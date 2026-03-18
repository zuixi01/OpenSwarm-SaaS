const express = require('express');
const crypto = require('crypto');
const {
  hashPassword,
  verifyPassword,
} = require('../lib/password-hash');
const repo = require('../lib/auth-phase1-repo');
const {
  getAccessExpiresIn,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  requirePhase1Auth,
  parseRefreshToken,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} = require('../middleware/phase1-auth');

const router = express.Router();
const GOOGLE_STATE_COOKIE_NAME = 'openswarm-google-state';
const GOOGLE_NEXT_COOKIE_NAME = 'openswarm-google-next';
const GOOGLE_TENANT_COOKIE_NAME = 'openswarm-google-tenant';

function safeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function getClientIp(req) {
  return String(
    req.headers['x-forwarded-for']
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || ''
  ).split(',')[0].trim();
}

function getRefreshExpiryDate() {
  const days = parseInt(process.env.OPENSWARM_AUTH_REFRESH_DAYS || '7', 10);
  const now = Date.now();
  return new Date(now + Math.max(1, days) * 24 * 60 * 60 * 1000);
}

function getCookieOptions(req, maxAgeMs) {
  const secureByEnv = String(process.env.OPENSWARM_AUTH_COOKIE_SECURE || '').trim() === '1';
  const isHttps = String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https' || !!req.secure;
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureByEnv || isHttps,
    path: '/',
    maxAge: maxAgeMs,
  };
}

function getAccessMaxAgeMs() {
  // 与 access token 生命周期解耦，避免页面频繁掉登录
  const hours = parseInt(process.env.OPENSWARM_AUTH_WEB_ACCESS_HOURS || '24', 10);
  return Math.max(1, hours) * 60 * 60 * 1000;
}

function getRefreshMaxAgeMs() {
  const days = parseInt(process.env.OPENSWARM_AUTH_REFRESH_DAYS || '7', 10);
  return Math.max(1, days) * 24 * 60 * 60 * 1000;
}

function setAuthCookies(req, res, tokens) {
  res.cookie(ACCESS_COOKIE_NAME, tokens.accessToken, getCookieOptions(req, getAccessMaxAgeMs()));
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, getCookieOptions(req, getRefreshMaxAgeMs()));
}

function clearAuthCookies(req, res) {
  const opts = getCookieOptions(req, 0);
  res.clearCookie(ACCESS_COOKIE_NAME, opts);
  res.clearCookie(REFRESH_COOKIE_NAME, opts);
}

function setShortCookie(req, res, name, value, maxAgeMs) {
  res.cookie(name, value, getCookieOptions(req, maxAgeMs));
}

function clearShortCookie(req, res, name) {
  res.clearCookie(name, getCookieOptions(req, 0));
}

function parseCookieValue(req, name) {
  try {
    const cookie = String(req.headers.cookie || '');
    for (const part of cookie.split(';')) {
      const trimmed = part.trim();
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      if (trimmed.slice(0, eq) === name) return decodeURIComponent(trimmed.slice(eq + 1));
    }
  } catch (_) {}
  return '';
}

function getGoogleOauthConfig(req) {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
  const configuredRedirectUri = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();
  const proto = String(req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')).trim() || 'http';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
  const baseUrl = String(process.env.OPENSWARM_PUBLIC_BASE_URL || '').trim() || (host ? `${proto}://${host}` : '');
  const redirectUri = configuredRedirectUri || (baseUrl ? `${baseUrl}/api/auth/google/callback` : '');
  return {
    clientId,
    clientSecret,
    redirectUri,
    enabled: !!(clientId && clientSecret && redirectUri),
  };
}

function parseJwtPayload(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const body = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = body + '='.repeat((4 - (body.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch (_) {
    return null;
  }
}

function normalizeNextPath(nextPath) {
  const value = String(nextPath || '/index.html').trim() || '/index.html';
  if (!value.startsWith('/') || value.startsWith('//')) return '/index.html';
  return value;
}

async function exchangeGoogleCode({ code, redirectUri, clientId, clientSecret }) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(payload.error_description || payload.error || `google token exchange failed (${response.status})`);
  }
  return payload;
}

async function fetchGoogleUserInfo(accessToken) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(payload.error_description || payload.error || `google userinfo failed (${response.status})`);
  }
  return payload;
}

