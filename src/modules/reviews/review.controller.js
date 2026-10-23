import { asyncHandler } from '../../common/utils/asyncHandler.js';
import * as reviewService from './review.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await reviewService.list(req.valid.query);
  res.json({ success: true, data: result.items, meta: result.meta });
});

export const create = asyncHandler(async (req, res) => {
  const review = await reviewService.create(req.user.id, req.valid.body);
  res.status(201).json({ success: true, data: review });
});

export const update = asyncHandler(async (req, res) => {
  const review = await reviewService.update(
    req.valid.params.reviewId,
    req.user.id,
    req.valid.body
  );
  res.json({ success: true, data: review });
});

export const remove = asyncHandler(async (req, res) => {
  await reviewService.remove(req.valid.params.reviewId, req.user.id);
  res.status(204).end();
});
