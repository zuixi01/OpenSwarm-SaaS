const express = require('express');
const fs = require('fs');

function createTenantRuntimeRouter(options = {}) {
  const {
    tenantRuntimeResolver,
    tenantPaths,
    tenantSecurityRepo,
    tenantAccessControl,
    reconcileRunningAgentHealth,
  } = options;

  if (!tenantRuntimeResolver) throw new Error('tenantRuntimeResolver is required');
  if (!tenantPaths) throw new Error('tenantPaths is required');
  if (!tenantSecurityRepo) throw new Error('tenantSecurityRepo is required');
  if (!tenantAccessControl) throw new Error('tenantAccessControl is required');

  const router = express.Router();
  router.use(tenantAccessControl.ensureAuth);

  function parseLimit(raw, fallback = 30, max = 200) {
    const value = parseInt(raw, 10);
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return Math.min(value, max);
  }

  function resolveRequestedTenantId(req) {
    const requested = String(req.query?.tenantId || req.body?.tenantId || req.headers['x-tenant-id'] || '').trim();
    const authTenantId = String(req.authCtx?.tenantId || '').trim();
    const role = String(req.authCtx?.role || 'member').trim();
    const tenantId = requested || authTenantId || 'public';
    if (requested && authTenantId && requested !== authTenantId && role !== 'platform_admin') {
      const err = new Error('tenant access denied');
      err.status = 403;
      throw err;
    }
    return tenantId;
  }

  function visibleTenantIds(req) {
    const authTenantId = String(req.authCtx?.tenantId || '').trim();
    const role = String(req.authCtx?.role || 'member').trim();
    if (authTenantId && role !== 'platform_admin') return [authTenantId];
    return tenantRuntimeResolver.listKnownTenantIds();
  }

  function requireRead(req, res, next) {
    const tenantId = resolveRequestedTenantId(req);
    const membership = String(req.authCtx?.role || '').trim() === 'platform_admin'
      ? { tenantId, role: 'platform_admin', userId: req.authCtx?.userId || null, email: req.authCtx?.email || null }
      : tenantSecurityRepo.getMember(tenantId, req.authCtx || {});
    if (!membership) return res.status(403).json({ error: 'tenant access denied' });
    req.tenantId = tenantId;
    req.tenantMembership = membership;
    req.authCtx = { ...(req.authCtx || {}), tenantId, role: membership.role || req.authCtx?.role || 'member' };
    return next();
  }

  function requireWrite(req, res, next) {
    return requireRead(req, res, () => {
      if (!tenantAccessControl.isWriteRole(req.authCtx?.role)) {
        return res.status(403).json({ error: 'only owner/admin can control runtime' });
      }
      return next();
    });
  }

  function readBillingEventsForTenant(tenantId, limit = 30) {
    try {
      const file = tenantPaths.billingEventsFile(tenantId);
      if (!fs.existsSync(file)) return [];
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      const items = Array.isArray(raw) ? raw : [];
      return items
        .slice()
        .sort((a, b) => Number(b.at || 0) - Number(a.at || 0))
        .slice(0, limit)
        .map((item) => ({
          id: item.id || null,
          eventType: item.kind || item.eventType || 'usage',
          units: item.units ?? null,
          unitPriceUsd: item.unitPriceUsd ?? null,
          totalCostUsd: item.totalCostUsd ?? null,
          metadata: item.meta || item.metadata || {},
          createdAt: item.at ? new Date(Number(item.at)).toISOString() : (item.createdAt || null),
        }));
    } catch (_) {
      return [];
    }
  }

  function toTenantItem(tenantId, req) {
    const role = String(req.authCtx?.role || 'platform_admin').trim() || 'platform_admin';
    const overview = tenantRuntimeResolver.getTenantOverview(tenantId);
    return {
      tenantId,
      tenantName: tenantId,
      role,
      planCode: 'local',
      tenantStatus: overview.runtime.status,
      tenantCreatedAt: null,
    };
  }

  router.get('/tenants', async (req, res) => {
    try {
      const items = visibleTenantIds(req).map((tenantId) => toTenantItem(tenantId, req));
      return res.json({ items, mode: 'local' });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'list tenant runtimes failed' });
    }
  });

  router.get('/overview', requireRead, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      if (typeof reconcileRunningAgentHealth === 'function') reconcileRunningAgentHealth(tenantId);
      const overview = tenantRuntimeResolver.getTenantOverview(tenantId);
      return res.json({
        tenantId,
        role: String(req.authCtx?.role || 'platform_admin'),
        quota: null,
        runtime: overview.runtime,
        main: overview.main,
        events: readBillingEventsForTenant(tenantId, 20),
        mode: 'local',
      });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'load tenant runtime overview failed' });
    }
  });

  router.get('/runtime/agents', requireRead, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      if (typeof reconcileRunningAgentHealth === 'function') reconcileRunningAgentHealth(tenantId);
      return res.json({
        runtimeId: `local:${tenantId}`,
        items: tenantRuntimeResolver.listAgentStatuses(tenantId),
        mode: 'local',
      });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'list tenant runtime agents failed' });
    }
  });

  router.get('/runtime/health', requireRead, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const health = await tenantRuntimeResolver.healthCheck(tenantId);
      return res.json({ ...health, mode: 'local' });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'tenant runtime health failed' });
    }
  });

  router.post('/runtime/ensure', requireWrite, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const desiredAgents = Number(req.body?.desiredAgents || 1);
      const overview = await tenantRuntimeResolver.ensureTenantRuntime(tenantId, { desiredAgents });
      await tenantAccessControl.audit(req, 'tenant.runtime.ensure', 'runtime', `local:${tenantId}`, { desiredAgents });
      return res.json({ ok: true, runtime: overview.runtime, main: overview.main, mode: 'local' });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'ensure tenant runtime failed' });
    }
  });

  router.post('/runtime/start', requireWrite, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const overview = await tenantRuntimeResolver.startRuntime(tenantId, {
        target: req.body?.target,
        agentId: req.body?.agentId,
        desiredAgents: req.body?.desiredAgents,
      });
      await tenantAccessControl.audit(req, 'tenant.runtime.start', req.body?.target === 'main' ? 'main' : 'agent', req.body?.agentId || 'main', {
        target: req.body?.target || null,
        desiredAgents: req.body?.desiredAgents || null,
      });
      return res.json({ ok: true, runtime: overview.runtime, main: overview.main, mode: 'local' });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'start tenant runtime failed' });
    }
  });

  router.post('/runtime/stop', requireWrite, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const overview = await tenantRuntimeResolver.stopRuntime(tenantId, {
        target: req.body?.target,
        agentId: req.body?.agentId,
      });
      await tenantAccessControl.audit(req, 'tenant.runtime.stop', req.body?.target === 'main' ? 'main' : 'agent', req.body?.agentId || 'main', {
        target: req.body?.target || null,
      });
      return res.json({ ok: true, runtime: overview.runtime, main: overview.main, mode: 'local' });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'stop tenant runtime failed' });
    }
  });

  router.post('/runtime/scale', requireWrite, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const desiredAgents = Number(req.body?.desiredAgents || 1);
      if (!Number.isFinite(desiredAgents) || desiredAgents <= 0) {
        return res.status(400).json({ error: 'desiredAgents must be positive integer' });
      }
      const overview = await tenantRuntimeResolver.scaleRuntime(tenantId, desiredAgents);
      await tenantAccessControl.audit(req, 'tenant.runtime.scale', 'runtime', `local:${tenantId}`, { desiredAgents });
      return res.json({ ok: true, runtime: overview.runtime, main: overview.main, mode: 'local' });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'scale tenant runtime failed' });
    }
  });

  router.get('/events', requireRead, async (req, res) => {
    try {
      const tenantId = req.tenantId;
      const limit = parseLimit(req.query?.limit, 30, 200);
      return res.json({ items: readBillingEventsForTenant(tenantId, limit), mode: 'local' });
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message || 'list tenant runtime events failed' });
    }
  });

  router.get('/members', requireRead, async (req, res) => {
    try {
      return res.json({ items: await tenantSecurityRepo.listMembers(req.tenantId), mode: 'local' });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'list tenant members failed' });
    }
  });

  router.post('/members', requireWrite, async (req, res) => {
    try {
      const member = await tenantSecurityRepo.upsertMember(req.tenantId, req.body || {});
      await tenantAccessControl.audit(req, 'tenant.member.upsert', 'tenant_member', member.userId || member.email, {
        role: member.role,
      });
      return res.status(201).json({ ok: true, item: member, mode: 'local' });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'upsert tenant member failed' });
    }
  });

  router.get('/audit', requireRead, async (req, res) => {
    try {
      const limit = parseLimit(req.query?.limit, 50, 500);
      return res.json({ items: await tenantSecurityRepo.listAuditLogs(req.tenantId, limit), mode: 'local' });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'list tenant audit logs failed' });
    }
  });

  return router;
}

module.exports = {
  createTenantRuntimeRouter,
};
