import { AuditLog } from '../../modules/audit/auditLog.model.js';
import { logger } from '../logger.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const REDACT = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
]);

function summarizeBody(body) {
  if (!body || typeof body !== 'object') return undefined;
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (REDACT.has(k)) {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'string' && v.length > 200) {
      out[k] = `${v.slice(0, 200)}…`;
    } else {
      out[k] = v;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export function auditMiddleware(req, res, next) {
  if (!MUTATING.has(req.method)) return next();

  const started = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/health') || req.path.startsWith('/api/docs')) return;

    const doc = {
      actor: req.user?.id || undefined,
      role: req.user?.role,
      method: req.method,
      path: req.originalUrl?.split('?')[0] || req.path,
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 300),
      requestId: req.id,
      bodySummary: summarizeBody(req.body),
    };

    AuditLog.create(doc).catch((err) => {
      logger.warn(
        { err: err.message, path: doc.path, ms: Date.now() - started },
        'audit log write failed'
      );
    });
  });

  next();
}