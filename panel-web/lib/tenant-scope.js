function resolveTenantId(input, fallback = 'public') {
  if (!input) return fallback;
  if (typeof input === 'string') return String(input).trim() || fallback;
  const fromReq = input.tenantId
    || input.authCtx?.tenantId
    || input.headers?.['x-tenant-id']
    || input.body?.tenantId
    || input.query?.tenantId
    || input.params?.tenantId;
  return String(fromReq || '').trim() || fallback;
}

function ensureTenantAccess(entity, tenantId) {
  if (!entity) return { ok: false, status: 404, message: '资源不存在' };
  const ownerTenantId = String(entity.tenantId || '').trim();
  const requestedTenantId = String(tenantId || '').trim();
  if (ownerTenantId && requestedTenantId && ownerTenantId !== requestedTenantId) {
    return { ok: false, status: 403, message: 'tenant access denied' };
  }
  return { ok: true };
}

module.exports = {
  resolveTenantId,
  ensureTenantAccess,
};
