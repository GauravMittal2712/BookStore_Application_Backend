import mongoose from 'mongoose';
import { jsonTransform } from '../../common/mongoosePlugins.js';

const wishlistItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

wishlistItemSchema.index({ user: 1, book: 1 }, { unique: true });
wishlistItemSchema.plugin(jsonTransform);

export const WishlistItem = mongoose.model('WishlistItem', wishlistItemSchema);
