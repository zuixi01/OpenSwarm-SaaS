const { isDbConfigured, query: dbQuery } = require('./db');

function normalize(projectId, entries) {
  return {
    projectId: String(projectId || '').trim(),
    entries: Array.isArray(entries) ? entries : [],
  };
}

function createProjectMemoryRepo() {
  async function read(projectId, tenantId) {
    if (!isDbConfigured()) return null;
    try {
      const result = await dbQuery(
        `
        select entries
        from project_memories
        where tenant_id = $1 and project_id = $2
        limit 1
        `,
        [String(tenantId || 'public').trim() || 'public', String(projectId || '').trim()]
      );
      if (!result.rows[0]) return null;
      return normalize(projectId, result.rows[0].entries);
    } catch (_) {
      return null;
    }
  }

  async function replace(projectId, tenantId, entries) {
    if (!isDbConfigured()) return null;
    const normalizedEntries = Array.isArray(entries) ? entries : [];
    try {
      await dbQuery(
        `
        insert into project_memories (tenant_id, project_id, entries)
        values ($1, $2, $3::jsonb)
        on conflict (tenant_id, project_id)
        do update set entries = excluded.entries, updated_at = now()
        `,
        [
          String(tenantId || 'public').trim() || 'public',
          String(projectId || '').trim(),
          JSON.stringify(normalizedEntries),
        ]
      );
      return normalize(projectId, normalizedEntries);
    } catch (_) {
      return null;
    }
  }

  async function clear(projectId, tenantId) {
    if (!isDbConfigured()) return null;
    try {
      const result = await dbQuery(
        `delete from project_memories where tenant_id = $1 and project_id = $2 returning 1`,
        [String(tenantId || 'public').trim() || 'public', String(projectId || '').trim()]
      );
      if (!result.rows[0]) return null;
      return { ok: true };
    } catch (_) {
      return null;
    }
  }

  return {
    read,
    replace,
    clear,
  };
}

module.exports = {
  createProjectMemoryRepo,
};
