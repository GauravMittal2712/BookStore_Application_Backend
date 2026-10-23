import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/AppError.js';
import { events } from '../../common/events/eventBus.js';
import { sendMail } from '../../common/mail/mailer.js';
import { User } from '../users/user.model.js';
import { RefreshToken } from './refreshToken.model.js';
import { PasswordReset } from './passwordReset.model.js';

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
    hasPassword: Boolean(user.passwordHash),
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
  if (!user || !user.passwordHash) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  const tokens = await issueTokens(user, meta);
  return { user: publicUser(user), ...tokens };
}

export async function loginWithGoogle({ idToken }, meta) {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError(503, 'GOOGLE_AUTH_DISABLED', 'Google login is not configured');
  }
  if (!idToken) {
    throw new AppError(422, 'VALIDATION_ERROR', 'idToken is required');
  }

  let payload;
  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`tokeninfo ${res.status}`);
    payload = await res.json();
  } catch {
    throw new AppError(401, 'GOOGLE_TOKEN_INVALID', 'Could not verify Google token');
  }

  if (payload.aud !== env.GOOGLE_CLIENT_ID) {
    throw new AppError(401, 'GOOGLE_TOKEN_INVALID', 'Token audience mismatch');
  }
  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    throw new AppError(401, 'GOOGLE_TOKEN_INVALID', 'Google email not verified');
  }

  const email = String(payload.email || '').toLowerCase();
  const googleId = payload.sub;
  const name = payload.name || email.split('@')[0] || 'Google User';

  let user = await User.findOne({ $or: [{ googleId }, { email }], isDeleted: false }).select(
    '+passwordHash'
  );

  if (user) {
    if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }
  } else {
    user = await User.create({
      name,
      email,
      googleId,
      role: 'customer',
    });
    events.emit('user.registered', { userId: user.id || user._id.toString() });
  }

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

  const user = await User.findOne({ _id: record.user, isDeleted: false }).select('+passwordHash');
  if (!user) throw new AppError(401, 'TOKEN_INVALID', 'Invalid refresh token');

  return { user: publicUser(user), ...(await issueTokens(user, meta, record.family)) };
}

export async function logout(rawToken) {
  if (!rawToken) return;
  await RefreshToken.updateOne({ tokenHash: hash(rawToken) }, { revokedAt: new Date() });
}

export async function me(userId) {
  const user = await User.findOne({ _id: userId, isDeleted: false }).select('+passwordHash');
  if (!user) throw new AppError(401, 'TOKEN_INVALID', 'User not found');
  return publicUser(user);
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new AppError(401, 'TOKEN_INVALID', 'User not found');

  if (user.passwordHash) {
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  await RefreshToken.updateMany({ user: userId }, { revokedAt: new Date() });
}

export async function forgotPassword(email) {
  const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
  if (!user) return { ok: true };

  const raw = crypto.randomBytes(32).toString('hex');
  await PasswordReset.deleteMany({ user: user._id });
  await PasswordReset.create({
    user: user._id,
    tokenHash: hash(raw),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  const link = `${env.CLIENT_URL}/reset-password?token=${raw}`;
  try {
    await sendMail({
      to: user.email,
      subject: 'Reset your Bookstore password',
      text: `Hi ${user.name},\n\nReset your password using this link (valid 1 hour):\n${link}\n\nIf you did not request this, ignore this email.`,
      html: `<p>Hi ${user.name},</p><p>Reset your password (valid 1 hour):</p><p><a href="${link}">${link}</a></p><p>If you did not request this, ignore this email.</p>`,
    });
  } catch (err) {
    console.error('forgot-password email failed', err.message);
  }
  return { ok: true };
}

export async function resetPassword({ token, password }) {
  if (!token || !password) {
    throw new AppError(422, 'VALIDATION_ERROR', 'token and password are required');
  }
  const record = await PasswordReset.findOne({ tokenHash: hash(token) });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError(400, 'RESET_TOKEN_INVALID', 'Reset link is invalid or expired');
  }

  const user = await User.findOne({ _id: record.user, isDeleted: false });
  if (!user) throw new AppError(400, 'RESET_TOKEN_INVALID', 'Reset link is invalid or expired');

  user.passwordHash = await bcrypt.hash(password, 12);
  await user.save();
  record.usedAt = new Date();
  await record.save();
  await RefreshToken.updateMany({ user: user._id }, { revokedAt: new Date() });
  return { ok: true };
}