function getTenantNameFromGoogleProfile(profile) {
  const name = String(profile.name || '').trim();
  const givenName = String(profile.given_name || '').trim();
  const email = safeEmail(profile.email);
  if (name) return `${name} Workspace`;
  if (givenName) return `${givenName} Workspace`;
  if (email) return `${email.split('@')[0]} Workspace`;
  return 'My Workspace';
}

async function authenticateGoogleAndIssue({ googleProfile, req }) {
  const provider = 'google';
  const providerSubject = String(googleProfile.sub || '').trim();
  const email = safeEmail(googleProfile.email);
  if (!providerSubject) return { error: { status: 401, message: 'google account subject missing' } };
  if (!isEmail(email)) return { error: { status: 401, message: 'google account email invalid' } };
  if (!googleProfile.email_verified) return { error: { status: 403, message: 'google email not verified' } };

  let user = await repo.findUserByIdentity(provider, providerSubject);
  let tenantMember = null;
  let created = false;

  if (!user) {
    user = await repo.findUserByEmail(email);
    if (!user) {
      const createdUser = await repo.createUserAndTenant({
        email,
        passwordHash: `external-google:${providerSubject}`,
        tenantName: getTenantNameFromGoogleProfile(googleProfile),
        planCode: 'free',
      });
      user = createdUser.user;
      tenantMember = {
        tenantId: createdUser.tenant.id,
        name: createdUser.tenant.name,
        role: createdUser.role,
      };
      created = true;
    } else if (user.status !== 'active') {
      user = await repo.activateUser(user.id) || user;
    }
  } else if (user.status !== 'active') {
    user = await repo.activateUser(user.id) || user;
  }

  await repo.linkUserIdentity({
    userId: user.id,
    provider,
    providerSubject,
    email,
    profile: {
      name: googleProfile.name || '',
      given_name: googleProfile.given_name || '',
      family_name: googleProfile.family_name || '',
      picture: googleProfile.picture || '',
      locale: googleProfile.locale || '',
      email_verified: !!googleProfile.email_verified,
    },
  });

  if (!tenantMember) {
    tenantMember = await repo.findTenantMemberByUser(user.id, null);
    if (!tenantMember) {
      const createdTenant = await repo.createTenantForUser({
        userId: user.id,
        tenantName: getTenantNameFromGoogleProfile(googleProfile),
        planCode: 'free',
      });
      tenantMember = {
        tenantId: createdTenant.tenant.id,
        name: createdTenant.tenant.name,
        role: createdTenant.role,
      };
      created = true;
    }
  }

  const tokens = issueTokenPair(
    { id: user.id, email: user.email },
    { id: tenantMember.tenantId, name: tenantMember.name },
    tenantMember.role
  );

  await repo.insertRefreshToken({
    userId: user.id,
    tenantId: tenantMember.tenantId,
    tokenHash: hashRefreshToken(tokens.refreshToken),
    expiresAt: getRefreshExpiryDate(),
    ip: getClientIp(req),
    userAgent: String(req.headers['user-agent'] || ''),
  });

  await repo.writeAuditLog({
    tenantId: tenantMember.tenantId,
    userId: user.id,
    action: created ? 'auth.google.register' : 'auth.google.login',
    targetType: 'user',
    targetId: user.id,
    ip: getClientIp(req),
    metadata: { email, provider, providerSubject },
  });

  return { user, tenantMember, tokens, created };
}

function issueTokenPair(user, tenant, role) {
  const tokenJti = crypto.randomUUID();
  const refreshJti = crypto.randomUUID();
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    tenantId: tenant.id,
    role: role || 'member',
    jti: tokenJti,
  });
  const refreshToken = signRefreshToken({
    sub: user.id,
    email: user.email,
    tenantId: tenant.id,
    role: role || 'member',
    type: 'refresh',
    jti: refreshJti,
  });
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: getAccessExpiresIn(),
  };
}

