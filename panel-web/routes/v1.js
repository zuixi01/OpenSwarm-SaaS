const express = require('express');
const fs = require('fs');
const path = require('path');
const { isDbConfigured, query: dbQuery, healthCheck: dbHealthCheck } = require('../lib/db');
const projectRepo = require('../lib/project-repo');
const chatRepo = require('../lib/chat-repo');
const taskRepo = require('../lib/task-repo');
const artifactRepo = require('../lib/artifact-repo');
const runtimeRepo = require('../lib/runtime-instance-repo');
const quotaRepo = require('../lib/quota-repo');
const { LocalTenantRuntimeManager } = require('../lib/runtime-manager');
const { QuotaGuard } = require('../lib/quota-guard');
const {
  signV1Token,
  requireV1Auth,
  requireTenantAccess,
  canAccessTenant,
  normalizeRoles,
  normalizeTenantIds,
} = require('../middleware/v1-auth');

const router = express.Router();
const ROOT_DIR = path.join(__dirname, '..', '..');
const MAIN_GATEWAY_HTTP = String(process.env.OPENSWARM_MAIN_GATEWAY_HTTP || 'http://127.0.0.1:18789').trim();

const runtimeManager = new LocalTenantRuntimeManager({
  rootDir: ROOT_DIR,
  openclawDir: process.env.OPENCLAW_DIR || path.join(ROOT_DIR, 'openclaw'),
  runtimeBaseDir: process.env.OPENSWARM_TENANT_RUNTIME_BASE_DIR || path.join(ROOT_DIR, 'yin', 'tenants'),
  logDir: process.env.OPENSWARM_TENANT_RUNTIME_LOG_DIR || '/tmp',
  portStart: process.env.OPENSWARM_TENANT_RUNTIME_PORT_START || 19001,
  portEnd: process.env.OPENSWARM_TENANT_RUNTIME_PORT_END || 21999,
  healthIntervalMs: process.env.OPENSWARM_RUNTIME_HEALTH_INTERVAL_MS || 30000,
  maxAutoRestart: process.env.OPENSWARM_RUNTIME_MAX_AUTO_RESTART || 3,
});
runtimeManager.startSweeper();

const quotaGuard = new QuotaGuard();

function getMainGatewayToken() {
  const envToken = String(process.env.OPENSWARM_GATEWAY_TOKEN || process.env.OPENCLAW_GATEWAY_TOKEN || '').trim();
  if (envToken) return envToken;
  try {
    const p = path.join(ROOT_DIR, 'yin', 'moltbot.json');
    if (!fs.existsSync(p)) return '';
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return String(j?.gateway?.auth?.token || '').trim();
  } catch (_) {
    return '';
  }
}

function currentPrincipal(auth) {
  return {
    sub: auth?.sub || null,
    email: auth?.email || null,
    roles: normalizeRoles(auth),
    tenantIds: normalizeTenantIds(auth),
  };
}

function mustDbConfigured(res) {
  if (!isDbConfigured()) {
    res.status(503).json({ error: 'DATABASE_URL not configured' });
    return false;
  }
  return true;
}

function parseLimit(raw, fallback, max) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function resolveRequestedTenantId(req, sourceTenantId) {
  const explicit = String(sourceTenantId || '').trim();
  if (explicit) return explicit;
  const tenantIds = normalizeTenantIds(req.v1Auth);
  if (tenantIds.length === 1) return String(tenantIds[0]);
  return '';
}

function hasPlatformAdmin(auth) {
  return normalizeRoles(auth).includes('platform_admin');
}

async function upsertUserByEmail(email) {
  const sql = `
    insert into users (email, password_hash, status)
    values ($1, 'external-auth', 'active')
    on conflict (email) do update set email = excluded.email
    returning id, email
  `;
  const result = await dbQuery(sql, [email]);
  return result.rows[0];
}

async function getProjectForAuth(projectId, auth) {
  const project = await projectRepo.getProjectById(projectId);
  if (!project) return { error: { status: 404, message: 'project not found' } };
  if (!canAccessTenant(auth, project.tenantId)) {
    return { error: { status: 404, message: 'project not found' } };
  }
  return { project };
}

