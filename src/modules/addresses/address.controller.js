import { asyncHandler } from '../../common/utils/asyncHandler.js';
import * as addressService from './address.service.js';

export const list = asyncHandler(async (req, res) => {
  const items = await addressService.list(req.user.id);
  res.json({ success: true, data: items });
});

export const create = asyncHandler(async (req, res) => {
  const address = await addressService.create(req.user.id, req.valid.body);
  res.status(201).json({ success: true, data: address });
});

export const update = asyncHandler(async (req, res) => {
  const address = await addressService.update(
    req.valid.params.addressId,
    req.user.id,
    req.valid.body
  );
  res.json({ success: true, data: address });
});

export const remove = asyncHandler(async (req, res) => {
  await addressService.remove(req.valid.params.addressId, req.user.id);
  res.status(204).end();
});

export const setDefault = asyncHandler(async (req, res) => {
  const address = await addressService.setDefault(
    req.valid.params.addressId,
    req.user.id
  );
  res.json({ success: true, data: address });
});
