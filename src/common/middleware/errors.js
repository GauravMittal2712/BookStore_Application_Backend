import { AppError } from '../errors/AppError.js';
import { env } from '../../config/env.js';

export const notFound = (req, _res, next) =>
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));

// Single place that turns any error into the uniform error envelope.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong';
  let details;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'MALFORMED_JSON';
    message = 'Malformed JSON body';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body too large';
  } else if (err.name === 'CastError') {
    status = 404;
    code = 'NOT_FOUND';
    message = 'Resource not found';
  } else if (err.name === 'ValidationError') {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = err.message;
  } else if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE_KEY';
    message = 'Resource already exists';
  }

  if (status >= 500) {
    req.log?.error({ err }, 'unhandled error');
    // Development only: show the real reason in the browser so problems are easy to diagnose.
    if (env.NODE_ENV !== 'production' && !(err instanceof AppError)) {
      message = `Something went wrong (dev): ${err?.message || err}`;
    }
  }

  res.status(status).json({
    success: false,
    error: { code, message, details, requestId: req.id },
  });
}