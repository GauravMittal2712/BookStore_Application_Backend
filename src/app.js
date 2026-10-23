import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import hpp from 'hpp';
import { auditMiddleware } from './common/middleware/audit.js';
import mongoSanitize from 'express-mongo-sanitize';
import pinoHttp from 'pino-http';
import mongoose from 'mongoose';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { env } from './config/env.js';
import { logger } from './common/logger.js';
import { redisEnabled, redisReady } from './common/redis/redis.js';
import { events } from './common/events/eventBus.js';
import { requestId } from './common/middleware/requestId.js';
import { apiLimiter } from './common/middleware/rateLimit.js';
import { notFound, errorHandler } from './common/middleware/errors.js';
import routes from './routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const openApiDoc = YAML.parse(
  readFileSync(join(__dirname, '../docs/openapi.yaml'), 'utf8')
);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => req.id }));
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'validator.swagger.io'],
        },
      },
    })
  );
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());
  app.use(mongoSanitize());
  app.use(hpp());
  app.use('/api/v1', apiLimiter, auditMiddleware, routes);
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (_req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ status: 'not ready' });
      }
      await mongoose.connection.db.admin().ping();
      if (!events.isHealthy()) {
        return res.status(503).json({ status: 'not ready', rabbitmq: 'down' });
      }
      res.json({
        status: 'ready',
        redis: redisEnabled() ? (redisReady() ? 'up' : 'down') : 'disabled',
        rabbitmq: events.usesBroker ? 'up' : 'disabled',
      });
    } catch {
      res.status(503).json({ status: 'not ready' });
    }
  });

  // Interactive OpenAPI UI + raw spec
  app.get('/api/docs.json', (_req, res) => res.json(openApiDoc));
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDoc, {
      customSiteTitle: 'Bookstore API Docs',
      swaggerOptions: { persistAuthorization: true },
    })
  );

  app.use('/api/v1', apiLimiter, routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}