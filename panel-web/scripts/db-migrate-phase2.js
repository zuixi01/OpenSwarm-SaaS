#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..', '..');
(function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(function(line) {
    const trimmed = line.replace(/#.*/, '').trim();
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  });
})();

const DEFAULT_SCHEMA = path.join(ROOT, 'docs', 'cloud-mvp', 'phase2-runtime-data.sql');
const TENANT_DATA_ROOT = path.join(ROOT, 'panel-web', 'data', 'tenants');

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
  const schemaFile = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SCHEMA;
  const shouldImportFiles = process.argv.includes('--import-files');
  if (!fs.existsSync(schemaFile)) throw new Error(`schema file not found: ${schemaFile}`);
  const sql = fs.readFileSync(schemaFile, 'utf8');
  const client = new Client(buildClientOptions());
  await client.connect();
  try {
    await client.query('begin');
    await client.query(sql);
    if (shouldImportFiles) await importTenantFiles(client);
    await client.query('commit');
    console.log(`[db:migrate:phase2] applied schema: ${schemaFile}${shouldImportFiles ? ' + imported tenant files' : ''}`);
  } catch (err) {
    try { await client.query('rollback'); } catch (_) {}
    throw err;
  } finally {
    await client.end();
  }
}

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

async function upsertProjectDocument(client, tenantId, projectId, kind, document) {
  await client.query(
    `
    insert into project_documents (tenant_id, project_id, kind, document)
    values ($1, $2, $3, $4::jsonb)
    on conflict (tenant_id, project_id, kind)
    do update set document = excluded.document, version = project_documents.version + 1, updated_at = now()
    `,
    [tenantId, String(projectId || '').trim(), kind, JSON.stringify(document || {})]
  );
}

async function upsertProjectMemory(client, tenantId, projectId, entries) {
  await client.query(
    `
    insert into project_memories (tenant_id, project_id, entries)
    values ($1, $2, $3::jsonb)
    on conflict (tenant_id, project_id)
    do update set entries = excluded.entries, updated_at = now()
    `,
    [tenantId, String(projectId || '').trim(), JSON.stringify(Array.isArray(entries) ? entries : [])]
  );
}

async function upsertAutonomousRun(client, tenantId, run) {
  const runId = String(run?.id || '').trim();
  if (!runId) return;
  await client.query(
    `
    insert into autonomous_runs (tenant_id, run_id, project_id, status, current_agent_id, payload)
    values ($1, $2, $3, $4, $5, $6::jsonb)
    on conflict (tenant_id, run_id)
    do update set
      project_id = excluded.project_id,
      status = excluded.status,
      current_agent_id = excluded.current_agent_id,
      payload = excluded.payload,
      updated_at = now()
    `,
    [
      tenantId,
      runId,
      String(run.projectId || '').trim(),
      String(run.status || 'running').trim() || 'running',
      run.currentAgentId ? String(run.currentAgentId).trim() : null,
      JSON.stringify(run || {}),
    ]
  );
}

async function ensureChatSession(client, tenantId, projectId, mode) {
  const lookup = await client.query(
    `
    select id
    from chat_sessions
    where tenant_id = $1 and project_id = $2 and mode = $3
    order by created_at desc
    limit 1
    `,
    [tenantId, projectId, mode]
  );
  if (lookup.rows[0]?.id) return lookup.rows[0].id;
  const created = await client.query(
    `
    insert into chat_sessions (tenant_id, project_id, mode)
    values ($1, $2, $3)
    returning id
    `,
    [tenantId, projectId, mode]
  );
  return created.rows[0].id;
}

function mapLegacyChatMessage(message) {
  const type = String(message?.type || '').trim();
  const isUser = type === 'user' || message?.role === 'user';
  return {
    role: isUser ? 'user' : 'assistant',
    runtimeAgentId: message?.agentId || message?.hexId || null,
    content: String(message?.message || message?.text || '').trim(),
    metadata: {
      type: type || (isUser ? 'user' : 'hex'),
      name: message?.name || null,
      isError: !!message?.isError,
    },
  };
}

async function importChatHistoryFile(client, tenantId, filePath) {
  const payload = readJsonIfExists(filePath);
  const messages = Array.isArray(payload) ? payload : (Array.isArray(payload?.messages) ? payload.messages : []);
  if (!messages.length) return;
  const base = path.basename(filePath, '.json');
  const match = base.match(/^chat_(single|discuss|yin)_(.+)$/);
  if (!match) return;
  const mode = match[1];
  const projectId = match[2];
  const sessionId = await ensureChatSession(client, tenantId, projectId, mode);
  await client.query('delete from chat_messages where tenant_id = $1 and session_id = $2', [tenantId, sessionId]);
  for (const message of messages) {
    const mapped = mapLegacyChatMessage(message);
    if (!mapped.content) continue;
    await client.query(
      `
      insert into chat_messages (tenant_id, project_id, session_id, role, runtime_agent_id, content, metadata)
      values ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [tenantId, projectId, sessionId, mapped.role, mapped.runtimeAgentId, mapped.content, JSON.stringify(mapped.metadata)]
    );
  }
}

async function importTenantFiles(client) {
  if (!fs.existsSync(TENANT_DATA_ROOT)) return;
  const tenantIds = fs.readdirSync(TENANT_DATA_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const tenantId of tenantIds) {
    const tenantDir = path.join(TENANT_DATA_ROOT, tenantId);
    const projects = readJsonIfExists(path.join(tenantDir, 'projects.json'));
    const hexDefinition = readJsonIfExists(path.join(tenantDir, 'hex-definition.json'));
    const autonomyRuns = readJsonIfExists(path.join(tenantDir, 'autonomous-task-runs.json'));
    const memoryDir = path.join(tenantDir, 'memory');
    const chatDir = path.join(tenantDir, 'chat');

    if (Array.isArray(projects)) {
      for (const project of projects) {
        if (!project || !project.id) continue;
        await upsertProjectDocument(client, tenantId, project.id, 'project_config', project);
      }
    }

    if (hexDefinition && typeof hexDefinition === 'object') {
      await upsertProjectDocument(client, tenantId, 'hex-definition', 'hex_definition', hexDefinition);
    }

    if (fs.existsSync(memoryDir)) {
      const files = fs.readdirSync(memoryDir).filter((name) => /^project_memory_.+\.json$/.test(name));
      for (const file of files) {
        const payload = readJsonIfExists(path.join(memoryDir, file));
        if (!payload || !payload.projectId) continue;
        await upsertProjectMemory(client, tenantId, payload.projectId, payload.entries);
      }
    }

    if (fs.existsSync(chatDir)) {
      const files = fs.readdirSync(chatDir).filter((name) => /^chat_(single|discuss|yin)_.+\.json$/.test(name));
      for (const file of files) {
        await importChatHistoryFile(client, tenantId, path.join(chatDir, file));
      }
    }

    if (autonomyRuns && typeof autonomyRuns === 'object') {
      for (const run of Object.values(autonomyRuns)) {
        await upsertAutonomousRun(client, tenantId, run);
      }
    }
  }
}

main().catch((err) => {
  console.error('[db:migrate:phase2] failed:', err.message || err);
  process.exit(1);
});
