// These tests need NO database: they cover everything that is decided before a query runs.
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';

const app = createApp();
const token = (role, sub = '66f1c2000000000000000001') =>
  jwt.sign({ role }, process.env.JWT_ACCESS_SECRET, { subject: sub, issuer: 'bookstore-api', algorithm: 'HS256', expiresIn: '5m' });
const auth = (role) => ({ Authorization: `Bearer ${token(role)}` });
let n = 0;
const ip = () => `10.9.${(n >> 8) & 255}.${n++ & 255}`; // each request looks like a different client

describe('platform', () => {
  it('GET /health', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
  });
  it('unknown route -> uniform 404 envelope with requestId', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeTruthy();
  });
  it('malformed JSON -> 400 (not 500)', async () => {
    const res = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MALFORMED_JSON');
  });
  it('body over 10kb -> 413 (not 500)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(20000) });
    expect(res.status).toBe(413);
  });
});

describe('authentication / RBAC', () => {
  it('guest cannot create a book -> 401', async () => {
    expect((await request(app).post('/api/v1/books').send({})).status).toBe(401);
  });
  it('bad token -> 401 TOKEN_INVALID', async () => {
    const res = await request(app).get('/api/v1/cart').set('Authorization', 'Bearer nope');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });
  it('customer cannot create a book -> 403', async () => {
    const res = await request(app).post('/api/v1/books').set(auth('customer')).send({ title: 'X', author: 'Y', price: 1000 });
    expect(res.status).toBe(403);
  });
  it('helper can not read orders or use cart/addresses/wishlist', async () => {
    for (const path of ['/api/v1/orders', '/api/v1/orders/66f1c2000000000000000009', '/api/v1/cart', '/api/v1/addresses', '/api/v1/wishlist']) {
      expect((await request(app).get(path).set(auth('helper'))).status).toBe(403);
    }
  });
  it('customer cannot touch inventory or users list', async () => {
    expect((await request(app).get('/api/v1/inventory').set(auth('customer'))).status).toBe(403);
    expect((await request(app).get('/api/v1/users').set(auth('customer'))).status).toBe(403);
  });
  it('only admin can change order status', async () => {
    const res = await request(app).patch('/api/v1/orders/66f1c2000000000000000009/status').set(auth('customer')).send({ status: 'processing' });
    expect(res.status).toBe(403);
  });
});

describe('validation', () => {
  it('register rejects role (mass assignment) and weak passwords', async () => {
    const base = { name: 'A', email: 'a@b.co', password: 'Str0ngPass!' };
    expect((await request(app).post('/api/v1/auth/register').set('X-Forwarded-For', ip()).send({ ...base, role: 'admin' })).status).toBe(422);
    expect((await request(app).post('/api/v1/auth/register').set('X-Forwarded-For', ip()).send({ ...base, password: 'weakpass' })).status).toBe(422);
  });
  it('book list: limit > 50, unknown params, bad id', async () => {
    expect((await request(app).get('/api/v1/books?limit=500')).status).toBe(422);
    expect((await request(app).get('/api/v1/books?foo=1')).status).toBe(422);
    expect((await request(app).get('/api/v1/books/123')).status).toBe(422);
  });
  it('admin: float price, weak password for new user and unknown sort field rejected', async () => {
    expect((await request(app).post('/api/v1/books').set(auth('admin')).send({ title: 'T', author: 'A', price: 10.5 })).status).toBe(422);
    expect((await request(app).post('/api/v1/users').set(auth('admin')).send({ name: 'N', email: 'n@e.co', password: 'abcdefgh' })).status).toBe(422);
    expect((await request(app).get('/api/v1/users?sort=passwordHash').set(auth('admin'))).status).toBe(422);
  });
  it('inventory: exactly one of stock / adjustBy', async () => {
    const p = '/api/v1/inventory/66f1c2000000000000000009';
    expect((await request(app).put(p).set(auth('helper')).send({ stock: 5, adjustBy: 1 })).status).toBe(422);
    expect((await request(app).put(p).set(auth('helper')).send({})).status).toBe(422);
  });
  it('reviews: sort limited to known fields', async () => {
    expect((await request(app).get('/api/v1/reviews?bookId=66f1c2000000000000000009&sort=user')).status).toBe(422);
  });
});

describe('rate limiting', () => {
  // NOTE: limiter is bypassed per-IP via X-Forwarded-For in the tests above; here we use one fixed IP.
  it('login: 10 attempts per window, 11th is 429; /auth/me is not affected', async () => {
    const statuses = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await request(app).post('/api/v1/auth/login').set('X-Forwarded-For', '203.0.113.50').send({})).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 422)).toBe(true);
    expect(statuses[10]).toBe(429);
    for (let i = 0; i < 12; i++) {
      const res = await request(app).get('/api/v1/auth/me').set('X-Forwarded-For', '203.0.113.51');
      expect(res.status).toBe(401); // never 429
    }
  });
});
