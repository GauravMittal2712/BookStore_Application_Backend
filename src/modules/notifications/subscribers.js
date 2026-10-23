import { events } from '../../common/events/eventBus.js';
import { logger } from '../../common/logger.js';
import { env } from '../../config/env.js';
import { User } from '../users/user.model.js';
import { Order } from '../orders/order.model.js';

let transport = null;

async function getTransport() {
  if (transport) return transport;
  if (!env.SMTP_HOST) {
    logger.info('SMTP not configured – emails will be logged only');
    return null;
  }
  const nodemailer = await import('nodemailer');
  transport = nodemailer.default.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT || 587,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transport;
}

async function sendMail({ to, subject, text }) {
  const t = await getTransport();
  if (!t) {
    logger.info({ to, subject, text }, 'email (no SMTP)');
    return;
  }
  await t.sendMail({ from: env.EMAIL_FROM, to, subject, text });
}

export function registerSubscribers() {
  events.on('user.registered', async ({ userId }) => {
    const user = await User.findById(userId);
    if (!user) return;
    await sendMail({
      to: user.email,
      subject: 'Welcome to the Bookstore',
      text: `Hi ${user.name}, your account is ready. Happy reading!`,
    });
  });

  events.on('order.placed', async ({ orderId, userId }) => {
    const [user, order] = await Promise.all([
      User.findById(userId),
      Order.findById(orderId),
    ]);
    if (!user || !order) return;
    await sendMail({
      to: user.email,
      subject: `Order confirmed #${orderId.slice(-6)}`,
      text: `Hi ${user.name}, your order of ₹${(order.totalAmount / 100).toFixed(2)} has been placed and is pending processing.`,
    });
  });

    events.on('stock.low', async ({ bookId, stock, title }) => {
    logger.warn({ bookId, stock, title }, 'low stock alert');
    const admins = await User.find({ role: 'admin', isDeleted: false })
      .select('email name')
      .lean();
    if (!admins.length) return;
    const subject = `Low stock: ${title || bookId}`;
    const text = `Book "${title || bookId}" is low on stock (current: ${stock}). Please restock.`;
    await Promise.all(
      admins.map((a) =>
        sendMail({ to: a.email, subject, text }).catch((err) =>
          logger.warn({ err: err.message, to: a.email }, 'low-stock email failed')
        )
      )
    );
  });

  events.on('order.status_changed', async ({ orderId, userId, status }) => {
    if (!['shipped', 'delivered'].includes(status)) return;
    const user = await User.findById(userId);
    if (!user) return;
    await sendMail({
      to: user.email,
      subject: `Order ${status} #${orderId.slice(-6)}`,
      text: `Hi ${user.name}, your order status is now: ${status}.`,
    });
  });

  events.on('order.cancelled', async ({ orderId, userId }) => {
    const user = await User.findById(userId);
    if (!user) return;
    await sendMail({
      to: user.email,
      subject: `Order cancelled #${orderId.slice(-6)}`,
      text: `Hi ${user.name}, your order has been cancelled and stock has been restored.`,
    });
  });

  events.on('stock.low', async ({ bookId, stock, title }) => {
    logger.warn({ bookId, stock, title }, 'low stock alert');
  });

  events.on('review.changed', async ({ bookId, userId, action, reviewId }) => {
    logger.info({ bookId, userId, action, reviewId }, 'review changed');
  });

  logger.info('notification subscribers registered');
}
