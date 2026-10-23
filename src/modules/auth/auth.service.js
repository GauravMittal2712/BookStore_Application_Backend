import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/AppError.js';
import { events } from '../../common/events/eventBus.js';
import { User } from '../users/user.model.js';
import { RefreshToken } from './refreshToken.model.js';

const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

async function issueTokens(user, meta = {}, family = crypto.randomUUID()) {
  const accessToken = jwt.sign(
    { role: user.role },
    env.JWT_ACCESS_SECRET,
    {
      subject: user.id || user._id.toString(),
      issuer: 'bookstore-api',
      expiresIn: env.ACCESS_TTL,
      algorithm: 'HS256',
    }
  );
  const refreshToken = crypto.randomBytes(64).toString('hex');
  await RefreshToken.create({
    user: user.id || user._id,
    tokenHash: hash(refreshToken),
    family,
    expiresAt: new Date(Date.now() + env.REFRESH_TTL_DAYS * 864e5),
    ...meta,
  });
  return { accessToken, refreshToken };
}

function publicUser(user) {
  return {
    id: user.id || user._id.toString(),
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function register({ name, email, password, mobile }, meta) {
  const existing = await User.findOne({ email });
  if (existing) throw new AppError(409, 'EMAIL_TAKEN', 'Email already registered');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, mobile, role: 'customer' });
  const tokens = await issueTokens(user, meta);
  events.emit('user.registered', { userId: user.id || user._id.toString() });
  return { user: publicUser(user), ...tokens };
}

export async function login({ email, password }, meta) {
  const user = await User.findOne({ email, isDeleted: false }).select('+passwordHash');
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  const tokens = await issueTokens(user, meta);
  return { user: publicUser(user), ...tokens };
}

export async function refresh(rawToken, meta) {
  const record = await RefreshToken.findOne({ tokenHash: hash(rawToken) });
  if (!record) throw new AppError(401, 'TOKEN_INVALID', 'Invalid refresh token');

  if (record.revokedAt) {
    await RefreshToken.updateMany({ family: record.family }, { revokedAt: new Date() });
    throw new AppError(401, 'TOKEN_REUSED', 'Session expired, please log in again');
  }

  record.revokedAt = new Date();
  await record.save();

  const user = await User.findOne({ _id: record.user, isDeleted: false });
  if (!user) throw new AppError(401, 'TOKEN_INVALID', 'Invalid refresh token');

  return { user: publicUser(user), ...(await issueTokens(user, meta, record.family)) };
}

export async function logout(rawToken) {
  if (!rawToken) return;
  await RefreshToken.updateOne(
    { tokenHash: hash(rawToken) },
    { revokedAt: new Date() }
  );
}

export async function me(userId) {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new AppError(401, 'TOKEN_INVALID', 'User not found');
  return publicUser(user);
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new AppError(401, 'TOKEN_INVALID', 'User not found');

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect');

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  await RefreshToken.updateMany({ user: userId }, { revokedAt: new Date() });
}
