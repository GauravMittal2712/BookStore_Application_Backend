import { Router } from 'express';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import { orderLimiter } from '../../common/middleware/rateLimit.js';
import * as ctrl from './payment.controller.js';
import { createPaymentSchema, verifyPaymentSchema } from './payment.validation.js';

const router = Router();

router.post('/create', authorize('customer'), orderLimiter, validate(createPaymentSchema), ctrl.create);
router.post('/verify', authorize('customer'), validate(verifyPaymentSchema), ctrl.verify);

export default router;