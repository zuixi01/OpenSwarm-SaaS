const { query: dbQuery } = require('./db');

function mapTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    workflowRunId: row.workflowRunId,
    runtimeAgentId: row.runtimeAgentId,
    taskType: row.taskType,
    status: row.status,
    input: row.input || {},
    output: row.output || null,
    error: row.error || null,
    retryCount: Number(row.retryCount || 0),
    createdAt: row.createdAt || null,
    startedAt: row.startedAt || null,
    finishedAt: row.finishedAt || null,
  };
}

async function createTask(input) {
  const tenantId = String(input.tenantId || '').trim();
  if (!tenantId) throw new Error('tenantId is required');
  const sql = `
    insert into tasks (
      tenant_id,
      project_id,
      workflow_run_id,
      runtime_agent_id,
      task_type,
      status,
      input,
      output,
      error,
      retry_count,
      started_at,
      finished_at
    )
    values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12)
    returning
      id,
      tenant_id as "tenantId",
      project_id as "projectId",
      workflow_run_id as "workflowRunId",
      runtime_agent_id as "runtimeAgentId",
      task_type as "taskType",
      status,
      input,
      output,
      error,
      retry_count as "retryCount",
      created_at as "createdAt",
      started_at as "startedAt",
      finished_at as "finishedAt"
  `;
  const params = [
    tenantId,
    input.projectId || null,
    input.workflowRunId || null,
    input.runtimeAgentId || null,
    input.taskType,
    input.status || 'queued',
    JSON.stringify(input.input || {}),
    input.output != null ? JSON.stringify(input.output) : null,
    input.error || null,
    Number.isFinite(input.retryCount) ? input.retryCount : 0,
    input.startedAt || null,
    input.finishedAt || null,
  ];
  const result = await dbQuery(sql, params);
  return mapTask(result.rows[0]);
}

async function getTaskById(taskId, tenantId = null) {
  const sql = `
    select
      id,
      tenant_id as "tenantId",
      project_id as "projectId",
      workflow_run_id as "workflowRunId",
      runtime_agent_id as "runtimeAgentId",
      task_type as "taskType",
      status,
      input,
      output,
      error,
      retry_count as "retryCount",
      created_at as "createdAt",
      started_at as "startedAt",
      finished_at as "finishedAt"
    from tasks
    where id = $1
      and ($2::uuid is null or tenant_id = $2)
    limit 1
  `;
  const result = await dbQuery(sql, [taskId, tenantId || null]);
  return mapTask(result.rows[0]);
}

async function updateTask(taskId, tenantOrPatch, maybePatch) {
  const hasTenant = typeof tenantOrPatch === 'string' && !!tenantOrPatch.trim();
  const tenantId = hasTenant ? tenantOrPatch.trim() : null;
  const patch = hasTenant ? (maybePatch || {}) : (tenantOrPatch || {});
  const sql = `
    update tasks
    set
      status = coalesce($2, status),
      output = coalesce($3::jsonb, output),
      error = coalesce($4, error),
      retry_count = coalesce($5, retry_count),
      started_at = coalesce($6, started_at),
      finished_at = coalesce($7, finished_at)
    where id = $1
      and ($8::uuid is null or tenant_id = $8)
    returning
      id,
      tenant_id as "tenantId",
      project_id as "projectId",
      workflow_run_id as "workflowRunId",
      runtime_agent_id as "runtimeAgentId",
      task_type as "taskType",
      status,
      input,
      output,
      error,
      retry_count as "retryCount",
      created_at as "createdAt",
      started_at as "startedAt",
      finished_at as "finishedAt"
  `;
  const params = [
    taskId,
    patch.status || null,
    patch.output != null ? JSON.stringify(patch.output) : null,
    patch.error || null,
    Number.isFinite(patch.retryCount) ? patch.retryCount : null,
    patch.startedAt || null,
    patch.finishedAt || null,
    tenantId,
  ];
  const result = await dbQuery(sql, params);
  return mapTask(result.rows[0]);
}

async function listTasksByProject(tenantId, projectId, options = {}) {
  const limit = Math.max(1, Math.min(200, parseInt(options.limit, 10) || 50));
  const sql = `
    select
      id,
      tenant_id as "tenantId",
      project_id as "projectId",
      workflow_run_id as "workflowRunId",
      runtime_agent_id as "runtimeAgentId",
      task_type as "taskType",
      status,
      input,
      output,
      error,
      retry_count as "retryCount",
      created_at as "createdAt",
      started_at as "startedAt",
      finished_at as "finishedAt"
    from tasks
    where tenant_id = $1 and project_id = $2
    order by created_at desc
    limit $3
  `;
  const result = await dbQuery(sql, [tenantId, projectId, limit]);
  return result.rows.map(mapTask);
}

module.exports = {
  createTask,
  getTaskById,
  updateTask,
  listTasksByProject,
};
