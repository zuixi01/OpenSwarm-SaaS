const { query: dbQuery } = require('./db');

function mapSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    mode: row.mode,
    createdAt: row.createdAt,
  };
}

function mapMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    sessionId: row.sessionId,
    role: row.role,
    runtimeAgentId: row.runtimeAgentId || null,
    content: row.content,
    metadata: row.metadata || {},
    createdAt: row.createdAt,
  };
}

async function createSession(input) {
  const sql = `
    insert into chat_sessions (tenant_id, project_id, mode)
    values ($1, $2, $3)
    returning
      id,
      tenant_id as "tenantId",
      project_id as "projectId",
      mode,
      created_at as "createdAt"
  `;
  const result = await dbQuery(sql, [input.tenantId, input.projectId || null, input.mode || 'yin']);
  return mapSession(result.rows[0]);
}

async function getSessionByIdForTenant(sessionId, tenantId) {
  const sql = `
    select
      id,
      tenant_id as "tenantId",
      project_id as "projectId",
      mode,
      created_at as "createdAt"
    from chat_sessions
    where id = $1 and tenant_id = $2
    limit 1
  `;
  const result = await dbQuery(sql, [sessionId, tenantId]);
  return mapSession(result.rows[0]);
}

async function listSessionsByProject(tenantId, projectId, options = {}) {
  const limit = Math.max(1, Math.min(200, parseInt(options.limit, 10) || 50));
  const sql = `
    select
      id,
      tenant_id as "tenantId",
      project_id as "projectId",
      mode,
      created_at as "createdAt"
    from chat_sessions
    where tenant_id = $1 and project_id = $2
    order by created_at desc
    limit $3
  `;
  const result = await dbQuery(sql, [tenantId, projectId, limit]);
  return result.rows.map(mapSession);
}

async function appendMessage(input) {
  const sql = `
    insert into chat_messages (
      tenant_id,
      project_id,
      session_id,
      role,
      runtime_agent_id,
      content,
      metadata
    )
    values ($1, $2, $3, $4, $5, $6, $7::jsonb)
    returning
      id,
      tenant_id as "tenantId",
      project_id as "projectId",
      session_id as "sessionId",
      role,
      runtime_agent_id as "runtimeAgentId",
      content,
      metadata,
      created_at as "createdAt"
  `;
  const result = await dbQuery(sql, [
    input.tenantId,
    input.projectId || null,
    input.sessionId,
    input.role,
    input.runtimeAgentId || null,
    input.content,
    JSON.stringify(input.metadata || {}),
  ]);
  return mapMessage(result.rows[0]);
}

async function listMessagesBySession(tenantId, sessionId, options = {}) {
  const limit = Math.max(1, Math.min(500, parseInt(options.limit, 10) || 100));
  const sql = `
    select
      id,
      tenant_id as "tenantId",
      project_id as "projectId",
      session_id as "sessionId",
      role,
      runtime_agent_id as "runtimeAgentId",
      content,
      metadata,
      created_at as "createdAt"
    from chat_messages
    where tenant_id = $1 and session_id = $2
    order by id asc
    limit $3
  `;
  const result = await dbQuery(sql, [tenantId, sessionId, limit]);
  return result.rows.map(mapMessage);
}

module.exports = {
  createSession,
  getSessionByIdForTenant,
  listSessionsByProject,
  appendMessage,
  listMessagesBySession,
};
