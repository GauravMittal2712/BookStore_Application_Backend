
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from './config/env.js';
import { User } from './modules/users/user.model.js';
import { Book } from './modules/books/book.model.js';
import { extraBooks, coverUrl } from './data/books.js';

if (env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('Refusing to seed with NODE_ENV=production. Re-run with --force if you really mean it.');
  process.exit(1);
}

await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
console.log('Connected');

const accounts = [
  { name: 'Store Admin', email: 'admin@bookstore.local', password: 'Admin123!', role: 'admin' },
  { name: 'Warehouse Helper', email: 'helper@bookstore.local', password: 'Helper123!', role: 'helper' },
  { name: 'Asha Raman', email: 'asha@example.com', password: 'Customer1!', role: 'customer' },
];
for (const { password, ...a } of accounts) {
  if (await User.exists({ email: a.email })) {
    console.log(`  exists  ${a.email}`);
    continue;
  }
  await User.create({ ...a, passwordHash: await bcrypt.hash(password, 12) });
  console.log(`  created ${a.email}`);
}

const books = [
  { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', price: 59900, originalPrice: 77900, stock: 18, category: 'Technology', isbn: '9781449373320', publicationYear: 2017, description: 'The big ideas behind reliable, scalable and maintainable systems.' },
  { title: 'Clean Architecture', author: 'Robert C. Martin', price: 44900, originalPrice: 58400, stock: 10, category: 'Technology', isbn: '9780134494166', publicationYear: 2017, description: 'A craftsman guide to software structure and design.' },
  { title: 'The Pragmatic Programmer', author: 'David Thomas, Andrew Hunt', price: 39900, originalPrice: 51900, stock: 25, category: 'Technology', isbn: '9780135957059', publicationYear: 2019 },
  { title: 'Atomic Habits', author: 'James Clear', price: 29900, originalPrice: 38900, stock: 40, category: 'Self-Help', isbn: '9780735211292', publicationYear: 2018 },
  { title: 'Sapiens', author: 'Yuval Noah Harari', price: 34900, originalPrice: 45400, stock: 15, category: 'History', isbn: '9780062316097', publicationYear: 2015 },
  { title: "Don't Make Me Think", author: 'Steve Krug', price: 150000, originalPrice: 200000, stock: 12, category: 'Design', isbn: '9780321965516', publicationYear: 2014, description: 'A common sense approach to web usability.' },
  { title: 'React Material-UI', author: 'Adam Boduch', price: 78000, originalPrice: 90000, stock: 9, category: 'Technology', isbn: '9781789344615', publicationYear: 2019, description: 'Cookbook of recipes for building React apps with Material-UI.' },
  { title: 'UX For DUMMIES', author: 'Donald Chesnut', price: 150000, originalPrice: 200000, stock: 0, category: 'Design', isbn: '9781118914717', publicationYear: 2015, description: 'An out-of-stock sample title.' },
];

const catalogue = [...books, ...extraBooks];
let created = 0;
let covered = 0;
for (const { isbn, ...rest } of catalogue) {
  const res = await Book.updateOne(
    { isbn },
    { $setOnInsert: { ...rest, coverImageUrl: rest.coverImageUrl || coverUrl(isbn) } },
    { upsert: true }
  );
  if (res.upsertedCount) created += 1;
  // Books that already exist (e.g. from an earlier seed) get a cover only if they have none.
  const fix = await Book.updateOne(
    { isbn, $or: [{ coverImageUrl: { $exists: false } }, { coverImageUrl: null }, { coverImageUrl: '' }] },
    { $set: { coverImageUrl: coverUrl(isbn) } }
  );
  covered += fix.modifiedCount;
}
console.log(`  books: ${created} created, ${catalogue.length - created} already existed, ${covered} cover(s) added to existing books`);

console.log('\nLogins:');
console.log('  admin    admin@bookstore.local  / Admin123!');
console.log('  helper   helper@bookstore.local / Helper123!');
console.log('  customer asha@example.com       / Customer1!');
await mongoose.disconnect();
process.exit(0);