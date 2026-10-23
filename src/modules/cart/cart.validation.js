import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const addCartItemSchema = z.object({
  body: z
    .object({
      bookId: objectId.transform((s) => s.toLowerCase()),
      quantity: z.number().int().min(1).max(20).default(1),
    })
    .strict(),
});

export const updateCartItemSchema = z.object({
  params: z.object({ itemId: objectId }),
  body: z
    .object({
      quantity: z.number().int().min(1).max(20),
    })
    .strict(),
});

export const cartItemIdSchema = z.object({
  params: z.object({ itemId: objectId }),
});
