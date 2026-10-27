import amqp from 'amqplib';
import { env } from '../../config/env.js';
import { logger } from '../logger.js';
import { redis, redisReady } from '../redis/redis.js';
import { EVENT_NAMES } from './eventNames.js';

const EXCHANGE = 'bookstore.events';
const QUEUE = 'bookstore.notifications'; 
const RETRY_QUEUE = `${QUEUE}.retry`; 
const DEAD_QUEUE = `${QUEUE}.dead`; 

const handlers = new Map(); 

let connection = null;
let pubChannel = null;
let conChannel = null;
let consuming = false;
let stopping = false;
let reconnectTimer = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function onEvent(name, handler) {
  if (!handlers.has(name)) handlers.set(name, []);
  handlers.get(name).push(handler);
}

export const isConnected = () => !!connection && !!pubChannel;

async function assertTopology(ch) {
  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
  await ch.assertQueue(DEAD_QUEUE, { durable: true });
 
  await ch.assertQueue(RETRY_QUEUE, {
    durable: true,
    arguments: { 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': QUEUE },
  });
  await ch.assertQueue(QUEUE, { durable: true });
  for (const name of EVENT_NAMES) await ch.bindQueue(QUEUE, EXCHANGE, name);
}

async function openConnection() {
  const conn = await amqp.connect(env.RABBITMQ_URL, { heartbeat: 30 });
  conn.on('error', (err) => logger.warn({ err: err.message }, 'RabbitMQ connection error'));
  conn.on('close', () => {
    if (conn !== connection) return;
    connection = pubChannel = conChannel = null;
    if (stopping) return;
    logger.warn('RabbitMQ connection closed - reconnecting');
    scheduleReconnect();
  });

  let ch;
  try {
    ch = await conn.createConfirmChannel();
    ch.on('error', (err) => logger.warn({ err: err.message }, 'RabbitMQ publish channel error'));
    await assertTopology(ch);
  } catch (err) {
    conn.removeAllListeners('close');
    await conn.close().catch(() => {});
    throw err;
  }

  connection = conn;
  pubChannel = ch;
  if (consuming) await startConsumer();
}

function scheduleReconnect(attempt = 1) {
  if (reconnectTimer || stopping) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      await openConnection();
      logger.info('RabbitMQ reconnected');
    } catch (err) {
      logger.warn({ err: err.message, attempt }, 'RabbitMQ reconnect failed');
      scheduleReconnect(attempt + 1);
    }
  }, Math.min(attempt * 1000, 10000));
}

export async function start({ consume }) {
  stopping = false;
  consuming = consume;
  let lastErr;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await openConnection();
      logger.info({ consume }, 'RabbitMQ connected');
      return;
    } catch (err) {
      lastErr = err;
      logger.warn({ err: err.message, attempt }, 'RabbitMQ not ready, retrying in 2s');
      await sleep(2000);
    }
  }
  throw lastErr;
}

export async function stop() {
  stopping = true;
  clearTimeout(reconnectTimer);
  try {
    await conChannel?.close();
    await pubChannel?.close();
    await connection?.close();
  } catch {
    
  }
  connection = pubChannel = conChannel = null;
}

function publishRaw(exchange, routingKey, content, options) {
  return new Promise((resolve, reject) => {
    if (!pubChannel) return reject(new Error('RabbitMQ not connected'));
    pubChannel.publish(exchange, routingKey, content, { persistent: true, ...options }, (err) =>
      err ? reject(err) : resolve()
    );
  });
}

export async function publishEvent(name, evt) {
  await publishRaw(EXCHANGE, name, Buffer.from(JSON.stringify(evt)), {
    contentType: 'application/json',
    messageId: evt.eventId,
    type: name,
    timestamp: Date.now(),
  });
}



async function startConsumer() {
  conChannel = await connection.createChannel();
  conChannel.on('error', (err) => logger.warn({ err: err.message }, 'RabbitMQ consumer channel error'));
  await conChannel.prefetch(env.RABBITMQ_PREFETCH);
  await conChannel.consume(QUEUE, onMessage, { noAck: false });
  logger.info({ events: [...handlers.keys()] }, 'RabbitMQ consumer started');
}

const doneKey = (eventId, name, i) => `evt:done:${eventId}:${name}:${i}`;

async function runHandlers(name, evt) {
  const list = handlers.get(name) || [];
  for (let i = 0; i < list.length; i++) {
    const key = doneKey(evt.eventId, name, i);
    if (redisReady() && (await redis.exists(key).catch(() => 0))) continue;
    await list[i](evt);
    if (redisReady()) await redis.set(key, '1', 'EX', 86400).catch(() => {});
  }
}

async function onMessage(msg) {
  if (!msg) return; 
  const ch = conChannel;
  const name = msg.properties.type || msg.fields.routingKey;
  const retries = Number(msg.properties.headers?.['x-retry-count'] || 0);
  const meta = { event: name, messageId: msg.properties.messageId, retries };

  try {
    const evt = JSON.parse(msg.content.toString());
    await runHandlers(name, evt);
    ch.ack(msg);
  } catch (err) {
    logger.error({ err, ...meta }, 'event handling failed');
    try {
      if (retries < env.EVENT_MAX_RETRIES) {
        await publishRaw('', RETRY_QUEUE, msg.content, {
          contentType: 'application/json',
          messageId: msg.properties.messageId,
          type: name,
          expiration: String(env.EVENT_RETRY_DELAY_MS),
          headers: { 'x-retry-count': retries + 1 },
        });
      } else {
        logger.error(meta, 'event moved to dead-letter queue');
        await publishRaw('', DEAD_QUEUE, msg.content, {
          contentType: 'application/json',
          messageId: msg.properties.messageId,
          type: name,
          headers: { 'x-retry-count': retries, 'x-last-error': String(err.message).slice(0, 500) },
        });
      }
      ch.ack(msg);
    } catch (publishErr) {
      logger.error({ err: publishErr, ...meta }, 'could not re-queue failed event; requeueing original');
      ch.nack(msg, false, true);
    }
  }
}
