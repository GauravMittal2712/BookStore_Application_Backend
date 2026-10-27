import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().default(7),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.string().default('info'),
  REDIS_URL: z.string().optional(),
  BOOK_CACHE_TTL_SECONDS: z.coerce.number().default(120),
  RABBITMQ_URL: z.string().optional(),
  ENABLE_CONSUMERS: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  RABBITMQ_PREFETCH: z.coerce.number().default(10),
  EVENT_MAX_RETRIES: z.coerce.number().default(3),
  EVENT_RETRY_DELAY_MS: z.coerce.number().default(10000),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('Bookstore <noreply@bookstore.local>'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;