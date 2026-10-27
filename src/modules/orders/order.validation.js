import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const placeOrderSchema = z.object({
  body: z
    .object({ addressId: objectId, paymentMethod: z.enum(['cod', 'online']).default('cod') })
    .strict(),
});

export const listOrdersSchema = z.object({
  query: z
    .object({
      status: z
        .enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
        .optional(),
      userId: objectId.optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    .strict(),
});

export const orderIdSchema = z.object({
  params: z.object({ orderId: objectId }),
});

export const changeStatusSchema = z.object({
  params: z.object({ orderId: objectId }),
  body: z
    .object({
      status: z.enum(['processing', 'shipped', 'delivered', 'cancelled']),
    })
    .strict(),
});
