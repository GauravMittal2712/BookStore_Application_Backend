import mongoose from 'mongoose';
import { jsonTransform } from '../../common/mongoosePlugins.js';

export const PAYMENT_METHODS = ['cod', 'online'];
export const PAYMENT_STATUSES = ['unpaid', 'paid', 'failed', 'refunded', 'refund_failed'];
export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const orderItemSchema = new mongoose.Schema(
  {
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    title: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [orderItemSchema],
      validate: (v) => v.length > 0,
    },
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
    },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'pending',
      index: true,
    },
    statusHistory: [
      {
        status: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'cod' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'unpaid' },
    payment: {
      razorpayOrderId: { type: String, index: true, sparse: true },
      razorpayPaymentId: String,
      paidAt: Date,
      refundId: String,
    },
    idempotencyKey: { type: String },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index(
  { user: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

orderSchema.plugin(jsonTransform);
export const Order = mongoose.model('Order', orderSchema);