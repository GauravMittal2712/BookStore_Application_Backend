import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const createPaymentSchema = z.object({
  body: z.object({ orderId: objectId }).strict(),
});

export const verifyPaymentSchema = z.object({
  body: z
    .object({
      razorpay_order_id: z.string().min(1).max(100),
      razorpay_payment_id: z.string().min(1).max(100),
      razorpay_signature: z.string().min(1).max(200),
    })
    .strict(),
});