import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import * as ctrl from './review.controller.js';
import {
  listReviewsSchema,
  createReviewSchema,
  updateReviewSchema,
  reviewIdSchema,
} from './review.validation.js';

const router = Router();

router.get('/', validate(listReviewsSchema), ctrl.list);
router.post(
  '/',
  authenticate,
  authorize('customer'),
  validate(createReviewSchema),
  ctrl.create
);
router.put(
  '/:reviewId',
  authenticate,
  authorize('customer'),
  validate(updateReviewSchema),
  ctrl.update
);
router.delete(
  '/:reviewId',
  authenticate,
  authorize('customer'),
  validate(reviewIdSchema),
  ctrl.remove
);

export default router;
