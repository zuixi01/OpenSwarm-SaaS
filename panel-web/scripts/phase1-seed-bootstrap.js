#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getPool, isDbConfigured } = require('../lib/db');
const { hashPassword } = require('../lib/password-hash');

const ROOT = path.resolve(__dirname, '..', '..');
// 加载项目根目录 .env，便于直接 npm run 时读到 DATABASE_URL
(function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(function (line) {
    const trimmed = line.replace(/#.*/, '').trim();
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  });
})();

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

async function main() {
  if (!isDbConfigured()) throw new Error('DATABASE_URL is required. 请在项目根目录 .env 中配置 DATABASE_URL');

  const email = String(process.env.PHASE1_BOOTSTRAP_EMAIL || 'owner@openswarm.local').trim().toLowerCase();
  const password = String(process.env.PHASE1_BOOTSTRAP_PASSWORD || 'OpenSwarm123!').trim();
  if (!email || !password) throw new Error('PHASE1_BOOTSTRAP_EMAIL / PHASE1_BOOTSTRAP_PASSWORD 不能为空，或使用默认：owner@openswarm.local / OpenSwarm123!');
  const tenantName = String(process.env.PHASE1_BOOTSTRAP_TENANT_NAME || 'Bootstrap Tenant').trim();
  const role = String(process.env.PHASE1_BOOTSTRAP_ROLE || 'owner').trim();
  if (!['owner', 'admin', 'member'].includes(role)) throw new Error('PHASE1_BOOTSTRAP_ROLE must be owner/admin/member');

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');

    let userId = null;
    const userFound = await client.query('select id from users where email = $1 limit 1', [email]);
    if (userFound.rowCount > 0) {
      userId = userFound.rows[0].id;
      await client.query(
        'update users set status = $2, password_hash = $3 where id = $1',
        [userId, 'active', hashPassword(password)]
      );
    } else {
      const userRes = await client.query(
        `
        insert into users (email, password_hash, status)
        values ($1, $2, 'active')
        returning id
        `,
        [email, hashPassword(password)]
      );
      userId = userRes.rows[0].id;
    }

    let tenantId = null;
    const tenantFound = await client.query(
      'select id from tenants where owner_user_id = $1 order by created_at asc limit 1',
      [userId]
    );
    if (tenantFound.rowCount > 0) {
      tenantId = tenantFound.rows[0].id;
      await client.query('update tenants set name = coalesce(nullif($2, \'\'), name), status = $3 where id = $1', [tenantId, tenantName, 'active']);
    } else {
      const tenantRes = await client.query(
        `
        insert into tenants (name, owner_user_id, plan_code, status)
        values ($1, $2, 'free', 'active')
        returning id
        `,
        [tenantName, userId]
      );
      tenantId = tenantRes.rows[0].id;
    }

    await client.query(
      `
      insert into tenant_members (tenant_id, user_id, role)
      values ($1, $2, $3)
      on conflict (tenant_id, user_id)
      do update set role = excluded.role
      `,
      [tenantId, userId, role]
    );

    await client.query(
      `
      insert into audit_logs (tenant_id, user_id, action, target_type, target_id, metadata)
      values ($1, $2, 'auth.bootstrap.seed', 'user', $4, $3::jsonb)
      `,
      [tenantId, userId, JSON.stringify({ email }), String(userId)]
    );

    const refresh = crypto.randomBytes(32).toString('base64url');
    await client.query(
      `
      insert into auth_refresh_tokens (user_id, tenant_id, token_hash, expires_at)
      values ($1, $2, $3, now() + interval '7 day')
      on conflict (token_hash) do nothing
      `,
      [userId, tenantId, tokenHash(refresh)]
    );

    await client.query('commit');
    console.log(JSON.stringify({ ok: true, email, userId, tenantId, role }, null, 2));
  } catch (err) {
    try { await client.query('rollback'); } catch (_) {}
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[phase1-seed-bootstrap] failed:', err.message || err);
  process.exit(1);
});
