import { AppError } from '../../common/errors/AppError.js';
import { Cart } from './cart.model.js';
import { Book } from '../books/book.model.js';

async function buildCartResponse(cart) {
  if (!cart || !cart.items?.length) {
    return {
      id: cart?._id?.toString() || cart?.id || null,
      items: [],
      totalItems: 0,
      subtotal: 0,
      currency: 'INR',
    };
  }

  const bookIds = cart.items.map((i) => i.book);
  const books = await Book.find({
    _id: { $in: bookIds },
    isDeleted: false,
  }).lean();
  const bookMap = Object.fromEntries(books.map((b) => [b._id.toString(), b]));

  const items = [];
  let subtotal = 0;
  let totalItems = 0;

  for (const line of cart.items) {
    const book = bookMap[line.book.toString()];
    if (!book) continue; // drop deleted books
    const lineTotal = book.price * line.quantity;
    items.push({
      id: line._id.toString(),
      book: {
        id: book._id.toString(),
        title: book.title,
        author: book.author,
        price: book.price,
        originalPrice: book.originalPrice,
        stock: book.stock,
        coverImageUrl: book.coverImageUrl,
      },
      quantity: line.quantity,
      lineTotal,
    });
    subtotal += lineTotal;
    totalItems += line.quantity;
  }

  return {
    id: cart._id.toString(),
    items,
    totalItems,
    subtotal,
    currency: 'INR',
  };
}

export async function getCart(userId) {
  const cart = await Cart.findOne({ user: userId });
  return buildCartResponse(cart);
}
async function withRetry(fn, attempts = 4) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const retryable = e.name === 'VersionError' || e.code === 11000;
      if (!retryable || i >= attempts - 1) throw e;
    }
  }
}

export async function addItem(userId, { bookId, quantity }) {
  const book = await Book.findOne({ _id: bookId, isDeleted: false }).lean();
  if (!book) throw new AppError(404, 'BOOK_NOT_FOUND', 'Book not found');

  return withRetry(async () => {
    let cart = await Cart.findOne({ user: userId });
    if (!cart) cart = await Cart.create({ user: userId, items: [] });

    const existing = cart.items.find((i) => i.book.toString() === bookId);
    const newQty = (existing?.quantity ?? 0) + quantity;

    if (newQty > Math.min(book.stock, 20)) {
      throw new AppError(409, 'INSUFFICIENT_STOCK', 'Requested quantity is not available');
    }

    if (existing) existing.quantity = newQty;
    else cart.items.push({ book: bookId, quantity });
    await cart.save();
    return buildCartResponse(cart);
  });
}

export async function updateItem(userId, itemId, quantity) {
  return withRetry(async () => {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) throw new AppError(404, 'NOT_FOUND', 'Cart not found');

    const item = cart.items.id(itemId);
    if (!item) throw new AppError(404, 'NOT_FOUND', 'Cart item not found');

    const book = await Book.findOne({ _id: item.book, isDeleted: false }).lean();
    if (!book) throw new AppError(404, 'BOOK_NOT_FOUND', 'Book not found');
    if (quantity > Math.min(book.stock, 20)) {
      throw new AppError(409, 'INSUFFICIENT_STOCK', 'Requested quantity is not available');
    }

    item.quantity = quantity;
    await cart.save();
    return buildCartResponse(cart);
  });
}

export async function removeItem(userId, itemId) {
  return withRetry(async () => {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) throw new AppError(404, 'NOT_FOUND', 'Cart not found');

    const item = cart.items.id(itemId);
    if (!item) throw new AppError(404, 'NOT_FOUND', 'Cart item not found');

    item.deleteOne();
    await cart.save();
    return buildCartResponse(cart);
  });
}

export async function clear(userId, session) {
  const query = Cart.findOneAndUpdate(
    { user: userId },
    { $set: { items: [] } },
    { new: true }
  );
  if (session) query.session(session);
  await query;
}

export async function getCartForCheckout(userId, session) {
  const query = Cart.findOne({ user: userId });
  if (session) query.session(session);
  const cart = await query;
  if (!cart || !cart.items.length) {
    throw new AppError(400, 'CART_EMPTY', 'Your cart is empty');
  }
  return cart;
}
