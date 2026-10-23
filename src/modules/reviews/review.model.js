import mongoose from 'mongoose';
import { jsonTransform } from '../../common/mongoosePlugins.js';

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: Number.isInteger,
    },
    comment: { type: String, maxlength: 2000, trim: true },
    isVerifiedPurchase: { type: Boolean, default: true },
  },
  { timestamps: true }
);

reviewSchema.index({ user: 1, book: 1 }, { unique: true });
reviewSchema.index({ book: 1, createdAt: -1 });
reviewSchema.plugin(jsonTransform);

export const Review = mongoose.model('Review', reviewSchema);
