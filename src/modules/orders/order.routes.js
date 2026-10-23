import { Router } from 'express';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { orderLimiter } from '../../common/middleware/rateLimit.js';
import * as ctrl from './order.controller.js';
import {
  placeOrderSchema,
  listOrdersSchema,
  orderIdSchema,
  changeStatusSchema,
} from './order.validation.js';

const router = Router();

router.get('/', authorize('customer', 'admin'), validate(listOrdersSchema), ctrl.list);
router.get('/:orderId', authorize('customer', 'admin'), validate(orderIdSchema), ctrl.getOne);
router.post(
  '/',
  authorize('customer'),
  orderLimiter,
  validate(placeOrderSchema),
  ctrl.place
);
router.patch(
  '/:orderId/status',
  authorize('admin'),
  validate(changeStatusSchema),
  ctrl.changeStatus
);
router.patch('/:orderId/cancel', authorize('customer', 'admin'), validate(orderIdSchema), ctrl.cancel);

export default router;