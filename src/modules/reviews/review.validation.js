import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const listReviewsSchema = z.object({
  query: z
    .object({
      bookId: objectId,
      rating: z.coerce.number().int().min(1).max(5).optional(),
      sort: z.enum(['-createdAt', 'createdAt', '-rating', 'rating']).default('-createdAt'),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    .strict(),
});

export const createReviewSchema = z.object({
  body: z
    .object({
      bookId: objectId,
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(2000).optional(),
    })
    .strict(),
});

export const updateReviewSchema = z.object({
  params: z.object({ reviewId: objectId }),
  body: z
    .object({
      rating: z.number().int().min(1).max(5).optional(),
      comment: z.string().max(2000).optional(),
    })
    .strict(),
});

export const reviewIdSchema = z.object({
  params: z.object({ reviewId: objectId }),
});
