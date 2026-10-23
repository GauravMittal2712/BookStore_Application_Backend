import { Router } from 'express';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import * as ctrl from './user.controller.js';
import {
  listUsersSchema,
  createUserSchema,
  updateUserSchema,
  userIdSchema,
} from './user.validation.js';

const router = Router();

router.get('/', authorize('admin'), validate(listUsersSchema), ctrl.list);
router.post('/', authorize('admin'), validate(createUserSchema), ctrl.create);
router.get('/:userId', authorize('admin'), validate(userIdSchema), ctrl.getOne);
router.put('/:userId', validate(updateUserSchema), ctrl.update);
router.delete('/:userId', authorize('admin'), validate(userIdSchema), ctrl.remove);

export default router;
