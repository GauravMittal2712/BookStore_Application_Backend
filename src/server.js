import mongoose from 'mongoose';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './common/logger.js';
import { connectRedis, closeRedis } from './common/redis/redis.js';
import { events } from './common/events/eventBus.js';
import { registerSubscribers } from './modules/notifications/subscribers.js';

try {
  mongoose.set('autoIndex', env.NODE_ENV !== 'production');
  await mongoose.connect(env.MONGODB_URI, { maxPoolSize: 20, serverSelectionTimeoutMS: 5000 });
} catch (err) {
  logger.fatal({ err }, 'Could not connect to MongoDB. Is it running and is MONGODB_URI correct?');
  process.exit(1);
}
logger.info('MongoDB connected');
try {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName) {
    logger.warn('MongoDB is NOT a replica set: placing/cancelling orders and reviews will fail (transactions). See README.');
  }
} catch {
  /* ignore */
}

await connectRedis(); // optional: logs and continues if Redis is unreachable

// In-process events (no RabbitMQ) need handlers here. With RabbitMQ, handlers only run in a
// process that consumes: this one if ENABLE_CONSUMERS=true, otherwise the `worker`.
const consume = !events.usesBroker || env.ENABLE_CONSUMERS;
if (consume) registerSubscribers();
try {
  await events.start({ consume });
} catch (err) {
  logger.fatal({ err }, 'Could not connect to RabbitMQ. Is it running and is RABBITMQ_URL correct?');
  process.exit(1);
}

const server = createApp().listen(env.PORT, () =>
  logger.info(`API listening on port ${env.PORT}`)
);

const shutdown = async (signal) => {
  logger.info(`${signal} received, shutting down`);
  setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => {
    await events.stop();
    await closeRedis();
    await mongoose.disconnect();
    process.exit(0);
  });
};

['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, () => shutdown(sig)));