router.get('/health', async (_req, res) => {
  const db = await dbHealthCheck();
  const out = { ok: true, service: 'openswarm-panel-v1', ts: Date.now(), db };
  if (isDbConfigured() && !db.ok) out.ok = false;
  return res.status(out.ok ? 200 : 503).json(out);
});

router.post('/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const allowEmail = String(process.env.OPENSWARM_V1_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
  const allowPassword = String(process.env.OPENSWARM_V1_BOOTSTRAP_PASSWORD || '');

  if (!allowEmail || !allowPassword) {
    return res.status(503).json({ error: 'bootstrap login not configured' });
  }
  if (email !== allowEmail || password !== allowPassword) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  try {
    const token = signV1Token({
      sub: `bootstrap:${email}`,
      email,
      roles: ['platform_admin'],
      tenantIds: [],
    });
    return res.json({ accessToken: token, tokenType: 'Bearer', expiresIn: process.env.OPENSWARM_V1_JWT_EXPIRES_IN || '8h' });
  } catch (err) {
    return res.status(503).json({ error: err.message || 'token issue failed' });
  }
});

router.get('/auth/me', requireV1Auth, (req, res) => {
  return res.json({ user: currentPrincipal(req.v1Auth) });
});

router.post('/tenants', requireV1Auth, async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });

    const principal = currentPrincipal(req.v1Auth);
    const email = principal.email || String(req.body?.ownerEmail || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email is required in token or body.ownerEmail' });

    const user = await upsertUserByEmail(email);
    const tenantSql = `
      insert into tenants (name, owner_user_id, plan_code, status)
      values ($1, $2, coalesce($3, 'free'), 'active')
      returning
        id,
        name,
        owner_user_id as "ownerUserId",
        plan_code as "planCode",
        status,
        created_at as "createdAt"
    `;
    const planCode = req.body?.planCode || req.body?.plan || 'free';
    const tenantRes = await dbQuery(tenantSql, [name, user.id, planCode]);
    const tenant = tenantRes.rows[0];

    await dbQuery(
      `insert into tenant_members (tenant_id, user_id, role) values ($1, $2, 'owner') on conflict (tenant_id, user_id) do nothing`,
      [tenant.id, user.id]
    );

    await quotaGuard.ensureTenantDefaults(tenant.id, tenant.planCode || planCode || 'free');
    return res.status(201).json(tenant);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'create tenant failed' });
  }
});

router.get('/tenants/:tenantId/quota', requireV1Auth, requireTenantAccess((req) => req.params?.tenantId), async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const tenantId = String(req.params.tenantId || '').trim();
    const quota = await quotaGuard.getQuota(tenantId) || await quotaGuard.ensureTenantDefaults(tenantId, 'free');
    return res.json(quota);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'get quota failed' });
  }
});

router.put('/tenants/:tenantId/quota', requireV1Auth, requireTenantAccess((req) => req.params?.tenantId), async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    if (!hasPlatformAdmin(req.v1Auth)) {
      return res.status(403).json({ error: 'only platform_admin can update quota' });
    }
    const tenantId = String(req.params.tenantId || '').trim();
    const quota = await quotaGuard.setQuota(tenantId, {
      planCode: req.body?.planCode,
      maxRuntimes: req.body?.maxRuntimes,
      maxAgentsPerRuntime: req.body?.maxAgentsPerRuntime,
      maxConcurrency: req.body?.maxConcurrency,
      requestsPerMinute: req.body?.requestsPerMinute,
      dailyRequestLimit: req.body?.dailyRequestLimit,
      dailyBudgetUsd: req.body?.dailyBudgetUsd,
      cpuLimitMillicores: req.body?.cpuLimitMillicores,
      memoryLimitMb: req.body?.memoryLimitMb,
      recycleIdleMinutes: req.body?.recycleIdleMinutes,
    });
    return res.json(quota);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'update quota failed' });
  }
});

