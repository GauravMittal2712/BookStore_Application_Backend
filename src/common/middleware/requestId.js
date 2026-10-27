import { randomUUID } from 'node:crypto';

const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/;

export function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.id = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
