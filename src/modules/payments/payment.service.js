import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/AppError.js';
import { logger } from '../../common/logger.js';
import { Order } from '../orders/order.model.js';

const API = 'https://api.razorpay.com/v1';

function assertConfigured() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError(503, 'PAYMENTS_UNAVAILABLE', 'Online payments are not configured');
  }
}

async function rzp(path, body) {
  assertConfigured();
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  let res;
  try {
    res = await fetch(API + path, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.error({ err }, 'razorpay unreachable');
    throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', 'Could not reach the payment gateway');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.error({ status: res.status, body: json }, 'razorpay error');
    throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', json?.error?.description || 'Payment gateway error');
  }
  return json;
}

const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');

export function safeEqual(a = '', b = '') {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}
export function checkoutSignature(rzpOrderId, rzpPaymentId, secret = env.RAZORPAY_KEY_SECRET) {
  return hmac(secret, `${rzpOrderId}|${rzpPaymentId}`);
}
export function webhookSignature(rawBody, secret = env.RAZORPAY_WEBHOOK_SECRET) {
  return hmac(secret, rawBody);
}

async function ownedOnlineOrder(orderId, userId) {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
  if (order.paymentMethod !== 'online') {
    throw new AppError(409, 'NOT_ONLINE_ORDER', 'This order is not an online-payment order');
  }
  return order;
}
export async function createPayment(orderId, userId) {
  const order = await ownedOnlineOrder(orderId, userId);
  if (order.paymentStatus === 'paid') throw new AppError(409, 'ALREADY_PAID', 'Order is already paid');
  if (order.status !== 'pending') {
    throw new AppError(409, 'ORDER_NOT_PAYABLE', `Cannot pay for an order that is ${order.status}`);
  }

  if (!order.payment?.razorpayOrderId) {
    const created = await rzp('/orders', {
      amount: order.totalAmount, // already in paise
      currency: order.currency || 'INR',
      receipt: order._id.toString(),
      notes: { orderId: order._id.toString(), userId: String(userId) },
    });
    order.payment = { ...(order.payment?.toObject?.() || {}), razorpayOrderId: created.id };
    await order.save();
  }

  return {
    keyId: env.RAZORPAY_KEY_ID,
    razorpayOrderId: order.payment.razorpayOrderId,
    amount: order.totalAmount,
    currency: order.currency || 'INR',
    orderId: order._id.toString(),
  };
}

async function refund(order) {
  const paymentId = order.payment?.razorpayPaymentId;
  if (!paymentId) return;
  try {
    const r = await rzp(`/payments/${paymentId}/refund`, {
      amount: order.totalAmount,
      notes: { orderId: order._id.toString() },
    });
    await Order.updateOne(
      { _id: order._id },
      { paymentStatus: 'refunded', 'payment.refundId': r.id }
    );
  } catch (err) {
    logger.error({ err, orderId: order._id.toString() }, 'refund failed – needs manual action');
    await Order.updateOne({ _id: order._id }, { paymentStatus: 'refund_failed' });
  }
}

export async function refundIfPaid(orderId) {
  const order = await Order.findById(orderId);
  if (order && order.paymentMethod === 'online' && order.paymentStatus === 'paid') await refund(order);
}

async function settlePaid(rzpOrderId, rzpPaymentId, amount) {
  const order = await Order.findOne({ 'payment.razorpayOrderId': rzpOrderId });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
  if (amount !== undefined && amount !== order.totalAmount) {
    logger.error({ orderId: order.id, amount }, 'paid amount does not match order total');
    throw new AppError(409, 'AMOUNT_MISMATCH', 'Paid amount does not match the order total');
  }
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: { $nin: ['paid', 'refunded', 'refund_failed'] } },
    {
      paymentStatus: 'paid',
      'payment.razorpayPaymentId': rzpPaymentId,
      'payment.paidAt': new Date(),
    },
    { new: true }
  );
  const result = updated || (await Order.findById(order._id));
  if (updated && updated.status === 'cancelled') await refund(updated);
  return result;
}
export async function verifyPayment(userId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  assertConfigured();
  const expected = checkoutSignature(razorpay_order_id, razorpay_payment_id);
  if (!safeEqual(expected, razorpay_signature)) {
    throw new AppError(400, 'INVALID_SIGNATURE', 'Payment verification failed');
  }
  const mine = await Order.exists({ 'payment.razorpayOrderId': razorpay_order_id, user: userId });
  if (!mine) throw new AppError(404, 'NOT_FOUND', 'Order not found');
  return settlePaid(razorpay_order_id, razorpay_payment_id);
}

export async function handleWebhook(rawBody, signature) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    throw new AppError(503, 'PAYMENTS_UNAVAILABLE', 'Webhook secret is not configured');
  }
  if (!signature || !safeEqual(webhookSignature(rawBody), signature)) {
    throw new AppError(400, 'INVALID_SIGNATURE', 'Bad webhook signature');
  }
  const event = JSON.parse(rawBody.toString('utf8'));
  const p = event?.payload?.payment?.entity;
  if (!p) return;

  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    await settlePaid(p.order_id, p.id, p.amount);
  } else if (event.event === 'payment.failed') {
    await Order.updateOne(
      { 'payment.razorpayOrderId': p.order_id, paymentStatus: 'unpaid' },
      { paymentStatus: 'failed' }
    );
  }
}