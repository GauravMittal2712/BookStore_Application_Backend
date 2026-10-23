import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import * as ctrl from './book.controller.js';
import {
  listBooksSchema,
  createBookSchema,
  updateBookSchema,
  bookIdSchema,
} from './book.validation.js';

const router = Router();

router.get('/', validate(listBooksSchema), ctrl.list);
router.get('/:bookId', validate(bookIdSchema), ctrl.getOne);
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate(createBookSchema),
  ctrl.create
);
router.put(
  '/:bookId',
  authenticate,
  authorize('admin'),
  validate(updateBookSchema),
  ctrl.update
);
router.delete(
  '/:bookId',
  authenticate,
  authorize('admin'),
  validate(bookIdSchema),
  ctrl.remove
);

export default router;
