import { asyncHandler } from '../../common/utils/asyncHandler.js';
import * as userService from './user.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await userService.list(req.valid.query);
  res.json({ success: true, data: result.items, meta: result.meta });
});

export const create = asyncHandler(async (req, res) => {
  const user = await userService.create(req.valid.body);
  res.status(201).json({ success: true, data: user });
});

export const getOne = asyncHandler(async (req, res) => {
  const user = await userService.getById(req.valid.params.userId);
  res.json({ success: true, data: user });
});

export const update = asyncHandler(async (req, res) => {
  const user = await userService.update(
    req.valid.params.userId,
    req.valid.body,
    req.user
  );
  res.json({ success: true, data: user });
});

export const remove = asyncHandler(async (req, res) => {
  await userService.softDelete(req.valid.params.userId, req.user.id);
  res.status(204).end();
});
