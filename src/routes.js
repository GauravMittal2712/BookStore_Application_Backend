import { Router } from 'express';
import { authenticate } from './common/middleware/authenticate.js';
import { authorize } from './common/middleware/authorize.js';

import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import addressRoutes from './modules/addresses/address.routes.js';
import bookRoutes from './modules/books/book.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import cartRoutes from './modules/cart/cart.routes.js';
import orderRoutes from './modules/orders/order.routes.js';
import wishlistRoutes from './modules/wishlist/wishlist.routes.js';
import reviewRoutes from './modules/reviews/review.routes.js';
import paymentRoutes from './modules/payments/payment.routes.js';

const r = Router();

r.use('/auth', authRoutes);
r.use('/users', authenticate, userRoutes);
r.use('/addresses', authenticate, authorize('customer'), addressRoutes);
r.use('/books', bookRoutes);
r.use('/inventory', authenticate, authorize('admin', 'helper'), inventoryRoutes);
r.use('/cart', authenticate, authorize('customer'), cartRoutes);
r.use('/orders', authenticate, orderRoutes);
r.use('/wishlist', authenticate, authorize('customer'), wishlistRoutes);
r.use('/reviews', reviewRoutes);
r.use('/payments', authenticate, paymentRoutes);

export default r;