async function authenticateAndIssue({ email, password, tenantId, req }) {
  const user = await repo.findUserByEmail(email);
  if (!user || user.status !== 'active') return { error: { status: 401, message: 'invalid credentials' } };
  if (!verifyPassword(password, user.passwordHash)) return { error: { status: 401, message: 'invalid credentials' } };

  const tenantMember = await repo.findTenantMemberByUser(user.id, tenantId || null);
  if (!tenantMember) return { error: { status: 403, message: 'tenant membership not found' } };

  const tokens = issueTokenPair(
    { id: user.id, email: user.email },
    { id: tenantMember.tenantId, name: tenantMember.name },
    tenantMember.role
  );

  await repo.insertRefreshToken({
    userId: user.id,
    tenantId: tenantMember.tenantId,
    tokenHash: hashRefreshToken(tokens.refreshToken),
    expiresAt: getRefreshExpiryDate(),
    ip: getClientIp(req),
    userAgent: String(req.headers['user-agent'] || ''),
  });

  await repo.writeAuditLog({
    tenantId: tenantMember.tenantId,
    userId: user.id,
    action: 'auth.login',
    targetType: 'user',
    targetId: user.id,
    ip: getClientIp(req),
    metadata: { email },
  });

  return {
    user,
    tenantMember,
    tokens,
  };
}

async function rotateWithRefreshToken({ refreshToken, req }) {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashRefreshToken(refreshToken);
  const record = await repo.getRefreshTokenByHash(tokenHash);
  if (!record) return { error: { status: 401, message: 'invalid refresh token' } };
  if (record.revokedAt) return { error: { status: 401, message: 'refresh token revoked' } };
  if (new Date(record.expiresAt).getTime() <= Date.now()) return { error: { status: 401, message: 'refresh token expired' } };
  if (payload.sub !== record.userId || payload.tenantId !== record.tenantId) {
    return { error: { status: 401, message: 'refresh token mismatch' } };
  }

  await repo.revokeRefreshTokenByHash(tokenHash);

  const user = await repo.findUserByEmail(payload.email);
  if (!user) return { error: { status: 401, message: 'user not found' } };
  const tenantMember = await repo.findTenantMemberByUser(user.id, payload.tenantId);
  if (!tenantMember) return { error: { status: 403, message: 'tenant membership not found' } };

  const tokens = issueTokenPair(
    { id: user.id, email: user.email },
    { id: tenantMember.tenantId, name: tenantMember.name },
    tenantMember.role
  );
  await repo.insertRefreshToken({
    userId: user.id,
    tenantId: tenantMember.tenantId,
    tokenHash: hashRefreshToken(tokens.refreshToken),
    expiresAt: getRefreshExpiryDate(),
    ip: getClientIp(req),
    userAgent: String(req.headers['user-agent'] || ''),
  });
  await repo.writeAuditLog({
    tenantId: tenantMember.tenantId,
    userId: user.id,
    action: 'auth.refresh',
    targetType: 'user',
    targetId: user.id,
    ip: getClientIp(req),
    metadata: { email: user.email },
  });

  return { user, tenantMember, tokens };
}

