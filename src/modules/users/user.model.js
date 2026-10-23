import mongoose from 'mongoose';
import { jsonTransform } from '../../common/mongoosePlugins.js';

export const ROLES = ['customer', 'admin', 'helper'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 255,
      unique: true,
    },
    mobile: { type: String, trim: true, maxlength: 20 },
    // Optional for Google-only accounts
    passwordHash: { type: String, required: false, select: false },
    googleId: { type: String, sparse: true, unique: true, index: true },
    role: { type: String, enum: ROLES, default: 'customer', index: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.plugin(jsonTransform);
export const User = mongoose.model('User', userSchema);