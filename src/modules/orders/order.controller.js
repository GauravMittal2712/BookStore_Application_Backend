import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { AppError } from '../../common/errors/AppError.js';
import * as orderService from './order.service.js';

export const place = asyncHandler(async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  if (idempotencyKey && idempotencyKey.length > 100) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Idempotency-Key is too long (max 100 characters)');
  }
  const { order, replayed } = await orderService.placeOrder(req.user.id, req.valid.body, idempotencyKey);

  res.status(replayed ? 200 : 201).json({ success: true, data: order });
});

export const list = asyncHandler(async (req, res) => {
  const result = await orderService.list(req.user, req.valid.query);
  res.json({ success: true, data: result.items, meta: result.meta });
});

export const getOne = asyncHandler(async (req, res) => {
  const order = await orderService.getById(req.valid.params.orderId, req.user);
  res.json({ success: true, data: order });
});

export const changeStatus = asyncHandler(async (req, res) => {
  const order = await orderService.changeStatus(
    req.valid.params.orderId,
    req.valid.body.status,
    req.user
  );
  res.json({ success: true, data: order });
});

export const cancel = asyncHandler(async (req, res) => {
  const order = await orderService.changeStatus(
    req.valid.params.orderId,
    'cancelled',
    req.user
  );
  res.json({ success: true, data: order });
});
