#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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
const DEFAULT_SCHEMA = path.join(ROOT, 'docs', 'cloud-mvp', 'phase1-package', 'schema.phase1.sql');

function readArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function buildClientOptions() {
  const connectionString = String(process.env.DATABASE_URL || '').trim();
  if (!connectionString) throw new Error('DATABASE_URL is required. 请在项目根目录 .env 中配置 DATABASE_URL（如 postgres://localhost:5432/openswarm）');
  const sslMode = String(process.env.DATABASE_SSLMODE || '').toLowerCase();
  const useSsl = sslMode === 'require' || sslMode === 'prefer';
  return {
    connectionString,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

async function main() {
  const schemaFile = readArg('--file', DEFAULT_SCHEMA);
  if (!fs.existsSync(schemaFile)) throw new Error(`schema file not found: ${schemaFile}`);

  const sql = fs.readFileSync(schemaFile, 'utf8');
  const client = new Client(buildClientOptions());
  await client.connect();
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('commit');
    console.log(`[db:migrate:phase1] applied schema: ${schemaFile}`);
  } catch (err) {
    try { await client.query('rollback'); } catch (_) {}
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[db:migrate:phase1] failed:', err.message || err);
  process.exit(1);
});

