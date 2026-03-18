const express = require('express');
const path = require('path');
const { query: dbQuery, isDbConfigured } = require('../lib/db');
const { requirePhase1Auth, getAccessSecret } = require('../middleware/phase1-auth');
const runtimeRepo = require('../lib/runtime-instance-repo');
const { LocalTenantRuntimeManager } = require('../lib/runtime-manager');
const { QuotaGuard } = require('../lib/quota-guard');

const router = express.Router();
const AUTH_ENABLED = !!String(getAccessSecret() || '').trim();
if (AUTH_ENABLED) {
  router.use(requirePhase1Auth);
} else {
  router.use((req, _res, next) => {
    req.authCtx = {
      userId: null,
      email: 'local@openswarm',
      tenantId: null,
      role: 'platform_admin',
      raw: {},
    };
    next();
  });
}

const ROOT_DIR = path.join(__dirname, '..', '..');
const runtimeManager = new LocalTenantRuntimeManager({
  rootDir: ROOT_DIR,
  openclawDir: process.env.OPENCLAW_DIR || path.join(ROOT_DIR, 'openclaw'),
  runtimeBaseDir: process.env.OPENSWARM_TENANT_RUNTIME_BASE_DIR || path.join(ROOT_DIR, 'yin', 'tenants'),
  logDir: process.env.OPENSWARM_TENANT_RUNTIME_LOG_DIR || '/tmp',
  portStart: process.env.OPENSWARM_TENANT_RUNTIME_PORT_START || 19001,
  portEnd: process.env.OPENSWARM_TENANT_RUNTIME_PORT_END || 21999,
  healthIntervalMs: process.env.OPENSWARM_RUNTIME_HEALTH_INTERVAL_MS || 30000,
  maxAutoRestart: process.env.OPENSWARM_RUNTIME_MAX_AUTO_RESTART || 3,
  runtimeTokenSecret: process.env.OPENSWARM_RUNTIME_TOKEN_SECRET || 'openswarm-runtime-secret',
});
runtimeManager.startSweeper();

const quotaGuard = new QuotaGuard();

function mustDb(res) {
  if (!isDbConfigured()) {
    res.status(503).json({ error: 'DATABASE_URL not configured' });
    return false;
  }
  return true;
}

function isWriteRole(role) {
  const r = String(role || '').trim();
  return r === 'owner' || r === 'admin' || r === 'platform_admin';
}

async function listTenantMemberships(userId) {
  if (!userId) {
    const sql = `
      select
        t.id as "tenantId",
        'platform_admin'::text as role,
        t.name as "tenantName",
        t.plan_code as "planCode",
        t.status as "tenantStatus",
        t.created_at as "tenantCreatedAt"
      from tenants t
      order by t.created_at asc
    `;
    const result = await dbQuery(sql);
    return result.rows;
  }

  const sql = `
    select
      tm.tenant_id as "tenantId",
      tm.role,
      t.name as "tenantName",
      t.plan_code as "planCode",
      t.status as "tenantStatus",
      t.created_at as "tenantCreatedAt"
    from tenant_members tm
    join tenants t on t.id = tm.tenant_id
    where tm.user_id = $1
    order by tm.created_at asc
  `;
  const result = await dbQuery(sql, [userId]);
  return result.rows;
}

async function getMembership(userId, tenantId) {
  if (!userId) {
    const sql = `
      select
        t.id as "tenantId",
        'platform_admin'::text as role,
        t.name as "tenantName",
        t.plan_code as "planCode",
        t.status as "tenantStatus"
      from tenants t
      where t.id = $1
      limit 1
    `;
    const result = await dbQuery(sql, [tenantId]);
    return result.rows[0] || null;
  }

  const sql = `
    select
      tm.tenant_id as "tenantId",
      tm.role,
      t.name as "tenantName",
      t.plan_code as "planCode",
      t.status as "tenantStatus"
    from tenant_members tm
    join tenants t on t.id = tm.tenant_id
    where tm.user_id = $1 and tm.tenant_id = $2
    limit 1
  `;
  const result = await dbQuery(sql, [userId, tenantId]);
  return result.rows[0] || null;
}

async function ensureInvitedUser(email) {
  const safeEmail = String(email || '').trim().toLowerCase();
  if (!safeEmail) throw new Error('email is required');
  const result = await dbQuery(
    `
    insert into users (email, password_hash, status)
    values ($1, $2, 'invited')
    on conflict (email)
    do update set email = excluded.email
    returning id, email, status
    `,
    [safeEmail, `invite:${safeEmail}`]
  );
  return result.rows[0] || null;
}

