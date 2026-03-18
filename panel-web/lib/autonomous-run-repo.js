const { isDbConfigured, query: dbQuery } = require('./db');

function normalizeRun(run) {
  if (!run || typeof run !== 'object') return null;
  return {
    ...run,
    id: String(run.id || '').trim(),
    tenantId: String(run.tenantId || 'public').trim() || 'public',
    projectId: String(run.projectId || '').trim(),
    status: String(run.status || 'running').trim() || 'running',
    currentAgentId: run.currentAgentId ? String(run.currentAgentId).trim() : null,
  };
}

function createAutonomousRunRepo() {
  async function get(runId, tenantId) {
    if (!isDbConfigured()) return null;
    try {
      const result = await dbQuery(
        `
        select payload
        from autonomous_runs
        where tenant_id = $1 and run_id = $2
        limit 1
        `,
        [String(tenantId || 'public').trim() || 'public', String(runId || '').trim()]
      );
      if (!result.rows[0]) return null;
      return normalizeRun(result.rows[0].payload);
    } catch (_) {
      return null;
    }
  }

  async function listByTenant(tenantId, options = {}) {
    if (!isDbConfigured()) return null;
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 200, 1), 1000);
    try {
      const result = await dbQuery(
        `
        select payload
        from autonomous_runs
        where tenant_id = $1
        order by updated_at desc
        limit $2
        `,
        [String(tenantId || 'public').trim() || 'public', limit]
      );
      return result.rows.map((row) => normalizeRun(row.payload)).filter(Boolean);
    } catch (_) {
      return null;
    }
  }

  async function upsert(run) {
    if (!isDbConfigured()) return null;
    const normalized = normalizeRun(run);
    if (!normalized || !normalized.id) return null;
    try {
      await dbQuery(
        `
        insert into autonomous_runs (tenant_id, run_id, project_id, status, current_agent_id, payload)
        values ($1, $2, $3, $4, $5, $6::jsonb)
        on conflict (tenant_id, run_id)
        do update set
          project_id = excluded.project_id,
          status = excluded.status,
          current_agent_id = excluded.current_agent_id,
          payload = excluded.payload,
          updated_at = now()
        `,
        [
          normalized.tenantId,
          normalized.id,
          normalized.projectId,
          normalized.status,
          normalized.currentAgentId,
          JSON.stringify(normalized),
        ]
      );
      return normalized;
    } catch (_) {
      return null;
    }
  }

  async function clearProject(projectId, tenantId) {
    if (!isDbConfigured()) return null;
    try {
      const result = await dbQuery(
        `
        delete from autonomous_runs
        where tenant_id = $1 and project_id = $2
        returning run_id
        `,
        [String(tenantId || 'public').trim() || 'public', String(projectId || '').trim()]
      );
      return result.rowCount;
    } catch (_) {
      return null;
    }
  }

  return {
    get,
    listByTenant,
    upsert,
    clearProject,
  };
}

module.exports = {
  createAutonomousRunRepo,
};
