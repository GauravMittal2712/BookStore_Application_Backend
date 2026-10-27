
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { logger } from '../src/common/logger.js';

import '../src/modules/users/user.model.js';
import '../src/modules/auth/refreshToken.model.js';
import '../src/modules/addresses/address.model.js';
import '../src/modules/books/book.model.js';
import '../src/modules/cart/cart.model.js';
import '../src/modules/orders/order.model.js';
import '../src/modules/wishlist/wishlist.model.js';
import '../src/modules/reviews/review.model.js';
import '../src/modules/inventory/inventoryLog.model.js';
import '../src/modules/audit/auditLog.model.js';

const drop = process.argv.includes('--drop');

await mongoose.connect(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 10000 });
logger.info({ drop }, 'Connected – syncing indexes');

const names = mongoose.modelNames();
for (const name of names) {
  const model = mongoose.model(name);
  try {
    const result = drop ? await model.syncIndexes() : await model.createIndexes();
    logger.info({ model: name, result }, 'indexes ok');
  } catch (err) {
    logger.error({ model: name, err: err.message }, 'index sync failed');
    process.exitCode = 1;
  }
}

await mongoose.disconnect();
logger.info('Done');
process.exit(process.exitCode || 0);