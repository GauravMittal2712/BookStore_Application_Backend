import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must include an uppercase letter')
  .regex(/[a-z]/, 'Must include a lowercase letter')
  .regex(/[0-9]/, 'Must include a number');

export const registerSchema = {
  body: z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().email().max(255),
    password,
    mobile: z.string().trim().max(20).optional(),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().optional().default(''),
    newPassword: password,
  }),
};

export const googleSchema = {
  body: z.object({
    idToken: z.string().min(10),
  }),
};

export const forgotPasswordSchema = {
  body: z.object({
    email: z.string().email(),
  }),
};

export const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(10),
    password,
  }),
};