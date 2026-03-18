#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_SCHEMA = path.join(ROOT, 'docs', 'cloud-mvp', 'phase3-package', 'schema.phase3.sql');

function readArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function buildClientOptions() {
  const connectionString = String(process.env.DATABASE_URL || '').trim();
  if (!connectionString) throw new Error('DATABASE_URL is required');
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
    console.log(`[db:migrate:phase3] applied schema: ${schemaFile}`);
  } catch (err) {
    try { await client.query('rollback'); } catch (_) {}
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[db:migrate:phase3] failed:', err.message || err);
  process.exit(1);
});