router.post('/register', async (req, res) => {
  try {
    repo.assertDbReady();
    const email = safeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const tenantName = String(req.body?.tenantName || '').trim() || 'My Workspace';
    if (!isEmail(email)) return res.status(400).json({ error: 'invalid email' });
    if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

    const created = await repo.createUserAndTenant({
      email,
      passwordHash: hashPassword(password),
      tenantName,
      planCode: String(req.body?.planCode || 'free'),
    });
    const tokens = issueTokenPair(created.user, created.tenant, created.role);

    await repo.insertRefreshToken({
      userId: created.user.id,
      tenantId: created.tenant.id,
      tokenHash: hashRefreshToken(tokens.refreshToken),
      expiresAt: getRefreshExpiryDate(),
      ip: getClientIp(req),
      userAgent: String(req.headers['user-agent'] || ''),
    });

    await repo.writeAuditLog({
      tenantId: created.tenant.id,
      userId: created.user.id,
      action: 'auth.register',
      targetType: 'user',
      targetId: created.user.id,
      ip: getClientIp(req),
      metadata: { email },
    });

    return res.status(201).json({
      user: { id: created.user.id, email: created.user.email },
      tenant: { id: created.tenant.id, name: created.tenant.name, role: created.role },
      ...tokens,
    });
  } catch (err) {
    if (err.code === 'DB_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    if (err.code === 'EMAIL_EXISTS') return res.status(409).json({ error: 'email already exists' });
    return res.status(500).json({ error: err.message || 'register failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    repo.assertDbReady();
    const email = safeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const tenantId = String(req.body?.tenantId || '').trim();
    if (!isEmail(email)) return res.status(400).json({ error: 'invalid email' });
    if (!password) return res.status(400).json({ error: 'password is required' });
    const auth = await authenticateAndIssue({ email, password, tenantId, req });
    if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

    return res.json({
      user: { id: auth.user.id, email: auth.user.email },
      tenant: { id: auth.tenantMember.tenantId, name: auth.tenantMember.name, role: auth.tenantMember.role },
      ...auth.tokens,
    });
  } catch (err) {
    if (err.code === 'DB_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    return res.status(500).json({ error: err.message || 'login failed' });
  }
});

router.post('/web-login', async (req, res) => {
  try {
    repo.assertDbReady();
    const email = safeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const tenantId = String(req.body?.tenantId || '').trim();
    if (!isEmail(email)) return res.status(400).json({ error: 'invalid email' });
    if (!password) return res.status(400).json({ error: 'password is required' });

    const auth = await authenticateAndIssue({ email, password, tenantId, req });
    if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

    setAuthCookies(req, res, auth.tokens);
    return res.json({
      ok: true,
      user: { id: auth.user.id, email: auth.user.email },
      tenant: { id: auth.tenantMember.tenantId, name: auth.tenantMember.name, role: auth.tenantMember.role },
      expiresIn: auth.tokens.expiresIn,
    });
  } catch (err) {
    if (err.code === 'DB_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    return res.status(500).json({ error: err.message || 'web login failed' });
  }
});

router.get('/google/start', async (req, res) => {
  try {
    repo.assertDbReady();
    const google = getGoogleOauthConfig(req);
    if (!google.enabled) return res.redirect(302, '/login.html?error=google_not_configured');
    const nextPath = normalizeNextPath(req.query?.next || '/index.html');
    const tenantId = String(req.query?.tenantId || '').trim();
    const state = crypto.randomBytes(24).toString('hex');
    setShortCookie(req, res, GOOGLE_STATE_COOKIE_NAME, state, 10 * 60 * 1000);
    setShortCookie(req, res, GOOGLE_NEXT_COOKIE_NAME, nextPath, 10 * 60 * 1000);
    if (tenantId) setShortCookie(req, res, GOOGLE_TENANT_COOKIE_NAME, tenantId, 10 * 60 * 1000);
    else clearShortCookie(req, res, GOOGLE_TENANT_COOKIE_NAME);
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', google.clientId);
    authUrl.searchParams.set('redirect_uri', google.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'select_account');
    res.redirect(302, authUrl.toString());
  } catch (err) {
    return res.redirect(302, `/login.html?error=${encodeURIComponent(err.message || 'google_oauth_start_failed')}`);
  }
});

router.get('/google/callback', async (req, res) => {
  try {
    repo.assertDbReady();
    const google = getGoogleOauthConfig(req);
    if (!google.enabled) return res.redirect(302, '/login.html?error=google_not_configured');
    const state = String(req.query?.state || '').trim();
    const code = String(req.query?.code || '').trim();
    const storedState = parseCookieValue(req, GOOGLE_STATE_COOKIE_NAME);
    const nextPath = normalizeNextPath(parseCookieValue(req, GOOGLE_NEXT_COOKIE_NAME) || '/index.html');
    clearShortCookie(req, res, GOOGLE_STATE_COOKIE_NAME);
    clearShortCookie(req, res, GOOGLE_NEXT_COOKIE_NAME);
    clearShortCookie(req, res, GOOGLE_TENANT_COOKIE_NAME);
    if (!state || !storedState || state !== storedState) return res.redirect(302, '/login.html?error=google_state_mismatch');
    if (!code) return res.redirect(302, '/login.html?error=google_code_missing');

    const tokenPayload = await exchangeGoogleCode({
      code,
      redirectUri: google.redirectUri,
      clientId: google.clientId,
      clientSecret: google.clientSecret,
    });
    const idPayload = parseJwtPayload(tokenPayload.id_token);
    if (!idPayload || String(idPayload.aud || '') !== google.clientId) {
      return res.redirect(302, '/login.html?error=google_id_token_invalid');
    }
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(String(idPayload.iss || ''))) {
      return res.redirect(302, '/login.html?error=google_issuer_invalid');
    }
    const userInfo = await fetchGoogleUserInfo(tokenPayload.access_token);
    if (String(userInfo.sub || '') !== String(idPayload.sub || '')) {
      return res.redirect(302, '/login.html?error=google_profile_mismatch');
    }
    const auth = await authenticateGoogleAndIssue({ googleProfile: userInfo, req });
    if (auth.error) return res.redirect(302, `/login.html?error=${encodeURIComponent(auth.error.message)}`);
    setAuthCookies(req, res, auth.tokens);
    return res.redirect(302, nextPath);
  } catch (err) {
    return res.redirect(302, `/login.html?error=${encodeURIComponent(err.message || 'google_login_failed')}`);
  }
});

router.post('/refresh', async (req, res) => {
  try {
    repo.assertDbReady();
    const refreshToken = parseRefreshToken(req);
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });
    const refreshed = await rotateWithRefreshToken({ refreshToken, req });
    if (refreshed.error) return res.status(refreshed.error.status).json({ error: refreshed.error.message });
    return res.json(refreshed.tokens);
  } catch (err) {
    if (err.code === 'TokenExpiredError') return res.status(401).json({ error: 'refresh token expired' });
    if (err.code === 'JsonWebTokenError') return res.status(401).json({ error: 'invalid refresh token' });
    if (err.code === 'DB_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    return res.status(500).json({ error: err.message || 'refresh failed' });
  }
});

router.post('/web-refresh', async (req, res) => {
  try {
    repo.assertDbReady();
    const refreshToken = parseRefreshToken(req);
    if (!refreshToken) {
      clearAuthCookies(req, res);
      return res.status(401).json({ error: 'refresh token is required' });
    }
    const refreshed = await rotateWithRefreshToken({ refreshToken, req });
    if (refreshed.error) {
      clearAuthCookies(req, res);
      return res.status(refreshed.error.status).json({ error: refreshed.error.message });
    }
    setAuthCookies(req, res, refreshed.tokens);
    return res.json({ ok: true, expiresIn: refreshed.tokens.expiresIn });
  } catch (err) {
    clearAuthCookies(req, res);
    if (err.code === 'TokenExpiredError') return res.status(401).json({ error: 'refresh token expired' });
    if (err.code === 'JsonWebTokenError') return res.status(401).json({ error: 'invalid refresh token' });
    if (err.code === 'DB_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    return res.status(500).json({ error: err.message || 'web refresh failed' });
  }
});

router.post('/web-logout', async (req, res) => {
  try {
    repo.assertDbReady();
    const refreshToken = parseRefreshToken(req);
    if (refreshToken) {
      await repo.revokeRefreshTokenByHash(hashRefreshToken(refreshToken));
    }
    clearAuthCookies(req, res);
    return res.json({ ok: true });
  } catch (err) {
    clearAuthCookies(req, res);
    if (err.code === 'DB_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    return res.status(500).json({ error: err.message || 'web logout failed' });
  }
});

router.post('/logout', requirePhase1Auth, async (req, res) => {
  try {
    repo.assertDbReady();
    const refreshToken = String(req.body?.refreshToken || '').trim();
    if (refreshToken) {
      await repo.revokeRefreshTokenByHash(hashRefreshToken(refreshToken));
    }
    await repo.writeAuditLog({
      tenantId: req.authCtx?.tenantId || null,
      userId: req.authCtx?.userId || null,
      action: 'auth.logout',
      targetType: 'user',
      targetId: req.authCtx?.userId || null,
      ip: getClientIp(req),
      metadata: {},
    });
    return res.json({ ok: true });
  } catch (err) {
    if (err.code === 'DB_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    return res.status(500).json({ error: err.message || 'logout failed' });
  }
});

router.get('/session', requirePhase1Auth, async (req, res) => {
  try {
    repo.assertDbReady();
    const user = await repo.findUserByEmail(req.authCtx.email);
    if (!user) return res.status(404).json({ error: 'user not found' });
    return res.json({
      ok: true,
      user: { id: user.id, email: user.email },
      tenant: { id: req.authCtx.tenantId || null, role: req.authCtx.role || 'member' },
    });
  } catch (err) {
    if (err.code === 'DB_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    return res.status(500).json({ error: err.message || 'session failed' });
  }
});

router.get('/me', requirePhase1Auth, async (req, res) => {
  try {
    repo.assertDbReady();
    const user = await repo.findUserByEmail(req.authCtx.email);
    if (!user) return res.status(404).json({ error: 'user not found' });
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        roles: [req.authCtx.role || 'member'],
      },
      tenant: {
        id: req.authCtx.tenantId || null,
        role: req.authCtx.role || 'member',
      },
    });
  } catch (err) {
    if (err.code === 'DB_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    return res.status(500).json({ error: err.message || 'query me failed' });
  }
});

router.get('/memberships', requirePhase1Auth, async (req, res) => {
  try {
    repo.assertDbReady();
    const user = await repo.findUserByEmail(req.authCtx.email);
    if (!user) return res.status(404).json({ error: 'user not found' });
    const items = await repo.listTenantMembershipsByUser(user.id);
    return res.json({
      ok: true,
      items: items.map((item) => ({
        tenantId: item.tenantId,
        tenantName: item.name,
        role: item.role,
        current: String(item.tenantId || '') === String(req.authCtx.tenantId || ''),
      })),
    });
  } catch (err) {
    if (err.code === 'DB_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    return res.status(500).json({ error: err.message || 'memberships failed' });
  }
});

async function switchTenantAndIssue({ tenantId, req }) {
  const user = await repo.findUserByEmail(req.authCtx.email);
  if (!user) return { error: { status: 404, message: 'user not found' } };
  const tenantMember = await repo.findTenantMemberByUser(user.id, tenantId || null);
  if (!tenantMember || String(tenantMember.tenantId || '') !== String(tenantId || '')) {
    return { error: { status: 403, message: 'tenant membership not found' } };
  }

  const tokens = issueTokenPair(
    { id: user.id, email: user.email },
    { id: tenantMember.tenantId, name: tenantMember.name },
    tenantMember.role
  );

  await repo.insertRefreshToken({
    userId: user.id,
    tenantId: tenantMember.tenantId,
    tokenHash: hashRefreshToken(tokens.refreshToken),
    expiresAt: getRefreshExpiryDate(),
    ip: getClientIp(req),
    userAgent: String(req.headers['user-agent'] || ''),
  });

  await repo.writeAuditLog({
    tenantId: tenantMember.tenantId,
    userId: user.id,
    action: 'auth.switch_tenant',
    targetType: 'tenant',
    targetId: tenantMember.tenantId,
    ip: getClientIp(req),
    metadata: { fromTenantId: req.authCtx.tenantId || null, toTenantId: tenantMember.tenantId },
  });

  return { user, tenantMember, tokens };
}

router.post('/switch-tenant', requirePhase1Auth, async (req, res) => {
  try {
    repo.assertDbReady();
    const tenantId = String(req.body?.tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const switched = await switchTenantAndIssue({ tenantId, req });
    if (switched.error) return res.status(switched.error.status).json({ error: switched.error.message });
    return res.json({
      ok: true,
      tenant: {
        id: switched.tenantMember.tenantId,
        name: switched.tenantMember.name,
        role: switched.tenantMember.role,
      },
      ...switched.tokens,
    });
  } catch (err) {
    if (err.code === 'DB_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    return res.status(500).json({ error: err.message || 'switch tenant failed' });
  }
});

router.post('/web-switch-tenant', requirePhase1Auth, async (req, res) => {
  try {
    repo.assertDbReady();
    const tenantId = String(req.body?.tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const switched = await switchTenantAndIssue({ tenantId, req });
    if (switched.error) return res.status(switched.error.status).json({ error: switched.error.message });
    setAuthCookies(req, res, switched.tokens);
    return res.json({
      ok: true,
      tenant: {
        id: switched.tenantMember.tenantId,
        name: switched.tenantMember.name,
        role: switched.tenantMember.role,
      },
      expiresIn: switched.tokens.expiresIn,
    });
  } catch (err) {
    if (err.code === 'DB_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    return res.status(500).json({ error: err.message || 'web switch tenant failed' });
  }
});

module.exports = router;
