import { asyncHandler } from '../../common/utils/asyncHandler.js';
import * as wishlistService from './wishlist.service.js';
import { z } from 'zod';
import { validate } from '../../common/middleware/validate.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const addSchema = z.object({
  body: z.object({ bookId: objectId }).strict(),
});
export const bookIdParamSchema = z.object({
  params: z.object({ bookId: objectId }),
});

export const list = asyncHandler(async (req, res) => {
  const items = await wishlistService.list(req.user.id);
  res.json({ success: true, data: items });
});

export const add = asyncHandler(async (req, res) => {
  await wishlistService.add(req.user.id, req.valid.body.bookId);
  res.status(201).json({ success: true, data: { message: 'Added to wishlist' } });
});

export const remove = asyncHandler(async (req, res) => {
  await wishlistService.remove(req.user.id, req.valid.params.bookId);
  res.status(204).end();
});
