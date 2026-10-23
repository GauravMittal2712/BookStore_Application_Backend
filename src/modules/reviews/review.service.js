import mongoose from 'mongoose';
import { AppError } from '../../common/errors/AppError.js';
import { events } from '../../common/events/eventBus.js';
import { Review } from './review.model.js';
import { Book } from '../books/book.model.js';
import * as orderService from '../orders/order.service.js';
import { invalidateBooks } from '../books/book.cache.js';

/**
 * Recompute avgRating / ratingCount for a book.
 * When `session` is provided, runs inside the caller's MongoDB transaction.
 */
async function recomputeSummary(bookId, session = null) {
  const matchId =
    bookId instanceof mongoose.Types.ObjectId
      ? bookId
      : new mongoose.Types.ObjectId(String(bookId));

  let aggQuery = Review.aggregate([
    { $match: { book: matchId } },
    { $group: { _id: '$book', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  if (session) aggQuery = aggQuery.session(session);

  const [agg] = await aggQuery;
  const update = {
    avgRating: agg ? Math.round(agg.avg * 10) / 10 : 0,
    ratingCount: agg?.count ?? 0,
  };
  const opts = session ? { session } : {};
  await Book.updateOne({ _id: matchId }, update, opts);
}

function toReview(doc) {
  return {
    id: doc._id?.toString() || doc.id,
    book: doc.book?.toString?.() || doc.book,
    user: doc.user?.name
      ? { id: doc.user._id?.toString() || doc.user.id, name: doc.user.name }
      : doc.user?.toString?.() || doc.user,
    rating: doc.rating,
    comment: doc.comment,
    isVerifiedPurchase: doc.isVerifiedPurchase,
    createdAt: doc.createdAt,
  };
}

export async function list({ bookId, rating, page = 1, limit = 20, sort = '-createdAt' }) {
  if (!bookId) throw new AppError(422, 'VALIDATION_ERROR', 'bookId is required');

  const filter = { book: bookId };
  if (rating) filter.rating = Number(rating);

  const sortField = sort.replace(/^-/, '');
  const sortObj = { [sortField]: sort.startsWith('-') ? -1 : 1 };

  const [items, total] = await Promise.all([
    Review.find(filter)
      .populate('user', 'name')
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
  ]);

  return {
    items: items.map(toReview),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function create(userId, { bookId, rating, comment }) {
  const book = await Book.findOne({ _id: bookId, isDeleted: false });
  if (!book) throw new AppError(404, 'BOOK_NOT_FOUND', 'Book not found');

  if (!(await orderService.hasDeliveredPurchase(userId, bookId))) {
    throw new AppError(
      403,
      'REVIEW_NOT_ALLOWED',
      'Only buyers of a delivered order can review this book'
    );
  }

  const session = await mongoose.startSession();
  let reviewId;
  try {
    await session.withTransaction(async () => {
      try {
        const [review] = await Review.create(
          [
            {
              user: userId,
              book: bookId,
              rating,
              comment,
              isVerifiedPurchase: true,
            },
          ],
          { session }
        );
        reviewId = review._id;
        await recomputeSummary(bookId, session);
      } catch (e) {
        if (e.code === 11000) {
          throw new AppError(409, 'REVIEW_EXISTS', 'You have already reviewed this book');
        }
        throw e;
      }
    });
  } finally {
    await session.endSession();
  }

  await invalidateBooks([bookId]);
  events.emit('review.changed', {
    bookId: String(bookId),
    userId: String(userId),
    action: 'created',
    reviewId: String(reviewId),
  });

  const populated = await Review.findById(reviewId).populate('user', 'name').lean();
  return toReview(populated);
}

export async function update(reviewId, userId, data) {
  const session = await mongoose.startSession();
  let bookId;
  try {
    await session.withTransaction(async () => {
      const review = await Review.findOne({ _id: reviewId, user: userId }).session(session);
      if (!review) throw new AppError(404, 'NOT_FOUND', 'Review not found');

      if (data.rating !== undefined) review.rating = data.rating;
      if (data.comment !== undefined) review.comment = data.comment;
      await review.save({ session });
      bookId = review.book.toString();
      await recomputeSummary(bookId, session);
    });
  } finally {
    await session.endSession();
  }

  await invalidateBooks([bookId]);
  events.emit('review.changed', {
    bookId: String(bookId),
    userId: String(userId),
    action: 'updated',
    reviewId: String(reviewId),
  });

  const populated = await Review.findById(reviewId).populate('user', 'name').lean();
  return toReview(populated);
}

export async function remove(reviewId, userId) {
  const session = await mongoose.startSession();
  let bookId;
  try {
    await session.withTransaction(async () => {
      const review = await Review.findOneAndDelete(
        { _id: reviewId, user: userId },
        { session }
      );
      if (!review) throw new AppError(404, 'NOT_FOUND', 'Review not found');
      bookId = review.book.toString();
      await recomputeSummary(bookId, session);
    });
  } finally {
    await session.endSession();
  }

  await invalidateBooks([bookId]);
  events.emit('review.changed', {
    bookId: String(bookId),
    userId: String(userId),
    action: 'deleted',
    reviewId: String(reviewId),
  });
}