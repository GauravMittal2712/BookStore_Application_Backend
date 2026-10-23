import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const listInventorySchema = z.object({
  query: z
    .object({
      // "true" (threshold 5) or a number (stock <= n)
      lowStock: z.string().regex(/^(true|\d+)$/, 'Use true or a whole number').optional(),
      q: z.string().trim().max(100).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    .strict(),
});

export const updateInventorySchema = z.object({
  params: z.object({ bookId: objectId }),
  body: z
    .object({
      stock: z.number().int().min(0).optional(),
      adjustBy: z.number().int().optional(),
      reason: z
        .enum(['manual', 'order', 'cancel', 'restock', 'correction'])
        .default('manual'),
    })
    .strict()
    // provide exactly one of stock / adjustBy
    .refine((d) => (d.stock !== undefined) !== (d.adjustBy !== undefined), {
      message: 'Provide exactly one of "stock" or "adjustBy"',
    }),
});
