import mongoose from 'mongoose';
import { env } from './config/env.js';
import { logger } from './common/logger.js';
import { connectRedis, closeRedis } from './common/redis/redis.js';
import { events } from './common/events/eventBus.js';
import { registerSubscribers } from './modules/notifications/subscribers.js';

if (!events.usesBroker) {
  logger.fatal('RABBITMQ_URL is not set - nothing for the worker to consume.');
  process.exit(1);
}

try {
  await mongoose.connect(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 });
} catch (err) {
  logger.fatal({ err }, 'Worker could not connect to MongoDB');
  process.exit(1);
}
await connectRedis();

registerSubscribers();
try {
  await events.start({ consume: true });
} catch (err) {
  logger.fatal({ err }, 'Worker could not connect to RabbitMQ');
  process.exit(1);
}
logger.info('Worker running');

const shutdown = async (signal) => {
  logger.info(`${signal} received, worker shutting down`);
  setTimeout(() => process.exit(1), 10000).unref();
  await events.stop();
  await closeRedis();
  await mongoose.disconnect();
  process.exit(0);
};
['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, () => shutdown(sig)));
