import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import * as ctrl from './address.controller.js';
import {
  createAddressSchema,
  updateAddressSchema,
  addressIdSchema,
} from './address.validation.js';

const router = Router();

router.get('/', ctrl.list);
router.post('/', validate(createAddressSchema), ctrl.create);
router.put('/:addressId', validate(updateAddressSchema), ctrl.update);
router.delete('/:addressId', validate(addressIdSchema), ctrl.remove);
router.patch('/:addressId/default', validate(addressIdSchema), ctrl.setDefault);

export default router;
