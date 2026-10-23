import mongoose from 'mongoose';

/**
 * Optional audit trail for mutating API calls (architecture §11).
 * Written asynchronously after the response so it never slows down the request path.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    role: { type: String },
    method: { type: String, required: true },
    path: { type: String, required: true },
    statusCode: { type: Number },
    ip: { type: String },
    userAgent: { type: String },
    requestId: { type: String, index: true },
    bodySummary: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ path: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);