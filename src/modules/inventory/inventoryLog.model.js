import mongoose from 'mongoose';

const inventoryLogSchema = new mongoose.Schema(
  {
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    before: Number,
    after: Number,
    delta: Number,
    reason: {
      type: String,
      enum: ['manual', 'order', 'cancel', 'restock', 'correction'],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

inventoryLogSchema.index({ book: 1, createdAt: -1 });

export const InventoryLog = mongoose.model('InventoryLog', inventoryLogSchema);
