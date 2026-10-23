import { AppError } from '../../common/errors/AppError.js';

const TRANSITIONS = {
  pending: { processing: ['admin'], cancelled: ['admin', 'owner'] },
  processing: { shipped: ['admin'], cancelled: ['admin'] },
  shipped: { delivered: ['admin'] },
  delivered: {},
  cancelled: {},
};

export function assertTransition(from, to, actorRole, isOwner) {
  const allowedActors = TRANSITIONS[from]?.[to];
  const permitted =
    allowedActors &&
    (allowedActors.includes(actorRole) ||
      (isOwner && allowedActors.includes('owner')));
  if (!permitted) {
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      `Cannot change order from ${from} to ${to}`
    );
  }
}