router.post('/tenants/:tenantId/runtimes', requireV1Auth, requireTenantAccess((req) => req.params?.tenantId), async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const tenantId = String(req.params.tenantId || '').trim();
    const runtime = await runtimeManager.ensureRuntimeForTenant(tenantId, {
      mode: req.body?.mode || 'local',
      region: req.body?.region || 'local',
      desiredAgents: Number(req.body?.desiredAgents || 1),
      planCode: req.body?.planCode || 'free',
    });
    return res.status(201).json(runtime);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'create runtime failed' });
  }
});

router.get('/tenants/:tenantId/runtimes/:runtimeId', requireV1Auth, requireTenantAccess((req) => req.params?.tenantId), async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const tenantId = String(req.params.tenantId || '').trim();
    const runtimeId = String(req.params.runtimeId || '').trim();
    const runtime = await runtimeManager.getRuntime(runtimeId, tenantId);
    if (!runtime) return res.status(404).json({ error: 'runtime not found' });
    return res.json(runtime);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'get runtime failed' });
  }
});

router.post('/tenants/:tenantId/runtimes/:runtimeId/start', requireV1Auth, requireTenantAccess((req) => req.params?.tenantId), async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const tenantId = String(req.params.tenantId || '').trim();
    const runtimeId = String(req.params.runtimeId || '').trim();
    const runtime = await runtimeManager.startRuntime(runtimeId, tenantId);
    if (!runtime) return res.status(404).json({ error: 'runtime not found' });
    return res.status(202).json(runtime);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'start runtime failed' });
  }
});

router.post('/tenants/:tenantId/runtimes/:runtimeId/stop', requireV1Auth, requireTenantAccess((req) => req.params?.tenantId), async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const tenantId = String(req.params.tenantId || '').trim();
    const runtimeId = String(req.params.runtimeId || '').trim();
    const runtime = await runtimeManager.stopRuntime(runtimeId, tenantId);
    if (!runtime) return res.status(404).json({ error: 'runtime not found' });
    return res.status(202).json(runtime);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'stop runtime failed' });
  }
});

router.post('/tenants/:tenantId/runtimes/:runtimeId/scale', requireV1Auth, requireTenantAccess((req) => req.params?.tenantId), async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const tenantId = String(req.params.tenantId || '').trim();
    const runtimeId = String(req.params.runtimeId || '').trim();
    const desiredAgents = Number(req.body?.desiredAgents || 1);
    const runtime = await runtimeManager.scaleRuntime(runtimeId, tenantId, desiredAgents);
    if (!runtime) return res.status(404).json({ error: 'runtime not found' });
    return res.status(202).json(runtime);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'scale runtime failed' });
  }
});

router.get('/tenants/:tenantId/runtimes/:runtimeId/agents', requireV1Auth, requireTenantAccess((req) => req.params?.tenantId), async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const tenantId = String(req.params.tenantId || '').trim();
    const runtimeId = String(req.params.runtimeId || '').trim();
    const runtime = await runtimeManager.getRuntime(runtimeId, tenantId);
    if (!runtime) return res.status(404).json({ error: 'runtime not found' });
    const items = await runtimeManager.listAgents(runtimeId, tenantId);
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'list agents failed' });
  }
});

router.post('/projects', requireV1Auth, requireTenantAccess((req) => req.body?.tenantId), async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const tenantId = String(req.body?.tenantId || '').trim();
    const name = String(req.body?.name || '').trim();
    const description = req.body?.description != null ? String(req.body.description) : null;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });
    if (!name) return res.status(400).json({ error: 'name is required' });

    const tenantExists = await dbQuery('select id from tenants where id = $1 limit 1', [tenantId]);
    if (tenantExists.rowCount === 0) return res.status(404).json({ error: 'tenant not found' });

    const principal = currentPrincipal(req.v1Auth);
    const creator = principal.email ? await upsertUserByEmail(principal.email) : null;
    const project = await projectRepo.createProject({
      tenantId,
      name,
      description,
      createdBy: creator?.id || null,
      status: 'active',
    });
    return res.status(201).json(project);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'create project failed' });
  }
});

