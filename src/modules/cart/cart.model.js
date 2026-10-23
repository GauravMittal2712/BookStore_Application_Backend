import mongoose from 'mongoose';
import { jsonTransform } from '../../common/mongoosePlugins.js';

const cartItemSchema = new mongoose.Schema(
  {
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
      default: 1,
      validate: Number.isInteger,
    },
  },
  { timestamps: { createdAt: 'addedAt', updatedAt: false } }
);

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true }
);

cartSchema.plugin(jsonTransform);
export const Cart = mongoose.model('Cart', cartSchema);
