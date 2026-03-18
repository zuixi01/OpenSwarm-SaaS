const { Pool } = require('pg');

let pool = null;

function isDbConfigured() {
  return !!String(process.env.DATABASE_URL || '').trim();
}

function buildPoolOptions() {
  const connectionString = String(process.env.DATABASE_URL || '').trim();
  if (!connectionString) return null;

  const sslMode = String(process.env.DATABASE_SSLMODE || '').toLowerCase();
  const useSsl = sslMode === 'require' || sslMode === 'prefer';

  return {
    connectionString,
    max: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECT_TIMEOUT_MS || '5000', 10),
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

function getPool() {
  if (pool) return pool;
  const options = buildPoolOptions();
  if (!options) return null;
  pool = new Pool(options);
  pool.on('error', (err) => {
    console.error('[db] pool error:', err.message || err);
  });
  return pool;
}

async function query(text, params) {
  const p = getPool();
  if (!p) {
    const err = new Error('DATABASE_URL is not configured');
    err.code = 'DB_NOT_CONFIGURED';
    throw err;
  }
  return p.query(text, params);
}

async function healthCheck() {
  try {
    if (!isDbConfigured()) return { ok: false, reason: 'not_configured' };
    await query('select 1 as ok');
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message || 'db_error' };
  }
}

module.exports = {
  isDbConfigured,
  getPool,
  query,
  healthCheck,
};
