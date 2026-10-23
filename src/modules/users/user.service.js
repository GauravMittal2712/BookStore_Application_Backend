import bcrypt from 'bcrypt';
import { AppError } from '../../common/errors/AppError.js';
import { User } from './user.model.js';
import { RefreshToken } from '../auth/refreshToken.model.js';
import { escapeRegex } from '../../common/utils/regex.js';

export async function list({ role, q, page, limit, sort }) {
  const filter = { isDeleted: false };
  if (role) filter.role = role;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const sortObj = {};
  const field = sort.replace(/^-/, '');
  sortObj[field] = sort.startsWith('-') ? -1 : 1;

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    items: items.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
    })),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function create({ name, email, password, role }) {
  const existing = await User.findOne({ email });
  if (existing) throw new AppError(409, 'EMAIL_TAKEN', 'Email already registered');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role });
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function getById(userId) {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function update(userId, data, actor) {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

  const isSelf = String(actor.id) === String(userId).toLowerCase();
  if (actor.role !== 'admin' && !isSelf) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission');
  }
  if (actor.role !== 'admin' && data.role !== undefined) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot change role');
  }

  // never leave the system without an admin
  if (data.role !== undefined && data.role !== 'admin' && user.role === 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin', isDeleted: false });
    if (adminCount <= 1) throw new AppError(409, 'LAST_ADMIN', 'Cannot remove the role of the last admin');
  }

  if (data.email && data.email !== user.email) {
    const taken = await User.findOne({ email: data.email });
    if (taken) throw new AppError(409, 'EMAIL_TAKEN', 'Email already registered');
  }

  if (data.name !== undefined) user.name = data.name;
  if (data.email !== undefined) user.email = data.email;
  if (data.mobile !== undefined) user.mobile = data.mobile;
  if (data.role !== undefined && actor.role === 'admin') user.role = data.role;
  await user.save();

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
  };
}

export async function softDelete(userId, actorId) {
  if (userId === actorId) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot delete yourself');
  }

  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

  if (user.role === 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin', isDeleted: false });
    if (adminCount <= 1) {
      throw new AppError(403, 'FORBIDDEN', 'Cannot delete the last admin');
    }
  }

  user.isDeleted = true;
  await user.save();
  await RefreshToken.updateMany({ user: userId }, { revokedAt: new Date() });
}
