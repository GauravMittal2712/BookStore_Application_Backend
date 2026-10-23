import { asyncHandler } from '../../common/utils/asyncHandler.js';
import * as bookService from './book.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await bookService.search(req.valid.query);
  res.json({ success: true, data: result.items, meta: result.meta });
});

export const getOne = asyncHandler(async (req, res) => {
  const book = await bookService.getById(req.valid.params.bookId);
  res.json({ success: true, data: book });
});

export const create = asyncHandler(async (req, res) => {
  const book = await bookService.create(req.valid.body);
  res.status(201).json({ success: true, data: book });
});

export const update = asyncHandler(async (req, res) => {
  const book = await bookService.update(req.valid.params.bookId, req.valid.body);
  res.json({ success: true, data: book });
});

export const remove = asyncHandler(async (req, res) => {
  await bookService.softDelete(req.valid.params.bookId);
  res.status(204).end();
});
