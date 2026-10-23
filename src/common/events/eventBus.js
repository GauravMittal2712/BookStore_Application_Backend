import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../logger.js';
import * as rabbit from './rabbitmq.js';

// Same API as before (events.emit / events.on), so no service code had to change.
//   RABBITMQ_URL set   -> events go through RabbitMQ (durable, retried, consumable by a worker)
//   RABBITMQ_URL unset -> in-process EventEmitter (tests, quick local dev)
const useRabbit = !!env.RABBITMQ_URL;
const emitter = new EventEmitter();

export const events = {
  usesBroker: useRabbit,

  emit(name, payload) {
    const evt = { eventId: randomUUID(), occurredAt: new Date().toISOString(), ...payload };
    if (!useRabbit) {
      emitter.emit(name, evt);
      return;
    }
    // Fire-and-forget so a slow broker never slows the HTTP response.
    rabbit.publishEvent(name, evt).catch((err) =>
      logger.error({ err: err.message, event: name, evt }, 'FAILED to publish event')
    );
  },

  on(name, handler) {
    if (useRabbit) return rabbit.onEvent(name, handler);
    emitter.on(name, async (evt) => {
      try {
        await handler(evt);
      } catch (err) {
        logger.error({ err, event: name, eventId: evt.eventId }, 'event handler failed');
      }
    });
  },

  // consume=false -> publish only (API container when a separate worker does the consuming)
  async start({ consume = true } = {}) {
    if (useRabbit) await rabbit.start({ consume });
  },

  async stop() {
    if (useRabbit) await rabbit.stop();
  },

  isHealthy: () => !useRabbit || rabbit.isConnected(),
};
