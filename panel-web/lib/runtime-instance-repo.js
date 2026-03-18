const { query: dbQuery } = require('./db');

function mapRuntime(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    mode: row.mode,
    region: row.region,
    status: row.status,
    endpoint: row.endpoint || null,
    gatewayPort: row.gatewayPort == null ? null : Number(row.gatewayPort),
    stateDir: row.stateDir || null,
    pid: row.pid == null ? null : Number(row.pid),
    desiredAgents: Number(row.desiredAgents || 0),
    runningAgents: Number(row.runningAgents || 0),
    limits: row.limits || {},
    heartbeatAt: row.heartbeatAt || null,
    lastStartedAt: row.lastStartedAt || null,
    lastStoppedAt: row.lastStoppedAt || null,
    crashCount: Number(row.crashCount || 0),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

const SELECT_RUNTIME = `
  select
    id,
    tenant_id as "tenantId",
    mode,
    region,
    status,
    endpoint,
    gateway_port as "gatewayPort",
    state_dir as "stateDir",
    pid,
    desired_agents as "desiredAgents",
    running_agents as "runningAgents",
    limits,
    heartbeat_at as "heartbeatAt",
    last_started_at as "lastStartedAt",
    last_stopped_at as "lastStoppedAt",
    crash_count as "crashCount",
    created_at as "createdAt",
    updated_at as "updatedAt"
`;

async function createRuntime(input) {
  const sql = `
    insert into runtime_instances (
      tenant_id, mode, region, status, endpoint, gateway_port, state_dir, pid, desired_agents, running_agents, limits, heartbeat_at
    )
    values ($1, $2, $3, 'creating', $4, $5, $6, $7, $8, $9, $10::jsonb, now())
    returning
      id,
      tenant_id as "tenantId",
      mode,
      region,
      status,
      endpoint,
      gateway_port as "gatewayPort",
      state_dir as "stateDir",
      pid,
      desired_agents as "desiredAgents",
      running_agents as "runningAgents",
      limits,
      heartbeat_at as "heartbeatAt",
      last_started_at as "lastStartedAt",
      last_stopped_at as "lastStoppedAt",
      crash_count as "crashCount",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;
  const result = await dbQuery(sql, [
    input.tenantId,
    input.mode || 'local',
    input.region || 'local',
    input.endpoint || null,
    input.gatewayPort || null,
    input.stateDir || null,
    input.pid || null,
    input.desiredAgents || 1,
    input.runningAgents || 0,
    JSON.stringify(input.limits || {}),
  ]);
  return mapRuntime(result.rows[0]);
}

async function getByTenantId(tenantId) {
  const sql = `
    ${SELECT_RUNTIME}
    from runtime_instances
    where tenant_id = $1
    limit 1
  `;
  const result = await dbQuery(sql, [tenantId]);
  return mapRuntime(result.rows[0]);
}

async function getByIdForTenant(runtimeId, tenantId) {
  const sql = `
    ${SELECT_RUNTIME}
    from runtime_instances
    where id = $1 and tenant_id = $2
    limit 1
  `;
  const result = await dbQuery(sql, [runtimeId, tenantId]);
  return mapRuntime(result.rows[0]);
}

async function listRunning() {
  const sql = `
    ${SELECT_RUNTIME}
    from runtime_instances
    where status = 'running'
    order by updated_at desc
  `;
  const result = await dbQuery(sql, []);
  return result.rows.map(mapRuntime);
}

async function listAll() {
  const sql = `
    ${SELECT_RUNTIME}
    from runtime_instances
    order by updated_at desc
  `;
  const result = await dbQuery(sql, []);
  return result.rows.map(mapRuntime);
}

async function updateRuntime(runtimeId, patch) {
  const sql = `
    update runtime_instances
    set
      mode = coalesce($2, mode),
      region = coalesce($3, region),
      status = coalesce($4, status),
      endpoint = coalesce($5, endpoint),
      gateway_port = coalesce($6, gateway_port),
      state_dir = coalesce($7, state_dir),
      pid = case when $8::bigint is null then pid else $8 end,
      desired_agents = coalesce($9, desired_agents),
      running_agents = coalesce($10, running_agents),
      limits = coalesce($11::jsonb, limits),
      heartbeat_at = coalesce($12, heartbeat_at),
      last_started_at = coalesce($13, last_started_at),
      last_stopped_at = coalesce($14, last_stopped_at),
      crash_count = coalesce($15, crash_count)
    where id = $1
    returning
      id,
      tenant_id as "tenantId",
      mode,
      region,
      status,
      endpoint,
      gateway_port as "gatewayPort",
      state_dir as "stateDir",
      pid,
      desired_agents as "desiredAgents",
      running_agents as "runningAgents",
      limits,
      heartbeat_at as "heartbeatAt",
      last_started_at as "lastStartedAt",
      last_stopped_at as "lastStoppedAt",
      crash_count as "crashCount",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;
  const result = await dbQuery(sql, [
    runtimeId,
    patch.mode || null,
    patch.region || null,
    patch.status || null,
    patch.endpoint || null,
    patch.gatewayPort || null,
    patch.stateDir || null,
    patch.pid == null ? null : Number(patch.pid),
    patch.desiredAgents == null ? null : Number(patch.desiredAgents),
    patch.runningAgents == null ? null : Number(patch.runningAgents),
    patch.limits != null ? JSON.stringify(patch.limits) : null,
    patch.heartbeatAt || null,
    patch.lastStartedAt || null,
    patch.lastStoppedAt || null,
    patch.crashCount == null ? null : Number(patch.crashCount),
  ]);
  return mapRuntime(result.rows[0]);
}

module.exports = {
  createRuntime,
  getByTenantId,
  getByIdForTenant,
  listAll,
  listRunning,
  updateRuntime,
};
