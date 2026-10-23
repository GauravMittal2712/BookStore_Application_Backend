import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import * as ctrl from './inventory.controller.js';
import { listInventorySchema, updateInventorySchema } from './inventory.validation.js';

const router = Router();

router.get('/', validate(listInventorySchema), ctrl.list);
router.put('/:bookId', validate(updateInventorySchema), ctrl.update);

export default router;
