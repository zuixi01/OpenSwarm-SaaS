const { getAccessSecret, requirePhase1Auth } = require('../middleware/phase1-auth');
const { resolveTenantId } = require('./tenant-scope');

function getClientIp(req) {
  return String(
    req.headers['x-forwarded-for']
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || ''
  ).split(',')[0].trim();
}

function isWriteRole(role) {
  const value = String(role || '').trim();
  return value === 'owner' || value === 'admin' || value === 'platform_admin';
}

function createTenantAccessControl(options = {}) {
  const { tenantSecurityRepo } = options;
  if (!tenantSecurityRepo) throw new Error('tenantSecurityRepo is required');
  const authEnabled = !!String(getAccessSecret() || '').trim();

  function ensureAuth(req, res, next) {
    if (!authEnabled) {
      req.authCtx = {
        userId: null,
        email: 'local@openswarm',
        tenantId: null,
        role: 'platform_admin',
        raw: {},
      };
      return next();
    }
    return requirePhase1Auth(req, res, next);
  }

  async function resolveMembership(req, tenantId) {
    const principal = {
      userId: req.authCtx?.userId || null,
      email: req.authCtx?.email || null,
    };
    if (String(req.authCtx?.role || '').trim() === 'platform_admin') {
      return {
        tenantId,
        userId: principal.userId,
        email: principal.email,
        role: 'platform_admin',
      };
    }
    let membership = await tenantSecurityRepo.getMember(tenantId, principal);
    const claimedTenantId = String(req.authCtx?.tenantId || '').trim();
    if (!membership && claimedTenantId && claimedTenantId === tenantId && (principal.userId || principal.email)) {
      membership = await tenantSecurityRepo.ensureBootstrapMember(tenantId, principal, req.authCtx?.role || 'member');
    }
    return membership;
  }

  function requireTenantRead(resolveFn) {
    return [
      ensureAuth,
      async (req, res, next) => {
        try {
          const tenantId = String((typeof resolveFn === 'function' ? resolveFn(req) : resolveTenantId(req)) || 'public').trim() || 'public';
          const membership = await resolveMembership(req, tenantId);
          if (!membership) return res.status(403).json({ error: 'tenant access denied' });
          req.tenantId = tenantId;
          req.authCtx = { ...(req.authCtx || {}), tenantId, role: membership.role || req.authCtx?.role || 'member' };
          req.tenantMembership = membership;
          return next();
        } catch (err) {
          return res.status(err.status || 500).json({ error: err.message || 'tenant access failed' });
        }
      },
    ];
  }

  function requireTenantWrite(resolveFn) {
    return [
      ...requireTenantRead(resolveFn),
      (req, res, next) => {
        if (!isWriteRole(req.authCtx?.role)) {
          return res.status(403).json({ error: 'only owner/admin can modify tenant resources' });
        }
        return next();
      },
    ];
  }

  function audit(req, action, targetType, targetId, metadata) {
    const tenantId = String(req.tenantId || req.authCtx?.tenantId || 'public').trim() || 'public';
    return tenantSecurityRepo.appendAuditLog(tenantId, {
      userId: req.authCtx?.userId || null,
      email: req.authCtx?.email || null,
      role: req.authCtx?.role || null,
      action,
      targetType,
      targetId,
      ip: getClientIp(req),
      metadata,
    });
  }

  return {
    authEnabled,
    isWriteRole,
    ensureAuth,
    requireTenantRead,
    requireTenantWrite,
    audit,
  };
}

module.exports = {
  createTenantAccessControl,
  isWriteRole,
};