async function writeAuditEntry({ tenantId, userId, action, targetType, targetId, ip, metadata }) {
  await dbQuery(
    `
    insert into audit_logs (tenant_id, user_id, action, target_type, target_id, ip, metadata)
    values ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      tenantId,
      userId || null,
      String(action || 'unknown').trim() || 'unknown',
      targetType || null,
      targetId || null,
      ip || null,
      JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {}),
    ]
  );
}

function parseLimit(raw, fallback = 20, max = 200) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

async function loadOverview(tenantId, role) {
  const runtimeRaw = await runtimeRepo.getByTenantId(tenantId);
  let runtime = runtimeRaw;
  if (runtimeRaw && runtimeRaw.id) {
    runtime = await runtimeManager.getRuntime(runtimeRaw.id, tenantId);
  }
  const quota = await quotaGuard.getQuota(tenantId) || await quotaGuard.ensureTenantDefaults(tenantId, 'free');
  const events = await dbQuery(
    `
    select
      id,
      event_type as "eventType",
      units,
      unit_price_usd as "unitPriceUsd",
      total_cost_usd as "totalCostUsd",
      metadata,
      created_at as "createdAt"
    from billing_events
    where tenant_id = $1
    order by created_at desc
    limit 20
    `,
    [tenantId]
  );

  return {
    tenantId,
    role,
    quota,
    runtime: runtime || null,
    events: events.rows || [],
  };
}

router.get('/tenants', async (req, res) => {
  if (!mustDb(res)) return;
  try {
    const userId = String(req.authCtx?.userId || '').trim();
    const items = await listTenantMemberships(userId);
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'list tenants failed' });
  }
});

router.get('/overview', async (req, res) => {
  if (!mustDb(res)) return;
  try {
    const userId = String(req.authCtx?.userId || '').trim();
    const tenantId = String(req.query?.tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const membership = await getMembership(userId, tenantId);
    if (!membership) return res.status(403).json({ error: 'tenant access denied' });

    const out = await loadOverview(tenantId, membership.role);
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'load overview failed' });
  }
});

router.get('/members', async (req, res) => {
  if (!mustDb(res)) return;
  try {
    const userId = String(req.authCtx?.userId || '').trim();
    const tenantId = String(req.query?.tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const membership = await getMembership(userId, tenantId);
    if (!membership) return res.status(403).json({ error: 'tenant access denied' });
    const result = await dbQuery(
      `
      select
        tm.user_id as "userId",
        lower(coalesce(u.email, '')) as email,
        tm.role,
        tm.created_at as "createdAt",
        u.status as "userStatus"
      from tenant_members tm
      left join users u on u.id = tm.user_id
      where tm.tenant_id = $1
      order by tm.created_at asc
      `,
      [tenantId]
    );
    return res.json({ items: result.rows || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'list members failed' });
  }
});

router.post('/members', async (req, res) => {
  if (!mustDb(res)) return;
  try {
    const userId = String(req.authCtx?.userId || '').trim();
    const tenantId = String(req.body?.tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const membership = await getMembership(userId, tenantId);
    if (!membership) return res.status(403).json({ error: 'tenant access denied' });
    if (!isWriteRole(membership.role)) return res.status(403).json({ error: 'only owner/admin can manage members' });

    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = String(req.body?.role || 'member').trim() || 'member';
    if (!email) return res.status(400).json({ error: 'email is required' });
    const invitedUser = await ensureInvitedUser(email);
    const result = await dbQuery(
      `
      insert into tenant_members (tenant_id, user_id, role)
      values ($1, $2, $3)
      on conflict (tenant_id, user_id)
      do update set role = excluded.role
      returning
        user_id as "userId",
        role,
        created_at as "createdAt"
      `,
      [tenantId, invitedUser.id, role]
    );
    await writeAuditEntry({
      tenantId,
      userId: req.authCtx?.userId || null,
      action: 'tenant.member.upsert',
      targetType: 'tenant_member',
      targetId: email,
      ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim(),
      metadata: { role, invitedUserId: invitedUser.id, invitedUserStatus: invitedUser.status || 'invited' },
    });
    return res.status(201).json({
      ok: true,
      item: {
        ...(result.rows[0] || {}),
        email,
        userStatus: invitedUser.status || 'invited',
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'upsert member failed' });
  }
});

router.get('/audit', async (req, res) => {
  if (!mustDb(res)) return;
  try {
    const userId = String(req.authCtx?.userId || '').trim();
    const tenantId = String(req.query?.tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const membership = await getMembership(userId, tenantId);
    if (!membership) return res.status(403).json({ error: 'tenant access denied' });
    const limit = parseLimit(req.query?.limit, 50, 500);
    const result = await dbQuery(
      `
      select
        action,
        target_type as "resourceType",
        target_id as "resourceId",
        lower(coalesce(u.email, '')) as "actorEmail",
        metadata,
        created_at as "createdAt"
      from audit_logs
      left join users u on u.id = audit_logs.user_id
      where tenant_id = $1
      order by created_at desc
      limit $2
      `,
      [tenantId, limit]
    );
    return res.json({ items: result.rows || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'list audit failed' });
  }
});

router.get('/nodes', async (req, res) => {
  if (!mustDb(res)) return;
  try {
    const userId = String(req.authCtx?.userId || '').trim();
    const tenantId = String(req.query?.tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const membership = await getMembership(userId, tenantId);
    if (!membership) return res.status(403).json({ error: 'tenant access denied' });

    const result = await dbQuery(
      `
      select
        coalesce(region, 'local') as region,
        count(*)::int as "runtimeCount",
        count(*) filter (where status = 'running')::int as "runningCount",
        count(*) filter (where status = 'failed')::int as "failedCount",
        max(updated_at) as "updatedAt"
      from runtime_instances
      group by coalesce(region, 'local')
      order by region asc
      `
    );
    const currentRuntime = await runtimeRepo.getByTenantId(tenantId);
    return res.json({
      items: (result.rows || []).map((row) => ({
        nodeId: String(row.region || 'local'),
        region: String(row.region || 'local'),
        runtimeCount: Number(row.runtimeCount || 0),
        runningCount: Number(row.runningCount || 0),
        failedCount: Number(row.failedCount || 0),
        updatedAt: row.updatedAt || null,
        assigned: !!currentRuntime && String(currentRuntime.region || 'local') === String(row.region || 'local'),
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'list nodes failed' });
  }
});

router.get('/alerts', async (req, res) => {
  if (!mustDb(res)) return;
  try {
    const userId = String(req.authCtx?.userId || '').trim();
    const tenantId = String(req.query?.tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const membership = await getMembership(userId, tenantId);
    if (!membership) return res.status(403).json({ error: 'tenant access denied' });

    const runtime = await runtimeRepo.getByTenantId(tenantId);
    const quota = await quotaGuard.getQuota(tenantId) || await quotaGuard.ensureTenantDefaults(tenantId, membership.planCode || 'free');
    const items = [];
    if (!runtime) {
      items.push({ level: 'warn', code: 'runtime_missing', title: '租户 runtime 未创建', detail: '当前租户还没有独立 runtime。' });
    } else {
      if (runtime.status === 'failed') {
        items.push({ level: 'critical', code: 'runtime_failed', title: 'runtime 失败', detail: `当前 runtime 状态为 failed，region=${runtime.region || 'local'}` });
      } else if (runtime.status !== 'running') {
        items.push({ level: 'warn', code: 'runtime_not_running', title: 'runtime 未运行', detail: `当前 runtime 状态为 ${runtime.status}` });
      }
      if (runtime.heartbeatAt) {
        const ageMs = Date.now() - new Date(runtime.heartbeatAt).getTime();
        const idleLimitMs = Math.max(1, Number(quota.recycleIdleMinutes || 20)) * 60 * 1000;
        if (ageMs > idleLimitMs) {
          items.push({ level: 'warn', code: 'heartbeat_stale', title: 'runtime 心跳过旧', detail: `最后心跳超过 ${(ageMs / 60000).toFixed(1)} 分钟` });
        }
      }
    }

    const billingRes = await dbQuery(
      `
      select coalesce(sum(total_cost_usd), 0) as total
      from billing_events
      where tenant_id = $1
        and created_at >= date_trunc('day', now())
      `,
      [tenantId]
    );
    const dailySpent = Number(billingRes.rows[0]?.total || 0);
    if (Number(quota.dailyBudgetUsd || 0) > 0) {
      const ratio = dailySpent / Number(quota.dailyBudgetUsd);
      if (ratio >= 1) {
        items.push({ level: 'critical', code: 'budget_exceeded', title: '当日预算已超限', detail: `今日已使用 $${dailySpent.toFixed(2)} / $${Number(quota.dailyBudgetUsd).toFixed(2)}` });
      } else if (ratio >= 0.8) {
        items.push({ level: 'warn', code: 'budget_near_limit', title: '当日预算接近上限', detail: `今日已使用 $${dailySpent.toFixed(2)} / $${Number(quota.dailyBudgetUsd).toFixed(2)}` });
      }
    }

    const summary = items.reduce((acc, item) => {
      acc.total += 1;
      if (item.level === 'critical') acc.critical += 1;
      else if (item.level === 'warn') acc.warn += 1;
      else acc.info += 1;
      return acc;
    }, { total: 0, critical: 0, warn: 0, info: 0 });

    return res.json({ summary, items });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'load alerts failed' });
  }
});

router.post('/runtime/assign-node', async (req, res) => {
  if (!mustDb(res)) return;
  try {
    const userId = String(req.authCtx?.userId || '').trim();
    const tenantId = String(req.body?.tenantId || '').trim();
    const region = String(req.body?.region || '').trim() || 'local';
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const membership = await getMembership(userId, tenantId);
    if (!membership) return res.status(403).json({ error: 'tenant access denied' });
    if (!isWriteRole(membership.role)) return res.status(403).json({ error: 'only owner/admin can assign node' });
    const runtime = await runtimeRepo.getByTenantId(tenantId);
    if (!runtime) return res.status(404).json({ error: 'runtime not found' });
    const next = await runtimeRepo.updateRuntime(runtime.id, { region });
    await writeAuditEntry({
      tenantId,
      userId: req.authCtx?.userId || null,
      action: 'tenant.runtime.assign_node',
      targetType: 'runtime',
      targetId: runtime.id,
      ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim(),
      metadata: { region },
    });
    return res.json({ ok: true, runtime: next });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'assign node failed' });
  }
});

router.put('/quota', async (req, res) => {
  if (!mustDb(res)) return;
  try {
    const userId = String(req.authCtx?.userId || '').trim();
    const tenantId = String(req.body?.tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const membership = await getMembership(userId, tenantId);
    if (!membership) return res.status(403).json({ error: 'tenant access denied' });
    if (!isWriteRole(membership.role)) return res.status(403).json({ error: 'only owner/admin can update quota' });

    const quota = await quotaGuard.setQuota(tenantId, {
      planCode: req.body?.planCode,
      maxRuntimes: req.body?.maxRuntimes,
      maxAgentsPerRuntime: req.body?.maxAgentsPerRuntime,
      maxConcurrency: req.body?.maxConcurrency,
      requestsPerMinute: req.body?.requestsPerMinute,
      dailyRequestLimit: req.body?.dailyRequestLimit,
      dailyBudgetUsd: req.body?.dailyBudgetUsd,
      cpuLimitMillicores: req.body?.cpuLimitMillicores,
      memoryLimitMb: req.body?.memoryLimitMb,
      recycleIdleMinutes: req.body?.recycleIdleMinutes,
    });
    return res.json({ ok: true, quota });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'update quota failed' });
  }
});

router.post('/runtime/ensure', async (req, res) => {
  if (!mustDb(res)) return;
  try {
    const userId = String(req.authCtx?.userId || '').trim();
    const tenantId = String(req.body?.tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const membership = await getMembership(userId, tenantId);
    if (!membership) return res.status(403).json({ error: 'tenant access denied' });
    if (!isWriteRole(membership.role)) return res.status(403).json({ error: 'only owner/admin can control runtime' });

    const runtime = await runtimeManager.ensureRuntimeForTenant(tenantId, {
      mode: req.body?.mode || 'local',
      region: req.body?.region || 'local',
      desiredAgents: Number(req.body?.desiredAgents || 1),
      planCode: membership.planCode || 'free',
    });
    return res.json({ ok: true, runtime });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'ensure runtime failed' });
  }
});

router.post('/runtime/start', async (req, res) => {
  if (!mustDb(res)) return;
  try {
    const userId = String(req.authCtx?.userId || '').trim();
    const tenantId = String(req.body?.tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const membership = await getMembership(userId, tenantId);
    if (!membership) return res.status(403).json({ error: 'tenant access denied' });
    if (!isWriteRole(membership.role)) return res.status(403).json({ error: 'only owner/admin can control runtime' });

    let runtime = await runtimeRepo.getByTenantId(tenantId);
    if (!runtime) {
      runtime = await runtimeManager.ensureRuntimeForTenant(tenantId, {
        mode: 'local',
        region: 'local',
        desiredAgents: 1,
        planCode: membership.planCode || 'free',
      });
      return res.json({ ok: true, runtime });
    }

    runtime = await runtimeManager.startRuntime(runtime.id, tenantId);
    if (!runtime) return res.status(404).json({ error: 'runtime not found' });
    return res.json({ ok: true, runtime });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'start runtime failed' });
  }
});

router.post('/runtime/stop', async (req, res) => {
  if (!mustDb(res)) return;
  try {
    const userId = String(req.authCtx?.userId || '').trim();
    const tenantId = String(req.body?.tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const membership = await getMembership(userId, tenantId);
    if (!membership) return res.status(403).json({ error: 'tenant access denied' });
    if (!isWriteRole(membership.role)) return res.status(403).json({ error: 'only owner/admin can control runtime' });

    const runtime = await runtimeRepo.getByTenantId(tenantId);
    if (!runtime) return res.status(404).json({ error: 'runtime not found' });
    const next = await runtimeManager.stopRuntime(runtime.id, tenantId);
    return res.json({ ok: true, runtime: next });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'stop runtime failed' });
  }
});

router.post('/runtime/scale', async (req, res) => {
  if (!mustDb(res)) return;
  try {
    const userId = String(req.authCtx?.userId || '').trim();
    const tenantId = String(req.body?.tenantId || '').trim();
    const desiredAgents = Number(req.body?.desiredAgents || 1);
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    if (!Number.isFinite(desiredAgents) || desiredAgents <= 0) {
      return res.status(400).json({ error: 'desiredAgents must be positive integer' });
    }
    const membership = await getMembership(userId, tenantId);
    if (!membership) return res.status(403).json({ error: 'tenant access denied' });
    if (!isWriteRole(membership.role)) return res.status(403).json({ error: 'only owner/admin can control runtime' });

    const runtime = await runtimeRepo.getByTenantId(tenantId);
    if (!runtime) return res.status(404).json({ error: 'runtime not found' });
    const next = await runtimeManager.scaleRuntime(runtime.id, tenantId, desiredAgents);
    return res.json({ ok: true, runtime: next });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'scale runtime failed' });
  }
});

router.get('/runtime/agents', async (req, res) => {
  if (!mustDb(res)) return;
  try {
    const userId = String(req.authCtx?.userId || '').trim();
    const tenantId = String(req.query?.tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const membership = await getMembership(userId, tenantId);
    if (!membership) return res.status(403).json({ error: 'tenant access denied' });

    const runtime = await runtimeRepo.getByTenantId(tenantId);
    if (!runtime) return res.json({ items: [] });
    const items = await runtimeManager.listAgents(runtime.id, tenantId);
    return res.json({ runtimeId: runtime.id, items });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'list runtime agents failed' });
  }
});

router.get('/runtime/health', async (req, res) => {
  if (!mustDb(res)) return;
  try {
    const userId = String(req.authCtx?.userId || '').trim();
    const tenantId = String(req.query?.tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const membership = await getMembership(userId, tenantId);
    if (!membership) return res.status(403).json({ error: 'tenant access denied' });
    const runtime = await runtimeRepo.getByTenantId(tenantId);
    if (!runtime) return res.status(404).json({ error: 'runtime not found' });
    const health = await runtimeManager.healthCheck(runtime.id, tenantId);
    return res.json(health);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'runtime health failed' });
  }
});

router.get('/events', async (req, res) => {
  if (!mustDb(res)) return;
  try {
    const userId = String(req.authCtx?.userId || '').trim();
    const tenantId = String(req.query?.tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    const membership = await getMembership(userId, tenantId);
    if (!membership) return res.status(403).json({ error: 'tenant access denied' });
    const limit = parseLimit(req.query?.limit, 30, 200);
    const result = await dbQuery(
      `
      select
        id,
        event_type as "eventType",
        units,
        unit_price_usd as "unitPriceUsd",
        total_cost_usd as "totalCostUsd",
        metadata,
        created_at as "createdAt"
      from billing_events
      where tenant_id = $1
      order by created_at desc
      limit $2
      `,
      [tenantId, limit]
    );
    return res.json({ items: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'list events failed' });
  }
});

module.exports = router;
