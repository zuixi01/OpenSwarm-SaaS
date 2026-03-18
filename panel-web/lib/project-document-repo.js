const { isDbConfigured, query: dbQuery } = require('./db');

function createProjectDocumentRepo() {
  async function replaceProjectConfigsForTenant(tenantId, projects = []) {
    if (!isDbConfigured()) return null;
    const safeTenantId = String(tenantId || 'public').trim() || 'public';
    const items = Array.isArray(projects) ? projects : [];
    try {
      await dbQuery(
        `
        delete from project_documents
        where tenant_id = $1 and kind = 'project_config'
        `,
        [safeTenantId]
      );
      for (const project of items) {
        if (!project || !project.id) continue;
        await dbQuery(
          `
          insert into project_documents (tenant_id, project_id, kind, document, version)
          values ($1, $2, 'project_config', $3::jsonb, 1)
          on conflict (tenant_id, project_id, kind)
          do update
            set document = excluded.document,
                version = project_documents.version + 1,
                updated_at = now()
          `,
          [safeTenantId, String(project.id).trim(), JSON.stringify(project)]
        );
      }
      return items.length;
    } catch (_) {
      return null;
    }
  }

  async function deleteDocument(tenantId, projectId, kind) {
    if (!isDbConfigured()) return null;
    try {
      const result = await dbQuery(
        `
        delete from project_documents
        where tenant_id = $1 and project_id = $2 and kind = $3
        `,
        [
          String(tenantId || 'public').trim() || 'public',
          String(projectId || '').trim(),
          String(kind || '').trim(),
        ]
      );
      return result.rowCount;
    } catch (_) {
      return null;
    }
  }

  async function listDocumentsByTenant(tenantId, kind) {
    if (!isDbConfigured()) return null;
    const params = [String(tenantId || 'public').trim() || 'public'];
    let sql = `
      select project_id as "projectId", kind, document, version, created_at as "createdAt", updated_at as "updatedAt"
      from project_documents
      where tenant_id = $1
    `;
    if (kind) {
      params.push(String(kind || '').trim());
      sql += ' and kind = $2';
    }
    sql += ' order by updated_at desc';
    try {
      const result = await dbQuery(sql, params);
      return result.rows.map((row) => ({
        tenantId: String(tenantId || 'public').trim() || 'public',
        projectId: String(row.projectId || '').trim(),
        kind: String(row.kind || '').trim(),
        document: row.document && typeof row.document === 'object' ? row.document : {},
        version: Number(row.version || 1),
        createdAt: row.createdAt || null,
        updatedAt: row.updatedAt || null,
      }));
    } catch (_) {
      return null;
    }
  }

  async function readDocument(tenantId, projectId, kind) {
    if (!isDbConfigured()) return null;
    try {
      const result = await dbQuery(
        `
        select document, version, created_at as "createdAt", updated_at as "updatedAt"
        from project_documents
        where tenant_id = $1 and project_id = $2 and kind = $3
        limit 1
        `,
        [
          String(tenantId || 'public').trim() || 'public',
          String(projectId || '').trim(),
          String(kind || '').trim(),
        ]
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        tenantId: String(tenantId || 'public').trim() || 'public',
        projectId: String(projectId || '').trim(),
        kind: String(kind || '').trim(),
        document: row.document && typeof row.document === 'object' ? row.document : {},
        version: Number(row.version || 1),
        createdAt: row.createdAt || null,
        updatedAt: row.updatedAt || null,
      };
    } catch (_) {
      return null;
    }
  }

  async function writeDocument(tenantId, projectId, kind, document) {
    if (!isDbConfigured()) return null;
    const safeDocument = document && typeof document === 'object' ? document : {};
    try {
      const result = await dbQuery(
        `
        insert into project_documents (tenant_id, project_id, kind, document, version)
        values ($1, $2, $3, $4::jsonb, 1)
        on conflict (tenant_id, project_id, kind)
        do update
          set document = excluded.document,
              version = project_documents.version + 1,
              updated_at = now()
        returning version, created_at as "createdAt", updated_at as "updatedAt"
        `,
        [
          String(tenantId || 'public').trim() || 'public',
          String(projectId || '').trim(),
          String(kind || '').trim(),
          JSON.stringify(safeDocument),
        ]
      );
      const row = result.rows[0] || {};
      return {
        tenantId: String(tenantId || 'public').trim() || 'public',
        projectId: String(projectId || '').trim(),
        kind: String(kind || '').trim(),
        document: safeDocument,
        version: Number(row.version || 1),
        createdAt: row.createdAt || null,
        updatedAt: row.updatedAt || null,
      };
    } catch (_) {
      return null;
    }
  }

  return {
    replaceProjectConfigsForTenant,
    deleteDocument,
    listDocumentsByTenant,
    readDocument,
    writeDocument,
  };
}

module.exports = {
  createProjectDocumentRepo,
};
