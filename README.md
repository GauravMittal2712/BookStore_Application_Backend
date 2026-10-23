# Bookstore API - modular monolith backend (Node.js / Express / MongoDB)

Backend only. Follows the three design PDFs: JWT + rotating refresh tokens, role-based access
(`admin` / `customer` / `helper`), money as integer minor units (paise), soft delete, embedded
cart/order items, transactional order placement, uniform response envelope, Zod validation.

## Quick start

Requires Node.js 20+ (22 recommended) and Docker (for MongoDB).

```bash
npm install
cp .env.example .env          # then edit JWT_ACCESS_SECRET (32+ chars)
docker compose up -d mongo    # single-node MongoDB *replica set* (needed for transactions)
npm run seed                  # admin + helper + customer + 5 books (safe to re-run)
npm run dev                   # http://localhost:5000
```

Check it: `curl localhost:5000/health` and `curl localhost:5000/health/ready`.

| Role | Email | Password |
|------|-------|----------|
| admin | admin@bookstore.local | Admin123! |
| helper | helper@bookstore.local | Helper123! |
| customer | asha@example.com | Customer1! |

> **MongoDB must be a replica set.** Placing/cancelling orders and reviews use transactions; on a plain
> standalone `mongod` they fail with a 500. The server logs a warning at startup if it detects this.
> Using your own MongoDB: start it with `--replSet rs0`, run `rs.initiate()` once, and use
> `mongodb://127.0.0.1:27017/bookstore?directConnection=true` (or your Atlas URI).

Everything in containers: `docker compose up --build` (API :5000, RabbitMQ UI :15672).

## Redis & RabbitMQ

| Service | What it does here | If unset |
|---|---|---|
| **Redis** (`REDIS_URL`) | Cache for `GET /books` and `GET /books/:id` (TTL `BOOK_CACHE_TTL_SECONDS`, default 120s) and shared rate-limit counters | No cache, in-memory rate limits |
| **RabbitMQ** (`RABBITMQ_URL`) | Domain events (`order.placed`, `user.registered`, ...) are published to a durable topic exchange; the worker sends the emails | Events stay in-process (old behaviour) |

```bash
# local dev: infra in Docker, API on your machine
docker compose up -d mongo redis rabbitmq
npm run dev                  # API + consumer in one process (ENABLE_CONSUMERS=true)
# or run the consumer separately:  ENABLE_CONSUMERS=false npm run dev   +   npm run worker
```

**Cache invalidation:** every book/stock/rating write (admin edits, inventory changes, order placed/cancelled,
reviews) deletes the book's detail key and bumps a version counter that orphans all cached list pages.
If Redis is down the API simply reads MongoDB (fail-open).

**Event delivery:** publisher confirms + persistent messages. A failing handler is retried
`EVENT_MAX_RETRIES` times, `EVENT_RETRY_DELAY_MS` apart (via `bookstore.notifications.retry`), then parked in
`bookstore.notifications.dead` (visible in the management UI; use *Move messages* to replay). Redis remembers which
handlers already succeeded per `eventId`, so a redelivery never sends the same email twice.
`GET /health/ready` reports `redis` / `rabbitmq` status.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | start with auto-reload |
| `npm start` | start (production) |
| `npm run seed` | create demo users/books if missing; never deletes. Refuses `NODE_ENV=production` without `--force` |
| `npm test` | 19 tests, **no database needed** (errors, RBAC, validation, rate limits, order state machine) |

## API (base `/api/v1`)

| Area | Endpoints | Access |
|---|---|---|
| Auth | `POST /auth/register, /login, /refresh, /logout, /change-password` · `GET /auth/me` | public / cookie / auth |
| Users | `GET,POST /users` · `GET,PUT,DELETE /users/:id` | admin (PUT: admin or self) |
| Addresses | `GET,POST /addresses` · `PUT,DELETE /addresses/:id` · `PATCH /addresses/:id/default` | customer |
| Books | `GET /books` (q, author, category, minPrice, maxPrice, inStock, sort, page, limit) · `GET /books/:id` | public |
| | `POST /books` · `PUT,DELETE /books/:id` | admin |
| Inventory | `GET /inventory` · `PUT /inventory/:bookId` (`stock` **or** `adjustBy`) | admin, helper |
| Cart | `GET,DELETE /cart` · `POST /cart/items` · `PUT,DELETE /cart/items/:itemId` | customer |
| Orders | `GET /orders`, `GET /orders/:id` | customer (own) / admin (all) |
| | `POST /orders` (optional `Idempotency-Key`; replay returns 200) | customer |
| | `PATCH /orders/:id/status` | admin |
| | `PATCH /orders/:id/cancel` | customer (pending) / admin (until shipped) |
| Wishlist | `GET,POST /wishlist` · `DELETE /wishlist/:bookId` | customer |
| Reviews | `GET /reviews?bookId=` | public |
| | `POST /reviews` (needs a delivered order) · `PUT,DELETE /reviews/:id` | customer |

Success: `{ "success": true, "data": ..., "meta": { page, limit, total, totalPages } }`
Error: `{ "success": false, "error": { code, message, details?, requestId } }`

## Known limitations

- Full-text search (`GET /books?q=`), the review rating aggregate and order transactions need a **real
  MongoDB**. They are implemented as the PDFs describe but could not be exercised on the stand-in database
  used for review - run the flows once on your MongoDB.
- Access tokens stay valid until they expire (15 min) even after a user is deleted; refresh tokens are revoked immediately.
- Events are published after the MongoDB commit, not atomically with it: if the process dies in between, or RabbitMQ is
  unreachable at that moment, the event is lost (it is logged). A transactional outbox would close this gap.
- Without `REDIS_URL`, rate-limit counters live in memory (single instance only).
- `stock.low` events are only logged (no admin email yet). There is no Swagger/OpenAPI page yet.
- Some modules import another module's model directly (cart/inventory/wishlist -> books, etc.) instead of
  going through its service, which the architecture PDF asks to avoid.

## Changes made for the web UI
- `User.mobile` (optional): accepted by `POST /auth/register` and `PUT /users/:id`, returned by auth/users responses.
- `Address.type` (`home` | `work` | `other`, default `home`).
- `Book.originalPrice` (optional, paise): accepted on create/update, returned in book, cart and wishlist responses.
- `seed.js`: adds `originalPrice` to books and three sample books (one out of stock).
