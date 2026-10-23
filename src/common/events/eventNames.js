// Every event the app publishes. The RabbitMQ queue is bound to each of these, so events
// published while the worker is down are kept in the queue instead of being dropped.
export const EVENT_NAMES = [
  'user.registered',
  'order.placed',
  'order.status_changed',
  'order.cancelled',
  'stock.low',
  'review.changed',
];