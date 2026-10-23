import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { env } from '../../config/env.js';
import * as authService from './auth.service.js';

function setRefreshCookie(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: env.REFRESH_TTL_DAYS * 864e5,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
  });
}

function meta(req) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.valid.body, meta(req));
  setRefreshCookie(res, result.refreshToken);
  res.status(201).json({
    success: true,
    data: { user: result.user, accessToken: result.accessToken },
  });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.valid.body, meta(req));
  setRefreshCookie(res, result.refreshToken);
  res.json({
    success: true,
    data: { user: result.user, accessToken: result.accessToken },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const raw = req.cookies?.refreshToken;
  if (!raw) {
    return res.status(401).json({
      success: false,
      error: { code: 'TOKEN_INVALID', message: 'No refresh token' },
    });
  }
  const result = await authService.refresh(raw, meta(req));
  setRefreshCookie(res, result.refreshToken);
  res.json({
    success: true,
    data: { user: result.user, accessToken: result.accessToken },
  });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.refreshToken);
  clearRefreshCookie(res);
  res.status(204).end();
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.user.id);
  res.json({ success: true, data: user });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.valid.body);
  clearRefreshCookie(res);
  res.status(204).end();
});
