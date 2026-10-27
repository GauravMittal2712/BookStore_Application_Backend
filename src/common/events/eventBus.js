import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../logger.js';
import * as rabbit from './rabbitmq.js';

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

  async start({ consume = true } = {}) {
    if (useRabbit) await rabbit.start({ consume });
  },

  async stop() {
    if (useRabbit) await rabbit.stop();
  },

  isHealthy: () => !useRabbit || rabbit.isConnected(),
};
