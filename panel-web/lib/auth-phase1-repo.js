const { getPool, isDbConfigured } = require('./db');

function assertDbReady() {
  if (!isDbConfigured()) {
    const err = new Error('DATABASE_URL not configured');
    err.code = 'DB_NOT_CONFIGURED';
    throw err;
  }
}

async function withTx(fn) {
  assertDbReady();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const data = await fn(client);
    await client.query('commit');
    return data;
  } catch (err) {
    try { await client.query('rollback'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function findUserByEmail(email) {
  assertDbReady();
  const pool = getPool();
  const sql = `
    select id, email, password_hash as "passwordHash", status
    from users
    where email = $1
    limit 1
  `;
  const result = await pool.query(sql, [String(email || '').trim().toLowerCase()]);
  return result.rows[0] || null;
}

async function findTenantMemberByUser(userId, preferredTenantId) {
  assertDbReady();
  const pool = getPool();
  if (preferredTenantId) {
    const result = await pool.query(
      `
      select tm.tenant_id as "tenantId", tm.role, t.name
      from tenant_members tm
      join tenants t on t.id = tm.tenant_id
      where tm.user_id = $1 and tm.tenant_id = $2
      limit 1
      `,
      [userId, preferredTenantId]
    );
    if (result.rows[0]) return result.rows[0];
  }
  const fallback = await pool.query(
    `
    select tm.tenant_id as "tenantId", tm.role, t.name
    from tenant_members tm
    join tenants t on t.id = tm.tenant_id
    where tm.user_id = $1
    order by tm.created_at asc
    limit 1
    `,
    [userId]
  );
  return fallback.rows[0] || null;
}

async function listTenantMembershipsByUser(userId) {
  assertDbReady();
  const pool = getPool();
  const result = await pool.query(
    `
    select tm.tenant_id as "tenantId", tm.role, t.name
    from tenant_members tm
    join tenants t on t.id = tm.tenant_id
    where tm.user_id = $1
    order by tm.created_at asc
    `,
    [userId]
  );
  return result.rows || [];
}

async function findOrCreateUserByEmail(email, status = 'invited') {
  assertDbReady();
  const pool = getPool();
  const safeEmail = String(email || '').trim().toLowerCase();
  if (!safeEmail) throw new Error('email is required');
  const result = await pool.query(
    `
    insert into users (email, password_hash, status)
    values ($1, $2, $3)
    on conflict (email)
    do update set email = excluded.email
    returning id, email, status
    `,
    [safeEmail, `invite:${safeEmail}`, String(status || 'invited').trim() || 'invited']
  );
  return result.rows[0] || null;
}

async function ensureUserIdentitySchema() {
  assertDbReady();
  const pool = getPool();
  await pool.query(`
    create table if not exists user_identities (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      provider text not null,
      provider_subject text not null,
      email text,
      profile jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (provider, provider_subject),
      unique (user_id, provider)
    )
  `);
  await pool.query(`create index if not exists idx_user_identities_user on user_identities(user_id)`);
  await pool.query(`
    drop trigger if exists tg_user_identities_updated_at on user_identities;
    create trigger tg_user_identities_updated_at
    before update on user_identities
    for each row execute function phase1_set_updated_at();
  `);
}

async function findUserByIdentity(provider, providerSubject) {
  assertDbReady();
  await ensureUserIdentitySchema();
  const pool = getPool();
  const result = await pool.query(
    `
    select
      u.id,
      u.email,
      u.password_hash as "passwordHash",
      u.status,
      ui.provider,
      ui.provider_subject as "providerSubject"
    from user_identities ui
    join users u on u.id = ui.user_id
    where ui.provider = $1 and ui.provider_subject = $2
    limit 1
    `,
    [String(provider || '').trim(), String(providerSubject || '').trim()]
  );
  return result.rows[0] || null;
}

async function linkUserIdentity(payload) {
  assertDbReady();
  await ensureUserIdentitySchema();
  const pool = getPool();
  const result = await pool.query(
    `
    insert into user_identities (user_id, provider, provider_subject, email, profile)
    values ($1, $2, $3, $4, $5::jsonb)
    on conflict (provider, provider_subject)
    do update set
      user_id = excluded.user_id,
      email = excluded.email,
      profile = excluded.profile,
      updated_at = now()
    returning id, user_id as "userId", provider, provider_subject as "providerSubject", email
    `,
    [
      payload.userId,
      String(payload.provider || '').trim(),
      String(payload.providerSubject || '').trim(),
      payload.email ? String(payload.email).trim().toLowerCase() : null,
      JSON.stringify(payload.profile && typeof payload.profile === 'object' ? payload.profile : {}),
    ]
  );
  return result.rows[0] || null;
}

async function activateUser(userId) {
  assertDbReady();
  const pool = getPool();
  const result = await pool.query(
    `
    update users
    set status = 'active'
    where id = $1
    returning id, email, password_hash as "passwordHash", status
    `,
    [userId]
  );
  return result.rows[0] || null;
}

async function createUserAndTenant(payload) {
  const email = String(payload?.email || '').trim().toLowerCase();
  const passwordHash = String(payload?.passwordHash || '');
  const tenantName = String(payload?.tenantName || '').trim() || 'My Workspace';
  const planCode = String(payload?.planCode || 'free');
  if (!email || !passwordHash) throw new Error('email/passwordHash is required');

  return withTx(async (client) => {
    const existing = await client.query(
      'select id from users where email = $1 limit 1',
      [email]
    );
    if (existing.rowCount > 0) {
      const err = new Error('email already exists');
      err.code = 'EMAIL_EXISTS';
      throw err;
    }

    const userRes = await client.query(
      `
      insert into users (email, password_hash, status)
      values ($1, $2, 'active')
      returning id, email, status, created_at as "createdAt"
      `,
      [email, passwordHash]
    );
    const user = userRes.rows[0];

    const tenantRes = await client.query(
      `
      insert into tenants (name, owner_user_id, plan_code, status)
      values ($1, $2, $3, 'active')
      returning id, name, owner_user_id as "ownerUserId", plan_code as "planCode", status
      `,
      [tenantName, user.id, planCode]
    );
    const tenant = tenantRes.rows[0];

    await client.query(
      `
      insert into tenant_members (tenant_id, user_id, role)
      values ($1, $2, 'owner')
      `,
      [tenant.id, user.id]
    );

    return { user, tenant, role: 'owner' };
  });
}

async function createTenantForUser(payload) {
  const userId = String(payload?.userId || '').trim();
  const tenantName = String(payload?.tenantName || '').trim() || 'My Workspace';
  const planCode = String(payload?.planCode || 'free');
  if (!userId) throw new Error('userId is required');

  return withTx(async (client) => {
    const tenantRes = await client.query(
      `
      insert into tenants (name, owner_user_id, plan_code, status)
      values ($1, $2, $3, 'active')
      returning id, name, owner_user_id as "ownerUserId", plan_code as "planCode", status
      `,
      [tenantName, userId, planCode]
    );
    const tenant = tenantRes.rows[0];

    await client.query(
      `
      insert into tenant_members (tenant_id, user_id, role)
      values ($1, $2, 'owner')
      `,
      [tenant.id, userId]
    );

    return { tenant, role: 'owner' };
  });
}

async function insertRefreshToken(payload) {
  assertDbReady();
  const pool = getPool();
  const sql = `
    insert into auth_refresh_tokens (
      user_id, tenant_id, token_hash, expires_at, revoked_at, ip, user_agent
    )
    values ($1, $2, $3, $4, null, $5, $6)
    returning id, user_id as "userId", tenant_id as "tenantId", token_hash as "tokenHash", expires_at as "expiresAt", revoked_at as "revokedAt"
  `;
  const result = await pool.query(sql, [
    payload.userId,
    payload.tenantId,
    payload.tokenHash,
    payload.expiresAt,
    payload.ip || null,
    payload.userAgent || null,
  ]);
  return result.rows[0] || null;
}

async function getRefreshTokenByHash(tokenHash) {
  assertDbReady();
  const pool = getPool();
  const result = await pool.query(
    `
    select
      id,
      user_id as "userId",
      tenant_id as "tenantId",
      token_hash as "tokenHash",
      expires_at as "expiresAt",
      revoked_at as "revokedAt"
    from auth_refresh_tokens
    where token_hash = $1
    limit 1
    `,
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function revokeRefreshTokenByHash(tokenHash) {
  assertDbReady();
  const pool = getPool();
  const result = await pool.query(
    `
    update auth_refresh_tokens
    set revoked_at = now()
    where token_hash = $1 and revoked_at is null
    returning id
    `,
    [tokenHash]
  );
  return result.rowCount > 0;
}

async function writeAuditLog(payload) {
  assertDbReady();
  const pool = getPool();
  const sql = `
    insert into audit_logs (
      tenant_id, user_id, action, target_type, target_id, ip, metadata
    )
    values ($1, $2, $3, $4, $5, $6, $7::jsonb)
    returning id
  `;
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  const result = await pool.query(sql, [
    payload.tenantId || null,
    payload.userId || null,
    String(payload.action || 'unknown'),
    payload.targetType || null,
    payload.targetId || null,
    payload.ip || null,
    JSON.stringify(metadata),
  ]);
  return result.rows[0] || null;
}

module.exports = {
  assertDbReady,
  findUserByEmail,
  findTenantMemberByUser,
  listTenantMembershipsByUser,
  findOrCreateUserByEmail,
  ensureUserIdentitySchema,
  findUserByIdentity,
  linkUserIdentity,
  activateUser,
  createUserAndTenant,
  createTenantForUser,
  insertRefreshToken,
  getRefreshTokenByHash,
  revokeRefreshTokenByHash,
  writeAuditLog,
};
