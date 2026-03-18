const jwt = require('jsonwebtoken');

const ACCESS_COOKIE_NAME = String(process.env.OPENSWARM_AUTH_ACCESS_COOKIE || 'openswarm_access_token').trim();
const REFRESH_COOKIE_NAME = String(process.env.OPENSWARM_AUTH_REFRESH_COOKIE || 'openswarm_refresh_token').trim();

function getAccessSecret() {
  return String(process.env.OPENSWARM_AUTH_JWT_SECRET || process.env.OPENSWARM_V1_JWT_SECRET || '').trim();
}

function getRefreshSecret() {
  return String(process.env.OPENSWARM_AUTH_REFRESH_SECRET || getAccessSecret()).trim();
}

function getAccessExpiresIn() {
  return String(process.env.OPENSWARM_AUTH_ACCESS_EXPIRES || '15m').trim();
}

function getRefreshExpiresIn() {
  return String(process.env.OPENSWARM_AUTH_REFRESH_EXPIRES || '7d').trim();
}

function parseBearerToken(req) {
  const auth = String(req.headers.authorization || '').trim();
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
}

function getCookieValue(req, name) {
  const target = String(name || '').trim();
  if (!target) return '';
  try {
    const raw = String(req.headers.cookie || '');
    const parts = raw.split(';');
    for (const part of parts) {
      const chunk = part.trim();
      const i = chunk.indexOf('=');
      if (i <= 0) continue;
      const key = chunk.slice(0, i).trim();
      if (key !== target) continue;
      return decodeURIComponent(chunk.slice(i + 1)).trim();
    }
  } catch (_) {}
  return '';
}

function parseAccessToken(req) {
  return parseBearerToken(req) || String(req.headers['x-access-token'] || '').trim() || getCookieValue(req, ACCESS_COOKIE_NAME);
}

function parseRefreshToken(req) {
  return String(req.body?.refreshToken || '').trim()
    || String(req.headers['x-refresh-token'] || '').trim()
    || getCookieValue(req, REFRESH_COOKIE_NAME);
}

function signAccessToken(payload) {
  const secret = getAccessSecret();
  if (!secret) throw new Error('OPENSWARM_AUTH_JWT_SECRET not configured');
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    issuer: 'openswarm-panel',
    audience: 'openswarm-access',
    expiresIn: getAccessExpiresIn(),
  });
}

function signRefreshToken(payload) {
  const secret = getRefreshSecret();
  if (!secret) throw new Error('OPENSWARM_AUTH_REFRESH_SECRET not configured');
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    issuer: 'openswarm-panel',
    audience: 'openswarm-refresh',
    expiresIn: getRefreshExpiresIn(),
  });
}

function verifyRefreshToken(token) {
  const secret = getRefreshSecret();
  if (!secret) throw new Error('OPENSWARM_AUTH_REFRESH_SECRET not configured');
  return jwt.verify(String(token || ''), secret, {
    algorithms: ['HS256'],
    issuer: 'openswarm-panel',
    audience: 'openswarm-refresh',
  });
}

function verifyAccessToken(token) {
  const secret = getAccessSecret();
  if (!secret) throw new Error('OPENSWARM_AUTH_JWT_SECRET not configured');
  return jwt.verify(String(token || ''), secret, {
    algorithms: ['HS256'],
    issuer: 'openswarm-panel',
    audience: 'openswarm-access',
  });
}

function requirePhase1Auth(req, res, next) {
  if (!getAccessSecret()) return res.status(503).json({ error: 'OPENSWARM_AUTH_JWT_SECRET not configured' });
  const token = parseAccessToken(req);
  if (!token) return res.status(401).json({ error: 'missing bearer token' });
  try {
    const payload = verifyAccessToken(token);
    req.authCtx = {
      userId: payload.sub || null,
      email: payload.email || null,
      tenantId: payload.tenantId || null,
      role: payload.role || 'member',
      raw: payload,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: err.message || 'invalid token' });
  }
}

function requireTenantContext(req, res, next) {
  const auth = req.authCtx || {};
  const requested = String(req.headers['x-tenant-id'] || '').trim();
  const tenantId = requested || String(auth.tenantId || '').trim();
  if (!tenantId) return res.status(400).json({ error: 'tenant context missing' });
  if (requested && auth.tenantId && requested !== auth.tenantId && auth.role !== 'platform_admin') {
    return res.status(403).json({ error: 'tenant access denied' });
  }
  req.tenantId = tenantId;
  return next();
}

module.exports = {
  parseBearerToken,
  parseAccessToken,
  parseRefreshToken,
  getCookieValue,
  verifyAccessToken,
  getAccessSecret,
  getRefreshSecret,
  getAccessExpiresIn,
  getRefreshExpiresIn,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  requirePhase1Auth,
  requireTenantContext,
};
