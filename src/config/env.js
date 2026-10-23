import { z } from 'zod';
import 'dotenv/config';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().default(7),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('Bookstore <no-reply@bookstore.local>'),
  LOG_LEVEL: z.string().default('info'),

  // Redis (optional). Unset -> no caching, rate-limit counters stay in memory.
  REDIS_URL: z.string().optional(),
  BOOK_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).default(120),

  // RabbitMQ (optional). Unset -> events stay in-process (old EventEmitter behaviour).
  RABBITMQ_URL: z.string().optional(),
  // false on the API when a separate `worker` container consumes the queue
  ENABLE_CONSUMERS: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  RABBITMQ_PREFETCH: z.coerce.number().int().min(1).default(10),
  EVENT_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  EVENT_RETRY_DELAY_MS: z.coerce.number().int().min(100).default(10000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('\nInvalid environment configuration. Copy .env.example to .env and fill it in:');
  for (const i of parsed.error.issues) console.error(`  - ${i.path.join('.')}: ${i.message}`);
  process.exit(1);
}
export const env = parsed.data;
