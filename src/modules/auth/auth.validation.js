import { z } from 'zod';

export const registerSchema = z.object({
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
      mobile: z.string().trim().regex(/^\+?[0-9][0-9\s-]{6,18}$/, 'Enter a valid mobile number').optional(),
    })
    .strict(),
});

export const loginSchema = z.object({
  body: z
    .object({
      email: z.string().trim().toLowerCase().email(),
      password: z.string().min(1),
    })
    .strict(),
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1),
      newPassword: z
        .string()
        .min(8)
        .max(72)
        .regex(/[a-z]/, 'Needs a lowercase letter')
        .regex(/[A-Z]/, 'Needs an uppercase letter')
        .regex(/\d/, 'Needs a digit'),
    })
    .strict(),
});
