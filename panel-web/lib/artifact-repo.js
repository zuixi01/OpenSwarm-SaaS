const { query: dbQuery } = require('./db');

function mapArtifact(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId || null,
    taskId: row.taskId || null,
    storageKey: row.storageKey,
    filename: row.filename,
    sizeBytes: Number(row.sizeBytes || 0),
    contentType: row.contentType || null,
    metadata: row.metadata || {},
    createdAt: row.createdAt,
  };
}

async function createArtifact(input) {
  const sql = `
    insert into artifacts (
      tenant_id,
      project_id,
      task_id,
      storage_key,
      filename,
      size_bytes,
      content_type,
      metadata
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    returning
      id,
      tenant_id as "tenantId",
      project_id as "projectId",
      task_id as "taskId",
      storage_key as "storageKey",
      filename,
      size_bytes as "sizeBytes",
      content_type as "contentType",
      metadata,
      created_at as "createdAt"
  `;
  const result = await dbQuery(sql, [
    input.tenantId,
    input.projectId || null,
    input.taskId || null,
    input.storageKey,
    input.filename,
    Number.isFinite(input.sizeBytes) ? input.sizeBytes : 0,
    input.contentType || null,
    JSON.stringify(input.metadata || {}),
  ]);
  return mapArtifact(result.rows[0]);
}

async function listArtifactsByProject(tenantId, projectId, options = {}) {
  const limit = Math.max(1, Math.min(500, parseInt(options.limit, 10) || 100));
  const sql = `
    select
      id,
      tenant_id as "tenantId",
      project_id as "projectId",
      task_id as "taskId",
      storage_key as "storageKey",
      filename,
      size_bytes as "sizeBytes",
      content_type as "contentType",
      metadata,
      created_at as "createdAt"
    from artifacts
    where tenant_id = $1 and project_id = $2
    order by created_at desc
    limit $3
  `;
  const result = await dbQuery(sql, [tenantId, projectId, limit]);
  return result.rows.map(mapArtifact);
}

module.exports = {
  createArtifact,
  listArtifactsByProject,
};