router.get('/projects', requireV1Auth, async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const tenantId = resolveRequestedTenantId(req, req.query?.tenantId);
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required when token has multiple/no tenantIds' });
    }
    if (!canAccessTenant(req.v1Auth, tenantId)) {
      return res.status(403).json({ error: 'tenant access denied' });
    }

    const items = await projectRepo.listProjectsByTenant(tenantId, {
      limit: parseLimit(req.query?.limit, 50, 200),
      offset: parseInt(req.query?.offset, 10) || 0,
    });
    return res.json({ tenantId, items });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'list projects failed' });
  }
});

router.get('/projects/:projectId', requireV1Auth, async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const resolved = await getProjectForAuth(projectId, req.v1Auth);
    if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message });
    return res.json(resolved.project);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'query project failed' });
  }
});

router.post('/projects/:projectId/chat/yin', requireV1Auth, async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const projectId = String(req.params.projectId || '').trim();
    const message = String(req.body?.message || '').trim();
    const requestedSessionId = String(req.body?.sessionId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    if (!message) return res.status(400).json({ error: 'message is required' });

    const resolved = await getProjectForAuth(projectId, req.v1Auth);
    if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message });
    const project = resolved.project;

    const reserved = await quotaGuard.reserveTaskDispatch(project.tenantId, {
      planCode: 'free',
    });
    if (!reserved.ok) {
      return res.status(429).json({
        error: 'quota exceeded',
        code: reserved.code,
        reason: reserved.reason,
      });
    }

    const tenantRuntime = await runtimeManager.ensureRuntimeForTenant(project.tenantId, {
      mode: 'local',
      region: 'local',
      desiredAgents: 1,
      planCode: reserved.quota?.planCode || 'free',
    });
    if (!tenantRuntime || tenantRuntime.status !== 'running' || !tenantRuntime.endpoint) {
      return res.status(503).json({ error: 'tenant runtime is not available' });
    }

    let session = null;
    if (requestedSessionId) {
      session = await chatRepo.getSessionByIdForTenant(requestedSessionId, project.tenantId);
      if (!session || session.projectId !== project.id) {
        return res.status(404).json({ error: 'session not found' });
      }
    } else {
      session = await chatRepo.createSession({ tenantId: project.tenantId, projectId: project.id, mode: 'yin' });
    }

    const userMessage = await chatRepo.appendMessage({
      tenantId: project.tenantId,
      projectId: project.id,
      sessionId: session.id,
      role: 'user',
      content: message,
      metadata: { source: 'v1.projects.chat.yin' },
    });

    const task = await taskRepo.createTask({
      tenantId: project.tenantId,
      projectId: project.id,
      taskType: 'chat',
      status: 'queued',
      input: {
        mode: 'yin',
        message,
        sessionId: session.id,
        runtimeId: tenantRuntime.id,
      },
    });
    if (!task) return res.status(500).json({ error: 'failed to create task' });

    void (async () => {
      try {
        await taskRepo.updateTask(task.id, project.tenantId, { status: 'running', startedAt: new Date() });

        const headers = { 'Content-Type': 'application/json' };
        const token = runtimeManager.getGatewayTokenForTenant(project.tenantId) || getMainGatewayToken();
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(`${tenantRuntime.endpoint}/v1/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: 'openclaw',
            messages: [{ role: 'user', content: message }],
          }),
        });
        const raw = await response.text();
        let parsed = {};
        try { parsed = JSON.parse(raw); } catch (_) {}

        if (!response.ok) {
          const errMsg = parsed?.error?.message || parsed?.message || `HTTP ${response.status}`;
          await taskRepo.updateTask(task.id, project.tenantId, {
            status: 'error',
            error: errMsg,
            output: { gatewayStatus: response.status, runtimeId: tenantRuntime.id },
            finishedAt: new Date(),
          });
          await quotaGuard.recordTaskCompletion(project.tenantId, task.id, 'error', { reason: errMsg });
          return;
        }

        const reply = parsed?.choices?.[0]?.message?.content != null
          ? String(parsed.choices[0].message.content)
          : '';

        await chatRepo.appendMessage({
          tenantId: project.tenantId,
          projectId: project.id,
          sessionId: session.id,
          role: 'assistant',
          content: reply,
          metadata: { taskId: task.id },
        });

        await taskRepo.updateTask(task.id, project.tenantId, {
          status: 'done',
          output: { reply, sessionId: session.id, runtimeId: tenantRuntime.id },
          finishedAt: new Date(),
        });
        await quotaGuard.recordTaskCompletion(project.tenantId, task.id, 'done', { runtimeId: tenantRuntime.id });
      } catch (err) {
        await taskRepo.updateTask(task.id, project.tenantId, {
          status: 'error',
          error: err.message || 'task failed',
          finishedAt: new Date(),
        });
        await quotaGuard.recordTaskCompletion(project.tenantId, task.id, 'error', { reason: err.message || 'task failed' });
      }
    })();

    return res.status(202).json({
      taskId: task.id,
      status: 'queued',
      sessionId: session.id,
      userMessageId: userMessage.id,
      runtimeId: tenantRuntime.id,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'submit task failed' });
  }
});

router.get('/projects/:projectId/chat/sessions', requireV1Auth, async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const resolved = await getProjectForAuth(projectId, req.v1Auth);
    if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message });

    const items = await chatRepo.listSessionsByProject(
      resolved.project.tenantId,
      resolved.project.id,
      { limit: parseLimit(req.query?.limit, 50, 200) }
    );
    return res.json({ projectId: resolved.project.id, tenantId: resolved.project.tenantId, items });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'list sessions failed' });
  }
});

router.get('/projects/:projectId/chat/sessions/:sessionId/messages', requireV1Auth, async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const projectId = String(req.params.projectId || '').trim();
    const sessionId = String(req.params.sessionId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const resolved = await getProjectForAuth(projectId, req.v1Auth);
    if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message });

    const session = await chatRepo.getSessionByIdForTenant(sessionId, resolved.project.tenantId);
    if (!session || session.projectId !== resolved.project.id) {
      return res.status(404).json({ error: 'session not found' });
    }

    const items = await chatRepo.listMessagesBySession(
      resolved.project.tenantId,
      session.id,
      { limit: parseLimit(req.query?.limit, 100, 500) }
    );
    return res.json({ projectId: resolved.project.id, sessionId: session.id, tenantId: resolved.project.tenantId, items });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'list messages failed' });
  }
});

router.get('/projects/:projectId/tasks', requireV1Auth, async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const resolved = await getProjectForAuth(projectId, req.v1Auth);
    if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message });

    const items = await taskRepo.listTasksByProject(
      resolved.project.tenantId,
      resolved.project.id,
      { limit: parseLimit(req.query?.limit, 50, 200) }
    );
    return res.json({ projectId: resolved.project.id, tenantId: resolved.project.tenantId, items });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'list tasks failed' });
  }
});

router.get('/projects/:projectId/artifacts', requireV1Auth, async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const projectId = String(req.params.projectId || '').trim();
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const resolved = await getProjectForAuth(projectId, req.v1Auth);
    if (resolved.error) return res.status(resolved.error.status).json({ error: resolved.error.message });

    const items = await artifactRepo.listArtifactsByProject(
      resolved.project.tenantId,
      resolved.project.id,
      { limit: parseLimit(req.query?.limit, 100, 500) }
    );
    return res.json({ projectId: resolved.project.id, tenantId: resolved.project.tenantId, items });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'list artifacts failed' });
  }
});

router.get('/tasks/:taskId', requireV1Auth, async (req, res) => {
  if (!mustDbConfigured(res)) return;
  try {
    const taskId = String(req.params.taskId || '').trim();
    if (!taskId) return res.status(400).json({ error: 'taskId is required' });

    const row = await taskRepo.getTaskById(taskId);
    if (!row) return res.status(404).json({ error: 'task not found' });
    if (!canAccessTenant(req.v1Auth, row.tenantId)) {
      return res.status(404).json({ error: 'task not found' });
    }
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'query failed' });
  }
});

// debug-only runtime listing for platform admin
router.get('/_debug/runtimes', requireV1Auth, async (req, res) => {
  if (!mustDbConfigured(res)) return;
  if (!hasPlatformAdmin(req.v1Auth)) return res.status(403).json({ error: 'forbidden' });
  const items = await runtimeRepo.listAll();
  return res.json({ items });
});

module.exports = router;
