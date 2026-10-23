import { AppError } from '../errors/AppError.js';

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Missing bearer token'));
  }
  if (roles.length && !roles.includes(req.user.role)) {
    return next(new AppError(403, 'FORBIDDEN', 'You do not have permission'));
  }
  next();
};
