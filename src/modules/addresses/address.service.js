import { AppError } from '../../common/errors/AppError.js';
import { Address } from './address.model.js';

const MAX_ADDRESSES = 10;

function toAddress(doc) {
  return {
    id: doc._id?.toString() || doc.id,
    street: doc.street,
    city: doc.city,
    state: doc.state,
    zipCode: doc.zipCode,
    type: doc.type || 'home',
    isDefault: doc.isDefault,
    createdAt: doc.createdAt,
  };
}

export async function list(userId) {
  const items = await Address.find({ user: userId })
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();
  return items.map(toAddress);
}

export async function create(userId, data) {
  const count = await Address.countDocuments({ user: userId });
  if (count >= MAX_ADDRESSES) {
    throw new AppError(400, 'LIMIT_REACHED', `Maximum ${MAX_ADDRESSES} addresses allowed`);
  }

  const isFirst = count === 0;
  const address = await Address.create({
    user: userId,
    ...data,
    isDefault: isFirst,
  });
  return toAddress(address.toObject());
}

export async function update(addressId, userId, data) {
  const address = await Address.findOneAndUpdate(
    { _id: addressId, user: userId },
    { $set: data },
    { new: true }
  ).lean();
  if (!address) throw new AppError(404, 'NOT_FOUND', 'Address not found');
  return toAddress(address);
}

export async function remove(addressId, userId) {
  const address = await Address.findOneAndDelete({ _id: addressId, user: userId });
  if (!address) throw new AppError(404, 'NOT_FOUND', 'Address not found');

  if (address.isDefault) {
    const newest = await Address.findOne({ user: userId }).sort({ createdAt: -1 });
    if (newest) {
      newest.isDefault = true;
      await newest.save();
    }
  }
}

export async function setDefault(addressId, userId) {
  const address = await Address.findOne({ _id: addressId, user: userId });
  if (!address) throw new AppError(404, 'NOT_FOUND', 'Address not found');

  await Address.updateMany(
    { user: userId, isDefault: true },
    { $set: { isDefault: false } }
  );
  address.isDefault = true;
  await address.save();
  return toAddress(address.toObject());
}

export async function getOwnedAddress(addressId, userId, session) {
  const query = Address.findOne({ _id: addressId, user: userId });
  if (session) query.session(session);
  const address = await query;
  if (!address) throw new AppError(404, 'ADDRESS_NOT_FOUND', 'Address not found');
  return address;
}
