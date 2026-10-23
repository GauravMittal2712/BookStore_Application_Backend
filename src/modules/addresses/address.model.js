import mongoose from 'mongoose';
import { jsonTransform } from '../../common/mongoosePlugins.js';

const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    street: { type: String, required: true, trim: true, maxlength: 255 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    state: { type: String, required: true, trim: true, maxlength: 100 },
    zipCode: { type: String, required: true, trim: true, maxlength: 20 },
    type: { type: String, enum: ['home', 'work', 'other'], default: 'home' },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

addressSchema.index(
  { user: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } }
);

addressSchema.plugin(jsonTransform);
export const Address = mongoose.model('Address', addressSchema);
