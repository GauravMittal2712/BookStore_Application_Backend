import { AppError } from '../../common/errors/AppError.js';
import { Book } from './book.model.js';
import { cachedList, cachedDetail, invalidateBooks } from './book.cache.js';

function toBook(doc) {
  if (!doc) return null;
  return {
    id: doc._id?.toString() || doc.id,
    title: doc.title,
    author: doc.author,
    description: doc.description,
    isbn: doc.isbn,
    category: doc.category,
    price: doc.price,
    originalPrice: doc.originalPrice,
    currency: doc.currency || 'INR',
    stock: doc.stock,
    coverImageUrl: doc.coverImageUrl,
    publicationYear: doc.publicationYear,
    avgRating: doc.avgRating,
    ratingCount: doc.ratingCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function search(q) {
  return cachedList(q, () => searchInDb(q));
}

async function searchInDb(q) {
  const filter = { isDeleted: false };
  if (q.q) filter.$text = { $search: q.q };
  if (q.author) filter.author = new RegExp(`^${q.author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (q.category) filter.category = q.category;
  if (q.inStock === 'true') filter.stock = { $gt: 0 };
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.price = {};
    if (q.minPrice !== undefined) filter.price.$gte = q.minPrice;
    if (q.maxPrice !== undefined) filter.price.$lte = q.maxPrice;
  }

  const sortField = q.sort.replace(/^-/, '');
  const sortObj = { [sortField]: q.sort.startsWith('-') ? -1 : 1 };

  const [items, total] = await Promise.all([
    Book.find(filter)
      .sort(sortObj)
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    Book.countDocuments(filter),
  ]);

  return {
    items: items.map(toBook),
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.ceil(total / q.limit) || 1,
    },
  };
}

export function getById(bookId) {
  return cachedDetail(bookId, async () => {
    const book = await Book.findOne({ _id: bookId, isDeleted: false }).lean();
    if (!book) throw new AppError(404, 'NOT_FOUND', 'Book not found');
    return toBook(book);
  });
}

export async function create(data) {
  const book = await Book.create(data);
  await invalidateBooks([book._id]);
  return toBook(book.toObject());
}

export async function update(bookId, data) {
  const book = await Book.findOneAndUpdate(
    { _id: bookId, isDeleted: false },
    { $set: data },
    { new: true }
  ).lean();
  if (!book) throw new AppError(404, 'NOT_FOUND', 'Book not found');
  await invalidateBooks([bookId]);
  return toBook(book);
}

export async function softDelete(bookId) {
  const book = await Book.findOneAndUpdate(
    { _id: bookId, isDeleted: false },
    { $set: { isDeleted: true } }
  );
  if (!book) throw new AppError(404, 'NOT_FOUND', 'Book not found');
  await invalidateBooks([bookId]);
}

export async function getActiveBooks(ids) {
  return Book.find({ _id: { $in: ids }, isDeleted: false }).lean();
}

export async function applyRatingSummary(bookId, avg, count) {
  await Book.updateOne(
    { _id: bookId },
    { avgRating: avg, ratingCount: count }
  );
  await invalidateBooks([bookId]);
}
