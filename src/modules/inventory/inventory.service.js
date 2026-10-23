import { AppError } from '../../common/errors/AppError.js';
import { Book } from '../books/book.model.js';
import { InventoryLog } from './inventoryLog.model.js';
import { events } from '../../common/events/eventBus.js';
import { invalidateBooks } from '../books/book.cache.js';
import { escapeRegex } from '../../common/utils/regex.js';

const LOW_STOCK_THRESHOLD = 5;

export async function list({ lowStock, q, page = 1, limit = 20 }) {
  const filter = { isDeleted: false };
  if (lowStock !== undefined) {
    // lowStock=true -> default threshold; lowStock=<n> -> stock <= n (0 means "out of stock only")
    const threshold = lowStock === 'true' ? LOW_STOCK_THRESHOLD : Number(lowStock);
    filter.stock = { $lte: threshold };
  }
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { author: rx }];
  }

  const [items, total] = await Promise.all([
    Book.find(filter)
      .select('title author stock price category')
      .sort({ stock: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Book.countDocuments(filter),
  ]);

  return {
    items: items.map((b) => ({
      bookId: b._id.toString(),
      title: b.title,
      author: b.author,
      stock: b.stock,
      price: b.price,
      category: b.category,
    })),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

// Atomic: a single findOneAndUpdate, so concurrent adjustments can never overwrite each other.
export async function updateStock(bookId, { stock, adjustBy, reason }, actorId) {
  const filter = { _id: bookId, isDeleted: false };
  let update;
  if (stock !== undefined) {
    update = { $set: { stock } };
  } else {
    if (adjustBy < 0) filter.stock = { $gte: -adjustBy }; // never below 0
    update = { $inc: { stock: adjustBy } };
  }

  const previous = await Book.findOneAndUpdate(filter, update, { new: false });
  if (!previous) {
    const exists = await Book.exists({ _id: bookId, isDeleted: false });
    if (!exists) throw new AppError(404, 'NOT_FOUND', 'Book not found');
    throw new AppError(409, 'NEGATIVE_STOCK', 'Stock cannot go below 0');
  }

  await invalidateBooks([bookId]);

  const before = previous.stock;
  const after = stock !== undefined ? stock : before + adjustBy;

  await InventoryLog.create({
    book: bookId,
    changedBy: actorId,
    before,
    after,
    delta: after - before,
    reason: reason || 'manual',
  });

  if (after <= LOW_STOCK_THRESHOLD) {
    events.emit('stock.low', { bookId, stock: after, title: previous.title });
  }

  return { bookId: previous.id, title: previous.title, before, stock: after };
}

// Conditional decrement prevents overselling under concurrency. Logged like every other change.
export async function reserveStock(bookId, qty, session, actorId) {
  const book = await Book.findOneAndUpdate(
    { _id: bookId, isDeleted: false, stock: { $gte: qty } },
    { $inc: { stock: -qty } },
    { new: true, session }
  );
  if (!book) {
    throw new AppError(409, 'INSUFFICIENT_STOCK', 'One or more books are out of stock');
  }
  await InventoryLog.create(
    [{ book: book._id, changedBy: actorId, before: book.stock + qty, after: book.stock, delta: -qty, reason: 'order' }],
    { session }
  );
  return book;
}

export async function restock(items, session, actorId) {
  for (const item of items) {
    const book = await Book.findOneAndUpdate(
      { _id: item.book },
      { $inc: { stock: item.quantity } },
      { new: true, session }
    );
    if (book) {
      await InventoryLog.create(
        [{ book: book._id, changedBy: actorId, before: book.stock - item.quantity, after: book.stock, delta: item.quantity, reason: 'cancel' }],
        { session }
      );
    }
  }
}
