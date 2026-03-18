const { query: dbQuery } = require('./db');

function mapProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    status: row.status,
    createdBy: row.createdBy || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

async function createProject(input) {
  const sql = `
    insert into projects (tenant_id, name, description, status, created_by)
    values ($1, $2, $3, coalesce($4, 'active'), $5)
    returning
      id,
      tenant_id as "tenantId",
      name,
      description,
      status,
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;
  const params = [
    input.tenantId,
    input.name,
    input.description || null,
    input.status || 'active',
    input.createdBy || null,
  ];
  const result = await dbQuery(sql, params);
  return mapProject(result.rows[0]);
}

async function getProjectById(projectId) {
  const sql = `
    select
      id,
      tenant_id as "tenantId",
      name,
      description,
      status,
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from projects
    where id = $1
    limit 1
  `;
  const result = await dbQuery(sql, [projectId]);
  return mapProject(result.rows[0]);
}

async function getProjectByIdForTenant(projectId, tenantId) {
  const sql = `
    select
      id,
      tenant_id as "tenantId",
      name,
      description,
      status,
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from projects
    where id = $1 and tenant_id = $2
    limit 1
  `;
  const result = await dbQuery(sql, [projectId, tenantId]);
  return mapProject(result.rows[0]);
}

async function listProjectsByTenant(tenantId, options = {}) {
  const limit = Math.max(1, Math.min(200, parseInt(options.limit, 10) || 50));
  const offset = Math.max(0, parseInt(options.offset, 10) || 0);
  const sql = `
    select
      id,
      tenant_id as "tenantId",
      name,
      description,
      status,
      created_by as "createdBy",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from projects
    where tenant_id = $1
    order by created_at desc
    limit $2 offset $3
  `;
  const result = await dbQuery(sql, [tenantId, limit, offset]);
  return result.rows.map(mapProject);
}

module.exports = {
  createProject,
  getProjectById,
  getProjectByIdForTenant,
  listProjectsByTenant,
};
