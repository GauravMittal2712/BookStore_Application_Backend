import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AppError } from '../errors/AppError.js';

export function authenticate(req, _res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Missing bearer token'));
  }
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: 'bookstore-api',
    });
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new AppError(401, 'TOKEN_INVALID', 'Invalid or expired token'));
  }
}

export function optionalAuth(req, _res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        algorithms: ['HS256'],
        issuer: 'bookstore-api',
      });
      req.user = { id: payload.sub, role: payload.role };
    } catch {
     
    }
  }
  next();
}
