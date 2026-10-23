import { AppError } from '../../common/errors/AppError.js';
import { WishlistItem } from './wishlist.model.js';
import { Book } from '../books/book.model.js';

export async function list(userId) {
  const items = await WishlistItem.find({ user: userId })
    .sort({ createdAt: -1 })
    .lean();

  if (!items.length) return [];

  const bookIds = items.map((i) => i.book);
  const books = await Book.find({
    _id: { $in: bookIds },
    isDeleted: false,
  }).lean();
  const bookMap = Object.fromEntries(books.map((b) => [b._id.toString(), b]));

  return items
    .map((item) => {
      const book = bookMap[item.book.toString()];
      if (!book) return null;
      return {
        id: item._id.toString(),
        book: {
          id: book._id.toString(),
          title: book.title,
          author: book.author,
          price: book.price,
          originalPrice: book.originalPrice,
          stock: book.stock,
          coverImageUrl: book.coverImageUrl,
          avgRating: book.avgRating,
        },
        createdAt: item.createdAt,
      };
    })
    .filter(Boolean);
}

export async function add(userId, bookId) {
  const book = await Book.findOne({ _id: bookId, isDeleted: false });
  if (!book) throw new AppError(404, 'BOOK_NOT_FOUND', 'Book not found');

  try {
    await WishlistItem.create({ user: userId, book: bookId });
  } catch (e) {
    if (e.code === 11000) {
      throw new AppError(409, 'ALREADY_IN_WISHLIST', 'Book already in wishlist');
    }
    throw e;
  }
}

export async function remove(userId, bookId) {
  const result = await WishlistItem.findOneAndDelete({ user: userId, book: bookId });
  if (!result) throw new AppError(404, 'NOT_FOUND', 'Book not in wishlist');
}
