const fs = require('fs');
const { isDbConfigured, query: dbQuery } = require('./db');

function readJsonArray(file) {
  try {
    if (!file || !fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch (_) {
    return [];
  }
}

function writeJsonArray(file, items) {
  fs.writeFileSync(file, JSON.stringify(Array.isArray(items) ? items : [], null, 2));
}

function createTenantSecurityRepo(options = {}) {
  const { tenantPaths } = options;
  if (!tenantPaths) throw new Error('tenantPaths is required');
  let tenantMemberSchemaReady = false;
  let tenantMemberSchemaPromise = null;

  async function ensureTenantMemberSchema() {
    if (!isDbConfigured() || tenantMemberSchemaReady) return;
    if (!tenantMemberSchemaPromise) {
      tenantMemberSchemaPromise = (async () => {
        await dbQuery(`
          alter table tenant_members
          add column if not exists updated_at timestamptz not null default now()
        `);
        await dbQuery(`
          update tenant_members
          set updated_at = coalesce(updated_at, created_at, now())
          where updated_at is null
        `);
        await dbQuery(`
          drop trigger if exists tg_phase1_tenant_members_updated_at on tenant_members;
          create trigger tg_phase1_tenant_members_updated_at
          before update on tenant_members
          for each row execute function phase1_set_updated_at();
        `);
        tenantMemberSchemaReady = true;
      })().finally(() => {
        tenantMemberSchemaPromise = null;
      });
    }
    await tenantMemberSchemaPromise;
  }

  async function listMembers(tenantId) {
    if (isDbConfigured()) {
      await ensureTenantMemberSchema();
      const result = await dbQuery(
        `
        select
          tm.tenant_id as "tenantId",
          tm.user_id as "userId",
          lower(coalesce(u.email, '')) as email,
          tm.role,
          tm.created_at as "createdAt",
          tm.updated_at as "updatedAt"
        from tenant_members tm
        left join users u on u.id = tm.user_id
        where tm.tenant_id::text = $1
        order by tm.created_at asc
        `,
        [String(tenantId || 'public').trim() || 'public']
      );
      return result.rows.map((item) => ({
        tenantId: String(item.tenantId || tenantId || 'public').trim() || 'public',
        userId: item.userId ? String(item.userId).trim() : null,
        email: item.email ? String(item.email).trim().toLowerCase() : null,
        role: String(item.role || 'member').trim() || 'member',
        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null,
      }));
    }
    const file = tenantPaths.tenantMembersFile(tenantId);
    return readJsonArray(file)
      .map((item) => ({
        tenantId: String(item.tenantId || tenantId || 'public').trim() || 'public',
        userId: item.userId ? String(item.userId).trim() : null,
        email: item.email ? String(item.email).trim().toLowerCase() : null,
        role: String(item.role || 'member').trim() || 'member',
        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null,
      }))
      .filter((item) => item.userId || item.email);
  }

  async function getMember(tenantId, principal = {}) {
    const userId = principal.userId ? String(principal.userId).trim() : '';
    const email = principal.email ? String(principal.email).trim().toLowerCase() : '';
    if (!userId && !email) return null;
    if (isDbConfigured()) {
      await ensureTenantMemberSchema();
      const result = await dbQuery(
        `
        select
          tm.tenant_id as "tenantId",
          tm.user_id as "userId",
          lower(coalesce(u.email, '')) as email,
          tm.role,
          tm.created_at as "createdAt",
          tm.updated_at as "updatedAt"
        from tenant_members tm
        left join users u on u.id = tm.user_id
        where tm.tenant_id::text = $1
          and (
            ($2 <> '' and tm.user_id::text = $2)
            or ($3 <> '' and lower(coalesce(u.email, '')) = $3)
          )
        limit 1
        `,
        [String(tenantId || 'public').trim() || 'public', userId, email]
      );
      return result.rows[0] || null;
    }
    const items = await listMembers(tenantId);
    return items.find((item) => (userId && item.userId === userId) || (email && item.email === email)) || null;
  }

  async function upsertMember(tenantId, input = {}) {
    const file = tenantPaths.tenantMembersFile(tenantId);
    const userId = input.userId ? String(input.userId).trim() : '';
    const email = input.email ? String(input.email).trim().toLowerCase() : '';
    const role = String(input.role || 'member').trim() || 'member';
    if (!userId && !email) throw new Error('userId or email is required');
    if (isDbConfigured()) {
      await ensureTenantMemberSchema();
      let resolvedUserId = userId;
      if (!resolvedUserId && email) {
        const existingUser = await dbQuery(
          `select id from users where lower(email) = $1 limit 1`,
          [email]
        );
        if (existingUser.rows[0]?.id) resolvedUserId = existingUser.rows[0].id;
      }
      if (!resolvedUserId) throw new Error('userId is required when DATABASE_URL is configured and email is unknown');
      const result = await dbQuery(
        `
        insert into tenant_members (tenant_id, user_id, role)
        values ($1, $2, $3)
        on conflict (tenant_id, user_id)
        do update set role = excluded.role, updated_at = now()
        returning
          tenant_id as "tenantId",
          user_id as "userId",
          role,
          created_at as "createdAt",
          updated_at as "updatedAt"
        `,
        [String(tenantId || 'public').trim() || 'public', resolvedUserId, role]
      );
      const row = result.rows[0] || {};
      let finalEmail = email;
      if (!finalEmail) {
        const userRes = await dbQuery(`select lower(email) as email from users where id = $1 limit 1`, [resolvedUserId]);
        finalEmail = userRes.rows[0]?.email || null;
      }
      return {
        tenantId: row.tenantId || String(tenantId || 'public').trim() || 'public',
        userId: row.userId ? String(row.userId).trim() : resolvedUserId,
        email: finalEmail,
        role: String(row.role || role).trim() || role,
        createdAt: row.createdAt || null,
        updatedAt: row.updatedAt || null,
      };
    }
    const now = new Date().toISOString();
    const items = await listMembers(tenantId);
    const idx = items.findIndex((item) => (userId && item.userId === userId) || (email && item.email === email));
    const next = {
      tenantId: String(tenantId || 'public').trim() || 'public',
      userId: userId || null,
      email: email || null,
      role,
      createdAt: idx >= 0 ? (items[idx].createdAt || now) : now,
      updatedAt: now,
    };
    if (idx >= 0) items[idx] = { ...items[idx], ...next };
    else items.push(next);
    writeJsonArray(file, items);
    return next;
  }

  async function ensureBootstrapMember(tenantId, principal = {}, role = 'owner') {
    const existing = await getMember(tenantId, principal);
    if (existing) return existing;
    return upsertMember(tenantId, {
      userId: principal.userId || null,
      email: principal.email || null,
      role,
    });
  }

  async function appendAuditLog(tenantId, entry = {}) {
    if (isDbConfigured()) {
      const metadata = entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {};
      const result = await dbQuery(
        `
        insert into audit_logs (
          tenant_id, user_id, action, target_type, target_id, ip, metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb)
        returning
          id,
          tenant_id as "tenantId",
          user_id as "userId",
          action,
          target_type as "targetType",
          target_id as "targetId",
          ip,
          metadata,
          created_at as "createdAt"
        `,
        [
          String(tenantId || 'public').trim() || 'public',
          entry.userId || null,
          String(entry.action || 'unknown').trim() || 'unknown',
          entry.targetType || null,
          entry.targetId || null,
          entry.ip || null,
          JSON.stringify(metadata),
        ]
      );
      const row = result.rows[0] || {};
      return {
        id: row.id || null,
        tenantId: row.tenantId || String(tenantId || 'public').trim() || 'public',
        userId: row.userId || null,
        email: entry.email ? String(entry.email).trim().toLowerCase() : null,
        role: entry.role ? String(entry.role).trim() : null,
        action: row.action || entry.action || 'unknown',
        targetType: row.targetType || entry.targetType || null,
        targetId: row.targetId || entry.targetId || null,
        ip: row.ip || entry.ip || null,
        metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : metadata,
        createdAt: row.createdAt || entry.createdAt || new Date().toISOString(),
      };
    }
    const file = tenantPaths.tenantAuditLogFile(tenantId);
    const items = readJsonArray(file);
    items.push({
      id: entry.id || `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId: String(tenantId || 'public').trim() || 'public',
      userId: entry.userId ? String(entry.userId).trim() : null,
      email: entry.email ? String(entry.email).trim().toLowerCase() : null,
      role: entry.role ? String(entry.role).trim() : null,
      action: String(entry.action || 'unknown').trim() || 'unknown',
      targetType: entry.targetType ? String(entry.targetType).trim() : null,
      targetId: entry.targetId ? String(entry.targetId).trim() : null,
      ip: entry.ip ? String(entry.ip).trim() : null,
      metadata: entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {},
      createdAt: entry.createdAt || new Date().toISOString(),
    });
    writeJsonArray(file, items);
    return items[items.length - 1];
  }

  async function listAuditLogs(tenantId, limit = 100) {
    if (isDbConfigured()) {
      const result = await dbQuery(
        `
        select
          id,
          tenant_id as "tenantId",
          user_id as "userId",
          action,
          target_type as "targetType",
          target_id as "targetId",
          ip,
          metadata,
          created_at as "createdAt"
        from audit_logs
        where tenant_id = $1
        order by created_at desc
        limit $2
        `,
        [String(tenantId || 'public').trim() || 'public', Math.max(1, Math.min(Number(limit) || 100, 500))]
      );
      return result.rows.map((row) => ({
        id: row.id || null,
        tenantId: row.tenantId || String(tenantId || 'public').trim() || 'public',
        userId: row.userId || null,
        email: null,
        role: null,
        action: row.action || 'unknown',
        targetType: row.targetType || null,
        targetId: row.targetId || null,
        ip: row.ip || null,
        metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
        createdAt: row.createdAt || null,
      }));
    }
    return readJsonArray(tenantPaths.tenantAuditLogFile(tenantId))
      .slice()
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, Math.max(1, Math.min(Number(limit) || 100, 500)));
  }

  return {
    listMembers,
    getMember,
    upsertMember,
    ensureBootstrapMember,
    appendAuditLog,
    listAuditLogs,
  };
}

module.exports = {
  createTenantSecurityRepo,
};
