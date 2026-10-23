import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { authLimiter } from '../../common/middleware/rateLimit.js';
import * as ctrl from './auth.controller.js';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
} from './auth.validation.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), ctrl.register);
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
router.post('/refresh', authLimiter, ctrl.refresh);
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  ctrl.changePassword
);

export default router;
