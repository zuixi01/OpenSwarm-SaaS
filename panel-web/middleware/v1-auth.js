const jwt = require('jsonwebtoken');

function getJwtSecret() {
  return String(process.env.OPENSWARM_V1_JWT_SECRET || process.env.JWT_SECRET || '').trim();
}

function parseBearerToken(req) {
  const auth = String(req.headers.authorization || '').trim();
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
}

function normalizeRoles(payload) {
  if (Array.isArray(payload?.roles)) return payload.roles.map((r) => String(r));
  if (payload?.role) return [String(payload.role)];
  return [];
}

function normalizeTenantIds(payload) {
  if (Array.isArray(payload?.tenantIds)) return payload.tenantIds.map((x) => String(x));
  if (payload?.tenantId) return [String(payload.tenantId)];
  return [];
}

function canAccessTenant(auth, tenantId) {
  const id = String(tenantId || '').trim();
  if (!id) return false;
  const roles = normalizeRoles(auth);
  if (roles.includes('platform_admin')) return true;
  const tenantIds = normalizeTenantIds(auth);
  return tenantIds.includes(id);
}

function signV1Token(payload, options = {}) {
  const secret = getJwtSecret();
  if (!secret) {
    const err = new Error('OPENSWARM_V1_JWT_SECRET is not configured');
    err.code = 'JWT_SECRET_MISSING';
    throw err;
  }
  const expiresIn = options.expiresIn || process.env.OPENSWARM_V1_JWT_EXPIRES_IN || '8h';
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    issuer: 'openswarm-panel',
    audience: 'openswarm-v1',
    expiresIn,
  });
}

function requireV1Auth(req, res, next) {
  const secret = getJwtSecret();
  if (!secret) {
    return res.status(503).json({ error: 'OPENSWARM_V1_JWT_SECRET not configured' });
  }
  const token = parseBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'missing bearer token' });
  }
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'openswarm-panel',
      audience: 'openswarm-v1',
    });
    req.v1Auth = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: err.message || 'invalid token' });
  }
}

function requireTenantAccess(resolveTenantId) {
  return (req, res, next) => {
    const tenantId = typeof resolveTenantId === 'function' ? resolveTenantId(req) : req.params?.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    if (!req.v1Auth) return res.status(401).json({ error: 'unauthorized' });
    if (!canAccessTenant(req.v1Auth, tenantId)) {
      return res.status(403).json({ error: 'tenant access denied' });
    }
    return next();
  };
}

module.exports = {
  signV1Token,
  requireV1Auth,
  requireTenantAccess,
  canAccessTenant,
  normalizeRoles,
  normalizeTenantIds,
};
