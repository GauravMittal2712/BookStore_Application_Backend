import mongoose from 'mongoose';
import { jsonTransform } from '../../common/mongoosePlugins.js';

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 255 },
    author: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, maxlength: 4000 },
    isbn: { type: String, trim: true },
    category: { type: String, trim: true, maxlength: 80, index: true },
    price: { type: Number, required: true, min: 0, validate: Number.isInteger },
    originalPrice: { type: Number, min: 0, validate: Number.isInteger },
    currency: { type: String, default: 'INR', uppercase: true, maxlength: 3 },
    stock: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    coverImageUrl: String,
    publicationYear: { type: Number, min: 1000, max: 2100 },
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

bookSchema.index({ title: 'text', author: 'text', description: 'text' });
bookSchema.index({ category: 1, price: 1 });
bookSchema.index({ isbn: 1 }, { unique: true, sparse: true });

bookSchema.plugin(jsonTransform);
export const Book = mongoose.model('Book', bookSchema);
