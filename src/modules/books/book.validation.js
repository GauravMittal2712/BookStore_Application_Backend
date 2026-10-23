import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const listBooksSchema = z.object({
  query: z
    .object({
      q: z.string().trim().max(100).optional(),
      author: z.string().trim().optional(),
      category: z.string().trim().optional(),
      minPrice: z.coerce.number().int().min(0).optional(),
      maxPrice: z.coerce.number().int().min(0).optional(),
      inStock: z.enum(['true', 'false']).optional(),
      sort: z
        .enum(['price', '-price', 'title', '-createdAt', '-avgRating'])
        .default('-createdAt'),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    .strict(),
});

export const createBookSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(1).max(255),
      author: z.string().trim().min(1).max(150),
      price: z.number().int().min(0),
      originalPrice: z.number().int().min(0).optional(),
      stock: z.number().int().min(0).default(0),
      category: z.string().trim().max(80).optional(),
      isbn: z.string().trim().max(20).optional(),
      description: z.string().max(4000).optional(),
      coverImageUrl: z.string().url().optional().or(z.literal('')),
      publicationYear: z.number().int().min(1000).max(2100).optional(),
    })
    .strict(),
});

export const updateBookSchema = z.object({
  params: z.object({ bookId: objectId }),
  body: z
    .object({
      title: z.string().trim().min(1).max(255).optional(),
      author: z.string().trim().min(1).max(150).optional(),
      price: z.number().int().min(0).optional(),
      originalPrice: z.number().int().min(0).optional(),
      category: z.string().trim().max(80).optional(),
      isbn: z.string().trim().max(20).optional(),
      description: z.string().max(4000).optional(),
      coverImageUrl: z.string().url().optional().or(z.literal('')),
      publicationYear: z.number().int().min(1000).max(2100).optional(),
    })
    .strict(),
});

export const bookIdSchema = z.object({
  params: z.object({ bookId: objectId }),
});
