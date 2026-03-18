const { query: dbQuery, getPool } = require('./db');

function mapQuota(row) {
  if (!row) return null;
  return {
    tenantId: row.tenantId,
    planCode: row.planCode,
    maxRuntimes: Number(row.maxRuntimes || 1),
    maxAgentsPerRuntime: Number(row.maxAgentsPerRuntime || 1),
    maxConcurrency: Number(row.maxConcurrency || 1),
    requestsPerMinute: Number(row.requestsPerMinute || 0),
    dailyRequestLimit: Number(row.dailyRequestLimit || 0),
    dailyBudgetUsd: Number(row.dailyBudgetUsd || 0),
    cpuLimitMillicores: Number(row.cpuLimitMillicores || 0),
    memoryLimitMb: Number(row.memoryLimitMb || 0),
    recycleIdleMinutes: Number(row.recycleIdleMinutes || 20),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

const SELECT_QUOTA = `
  select
    tenant_id as "tenantId",
    plan_code as "planCode",
    max_runtimes as "maxRuntimes",
    max_agents_per_runtime as "maxAgentsPerRuntime",
    max_concurrency as "maxConcurrency",
    requests_per_minute as "requestsPerMinute",
    daily_request_limit as "dailyRequestLimit",
    daily_budget_usd as "dailyBudgetUsd",
    cpu_limit_millicores as "cpuLimitMillicores",
    memory_limit_mb as "memoryLimitMb",
    recycle_idle_minutes as "recycleIdleMinutes",
    created_at as "createdAt",
    updated_at as "updatedAt"
`;

function getDefaultPlanValues(planCode) {
  const p = String(planCode || 'free').trim().toLowerCase();
  if (p === 'pro') {
    return {
      planCode: 'pro',
      maxRuntimes: 1,
      maxAgentsPerRuntime: 4,
      maxConcurrency: 8,
      requestsPerMinute: 120,
      dailyRequestLimit: 5000,
      dailyBudgetUsd: 100,
      cpuLimitMillicores: 3000,
      memoryLimitMb: 8192,
      recycleIdleMinutes: 30,
    };
  }
  if (p === 'team') {
    return {
      planCode: 'team',
      maxRuntimes: 3,
      maxAgentsPerRuntime: 16,
      maxConcurrency: 30,
      requestsPerMinute: 600,
      dailyRequestLimit: 30000,
      dailyBudgetUsd: 1000,
      cpuLimitMillicores: 12000,
      memoryLimitMb: 32768,
      recycleIdleMinutes: 60,
    };
  }
  return {
    planCode: 'free',
    maxRuntimes: 1,
    maxAgentsPerRuntime: 1,
    maxConcurrency: 2,
    requestsPerMinute: 20,
    dailyRequestLimit: 500,
    dailyBudgetUsd: 0,
    cpuLimitMillicores: 1000,
    memoryLimitMb: 2048,
    recycleIdleMinutes: 20,
  };
}

async function ensureDefaultQuota(tenantId, planCode = 'free') {
  const d = getDefaultPlanValues(planCode);
  const sql = `
    insert into resource_quotas (
      tenant_id, plan_code, max_runtimes, max_agents_per_runtime, max_concurrency,
      requests_per_minute, daily_request_limit, daily_budget_usd, cpu_limit_millicores, memory_limit_mb, recycle_idle_minutes
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    on conflict (tenant_id) do nothing
  `;
  await dbQuery(sql, [
    tenantId,
    d.planCode,
    d.maxRuntimes,
    d.maxAgentsPerRuntime,
    d.maxConcurrency,
    d.requestsPerMinute,
    d.dailyRequestLimit,
    d.dailyBudgetUsd,
    d.cpuLimitMillicores,
    d.memoryLimitMb,
    d.recycleIdleMinutes,
  ]);
  return getQuota(tenantId);
}

async function getQuota(tenantId) {
  const sql = `${SELECT_QUOTA} from resource_quotas where tenant_id = $1 limit 1`;
  const result = await dbQuery(sql, [tenantId]);
  return mapQuota(result.rows[0]);
}

async function upsertQuota(tenantId, patch) {
  const current = await ensureDefaultQuota(tenantId, patch.planCode || 'free');
  const next = {
    ...current,
    ...Object.fromEntries(Object.entries(patch || {}).filter(([, v]) => v !== undefined)),
    tenantId,
  };
  const sql = `
    insert into resource_quotas (
      tenant_id, plan_code, max_runtimes, max_agents_per_runtime, max_concurrency,
      requests_per_minute, daily_request_limit, daily_budget_usd, cpu_limit_millicores, memory_limit_mb, recycle_idle_minutes
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    on conflict (tenant_id) do update set
      plan_code = excluded.plan_code,
      max_runtimes = excluded.max_runtimes,
      max_agents_per_runtime = excluded.max_agents_per_runtime,
      max_concurrency = excluded.max_concurrency,
      requests_per_minute = excluded.requests_per_minute,
      daily_request_limit = excluded.daily_request_limit,
      daily_budget_usd = excluded.daily_budget_usd,
      cpu_limit_millicores = excluded.cpu_limit_millicores,
      memory_limit_mb = excluded.memory_limit_mb,
      recycle_idle_minutes = excluded.recycle_idle_minutes
    returning
      tenant_id as "tenantId",
      plan_code as "planCode",
      max_runtimes as "maxRuntimes",
      max_agents_per_runtime as "maxAgentsPerRuntime",
      max_concurrency as "maxConcurrency",
      requests_per_minute as "requestsPerMinute",
      daily_request_limit as "dailyRequestLimit",
      daily_budget_usd as "dailyBudgetUsd",
      cpu_limit_millicores as "cpuLimitMillicores",
      memory_limit_mb as "memoryLimitMb",
      recycle_idle_minutes as "recycleIdleMinutes",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;
  const result = await dbQuery(sql, [
    tenantId,
    next.planCode,
    next.maxRuntimes,
    next.maxAgentsPerRuntime,
    next.maxConcurrency,
    next.requestsPerMinute,
    next.dailyRequestLimit,
    next.dailyBudgetUsd,
    next.cpuLimitMillicores,
    next.memoryLimitMb,
    next.recycleIdleMinutes,
  ]);
  return mapQuota(result.rows[0]);
}

async function insertBillingEvent(input) {
  const sql = `
    insert into billing_events (tenant_id, event_type, units, unit_price_usd, total_cost_usd, metadata)
    values ($1, $2, $3, $4, $5, $6::jsonb)
    returning id
  `;
  const result = await dbQuery(sql, [
    input.tenantId,
    String(input.eventType || 'unknown'),
    input.units == null ? 0 : Number(input.units),
    input.unitPriceUsd == null ? 0 : Number(input.unitPriceUsd),
    input.totalCostUsd == null ? 0 : Number(input.totalCostUsd),
    JSON.stringify(input.metadata || {}),
  ]);
  return result.rows[0] || null;
}

function minuteWindowStart(date = new Date()) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d;
}

function dayWindowStartUtc(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

async function reserveTaskQuota(tenantId, options = {}) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');

    const planCode = String(options.planCode || 'free').trim();
    const defaults = getDefaultPlanValues(planCode);
    await client.query(
      `
      insert into resource_quotas (
        tenant_id, plan_code, max_runtimes, max_agents_per_runtime, max_concurrency,
        requests_per_minute, daily_request_limit, daily_budget_usd, cpu_limit_millicores, memory_limit_mb, recycle_idle_minutes
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      on conflict (tenant_id) do nothing
      `,
      [
        tenantId,
        defaults.planCode,
        defaults.maxRuntimes,
        defaults.maxAgentsPerRuntime,
        defaults.maxConcurrency,
        defaults.requestsPerMinute,
        defaults.dailyRequestLimit,
        defaults.dailyBudgetUsd,
        defaults.cpuLimitMillicores,
        defaults.memoryLimitMb,
        defaults.recycleIdleMinutes,
      ]
    );

    const quotaRes = await client.query(`${SELECT_QUOTA} from resource_quotas where tenant_id = $1 for update`, [tenantId]);
    const quota = mapQuota(quotaRes.rows[0]);
    if (!quota) throw new Error('quota not found');

    const runningRes = await client.query(
      `select count(*)::int as c from tasks where tenant_id = $1 and status in ('queued', 'running')`,
      [tenantId]
    );
    const running = Number(runningRes.rows[0]?.c || 0);
    if (running >= quota.maxConcurrency) {
      await client.query('rollback');
      return { ok: false, code: 'QUOTA_CONCURRENCY_EXCEEDED', reason: `max_concurrency=${quota.maxConcurrency}` };
    }

    const now = options.now ? new Date(options.now) : new Date();
    const minuteStart = minuteWindowStart(now);
    const dayStart = dayWindowStartUtc(now);

    const minuteRes = await client.query(
      `
      insert into usage_counters (tenant_id, metric_key, window_type, window_start, used)
      values ($1, 'task_dispatch', 'minute', $2, 1)
      on conflict (tenant_id, metric_key, window_type, window_start)
      do update set used = usage_counters.used + 1, updated_at = now()
      returning used
      `,
      [tenantId, minuteStart]
    );
    const minuteUsed = Number(minuteRes.rows[0]?.used || 0);
    if (minuteUsed > quota.requestsPerMinute) {
      await client.query('rollback');
      return { ok: false, code: 'QUOTA_RPM_EXCEEDED', reason: `requests_per_minute=${quota.requestsPerMinute}` };
    }

    const dayRes = await client.query(
      `
      insert into usage_counters (tenant_id, metric_key, window_type, window_start, used)
      values ($1, 'task_dispatch', 'day', $2, 1)
      on conflict (tenant_id, metric_key, window_type, window_start)
      do update set used = usage_counters.used + 1, updated_at = now()
      returning used
      `,
      [tenantId, dayStart]
    );
    const dayUsed = Number(dayRes.rows[0]?.used || 0);
    if (dayUsed > quota.dailyRequestLimit) {
      await client.query('rollback');
      return { ok: false, code: 'QUOTA_DAILY_LIMIT_EXCEEDED', reason: `daily_request_limit=${quota.dailyRequestLimit}` };
    }

    await client.query('commit');
    return {
      ok: true,
      quota,
      usage: {
        running,
        minuteUsed,
        dayUsed,
      },
    };
  } catch (err) {
    try { await client.query('rollback'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getDefaultPlanValues,
  ensureDefaultQuota,
  getQuota,
  upsertQuota,
  insertBillingEvent,
  reserveTaskQuota,
};
