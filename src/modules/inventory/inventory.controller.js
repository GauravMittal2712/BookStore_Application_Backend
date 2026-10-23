import { asyncHandler } from '../../common/utils/asyncHandler.js';
import * as inventoryService from './inventory.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await inventoryService.list(req.valid.query);
  res.json({ success: true, data: result.items, meta: result.meta });
});

export const update = asyncHandler(async (req, res) => {
  const result = await inventoryService.updateStock(
    req.valid.params.bookId,
    req.valid.body,
    req.user.id
  );
  res.json({ success: true, data: result });
});
