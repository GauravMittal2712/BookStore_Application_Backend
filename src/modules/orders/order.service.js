import mongoose from 'mongoose';
import { AppError } from '../../common/errors/AppError.js';
import { events } from '../../common/events/eventBus.js';
import { Order } from './order.model.js';
import { assertTransition } from './order.rules.js';
import * as cartService from '../cart/cart.service.js';
import * as addressService from '../addresses/address.service.js';
import * as inventoryService from '../inventory/inventory.service.js';
import { invalidateBooks } from '../books/book.cache.js';

function toOrder(doc) {
  if (!doc) return null;
  return {
    id: doc._id?.toString() || doc.id,
    status: doc.status,
    items: doc.items.map((i) => ({
      book: i.book?.toString?.() || i.book,
      title: i.title,
      price: i.price,
      quantity: i.quantity,
    })),
    shippingAddress: doc.shippingAddress,
    totalAmount: doc.totalAmount,
    currency: doc.currency || 'INR',
    statusHistory: (doc.statusHistory || []).map((h) => ({
      status: h.status,
      changedBy: h.changedBy?.toString?.() || h.changedBy,
      at: h.at,
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function placeOrder(userId, { addressId }, idempotencyKey) {
  const replay = async () => {
    const existing = await Order.findOne({ user: userId, idempotencyKey });
    return existing ? { order: toOrder(existing.toObject()), replayed: true } : null;
  };

  if (idempotencyKey) {
    const hit = await replay();
    if (hit) return hit;
  }

  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      const cart = await cartService.getCartForCheckout(userId, session);
      const address = await addressService.getOwnedAddress(addressId, userId, session);

      const items = [];
      for (const line of cart.items) {
        const book = await inventoryService.reserveStock(line.book, line.quantity, session, userId);
        items.push({
          book: book._id,
          title: book.title,
          price: book.price,
          quantity: line.quantity,
        });
      }

      const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

      const [created] = await Order.create(
        [
          {
            user: userId,
            items,
            totalAmount,
            currency: 'INR',
            idempotencyKey: idempotencyKey || undefined,
            shippingAddress: {
              street: address.street,
              city: address.city,
              state: address.state,
              zipCode: address.zipCode,
            },
            status: 'pending',
            statusHistory: [{ status: 'pending', changedBy: userId }],
          },
        ],
        { session }
      );
      order = created;
      await cartService.clear(userId, session);
    });
  } catch (err) {
    // two simultaneous submits with the same key: the loser gets the winner's order
    if (err.code === 11000 && idempotencyKey) {
      const hit = await replay();
      if (hit) return hit;
    }
    throw err;
  } finally {
    await session.endSession();
  }

  await invalidateBooks(order.items.map((i) => i.book.toString())); // stock changed
  events.emit('order.placed', { orderId: order.id || order._id.toString(), userId });
  return { order: toOrder(order.toObject()), replayed: false };
}

export async function list(actor, query) {
  const filter = {};
  if (actor.role === 'customer') {
    filter.user = actor.id;
  } else if (query.userId) {
    filter.user = query.userId;
  }
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return {
    items: items.map(toOrder),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    },
  };
}

export async function getById(orderId, actor) {
  const order = await Order.findById(orderId).lean();
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');

  if (actor.role === 'customer' && order.user.toString() !== actor.id) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found');
  }
  return toOrder(order);
}

export async function changeStatus(orderId, to, actor) {
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await Order.findById(orderId).session(session);
      if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');

      const isOwner = order.user.toString() === actor.id;
      if (actor.role === 'customer' && !isOwner) {
        throw new AppError(404, 'NOT_FOUND', 'Order not found');
      }

      assertTransition(order.status, to, actor.role, isOwner);

      if (to === 'cancelled') {
        await inventoryService.restock(order.items, session, actor.id);
      }

      order.status = to;
      order.statusHistory.push({ status: to, changedBy: actor.id });
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }

  if (to === 'cancelled') await invalidateBooks(order.items.map((i) => i.book.toString())); // stock restored
  events.emit(to === 'cancelled' ? 'order.cancelled' : 'order.status_changed', {
    orderId: order.id || order._id.toString(),
    userId: order.user.toString(),
    status: to,
  });
  return toOrder(order.toObject());
}

export async function hasDeliveredPurchase(userId, bookId) {
  const order = await Order.findOne({
    user: userId,
    status: 'delivered',
    'items.book': bookId,
  }).lean();
  return !!order;
}
