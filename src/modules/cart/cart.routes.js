import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import * as ctrl from './cart.controller.js';
import {
  addCartItemSchema,
  updateCartItemSchema,
  cartItemIdSchema,
} from './cart.validation.js';

const router = Router();

router.get('/', ctrl.get);
router.post('/items', validate(addCartItemSchema), ctrl.addItem);
router.put('/items/:itemId', validate(updateCartItemSchema), ctrl.updateItem);
router.delete('/items/:itemId', validate(cartItemIdSchema), ctrl.removeItem);
router.delete('/', ctrl.clear);

export default router;
