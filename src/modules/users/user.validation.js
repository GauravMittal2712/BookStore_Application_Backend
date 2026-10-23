import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const listUsersSchema = z.object({
  query: z
    .object({
      role: z.enum(['customer', 'admin', 'helper']).optional(),
      q: z.string().trim().max(100).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
      sort: z.enum(['-createdAt', 'createdAt', 'name', '-name', 'email', '-email']).default('-createdAt'),
    })
    .strict(),
});

export const createUserSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).max(100),
      email: z.string().trim().toLowerCase().email().max(255),
      password: z
        .string()
        .min(8)
        .max(72)
        .regex(/[a-z]/, 'Needs a lowercase letter')
        .regex(/[A-Z]/, 'Needs an uppercase letter')
        .regex(/\d/, 'Needs a digit'),
      role: z.enum(['customer', 'admin', 'helper']).default('customer'),
    })
    .strict(),
});

export const updateUserSchema = z.object({
  params: z.object({ userId: objectId }),
  body: z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      email: z.string().trim().toLowerCase().email().max(255).optional(),
      mobile: z.string().trim().regex(/^\+?[0-9][0-9\s-]{6,18}$/, 'Enter a valid mobile number').optional(),
      role: z.enum(['customer', 'admin', 'helper']).optional(),
    })
    .strict(),
});

export const userIdSchema = z.object({
  params: z.object({ userId: objectId }),
});
