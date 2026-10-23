import { asyncHandler } from '../../common/utils/asyncHandler.js';
import * as cartService from './cart.service.js';

export const get = asyncHandler(async (req, res) => {
  const cart = await cartService.getCart(req.user.id);
  res.json({ success: true, data: cart });
});

export const addItem = asyncHandler(async (req, res) => {
  const cart = await cartService.addItem(req.user.id, req.valid.body);
  res.status(201).json({ success: true, data: cart });
});

export const updateItem = asyncHandler(async (req, res) => {
  const cart = await cartService.updateItem(
    req.user.id,
    req.valid.params.itemId,
    req.valid.body.quantity
  );
  res.json({ success: true, data: cart });
});

export const removeItem = asyncHandler(async (req, res) => {
  const cart = await cartService.removeItem(req.user.id, req.valid.params.itemId);
  res.json({ success: true, data: cart });
});

export const clear = asyncHandler(async (req, res) => {
  await cartService.clear(req.user.id);
  res.status(204).end();
});
