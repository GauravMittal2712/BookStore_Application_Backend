import { asyncHandler } from '../../common/utils/asyncHandler.js';
import * as paymentService from './payment.service.js';

export const create = asyncHandler(async (req, res) => {
  const data = await paymentService.createPayment(req.valid.body.orderId, req.user.id);
  res.json({ success: true, data });
});

export const verify = asyncHandler(async (req, res) => {
  const order = await paymentService.verifyPayment(req.user.id, req.valid.body);
  res.json({ success: true, data: { orderId: order.id, paymentStatus: order.paymentStatus } });
});

export const webhook = asyncHandler(async (req, res) => {
  await paymentService.handleWebhook(req.body, req.headers['x-razorpay-signature']);
  res.json({ received: true });
});