import { AppError } from '../errors/AppError.js';

export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    return next(new AppError(422, 'VALIDATION_ERROR', 'Request validation failed', details));
  }
  req.valid = result.data;
  next();
};
