# Bookstore Backend API

A modular Node.js backend for an online bookstore. It provides REST APIs for authentication, book browsing, inventory, cart, orders, addresses, wishlist, reviews, users, and payments.

## Technology Stack

- **Node.js 20+** and **Express.js** — REST API and server
- **MongoDB** with **Mongoose** — data persistence
- **JWT** — access-token authentication; refresh-token handling
- **bcrypt** — password hashing
- **Zod** — request validation
- **Redis** (`ioredis`) — book caching and shared rate-limit counters
- **RabbitMQ** (`amqplib`) — asynchronous domain events and notification processing
- **Nodemailer** — email delivery
- **Razorpay** — optional payment integration
- **Helmet, CORS, express-rate-limit, express-mongo-sanitize, HPP** — security and request protection
- **Pino / pino-http** — logging
- **Jest and Supertest** — automated tests
- **Docker Compose** — local infrastructure

## Features

- Registration, login, logout, refresh tokens, and password-change flows
- Role-based access control for `admin`, `helper`, and `customer`
- Book listing, searching, filtering, sorting, pagination, and book details
- Admin book management and inventory updates
- Cart, addresses, checkout, order history, and order status management
- Wishlist and customer reviews
- Optional Razorpay payment configuration; cash on delivery can be used when payment settings are not configured
- Redis caching for book reads, with cache invalidation after relevant writes
- RabbitMQ-backed events and background email/notification processing, with retry and dead-letter handling
- Centralized validation, error responses, request IDs, logging, and rate limiting
- OpenAPI specification at `docs/openapi.yaml`
- Automated unit and API tests

## Project Structure

```text
bookstore-backend/
├── docs/                 # OpenAPI specification
├── scripts/              # Database/index maintenance scripts
├── src/
│   ├── common/           # Cache, events, mail, middleware, logging, utilities
│   ├── config/           # Environment configuration
│   ├── data/             # Seed data
│   ├── modules/          # Feature modules (auth, books, cart, orders, etc.)
│   ├── app.js            # Express application and middleware
│   ├── routes.js         # API route registration
│   ├── server.js         # API server entry point
│   ├── worker.js         # Background event consumer
│   └── seed.js           # Demo data seeding
├── tests/                # Unit and API tests
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

Each feature module generally separates routes, controllers, services, models, and validation. Routes connect HTTP requests to controllers; controllers handle request/response concerns; services contain business logic; models define MongoDB schemas; validation checks incoming data.

## Prerequisites

- Node.js **20 or later**
- npm
- Docker Desktop with Docker Compose, or compatible local MongoDB, Redis, and RabbitMQ services
- SMTP credentials if you want to send real emails
- Razorpay test credentials if you want to test online payments

## Getting Started

1. Open a terminal in `bookstore-backend`.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

   On Windows Command Prompt, use `copy .env.example .env`. Edit `.env` and set a strong `JWT_ACCESS_SECRET` (at least 32 characters). Configure MongoDB and any optional integrations you plan to use. Never commit `.env`.

4. Start the local infrastructure. The Compose file includes the services configured for this project:

   ```bash
   docker compose up -d mongo redis rabbitmq
   ```

   **Important:** order placement and other transaction-based operations require MongoDB to run as a replica set. The included Compose configuration is intended to provide the local replica-set setup.

5. Seed demo data:

   ```bash
   npm run seed
   ```

   The seed script creates demo accounts and sample books if they do not already exist. Check the script and use only in a local development database.

6. Start the API:

   ```bash
   npm run dev
   ```

   The API uses port `5000` by default. Check `http://localhost:5000/health` and `http://localhost:5000/health/ready`.

### Optional: Run the background worker separately

For a separate API and consumer process, configure the API process with `ENABLE_CONSUMERS=false`, then run:

```bash
npm run worker
```

The worker consumes queued events and handles notification tasks. Alternatively, use the project's Docker Compose setup as documented in `docker-compose.yml`.

## Environment Variables

Copy `.env.example` to `.env` and configure values for your environment. Common settings include:

| Variable | Purpose |
|---|---|
| `PORT` | API port (default: `5000`) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` | Secret used to sign access tokens |
| `ACCESS_TTL` | Access-token lifetime |
| `REFRESH_TTL_DAYS` | Refresh-token lifetime |
| `CLIENT_ORIGIN` | Allowed frontend origin (default: `http://localhost:5173`) |
| `REDIS_URL` | Optional Redis connection for caching/rate limits |
| `BOOK_CACHE_TTL_SECONDS` | Book cache lifetime |
| `RABBITMQ_URL` | Optional RabbitMQ connection for event processing |
| `ENABLE_CONSUMERS` | Whether the API process also consumes events |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP settings for email |
| `EMAIL_FROM` | Sender identity for email |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Optional Razorpay credentials |
| `RAZORPAY_WEBHOOK_SECRET` | Optional webhook verification secret |

See `.env.example` for the full list. Leave optional integrations unconfigured only where the application supports that fallback.

## Useful Commands

| Command | Description |
|---|---|
| `npm run dev` | Start API with Node watch mode |
| `npm start` | Start API without watch mode |
| `npm run worker` | Start background worker |
| `npm run seed` | Insert demo data |
| `npm run ensure-indexes` | Ensure configured database indexes |
| `npm test` | Run Jest tests |
| `npm run lint` | Lint source files |
| `npm run format` | Format source, scripts, and tests |
| `npm run format:check` | Check formatting |

## API Overview

The API base path is `/api/v1`. Main resource areas include:

- `/auth` — registration, login, refresh, logout, and current-user details
- `/users` — user administration
- `/addresses` — customer addresses
- `/books` — public book catalogue and admin book management
- `/inventory` — stock management
- `/cart` — cart operations
- `/orders` — order placement, history, cancellation, and status
- `/wishlist` — wishlist management
- `/reviews` — book reviews
- `/payments` — payment-related endpoints

See `docs/openapi.yaml` and the route files for the exact paths, payloads, and access rules.

### Response format

Successful responses generally use a consistent envelope:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Errors use a structured response with an error code, message, optional details, and request ID.

## Tests

Run:

```bash
npm test
```

The test suite includes unit and API tests. Tests are configured through `tests/setupEnv.cjs`; check the test files for their exact setup and coverage.

## Security Notes

- Never commit `.env`, real credentials, tokens, database dumps, or production secrets.
- Change all demo credentials before deploying anywhere public.
- Use a strong, unique JWT secret and configure CORS for the deployed frontend origin.
- Use test credentials for payment integration during development.
- Review environment variables and security settings before production deployment.

## Current Limitations

- Google/Facebook login and password-reset-by-email are not implemented in the current frontend/backend flow.
- Some event delivery is performed after the database transaction commits; it is not a fully transactional outbox.
- Optional Redis and RabbitMQ integrations depend on their services being reachable.
- Validate the full transaction and payment flows against your own properly configured MongoDB and provider test accounts before production use.

## License

Add a license file if you intend to distribute this project publicly.
