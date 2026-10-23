import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const addressBody = z
  .object({
    street: z.string().trim().min(1).max(255),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    zipCode: z.string().trim().min(1).max(20),
    type: z.enum(['home', 'work', 'other']).optional(),
  })
  .strict();

export const createAddressSchema = z.object({ body: addressBody });
export const updateAddressSchema = z.object({
  params: z.object({ addressId: objectId }),
  body: addressBody.partial(),
});
export const addressIdSchema = z.object({
  params: z.object({ addressId: objectId }),
});
