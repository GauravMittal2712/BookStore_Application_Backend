import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import * as ctrl from './wishlist.controller.js';
import { addSchema, bookIdParamSchema } from './wishlist.controller.js';

const router = Router();

router.get('/', ctrl.list);
router.post('/', validate(addSchema), ctrl.add);
router.delete('/:bookId', validate(bookIdParamSchema), ctrl.remove);

export default router;
