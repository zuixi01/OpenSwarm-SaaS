#!/usr/bin/env node
/**
 * OpenSwarm 面板：command（主控网关）+ 64 个 agent 执行单元。
 * - command：点启动 → 弹终端运行 start-yin.sh（网关 + TUI）。
 * - agent：点启动 → 若对应端口未占用会先自动起网关，再弹终端开 TUI（一键启动）。
 */
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { spawn, spawnSync, execSync } = require('child_process');
const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const v1Router = require('./routes/v1');
const phase1AuthRouter = require('./routes/phase1-auth');
const runtimeAdminRouter = require('./routes/runtime-admin');
const { createTenantRuntimeRouter } = require('./routes/tenant-runtime');
const { createYinRouter } = require('./routes/yin');
const { createAutonomyRouter } = require('./routes/autonomy');
const { createAgentRouter } = require('./routes/agent');
const { createProjectDataRouter } = require('./routes/project-data');
const { createTriggerRouter } = require('./routes/triggers');
const { createRuntimeControlRouter } = require('./routes/runtime-control');
const { createProjectDomainRouter } = require('./routes/project-domain');
const { createLegacyAdminRouter } = require('./routes/legacy-admin');
const { createDevtoolsRouter } = require('./routes/devtools');
const { createConfigRouter } = require('./routes/config');
const { createAgentMetaRouter } = require('./routes/agent-meta');
const { createProjectRunRouter } = require('./routes/project-run');
const { createRuntimeAdapter } = require('./lib/runtime-adapter');
const { createRuntimeControlService } = require('./lib/runtime-control-service');
const { createConfigService } = require('./lib/config-service');
const { createProjectDomainService } = require('./lib/project-domain-service');
const { createLegacyAdminService } = require('./lib/legacy-admin-service');
const { createDevtoolsService } = require('./lib/devtools-service');
const { createAgentMetaService } = require('./lib/agent-meta-service');
const { createProjectRunService } = require('./lib/project-run-service');
const { createAgentTaskService } = require('./lib/agent-task-service');
const { createYinGatewayService } = require('./lib/yin-gateway-service');
const { callHexAgentWS: workerWsCall } = require('./lib/worker-ws-client');
const { AutonomousRunStore } = require('./lib/autonomy-store');
const { createAutonomyParser } = require('./lib/autonomy-parser');
const { createAutonomyService, countAutonomousAgentSteps } = require('./lib/autonomy-service');
const { createYinService } = require('./lib/yin-service');
const { createAutonomyYinReviewService } = require('./lib/autonomy-yin-review');
const { createChatHistoryService } = require('./lib/chat-history-service');
const { createChatHistoryRepo } = require('./lib/chat-history-repo');
const { createDiscussService } = require('./lib/discuss-service');
const { createProjectDataService } = require('./lib/project-data-service');
const { createProjectMemoryRepo } = require('./lib/project-memory-repo');
const { createProjectDocumentRepo } = require('./lib/project-document-repo');
const { createAutonomousRunRepo } = require('./lib/autonomous-run-repo');
const { createTriggerService } = require('./lib/trigger-service');
const { createTenantPaths } = require('./lib/tenant-paths');
const { createTenantSecurityRepo } = require('./lib/tenant-security-repo');
const { createTenantAccessControl } = require('./lib/tenant-access-control');
const { TenantRuntimeResolver } = require('./lib/tenant-runtime-resolver');
const { createAgentRuntimeHealthService } = require('./lib/agent-runtime-health-service');
const { isDbConfigured, query: dbQuery } = require('./lib/db');
const { parseAccessToken, verifyAccessToken, getAccessSecret } = require('./middleware/phase1-auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// API 命名迁移层（v2）：command / strategy / agent
// - command/strategy 与 yin/yang 保持兼容
// - agent 为主路径，hex 旧路径自动重写到 agent
const API_PATH_ALIAS_RULES = [
  { re: /^\/api\/projects\/([^/]+)\/strategy-configure$/, to: (m) => `/api/projects/${m[1]}/yang-configure` },
  { re: /^\/api\/projects\/([^/]+)\/command-status$/, to: (m) => `/api/projects/${m[1]}/yin-status` },
  { re: /^\/api\/command\/status$/, to: () => '/api/yin/status' },
  { re: /^\/api\/command\/gateway\/health$/, to: () => '/api/yin/gateway/health' },
  { re: /^\/api\/command\/task\/([^/]+)$/, to: (m) => `/api/yin/task/${m[1]}` },
  { re: /^\/api\/command\/chat$/, to: () => '/api/yin/chat' },
  { re: /^\/api\/hex-definition\/(.+)$/, to: (m) => `/api/agent-definition/${m[1]}` },
  { re: /^\/api\/hex\/([^/]+)\/label$/, to: (m) => `/api/agent/${m[1]}/label` },
  { re: /^\/api\/hexagrams$/, to: () => '/api/agents' },
  { re: /^\/api\/hexagrams\/([^/]+)$/, to: (m) => `/api/agents/${m[1]}` },
  { re: /^\/api\/hexagrams\/([^/]+)\/supervisor$/, to: (m) => `/api/agents/${m[1]}/supervisor` },
  { re: /^\/api\/hexagrams\/([^/]+)\/subordinates$/, to: (m) => `/api/agents/${m[1]}/subordinates` },
  { re: /^\/api\/match-hexagrams$/, to: () => '/api/match-agents' },
  { re: /^\/api\/health\/hexagrams$/, to: () => '/api/health/agents' },
  { re: /^\/api\/self-heal\/hexagrams$/, to: () => '/api/self-heal/agents' },
  { re: /^\/api\/close-all-hex-terminals$/, to: () => '/api/close-all-agent-terminals' },
  { re: /^\/api\/hex\/task\/([^/]+)$/, to: (m) => `/api/agent/task/${m[1]}` },
  { re: /^\/api\/hex\/chat$/, to: () => '/api/agent/chat' },
  { re: /^\/api\/hex\/agent-task$/, to: () => '/api/agent/agent-task' },
  { re: /^\/api\/hex\/agent-task\/([^/]+)$/, to: (m) => `/api/agent/agent-task/${m[1]}` },
  { re: /^\/api\/chat-history\/([^/]+)\/command$/, to: (m) => `/api/chat-history/${m[1]}/yin` },
];
function rewriteApiAliasPath(pathname) {
  for (const rule of API_PATH_ALIAS_RULES) {
    const match = pathname.match(rule.re);
    if (match) return rule.to(match);
  }
  return pathname;
}
function normalizeAgentNodeAliases(node) {
  if (!node || typeof node !== 'object') return node;
  const next = { ...node };
  if (next.hexId == null && next.agentId != null) next.hexId = next.agentId;
  if (next.agentId == null && next.hexId != null) next.agentId = next.hexId;
  return next;
}
function normalizeWorkflowAliases(workflow) {
  if (!workflow || typeof workflow !== 'object') return workflow;
  const next = { ...workflow };
  if (Array.isArray(next.steps)) next.steps = next.steps.map(normalizeAgentNodeAliases);
  return next;
}
function normalizeProjectAgentSchema(project) {
  if (!project || typeof project !== 'object') return project;
  const next = { ...project };
  if ((!Array.isArray(next.hexIds) || next.hexIds.length === 0) && Array.isArray(next.agentIds)) {
    next.hexIds = [...next.agentIds];
  }
  if ((!next.hexSkills || typeof next.hexSkills !== 'object') && next.agentSkills && typeof next.agentSkills === 'object') {
    next.hexSkills = { ...next.agentSkills };
  }
  if ((!next.hexConfig || typeof next.hexConfig !== 'object') && next.agentConfig && typeof next.agentConfig === 'object') {
    next.hexConfig = { ...next.agentConfig };
  }
  next.hexIds = Array.isArray(next.hexIds) ? next.hexIds : [];
  next.hexSkills = (next.hexSkills && typeof next.hexSkills === 'object') ? next.hexSkills : {};
  next.hexConfig = (next.hexConfig && typeof next.hexConfig === 'object') ? next.hexConfig : {};
  if (Array.isArray(next.schedules)) next.schedules = next.schedules.map(normalizeAgentNodeAliases);
  if (Array.isArray(next.triggers)) next.triggers = next.triggers.map(normalizeAgentNodeAliases);
  if (Array.isArray(next.workflows)) next.workflows = next.workflows.map(normalizeWorkflowAliases);
  next.billing = normalizeProjectBillingConfig(next.billing);
  next.agentIds = [...next.hexIds];
  next.agentSkills = { ...next.hexSkills };
  next.agentConfig = { ...next.hexConfig };
  return next;
}
function normalizeAgentPayloadAliases(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload.agentIds) && !Array.isArray(payload.hexIds)) payload.hexIds = payload.agentIds;
  if (payload.agentSkills !== undefined && payload.hexSkills === undefined) payload.hexSkills = payload.agentSkills;
  if (payload.agentConfig !== undefined && payload.hexConfig === undefined) payload.hexConfig = payload.agentConfig;
  if (payload.agentId !== undefined && payload.hexId === undefined) payload.hexId = payload.agentId;
  if (payload.agent !== undefined && payload.hex === undefined) payload.hex = payload.agent;
  if (Array.isArray(payload.schedules)) payload.schedules = payload.schedules.map(normalizeAgentNodeAliases);
  if (Array.isArray(payload.triggers)) payload.triggers = payload.triggers.map(normalizeAgentNodeAliases);
  if (Array.isArray(payload.workflows)) payload.workflows = payload.workflows.map(normalizeWorkflowAliases);
  return payload;
}
app.use((req, _res, next) => {
  if (req.url && req.url.startsWith('/api/')) {
    const qIdx = req.url.indexOf('?');
    const pathname = qIdx >= 0 ? req.url.slice(0, qIdx) : req.url;
    const query = qIdx >= 0 ? req.url.slice(qIdx) : '';
    const mapped = rewriteApiAliasPath(pathname);
    if (mapped !== pathname) req.url = mapped + query;
    if (req.body && typeof req.body === 'object') normalizeAgentPayloadAliases(req.body);
    if (req.query && typeof req.query === 'object') normalizeAgentPayloadAliases(req.query);
  }
  next();
});
// 面板登录控制：
// 1) 兼容旧版 panel token 登录（OPENSWARM_PANEL_TOKEN）
// 2) 支持 Phase1 邮箱密码登录（OPENSWARM_REQUIRE_USER_AUTH=1，默认在配置了 JWT Secret 时开启）
const PANEL_TOKEN = process.env.OPENSWARM_PANEL_TOKEN || '';
const REQUIRE_PANEL_TOKEN_ON_V1 = String(process.env.OPENSWARM_V1_REQUIRE_PANEL_TOKEN || '').trim() === '1';
const PANEL_TOKEN_COOKIE_NAME = 'openswarm-panel-token';
const HAS_PHASE1_AUTH_SECRET = !!String(getAccessSecret() || '').trim();
const REQUIRE_USER_AUTH = String(
  process.env.OPENSWARM_REQUIRE_USER_AUTH || (HAS_PHASE1_AUTH_SECRET ? '1' : '0')
).trim() === '1';

function getPanelToken(req) {
  const auth = req.headers.authorization || '';
  let cookie = '';
  try {
    (req.headers.cookie || '').split(';').forEach((p) => {
      const eq = p.trim().indexOf('=');
      if (eq > 0 && p.trim().slice(0, eq) === PANEL_TOKEN_COOKIE_NAME) {
        cookie = decodeURIComponent(p.trim().slice(eq + 1)).trim();
      }
    });
  } catch (_) {}
  return (auth.startsWith('Bearer ') ? auth.slice(7) : '') || req.headers['x-panel-token'] || cookie || '';
}

function hasValidUserSession(req) {
  if (!REQUIRE_USER_AUTH || !HAS_PHASE1_AUTH_SECRET) return false;
  const token = parseAccessToken(req);
  if (!token) return false;
  try {
    const payload = verifyAccessToken(token);
    req.authCtx = {
      userId: payload.sub || null,
      email: payload.email || null,
      tenantId: payload.tenantId || null,
      role: payload.role || 'member',
    };
    return true;
  } catch (_) {
    return false;
  }
}

app.use((req, res, next) => {
  const path = req.path || '';
  const isHtml = path === '/' || path.endsWith('.html');
  const isApi = path.startsWith('/api/');
  const isV1 = path.startsWith('/v1/');
  const isAuthOpenApi = path.startsWith('/api/auth/');
  const isLoginPage = path === '/login.html';
  const isRegisterPage = path === '/register.html';
  const isAuthPage = isLoginPage || isRegisterPage;
  const isPublicHealth = path === '/api/health';
  const userSessionOk = hasValidUserSession(req);

  // 优先处理用户登录态（邮箱/密码）
  if (REQUIRE_USER_AUTH) {
    if (isPublicHealth || isAuthOpenApi) {
      // 放行健康检查与 auth API（登录、刷新、注册等）
    } else if (isV1) {
      // v1 独立鉴权链路，不在这里强制拦截
    } else if (isApi) {
      if (!userSessionOk) return res.status(401).json({ error: '请先登录后再访问 API' });
    } else if (isHtml) {
      if (isAuthPage) {
        if (userSessionOk) return res.redirect(302, '/index.html');
      } else if (!userSessionOk) {
        const nextPath = encodeURIComponent(req.originalUrl || '/index.html');
        return res.redirect(302, `/login.html?next=${nextPath}`);
      }
    }
  }

  // 兼容旧版 panel token 登录
  if (PANEL_TOKEN) {
    if (isPublicHealth || path === '/api/panel-login' || isAuthPage) return next();
    const hasToken = getPanelToken(req) === PANEL_TOKEN;
    if (isV1) {
      if (!REQUIRE_PANEL_TOKEN_ON_V1) return next();
      if (hasToken) return next();
      return res.status(401).json({ error: '需提供有效的 X-Panel-Token、Authorization: Bearer 或先访问 /login.html 登录' });
    }
    if (isApi) {
      if (hasToken) return next();
      return res.status(401).json({ error: '需提供有效的 X-Panel-Token、Authorization: Bearer 或先访问 /login.html 登录' });
    }
    if (isHtml && !isAuthPage && !hasToken) {
      return res.redirect(302, '/login.html');
    }
  }

  return next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', phase1AuthRouter);
app.use('/api/runtime-admin', runtimeAdminRouter);
app.use('/v1', v1Router);

// 确保任何错误都返回 JSON，避免前端收到 HTML 报错页
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('[express error]', err.message || err);
  res.status(err.status || 500).json({ error: err.message || '服务器错误', replies: req.url.includes('agent/chat') ? [] : undefined });
});

const homedir = os.homedir();
const GATEWAY_MAIN = process.env.GATEWAY_MAIN || 'ws://127.0.0.1:18789';

// 64 个 agent（对应 workers.conf 1～64）
const HEXAGRAM_ROBOTS = [
  { id: 'qian', name: 'NO.01', workerId: 1 },
  { id: 'kun', name: 'NO.02', workerId: 2 },
  { id: 'tai', name: 'NO.03', workerId: 3 },
  { id: 'pi', name: 'NO.04', workerId: 4 },
  { id: 'xun', name: 'NO.05', workerId: 5 },
  { id: 'yu', name: 'NO.06', workerId: 6 },
  { id: 'sui', name: 'NO.07', workerId: 7 },
  { id: 'gu', name: 'NO.08', workerId: 8 },
  { id: 'lin', name: 'NO.09', workerId: 9 },
  { id: 'guan', name: 'NO.10', workerId: 10 },
  { id: 'h11', name: 'NO.11', workerId: 11 },
  { id: 'h12', name: 'NO.12', workerId: 12 },
  { id: 'h13', name: 'NO.13', workerId: 13 },
  { id: 'h14', name: 'NO.14', workerId: 14 },
  { id: 'h15', name: 'NO.15', workerId: 15 },
  { id: 'h16', name: 'NO.16', workerId: 16 },
  { id: 'h17', name: 'NO.17', workerId: 17 },
  { id: 'h18', name: 'NO.18', workerId: 18 },
  { id: 'h19', name: 'NO.19', workerId: 19 },
  { id: 'h20', name: 'NO.20', workerId: 20 },
  { id: 'h21', name: 'NO.21', workerId: 21 },
  { id: 'h22', name: 'NO.22', workerId: 22 },
  { id: 'h23', name: 'NO.23', workerId: 23 },
  { id: 'h24', name: 'NO.24', workerId: 24 },
  { id: 'h25', name: 'NO.25', workerId: 25 },
  { id: 'h26', name: 'NO.26', workerId: 26 },
  { id: 'h27', name: 'NO.27', workerId: 27 },
  { id: 'h28', name: 'NO.28', workerId: 28 },
  { id: 'h29', name: 'NO.29', workerId: 29 },
  { id: 'h30', name: 'NO.30', workerId: 30 },
  { id: 'h31', name: 'NO.31', workerId: 31 },
  { id: 'h32', name: 'NO.32', workerId: 32 },
  { id: 'h33', name: 'NO.33', workerId: 33 },
  { id: 'h34', name: 'NO.34', workerId: 34 },
  { id: 'h35', name: 'NO.35', workerId: 35 },
  { id: 'h36', name: 'NO.36', workerId: 36 },
  { id: 'h37', name: 'NO.37', workerId: 37 },
  { id: 'h38', name: 'NO.38', workerId: 38 },
  { id: 'h39', name: 'NO.39', workerId: 39 },
  { id: 'h40', name: 'NO.40', workerId: 40 },
  { id: 'h41', name: 'NO.41', workerId: 41 },
  { id: 'h42', name: 'NO.42', workerId: 42 },
  { id: 'h43', name: 'NO.43', workerId: 43 },
  { id: 'h44', name: 'NO.44', workerId: 44 },
  { id: 'h45', name: 'NO.45', workerId: 45 },
  { id: 'h46', name: 'NO.46', workerId: 46 },
  { id: 'h47', name: 'NO.47', workerId: 47 },
  { id: 'h48', name: 'NO.48', workerId: 48 },
  { id: 'h49', name: 'NO.49', workerId: 49 },
  { id: 'h50', name: 'NO.50', workerId: 50 },
  { id: 'h51', name: 'NO.51', workerId: 51 },
  { id: 'h52', name: 'NO.52', workerId: 52 },
  { id: 'h53', name: 'NO.53', workerId: 53 },
  { id: 'h54', name: 'NO.54', workerId: 54 },
  { id: 'h55', name: 'NO.55', workerId: 55 },
  { id: 'h56', name: 'NO.56', workerId: 56 },
  { id: 'h57', name: 'NO.57', workerId: 57 },
  { id: 'h58', name: 'NO.58', workerId: 58 },
  { id: 'h59', name: 'NO.59', workerId: 59 },
  { id: 'h60', name: 'NO.60', workerId: 60 },
  { id: 'h61', name: 'NO.61', workerId: 61 },
  { id: 'h62', name: 'NO.62', workerId: 62 },
  { id: 'h63', name: 'NO.63', workerId: 63 },
  { id: 'h64', name: 'NO.64', workerId: 64 },
];
// 新命名：内部逐步从 HEX 迁移到 AGENT，旧常量继续保留供兼容逻辑复用。
const AGENT_ROBOTS = HEXAGRAM_ROBOTS;
const ROOT_DIR = path.join(__dirname, '..');  // OpenSwarm项目根目录
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || path.join(ROOT_DIR, 'openclaw');
const CONFIG_FILE = path.join(ROOT_DIR, 'config.json');
const WORKERS_CONF = path.join(ROOT_DIR, 'workers.conf');
const START_WORKER_SH = path.join(ROOT_DIR, 'start-worker.sh');
const STOP_WORKER_SH = path.join(ROOT_DIR, 'stop-worker.sh');
const OPENCLAW_NODE_CMD = (() => {
  const fromEnv = String(process.env.OPENCLAW_NODE_CMD || '').trim();
  if (fromEnv) return fromEnv;
  const [majStr, minStr] = String(process.versions.node || '0.0').split('.');
  const maj = parseInt(majStr, 10) || 0;
  const min = parseInt(minStr, 10) || 0;
  // Keep gateway/runtime launches on the same Node binary as the panel when compatible.
  if (maj > 22 || (maj === 22 && min >= 12)) return process.execPath || 'node';
  const brewNode22 = '/opt/homebrew/opt/node@22/bin/node';
  if (process.platform === 'darwin' && fs.existsSync(brewNode22)) return brewNode22;
  return 'npx -y node@22.12.0';
})();

function parseWorkersConf() {
  const out = [];
  try {
    const raw = fs.readFileSync(WORKERS_CONF, 'utf8');
    raw.split('\n').forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length >= 3) {
        let stateDir = parts[1];
        if (stateDir && stateDir[0] !== '/' && stateDir[0] !== '~') {
          stateDir = path.join(ROOT_DIR, stateDir);
        }
        out.push({ workerId: parts[0], stateDir, port: parts[2], token: parts[3] || '' });
      }
    });
  } catch (_) {}
  return out;
}

function getWorkerByAgent(agentId) {
  const agent = AGENT_ROBOTS.find((h) => h.id === agentId);
  if (!agent) return null;
  const rows = parseWorkersConf();
  return rows.find((r) => String(r.workerId) === String(agent.workerId));
}
const publicGetWorkerByAgent = getWorkerByAgent;
function getWorkerByHex(agentId, tenantId = 'public') {
  if (String(tenantId || 'public') === 'public') return publicGetWorkerByAgent(agentId);
  return tenantRuntimeResolver.getWorkerByAgent(agentId, tenantId);
}

const isWin = process.platform === 'win32';

// 端口状态缓存（500ms 内复用结果，避免频繁系统调用）
const _portStatusCache = new Map(); // port -> { status, timestamp }
const PORT_STATUS_CACHE_TTL = 500; // ms

function isPortInUse(port) {
  const now = Date.now();
  const cached = _portStatusCache.get(port);
  if (cached && (now - cached.timestamp) < PORT_STATUS_CACHE_TTL) {
    return cached.status;
  }
  
  try {
    if (isWin) {
      const out = execSync('netstat -an', { encoding: 'utf8', stdio: 'pipe' });
      const status = new RegExp(':' + port + '\\s+.*LISTENING', 'i').test(out);
      _portStatusCache.set(port, { status, timestamp: now });
      return status;
    }
    try {
      execSync('lsof -ti :' + port, { stdio: 'pipe' });
      _portStatusCache.set(port, { status: true, timestamp: now });
      return true;
    } catch (_) {
      const out = execSync(`ss -lnt '( sport = :${Number(port)} )'`, { encoding: 'utf8', stdio: 'pipe' });
      const status = out.split('\n').some((line) => line.includes(`:${Number(port)}`));
      _portStatusCache.set(port, { status, timestamp: now });
      return status;
    }
  } catch (_) {
    _portStatusCache.set(port, { status: false, timestamp: now });
    return false;
  }
}

// 定期清理过期的缓存
setInterval(() => {
  const now = Date.now();
  for (const [port, data] of _portStatusCache.entries()) {
    if ((now - data.timestamp) > PORT_STATUS_CACHE_TTL * 2) {
      _portStatusCache.delete(port);
    }
  }
}, 1000);

// 员工状态 reconciliate 缓存（5 秒内不复用）
let _lastReconcileTime = 0;
const RECONCILE_INTERVAL = 5000; // ms

function findFreePort(start, exclude) {
  const excl = new Set(exclude || []);
  for (let p = start; p < 65536; p++) {
    if (excl.has(p)) continue;
    if (!isPortInUse(p)) return p;
  }
  return start;
}

function findFreePortBlock(start, count, exclude) {
  const excl = new Set(exclude || []);
  for (let s = start; s < 65536 - count; s++) {
    let ok = true;
    for (let i = 0; i < count; i++) {
      const p = s + i;
      if (excl.has(p) || isPortInUse(p)) { ok = false; break; }
    }
    if (ok) return s;
  }
  return start;
}

// 后台启动 moltbot gateway（数据分析师～职场顾问）：直接调用 start-worker.sh，与 panel-full.sh start <id> 一致
// 后台启动主控 gateway：端口 18789，使用项目内 openclaw
const MAIN_GATEWAY_PORT = parseInt((GATEWAY_MAIN || '').replace(/.*:(\d+)$/, '$1'), 10) || 18789;
const MAIN_GATEWAY_LOG = path.join(os.tmpdir(), 'openswarm-main.log');
const RUNTIME_MODE = String(process.env.OPENSWARM_RUNTIME_MODE || 'local').trim().toLowerCase();
const runtimeAdapter = createRuntimeAdapter(RUNTIME_MODE, {
  rootDir: ROOT_DIR,
  openclawDir: OPENCLAW_DIR,
  startWorkerScript: START_WORKER_SH,
  stopWorkerScript: STOP_WORKER_SH,
  mainGatewayPort: MAIN_GATEWAY_PORT,
  mainGatewayLog: MAIN_GATEWAY_LOG,
  openclawNodeCmd: OPENCLAW_NODE_CMD,
  getConfigEnv: () => configService.getConfigEnv(),
  parseWorkersConf,
  isPortInUse,
  spawn,
  spawnSync,
  execSync,
});
function startMainGatewayInBackground() {
  return runtimeAdapter.startMainGateway();
}
async function ensureTenantMainGateway(tenantId = 'public') {
  if (String(tenantId || 'public') === 'public') return startMainGatewayInBackground();
  return tenantRuntimeResolver.ensureMainGateway(tenantId);
}
async function ensureTenantWorkerGateway(agentId, tenantId = 'public') {
  if (String(tenantId || 'public') === 'public') return getWorkerByHex(agentId, tenantId);
  return tenantRuntimeResolver.ensureWorkerGateway(agentId, tenantId);
}

// 项目空间：本地 JSON 存储（路线图阶段 A）
const DATA_DIR = path.join(__dirname, 'data');
const LEGACY_PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const BILLING_PLANS_FILE = path.join(DATA_DIR, 'billing-plans.json');
const LEGACY_BILLING_EVENTS_FILE = path.join(DATA_DIR, 'billing-events.json');
const SKILLS_FILE = path.join(ROOT_DIR, 'skills', 'skills.json');
const HEX_DEFINITION_PROJECT_ID = 'hex-definition';
const LEGACY_HEX_DEFINITION_FILE = path.join(DATA_DIR, 'hex-definition.json');
const tenantPaths = createTenantPaths({ dataDir: DATA_DIR });
const tenantSecurityRepo = createTenantSecurityRepo({ tenantPaths });
const tenantAccessControl = createTenantAccessControl({ tenantSecurityRepo });
const agentRuntimeHealthService = createAgentRuntimeHealthService({
  file: path.join(DATA_DIR, 'agent-runtime-health.json'),
});
const projectDocumentRepo = createProjectDocumentRepo();
const autonomousRunRepo = createAutonomousRunRepo();
const projectDocumentCache = new Map();
const DB_PHASE2_MODE = isDbConfigured();
const tenantRuntimeResolver = new TenantRuntimeResolver({
  rootDir: ROOT_DIR,
  runtimeBaseDir: path.join(ROOT_DIR, 'runtime', 'tenants'),
  registryFile: path.join(DATA_DIR, 'tenant-runtime-registry.json'),
  openclawDir: OPENCLAW_DIR,
  openclawNodeCmd: OPENCLAW_NODE_CMD,
  mainGatewayPort: MAIN_GATEWAY_PORT,
  getMainGatewayToken: () => (typeof yinGatewayService !== 'undefined' && yinGatewayService ? yinGatewayService.getMainGatewayToken() : ''),
  publicParseWorkersConf: parseWorkersConf,
  agentRobots: AGENT_ROBOTS,
  isPortInUse,
  projectsFileForTenant: (tenantId) => tenantPaths.projectsFile(tenantId),
  hexDefinitionFileForTenant: (tenantId) => tenantPaths.hexDefinitionFile(tenantId),
  getAgentRuntimeHealth: (tenantId, agentId) => agentRuntimeHealthService.getAgentState(tenantId, agentId),
  setAgentRuntimeHealth: (tenantId, agentId, patch) => agentRuntimeHealthService.setAgentState(tenantId, agentId, patch),
});
function reportWorkerHealth(tenantId, agentId, payload = {}) {
  if (!agentId) return null;
  if (payload && payload.ok) return agentRuntimeHealthService.markSuccess(tenantId, agentId, payload);
  return agentRuntimeHealthService.markFailure(tenantId, agentId, payload.error, payload);
}

function reconcileRunningAgentHealth(tenantId = 'public') {
  const now = Date.now();
  // 添加缓存逻辑，避免每次请求都执行
  if ((now - _lastReconcileTime) < RECONCILE_INTERVAL) return;
  _lastReconcileTime = now;
  
  try {
    const statuses = tenantRuntimeResolver.listAgentStatuses(tenantId) || [];
    statuses.forEach((item) => {
      if (!item || !item.agentId || !item.running) return;
      const health = agentRuntimeHealthService.getAgentState(tenantId, item.agentId);
      if (!health || health.status !== 'healthy') {
        agentRuntimeHealthService.markSuccess(tenantId, item.agentId, {
          code: 'PORT_ONLINE',
          latencyMs: Number.isFinite(Number(health && health.lastLatencyMs)) ? Number(health.lastLatencyMs) : 0,
        });
      }
    });
  } catch (_) {}
}
async function restartTenantWorkerGateway(agentId, tenantId = 'public') {
  if (!agentId) return null;
  tenantRuntimeResolver.stopWorkerGateway(agentId, tenantId);
  const health = agentRuntimeHealthService.markAutoRestart(tenantId, agentId);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const worker = await tenantRuntimeResolver.ensureWorkerGateway(agentId, tenantId);
  if (worker && isPortInUse(Number(worker.port))) {
    return agentRuntimeHealthService.markSuccess(tenantId, agentId, {
      code: 'RESTART_OK',
      latencyMs: 0,
    });
  }
  return health;
}
function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}
function resolveTenantFile(primaryFile, legacyFile, tenantId = 'public') {
  if (String(tenantId || 'public') === 'public' && !fs.existsSync(primaryFile) && legacyFile && fs.existsSync(legacyFile)) {
    return legacyFile;
  }
  return primaryFile;
}
function setCachedProjectDocuments(tenantId, projectDocs, hexDoc) {
  projectDocumentCache.set(String(tenantId || 'public'), {
    projects: Array.isArray(projectDocs) ? projectDocs.map((item) => normalizeProjectAgentSchema(item)) : [],
    hexDefinition: hexDoc && typeof hexDoc === 'object'
      ? {
          hexIds: Array.isArray(hexDoc.hexIds) ? hexDoc.hexIds : (Array.isArray(hexDoc.agentIds) ? hexDoc.agentIds : []),
          agentIds: Array.isArray(hexDoc.agentIds) ? hexDoc.agentIds : (Array.isArray(hexDoc.hexIds) ? hexDoc.hexIds : []),
        }
      : null,
  });
}
function getCachedProjectDocuments(tenantId = 'public') {
  return projectDocumentCache.get(String(tenantId || 'public')) || null;
}
function readProjects(tenantId = 'public') {
  ensureDataDir();
  const cached = getCachedProjectDocuments(tenantId);
  if (cached && Array.isArray(cached.projects)) return cached.projects.map(normalizeProjectAgentSchema);
  if (DB_PHASE2_MODE) return [];
  try {
    const raw = fs.readFileSync(resolveTenantFile(tenantPaths.projectsFile(tenantId), LEGACY_PROJECTS_FILE, tenantId), 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(normalizeProjectAgentSchema) : [];
  } catch (_) {
    return [];
  }
}
function writeProjects(list, tenantId = 'public') {
  ensureDataDir();
  const normalized = Array.isArray(list) ? list.map(normalizeProjectAgentSchema) : [];
  const cached = getCachedProjectDocuments(tenantId);
  setCachedProjectDocuments(tenantId, normalized, cached?.hexDefinition || null);
  if (!DB_PHASE2_MODE) {
    fs.writeFileSync(tenantPaths.projectsFile(tenantId), JSON.stringify(normalized, null, 2), 'utf8');
  }
  projectDocumentRepo.replaceProjectConfigsForTenant(
    tenantId,
    normalized.filter((project) => project && project.id && project.id !== HEX_DEFINITION_PROJECT_ID)
  ).catch(() => {});
}
function readHexDefinitionConfig(tenantId = 'public') {
  const cached = getCachedProjectDocuments(tenantId);
  if (cached?.hexDefinition) return cached.hexDefinition;
  if (DB_PHASE2_MODE) return { hexIds: [], agentIds: [] };
  try {
    const file = resolveTenantFile(tenantPaths.hexDefinitionFile(tenantId), LEGACY_HEX_DEFINITION_FILE, tenantId);
    if (fs.existsSync(file)) {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      const ids = Array.isArray(j.hexIds) ? j.hexIds : (Array.isArray(j.agentIds) ? j.agentIds : []);
      return { hexIds: ids, agentIds: ids };
    }
  } catch (_) {}
  return { hexIds: [], agentIds: [] };
}
function writeHexDefinitionConfig(obj, tenantId = 'public') {
  ensureDataDir();
  const ids = Array.isArray(obj.hexIds) ? obj.hexIds : (Array.isArray(obj.agentIds) ? obj.agentIds : []);
  const cached = getCachedProjectDocuments(tenantId);
  setCachedProjectDocuments(tenantId, cached?.projects || [], { hexIds: ids, agentIds: ids });
  if (!DB_PHASE2_MODE) {
    fs.writeFileSync(tenantPaths.hexDefinitionFile(tenantId), JSON.stringify({ hexIds: ids, agentIds: ids }, null, 2), 'utf8');
  }
  projectDocumentRepo.writeDocument(tenantId, HEX_DEFINITION_PROJECT_ID, 'hex_definition', { hexIds: ids, agentIds: ids }).catch(() => {});
}
async function listKnownTenantIds() {
  const tenantIds = new Set(['public']);
  const tenantRoot = path.join(DATA_DIR, 'tenants');
  if (fs.existsSync(tenantRoot)) {
    fs.readdirSync(tenantRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .forEach((entry) => tenantIds.add(entry.name));
  }
  if (DB_PHASE2_MODE) {
    try {
      const result = await dbQuery('select id from tenants');
      (result.rows || []).forEach((row) => {
        const id = String(row.id || '').trim();
        if (id) tenantIds.add(id);
      });
    } catch (_) {}
  }
  return Array.from(tenantIds);
}
async function bootstrapPhase2TenantStateFromDb() {
  try {
    const tenantIds = await listKnownTenantIds();
    for (const tenantId of tenantIds) {
      const docs = await projectDocumentRepo.listDocumentsByTenant(tenantId);
      if (Array.isArray(docs)) {
        const projectDocs = docs
          .filter((doc) => doc.kind === 'project_config' && doc.projectId !== HEX_DEFINITION_PROJECT_ID)
          .map((doc) => normalizeProjectAgentSchema(doc.document || {}));
        let cachedHexDefinition = null;
        const hexDoc = docs.find((doc) => doc.kind === 'hex_definition' || doc.projectId === HEX_DEFINITION_PROJECT_ID);
        if (hexDoc) {
          const ids = Array.isArray(hexDoc.document?.hexIds) ? hexDoc.document.hexIds : (Array.isArray(hexDoc.document?.agentIds) ? hexDoc.document.agentIds : []);
          cachedHexDefinition = { hexIds: ids, agentIds: ids };
        }
        setCachedProjectDocuments(tenantId, projectDocs, cachedHexDefinition);
      }
      const runs = await autonomousRunRepo.listByTenant(tenantId, { limit: 1000 });
      if (Array.isArray(runs)) {
        if (typeof autonomyStore !== 'undefined' && autonomyStore) autonomyStore.replaceTenantRuns(tenantId, runs);
      }
    }
  } catch (err) {
    console.warn('[phase2 bootstrap] sync db -> cache failed:', err.message || err);
  }
}
function schedulePhase2DbRefresh() {
  if (!DB_PHASE2_MODE) return;
  setInterval(() => {
    bootstrapPhase2TenantStateFromDb().catch((err) => {
      console.warn('[phase2 bootstrap] periodic cache refresh failed:', err.message || err);
    });
  }, 60000);
}
function nextProjectId(list) {
  const seen = new Set((Array.isArray(list) ? list : []).map((item) => String(item?.id || '').trim()).filter(Boolean));
  let candidate = '';
  do {
    candidate = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  } while (seen.has(candidate));
  return candidate;
}

const DEFAULT_BILLING_PLANS = [
  { id: 'solo', name: 'Solo', monthlyFeeCents: 2900, includedUnits: 2000, pricePerUnitCents: 10 },
  { id: 'team', name: 'Team', monthlyFeeCents: 19900, includedUnits: 20000, pricePerUnitCents: 8 },
  { id: 'enterprise', name: 'Enterprise', monthlyFeeCents: 99900, includedUnits: 120000, pricePerUnitCents: 6 }
];
function normalizeProjectBillingConfig(input) {
  const next = (input && typeof input === 'object') ? { ...input } : {};
  next.planId = String(next.planId || 'solo');
  const credit = Number(next.creditBalanceCents);
  next.creditBalanceCents = Number.isFinite(credit) ? Math.max(0, Math.round(credit)) : 0;
  if (next.hardLimitCents === '' || next.hardLimitCents == null) {
    next.hardLimitCents = null;
  } else {
    const hard = Number(next.hardLimitCents);
    next.hardLimitCents = Number.isFinite(hard) ? Math.max(0, Math.round(hard)) : null;
  }
  return next;
}
function normalizeBillingPlan(plan) {
  if (!plan || typeof plan !== 'object') return null;
  const id = String(plan.id || '').trim();
  if (!id) return null;
  return {
    id,
    name: String(plan.name || id).trim() || id,
    monthlyFeeCents: Math.max(0, Math.round(Number(plan.monthlyFeeCents) || 0)),
    includedUnits: Math.max(0, Math.round(Number(plan.includedUnits) || 0)),
    pricePerUnitCents: Math.max(0, Math.round(Number(plan.pricePerUnitCents) || 0))
  };
}
function readBillingPlans() {
  ensureDataDir();
  try {
    if (fs.existsSync(BILLING_PLANS_FILE)) {
      const raw = fs.readFileSync(BILLING_PLANS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      const plans = Array.isArray(parsed?.plans) ? parsed.plans : (Array.isArray(parsed) ? parsed : []);
      const normalized = plans.map(normalizeBillingPlan).filter(Boolean);
      if (normalized.length > 0) return normalized;
    }
  } catch (_) {}
  return DEFAULT_BILLING_PLANS.map((p) => ({ ...p }));
}
function writeBillingPlans(plans) {
  ensureDataDir();
  const normalized = Array.isArray(plans) ? plans.map(normalizeBillingPlan).filter(Boolean) : [];
  const next = normalized.length > 0 ? normalized : DEFAULT_BILLING_PLANS.map((p) => ({ ...p }));
  fs.writeFileSync(BILLING_PLANS_FILE, JSON.stringify({ plans: next }, null, 2), 'utf8');
}
function getPlanById(planId) {
  const plans = readBillingPlans();
  const selected = plans.find((p) => p.id === planId);
  return { plan: selected || plans[0] || DEFAULT_BILLING_PLANS[0], plans };
}
function readBillingEvents(tenantId = 'public') {
  ensureDataDir();
  try {
    const file = resolveTenantFile(tenantPaths.billingEventsFile(tenantId), LEGACY_BILLING_EVENTS_FILE, tenantId);
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}
function writeBillingEvents(events, tenantId = 'public') {
  ensureDataDir();
  const arr = Array.isArray(events) ? events.slice(-20000) : [];
  fs.writeFileSync(tenantPaths.billingEventsFile(tenantId), JSON.stringify(arr, null, 2), 'utf8');
}
function appendBillingEvent(event, tenantId = 'public') {
  const events = readBillingEvents(tenantId);
  events.push(event);
  writeBillingEvents(events, tenantId);
}
function cycleBounds(ts = Date.now()) {
  const d = new Date(ts);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return { start, end, cycle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` };
}
function usageSnapshot(projectId, ts = Date.now(), tenantId = 'public') {
  const list = readProjects(tenantId);
  const project = list.find((p) => p.id === projectId);
  if (!project) return null;
  project.billing = normalizeProjectBillingConfig(project.billing);
  const { plan } = getPlanById(project.billing.planId);
  const { start, end, cycle } = cycleBounds(ts);
  const events = readBillingEvents(tenantId).filter((e) => {
    const at = Number(e.at || 0);
    return e.projectId === projectId && at >= start && at < end;
  });
  const usageEvents = events.filter((e) => e.kind === 'usage');
  const topupEvents = events.filter((e) => e.kind === 'topup');
  const usedUnits = usageEvents.reduce((s, e) => s + (Number(e.units) || 0), 0);
  const overageUnits = usageEvents.reduce((s, e) => s + (Number(e.overageUnits) || 0), 0);
  const usageNetCents = usageEvents.reduce((s, e) => s + (Number(e.amountCents) || 0), 0);
  const usageGrossCents = usageEvents.reduce((s, e) => s + (Number(e.grossAmountCents) || Number(e.amountCents) || 0), 0);
  const creditAppliedCents = usageEvents.reduce((s, e) => s + (Number(e.creditAppliedCents) || 0), 0);
  const toppedUpCents = topupEvents.reduce((s, e) => s + (Number(e.topupCents) || 0), 0);
  const remainingIncludedUnits = Math.max(0, (plan.includedUnits || 0) - usedUnits);
  const cycleTotalCents = (plan.monthlyFeeCents || 0) + usageNetCents;
  return {
    project,
    billing: project.billing,
    plan,
    cycle,
    cycleStart: start,
    cycleEnd: end,
    usedUnits,
    overageUnits,
    remainingIncludedUnits,
    usageGrossCents,
    usageNetCents,
    creditAppliedCents,
    toppedUpCents,
    cycleTotalCents
  };
}
function estimateAgentChatUnits({ inputChars = 0, outputChars = 0, agentCount = 1, rounds = 1, broadcast = false }) {
  const chars = Math.max(0, Number(inputChars) || 0) + Math.max(0, Number(outputChars) || 0);
  const charUnits = Math.ceil(chars / 180);
  const fanoutUnits = Math.max(1, Math.round(Number(agentCount) || 1)) * Math.max(1, Math.round(Number(rounds) || 1)) * (broadcast ? 2 : 1);
  return Math.max(1, charUnits + fanoutUnits);
}
function estimateAgentTaskUnits({ inputChars = 0, outputChars = 0, hasError = false }) {
  const chars = Math.max(0, Number(inputChars) || 0) + Math.max(0, Number(outputChars) || 0);
  const base = hasError ? 4 : 10;
  return Math.max(1, base + Math.ceil(chars / 200));
}
function checkHardLimit(projectId, estimatedUnits, tenantId = 'public') {
  if (!projectId) return { ok: true };
  const snap = usageSnapshot(projectId, Date.now(), tenantId);
  if (!snap) return { ok: true };
  const hard = snap.billing.hardLimitCents;
  if (hard == null) return { ok: true, snapshot: snap };
  const overageUnits = Math.max(0, (Number(estimatedUnits) || 0) - snap.remainingIncludedUnits);
  const gross = overageUnits * (snap.plan.pricePerUnitCents || 0);
  const creditApplied = Math.min(gross, snap.billing.creditBalanceCents || 0);
  const projected = snap.cycleTotalCents + Math.max(0, gross - creditApplied);
  if (projected > hard) {
    return {
      ok: false,
      snapshot: snap,
      error: `项目预算已达上限：${(projected / 100).toFixed(2)} > ${(hard / 100).toFixed(2)}`
    };
  }
  return { ok: true, snapshot: snap };
}
function recordUsageBilling({ projectId, source, taskId, units, inputChars = 0, outputChars = 0, meta = {}, tenantId = 'public' }) {
  if (!projectId) return { skipped: true, reason: 'missing_project' };
  const list = readProjects(tenantId);
  const idx = list.findIndex((p) => p.id === projectId);
  if (idx < 0) return { skipped: true, reason: 'project_not_found' };
  const project = list[idx];
  project.billing = normalizeProjectBillingConfig(project.billing);
  const { plan } = getPlanById(project.billing.planId);
  const now = Date.now();
  const { start, end, cycle } = cycleBounds(now);
  const allEvents = readBillingEvents(tenantId);
  const cycleUsage = allEvents.filter((e) => e.projectId === projectId && e.kind === 'usage' && Number(e.at || 0) >= start && Number(e.at || 0) < end);
  const usedUnitsBefore = cycleUsage.reduce((s, e) => s + (Number(e.units) || 0), 0);
  const u = Math.max(1, Math.round(Number(units) || 1));
  const includedCoveredUnits = Math.min(Math.max(0, (plan.includedUnits || 0) - usedUnitsBefore), u);
  const overageUnits = Math.max(0, u - includedCoveredUnits);
  const grossAmountCents = overageUnits * (plan.pricePerUnitCents || 0);
  const creditAppliedCents = Math.min(grossAmountCents, project.billing.creditBalanceCents || 0);
  const amountCents = Math.max(0, grossAmountCents - creditAppliedCents);
  project.billing.creditBalanceCents = Math.max(0, (project.billing.creditBalanceCents || 0) - creditAppliedCents);
  list[idx] = project;
  writeProjects(list, tenantId);
  const event = {
    id: `bill_${now}_${randomUUID().slice(0, 8)}`,
    kind: 'usage',
    at: now,
    cycle,
    projectId,
    source: String(source || 'unknown'),
    taskId: taskId || null,
    planId: plan.id,
    units: u,
    includedCoveredUnits,
    overageUnits,
    grossAmountCents,
    creditAppliedCents,
    amountCents,
    inputChars: Math.max(0, Math.round(Number(inputChars) || 0)),
    outputChars: Math.max(0, Math.round(Number(outputChars) || 0)),
    meta: (meta && typeof meta === 'object') ? meta : {}
  };
  appendBillingEvent(event, tenantId);
  return { event, billing: project.billing, plan };
}

const DEFAULT_SKILLS = [
  { id: 'summarize', name: 'Summarize' },
  { id: 'github', name: 'GitHub' },
  { id: 'wacli', name: 'Wacli' },
  { id: 'byte-rover', name: 'ByteRover' },
  { id: 'agent-browser', name: 'Agent Browser' },
  { id: 'gog', name: 'Gog' },
  { id: 'filesystem', name: 'Filesystem' }
];
function readSkillsLibrary() {
  try {
    if (fs.existsSync(SKILLS_FILE)) {
      const j = JSON.parse(fs.readFileSync(SKILLS_FILE, 'utf8'));
      const list = j.skills || [];
      return list.length > 0 ? list : DEFAULT_SKILLS;
    }
  } catch (_) {}
  return DEFAULT_SKILLS;
}

// 技能库管理：更新技能列表
function writeSkillsLibrary(skills) {
  const dir = path.dirname(SKILLS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  let meta = {};
  try {
    if (fs.existsSync(SKILLS_FILE)) {
      meta = JSON.parse(fs.readFileSync(SKILLS_FILE, 'utf8'));
    }
  } catch (_) {}
  meta.skills = Array.isArray(skills) ? skills : [];
  if (!meta.version) meta.version = '1.0';
  if (!meta.source) meta.source = 'ClawHub (clawhub.ai)';
  fs.writeFileSync(SKILLS_FILE, JSON.stringify(meta, null, 2), 'utf8');
}

// 技能模板：预设技能组合，一键应用到项目
const SKILL_TEMPLATES = [
  { id: 'content-ops', name: '内容运营', skillIds: ['summarize', 'filesystem', 'agent-browser'] },
  { id: 'dev-ops', name: '开发协作', skillIds: ['github', 'wacli', 'filesystem'] },
  { id: 'automation', name: '自动化', skillIds: ['byte-rover', 'wacli', 'agent-browser'] },
  { id: 'productivity', name: '效率工具', skillIds: ['summarize', 'gog', 'filesystem'] },
];

// 数字员工默认技能：加入项目且未配置技能时自动赋予（仅保留技能库中存在的 id）
// 可通过环境变量 OPENSWARM_DEFAULT_HEX_SKILLS 覆盖，逗号分隔，如：OPENSWARM_DEFAULT_HEX_SKILLS=summarize,filesystem,github
const DEFAULT_HEX_SKILL_IDS = (() => {
  const env = process.env.OPENSWARM_DEFAULT_HEX_SKILLS || '';
  if (env.trim()) return env.split(',').map((s) => s.trim()).filter(Boolean);
  return ['summarize', 'filesystem'];
})();
function applyDefaultHexSkills(project) {
  if (!project || !Array.isArray(project.hexIds) || project.hexIds.length === 0) return;
  const skills = readSkillsLibrary();
  const validIds = new Set((skills || []).map((s) => s.id));
  const defaultIds = DEFAULT_HEX_SKILL_IDS.filter((id) => validIds.has(id));
  if (defaultIds.length === 0) return;
  if (!project.hexSkills || typeof project.hexSkills !== 'object') project.hexSkills = {};
  project.hexIds.forEach((hexId) => {
    const current = project.hexSkills[hexId];
    if (!Array.isArray(current) || current.length === 0) {
      project.hexSkills[hexId] = defaultIds.slice();
    }
  });
}

// 项目模板：预设项目结构
const PROJECT_TEMPLATES = [
  { id: 'weekly-report', name: '周报分析', hexIds: ['qian'], hexSkills: { qian: ['summarize', 'filesystem'] }, description: '单员工摘要与文件分析' },
  { id: 'pr-review', name: 'PR 评审', hexIds: ['qian', 'kun'], hexSkills: { qian: ['github', 'summarize'], kun: ['github', 'wacli'] }, description: '双员工协作：代码审查与总结' },
  { id: 'content-pipeline', name: '内容流水线', hexIds: ['qian', 'kun', 'tai'], hexSkills: { qian: ['agent-browser', 'filesystem'], kun: ['summarize'], tai: ['filesystem'] }, description: '多员工：抓取→摘要→输出' },
];

function nextTaskId(tasks) {
  const max = (tasks || []).reduce((m, t) => Math.max(m, parseInt(String(t.id).replace(/\D/g, '') || '0', 10)), 0);
  return 't' + (max + 1);
}

// ---------- 员工定义 / 标签 / 显示名 ----------

const runtimeControlService = createRuntimeControlService({
  rootDir: ROOT_DIR,
  panelDir: __dirname,
  openclawDir: OPENCLAW_DIR,
  openclawNodeCmd: OPENCLAW_NODE_CMD,
  mainGatewayPort: MAIN_GATEWAY_PORT,
  gatewayMain: GATEWAY_MAIN,
  runtimeAdapter,
  agentRobots: HEXAGRAM_ROBOTS,
  parseWorkersConf,
  getWorkerByAgent,
  readAgentLabel: (hexId) => agentMetaService.readAgentLabel(hexId),
  isPortInUse,
  execSync,
  spawn,
  spawnSync,
});

const configService = createConfigService({
  rootDir: ROOT_DIR,
  openclawDir: OPENCLAW_DIR,
  configFile: CONFIG_FILE,
  workersConf: WORKERS_CONF,
  runtimeControlService,
  tenantRuntimeResolver,
  parseWorkersConf,
  isPortInUse,
  findFreePort,
  findFreePortBlock,
});
try {
  configService.syncAgentModelsApiKeys();
} catch (error) {
  console.warn('[config] syncAgentModelsApiKeys failed:', error.message);
}

const yinGatewayService = createYinGatewayService({
  rootDir: ROOT_DIR,
  mainGatewayPort: MAIN_GATEWAY_PORT,
  mainGatewayHttp: `http://127.0.0.1:${MAIN_GATEWAY_PORT}`,
  isPortInUse,
});

const projectDomainService = createProjectDomainService({
  hexDefinitionProjectId: HEX_DEFINITION_PROJECT_ID,
  hexRobots: HEXAGRAM_ROBOTS,
  mainGatewayPort: MAIN_GATEWAY_PORT,
  rootDir: ROOT_DIR,
  readProjects,
  writeProjects,
  readHexDefinitionConfig,
  writeHexDefinitionConfig,
  nextProjectId,
  normalizeProjectAgentSchema,
  normalizeProjectBillingConfig,
  normalizeAgentNodeAliases,
  normalizeWorkflowAliases,
  readSkillsLibrary,
  writeSkillsLibrary,
  readBillingPlans,
  writeBillingPlans,
  getPlanById,
  readBillingEvents,
  appendBillingEvent,
  usageSnapshot,
  readProjectTemplates: () => PROJECT_TEMPLATES,
  readSkillTemplates: () => SKILL_TEMPLATES,
  applyDefaultHexSkills,
  nextTaskId,
  reloadSchedules: () => triggerService.reloadSchedules(),
  resolveMainGatewayToken: () => yinGatewayService.getMainGatewayToken(),
  clearProjectState: (projectId, tenantId) => projectDataService?.clearProjectState(projectId, tenantId),
  clearAutonomyRuns: (projectId, tenantId) => autonomyStore?.clearProject(projectId, tenantId),
});

const legacyAdminService = createLegacyAdminService({
  hexRobots: HEXAGRAM_ROBOTS,
  readProjects,
  writeProjects,
  readHexagramProfiles,
  writeHexagramProfiles,
  getHexagramProfilesMerged,
  defaultHexagramProfile,
  scoreHexagramForNeeds,
  readRevenueState,
  writeRevenueState,
  nextTransactionId,
  readReports,
  writeReports,
  readDecisions,
  writeDecisions,
  nextTaskId,
  runtimeControlService,
  runtimeAdapter,
  getWorkerByHex,
  readHierarchy,
  readAlertRules,
  writeAlertRules,
  readAlertEvents,
  appendAlertEvent,
});

const devtoolsService = createDevtoolsService({
  rootDir: ROOT_DIR,
  hexRobots: HEXAGRAM_ROBOTS,
  readProjects,
  writeProjects,
  readPlatforms,
  writePlatforms,
  readPlatformTasks,
  writePlatformTasks,
  platformTasksFile,
  getHexWorkspaceDir,
  getHexagramProfilesMerged,
  scoreHexagramForNeeds,
  nextTaskId,
  execSync,
});

const agentMetaService = createAgentMetaService({
  rootDir: ROOT_DIR,
  hexRobots: HEXAGRAM_ROBOTS,
  getWorkerByHex,
});

const projectRunService = createProjectRunService({
  hexDefinitionProjectId: HEX_DEFINITION_PROJECT_ID,
  readProjects,
  normalizeAgentPayloadAliases,
  port: Number(process.env.PANEL_WEB_PORT) || 3999,
});

// ---------- 主控升级 Phase 1：员工能力画像（64 数字员工总控系统需求清单） ----------
const HEXAGRAMS_FILE = path.join(DATA_DIR, 'hexagrams.json');
const DEFAULT_CAPABILITIES = { coding: 5, writing: 5, trading: 5, marketing: 5, design: 5, analysis: 5 };
function defaultHexagramProfile(hex) {
  return {
    id: hex.id,
    name: hex.name,
    workerId: hex.workerId,
    capabilities: { ...DEFAULT_CAPABILITIES },
    expertise: [],
    currentProject: null,
    status: 'idle',
    performance: { revenue: 0, tasksCompleted: 0, avgRating: 0 }
  };
}
function readHexagramProfiles() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(HEXAGRAMS_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return HEXAGRAM_ROBOTS.map((h) => defaultHexagramProfile(h));
  }
}
function writeHexagramProfiles(profiles) {
  ensureDataDir();
  fs.writeFileSync(HEXAGRAMS_FILE, JSON.stringify(profiles, null, 2), 'utf8');
}
function getHexagramProfilesMerged() {
  const stored = readHexagramProfiles();
  const byId = {};
  stored.forEach((p) => { byId[p.id] = p; });
  return HEXAGRAM_ROBOTS.map((h) => {
    const p = byId[h.id] || defaultHexagramProfile(h);
    return { ...defaultHexagramProfile(h), ...p, id: h.id, name: h.name, workerId: h.workerId };
  });
}
// ---------- 主控升级 Phase 1 员工画像结束 ----------

// ---------- 主控升级 Phase 1：收益与升级池（64 数字员工总控系统需求清单） ----------
const REVENUE_FILE = path.join(DATA_DIR, 'revenue.json');
function defaultRevenueState() {
  return { totalRevenue: 0, upgradePool: 0, availableFunds: 0, transactions: [] };
}
function readRevenueState() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(REVENUE_FILE, 'utf8');
    const j = JSON.parse(raw);
    return {
      totalRevenue: Number(j.totalRevenue) || 0,
      upgradePool: Number(j.upgradePool) || 0,
      availableFunds: Number(j.availableFunds) || 0,
      transactions: Array.isArray(j.transactions) ? j.transactions : []
    };
  } catch (_) {
    return defaultRevenueState();
  }
}
function writeRevenueState(state) {
  ensureDataDir();
  fs.writeFileSync(REVENUE_FILE, JSON.stringify(state, null, 2), 'utf8');
}
function nextTransactionId(txs) {
  const max = txs.reduce((m, t) => Math.max(m, parseInt(String(t.id).replace(/\D/g, '') || '0', 10)), 0);
  return 'tx' + (max + 1);
}
// ---------- 主控升级 Phase 1 收益结束 ----------

// ---------- 主控升级 Phase 1：汇报（64 数字员工总控系统需求清单） ----------
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
function readReports() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(REPORTS_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}
function writeReports(list) {
  ensureDataDir();
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(list, null, 2), 'utf8');
}
// ---------- 主控升级 Phase 1 汇报结束 ----------

// ---------- 主控升级 Phase 2：能力匹配、决策日志、任务分配 ----------
const CAPABILITY_KEYS = ['coding', 'writing', 'trading', 'marketing', 'design', 'analysis'];
function scoreHexagramForNeeds(profile, needs) {
  if (!needs || needs.length === 0) return (profile.capabilities && profile.capabilities.coding) ? profile.capabilities.coding : 5;
  const cap = profile.capabilities || {};
  let sum = 0, n = 0;
  needs.forEach((k) => {
    if (CAPABILITY_KEYS.includes(k)) { sum += Number(cap[k]) || 0; n++; }
  });
  return n ? sum / n : 0;
}

const DECISIONS_FILE = path.join(DATA_DIR, 'decisions.json');
function readDecisions() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(DECISIONS_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}
function writeDecisions(list) {
  ensureDataDir();
  fs.writeFileSync(DECISIONS_FILE, JSON.stringify(list, null, 2), 'utf8');
}
// ---------- 主控升级 Phase 2：Cursor / GitHub / Platform devtools ----------
function getHexWorkspaceDir(hexId) {
  const hex = HEXAGRAM_ROBOTS.find((h) => h.id === hexId);
  return hex ? path.join(ROOT_DIR, hexId) : ROOT_DIR;
}
const PLATFORMS_FILE = path.join(DATA_DIR, 'platforms.json');
function readPlatforms() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(PLATFORMS_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}
function writePlatforms(list) {
  ensureDataDir();
  fs.writeFileSync(PLATFORMS_FILE, JSON.stringify(list, null, 2), 'utf8');
}
function platformTasksFile(platformId) {
  return path.join(DATA_DIR, 'platform-' + platformId + '-tasks.json');
}
function readPlatformTasks(platformId) {
  try {
    const raw = fs.readFileSync(platformTasksFile(platformId), 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}
function writePlatformTasks(platformId, tasks) {
  ensureDataDir();
  fs.writeFileSync(platformTasksFile(platformId), JSON.stringify(tasks, null, 2), 'utf8');
}

// ---------- 主控升级 Phase 4：健康、告警、自愈、分级、汇报模板 ----------
const ALERT_RULES_FILE = path.join(DATA_DIR, 'alert-rules.json');
const ALERT_EVENTS_FILE = path.join(DATA_DIR, 'alert-events.json');
function readAlertRules() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(ALERT_RULES_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}
function writeAlertRules(list) {
  ensureDataDir();
  fs.writeFileSync(ALERT_RULES_FILE, JSON.stringify(list, null, 2), 'utf8');
}
function readAlertEvents() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(ALERT_EVENTS_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}
function appendAlertEvent(ev) {
  ensureDataDir();
  const list = readAlertEvents();
  list.push({ ...ev, id: 'ae' + (list.length + 1), at: new Date().toISOString() });
  fs.writeFileSync(ALERT_EVENTS_FILE, JSON.stringify(list.slice(-500), null, 2), 'utf8');
}
const HIERARCHY_FILE = path.join(DATA_DIR, 'hierarchy.json');
const DEFAULT_HIERARCHY = { supervisors: { qian: ['h11','h12','h13','h14','h15','h16','h17'], kun: ['h18','h19','h20','h21','h22','h23','h24'], tai: ['h25','h26','h27','h28','h29','h30','h31'], pi: ['h32','h33','h34','h35','h36','h37','h38'], xun: ['h39','h40','h41','h42','h43','h44','h45'], yu: ['h46','h47','h48','h49','h50','h51','h52'], sui: ['h53','h54','h55','h56','h57','h58','h59'], gu: ['h60','h61','h62','h63','h64'] } };
function readHierarchy() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(HIERARCHY_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return DEFAULT_HIERARCHY;
  }
}
function writeHierarchy(obj) {
  ensureDataDir();
  fs.writeFileSync(HIERARCHY_FILE, JSON.stringify(obj, null, 2), 'utf8');
}
// ---------- 主控升级 Phase 4 结束 ----------

// 与主控对话：走主控网关 18789（与终端 moltbot TUI 同一 Claw），不再用 Bala。网关需启用 HTTP chatCompletions。
// 主控回复慢的常见原因：1) 上游 LLM 推理耗时（openclaw→智谱等）；2) 未开流式，需等整段生成；3) 注入的上下文过长（项目/记忆/群聊/历史）；4) 主控网关未启动时自动拉起约等 5s。
const MAIN_GATEWAY_HTTP = `http://127.0.0.1:${MAIN_GATEWAY_PORT}`;
// 聊天历史持久化存储（本地文件，不依赖浏览器缓存）
const CHAT_DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(CHAT_DATA_DIR)) fs.mkdirSync(CHAT_DATA_DIR, { recursive: true });

function getLegacyChatHistoryPath(projectId, mode) {
  const safeId = String(projectId || 'default').replace(/[^a-zA-Z0-9_\-]/g, '_');
  return path.join(CHAT_DATA_DIR, `chat_${mode}_${safeId}.json`);
}

function getChatHistoryPath(projectId, mode, tenantId = 'public') {
  return resolveTenantFile(
    tenantPaths.chatHistoryPath(tenantId, projectId, mode),
    getLegacyChatHistoryPath(projectId, mode),
    tenantId
  );
}

// 文件写入队列：同一路径的写入串行化，防止并发覆盖
const _writeQueues = new Map(); // filePath -> Promise
function queuedWriteFile(filePath, data) {
  const prev = _writeQueues.get(filePath) || Promise.resolve();
  const next = prev.then(() => {
    fs.writeFileSync(filePath, data, 'utf8');
  }).catch(e => { console.warn('[writeQueue]', filePath, e.message); });
  _writeQueues.set(filePath, next);
  // 队列完成后清理，防内存泄漏
  next.then(() => { if (_writeQueues.get(filePath) === next) _writeQueues.delete(filePath); });
  return next;
}

// ─── 项目记忆 ─────────────────────────────────────────────────────────────────
// 格式：{ projectId, entries: [{ date, type, content }] }
function getProjectMemoryPath(projectId, tenantId = 'public') {
  const safeId = String(projectId || 'default').replace(/[^a-zA-Z0-9_\-]/g, '_');
  return resolveTenantFile(
    tenantPaths.projectMemoryPath(tenantId, projectId),
    path.join(CHAT_DATA_DIR, `project_memory_${safeId}.json`),
    tenantId
  );
}
const projectMemoryRepo = createProjectMemoryRepo();
async function readProjectMemory(projectId, tenantId = 'public') {
  const stored = await projectMemoryRepo.read(projectId, tenantId);
  if (stored) return stored;
  try {
    const p = getProjectMemoryPath(projectId, tenantId);
    if (!fs.existsSync(p)) return { projectId, entries: [] };
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) { return { projectId, entries: [] }; }
}

// ─────────────────────────────────────────────────────────────────────────────

// 解析消息中的 @员工名，返回被 @ 的员工的 id 列表（去重）；若无 @ 则返回空数组（表示不限制，用项目已选员工）
function parseMentionedHexIds(message) {
  const msg = String(message || '');
  const mentioned = [];
  const byCode = msg.match(/@DG-(\d{2})/gi) || [];
  byCode.forEach((token) => {
    const n = parseInt(String(token).replace(/[^0-9]/g, ''), 10);
    const robot = HEXAGRAM_ROBOTS.find((h) => h.workerId === n);
    if (robot) mentioned.push(robot.id);
  });
  for (const h of HEXAGRAM_ROBOTS) {
    if (msg.includes('@' + h.name) || msg.includes('@' + h.id)) mentioned.push(h.id);
  }
  return [...new Set(mentioned)];
}

// ─── 员工 Agent 任务：通过 WebSocket 让员工用工具执行真实任务 ──────────────────────
// 与 /api/agent/chat 的区别：
//   agent/chat  → HTTP /v1/chat/completions → 员工只回复文字，不用工具
//   agent/agent-task → WebSocket "agent" 方法 → 员工完整执行（可 exec、fs_write 等工具），
//                    结果通过 chat.history 读取最新 assistant 消息
//
// 协议（与 openclaw tui 相同）：
//   1. WS 建连
//   2. 发 { type:"req", id, method:"connect", params:{ auth:{token}, client:{id,version,...}, ... } }
//   3. 收到 { type:"res", id, ok:true, payload:{type:"hello-ok"} }
//   4. 发 { type:"req", id2, method:"agent", params:{ message, idempotencyKey, sessionKey? } }
//   5. 收到 { type:"res", id2, ok:true, payload:{runId, status:"accepted"} }
//   6. 发 { type:"req", id3, method:"agent.wait", params:{ runId, timeoutMs } }
//   7. 收到 { type:"res", id3, ok:true, payload:{runId, status:"ok"|"timeout"|"error"} }
//   8. 发 { type:"req", id4, method:"chat.history", params:{ sessionKey, limit:1 } }
//   9. 收到最新 assistant 消息

const AUTONOMOUS_MAX_STEPS = 8;
const AUTONOMOUS_MAX_AGENT_REPEATS = 2;
const autonomyStore = new AutonomousRunStore({
  repo: autonomousRunRepo,
  resolveFile: (tenantId) => resolveTenantFile(
    tenantPaths.autonomyRunsFile(tenantId),
    path.join(CHAT_DATA_DIR, 'autonomous-task-runs.json'),
    tenantId
  ),
});
schedulePhase2DbRefresh();
const autonomyParser = createAutonomyParser({ parseMentionedHexIds });
let autonomyService = null;

function parseAutonomousDirective(reply) {
  return autonomyParser.parseAutonomousDirective(reply);
}

function buildAutonomousPrompt(message) {
  return autonomyService.buildAutonomousPrompt(message);
}

function createAutonomousTaskRun({ projectId, initialAgentId, message, createdBy, tenantId }) {
  return autonomyService.createAutonomousTaskRun({ projectId, initialAgentId, message, createdBy, tenantId });
}

function getActiveAutonomousRunForProject(projectId, tenantId = 'public') {
  return autonomyStore.getActiveForProject(projectId, tenantId);
}

async function maybePromoteDiscussRepliesToAutonomy({ projectId, message, results, broadcast, tenantId = 'public' }) {
  return autonomyService.maybePromoteDiscussRepliesToAutonomy({ projectId, message, results, broadcast, tenantId });
}

function markAutonomousRun(run, patch) {
  return autonomyStore.mark(run, patch);
}

function parseAutonomousYinDecision(text) {
  return autonomyService.parseAutonomousYinDecision(text);
}

const yinService = createYinService({
  getChatHistoryPath,
  normalizeAgentNameForPrompt: agentMetaService.normalizeAgentNameForPrompt,
  normalizeLegacyAgentMentions: agentMetaService.normalizeLegacyAgentMentions,
  readProjects,
  formatHexNameWithLabel: agentMetaService.formatHexNameWithLabel,
  readProjectMemory,
  isPortInUse,
  startMainGatewayInBackground: ensureTenantMainGateway,
  getMainGatewayContext: (tenantId = 'public') => {
    if (String(tenantId || 'public') === 'public') {
      return {
        port: MAIN_GATEWAY_PORT,
        http: MAIN_GATEWAY_HTTP,
        token: yinGatewayService.getMainGatewayToken(),
      };
    }
    return tenantRuntimeResolver.getMainGatewayContext(tenantId);
  },
  MAIN_GATEWAY_PORT,
  MAIN_GATEWAY_HTTP,
  getMainGatewayToken: () => yinGatewayService.getMainGatewayToken(),
});

const chatHistoryService = createChatHistoryService({
  getChatHistoryPath,
  queuedWriteFile,
  chatHistoryRepo: createChatHistoryRepo(),
});
let projectDataService = createProjectDataService({
  getChatHistoryPath,
  queuedWriteFile,
  chatHistoryRepo: createChatHistoryRepo(),
  getProjectMemoryPath,
  readProjectMemory,
  projectMemoryRepo,
  parseWorkersConf,
  hexRobots: HEXAGRAM_ROBOTS,
  normalizeAgentPayloadAliases,
  getWorkerByHex,
});

const HEX_TASKS_FILE = path.join(CHAT_DATA_DIR, 'hex-tasks.json');
const discussService = createDiscussService({
  hexRobots: HEXAGRAM_ROBOTS,
  getWorkerByHex,
  ensureWorkerGateway: ensureTenantWorkerGateway,
  checkHardLimit,
  estimateAgentChatUnits,
  recordUsageBilling,
  readProjects,
  readHexDefinitionConfig,
  readProjectMemory,
  formatHexNameWithLabel: agentMetaService.formatHexNameWithLabel,
  resolveAgentDisplayName: agentMetaService.resolveAgentDisplayName,
  readAgentDefinition: agentMetaService.readAgentDefinition,
  maybePromoteDiscussRepliesToAutonomy,
  parseMentionedHexIds,
  getHexDefinitionProjectId: () => HEX_DEFINITION_PROJECT_ID,
  reportWorkerHealth,
  restartWorkerGateway: restartTenantWorkerGateway,
  taskFile: HEX_TASKS_FILE,
});
discussService.loadTasks();
setInterval(() => { discussService.cleanupExpiredTasks(); }, 600000);

const autonomyYinReviewService = createAutonomyYinReviewService({
  hexRobots: HEXAGRAM_ROBOTS,
  countAutonomousAgentSteps,
  maxAgentRepeats: AUTONOMOUS_MAX_AGENT_REPEATS,
  markAutonomousRun,
  dispatchAutonomousAgentStep: (...args) => agentTaskService.dispatchAutonomousAgentStep(...args),
  requestYinTask: ({ message, projectId, history, tenantId }) => yinService.createChatTask({ message, projectId, history, tenantId }),
  getYinTask: (taskId) => yinService.getTask(taskId),
  parseAutonomousYinDecision,
});

function buildAutonomousYinPrompt(run) {
  return autonomyYinReviewService.buildAutonomousYinPrompt(run);
}

async function maybeContinueAutonomousRunAfterYinReview(run, decision) {
  return autonomyYinReviewService.maybeContinueAutonomousRunAfterYinReview(run, decision);
}

async function triggerYinReviewForAutonomousRun(run) {
  return autonomyYinReviewService.triggerYinReviewForAutonomousRun(run);
}

autonomyService = createAutonomyService({
  store: autonomyStore,
  parser: autonomyParser,
  hexRobots: HEXAGRAM_ROBOTS,
  maxSteps: AUTONOMOUS_MAX_STEPS,
  maxAgentRepeats: AUTONOMOUS_MAX_AGENT_REPEATS,
  parseMentionedHexIds,
  dispatchAutonomousAgentStep: (...args) => agentTaskService.dispatchAutonomousAgentStep(...args),
  triggerYinReviewForAutonomousRun,
});
autonomyStore.load('public');

function pushAutonomousProgress(runId, payload = {}) {
  return autonomyService.pushAutonomousProgress(runId, payload);
}

async function resumeAutonomousRun(run, agentId, message, meta = {}) {
  return autonomyService.resumeAutonomousRun(run, agentId, message, meta);
}

async function processAutonomousAgentResult(task) {
  return autonomyService.processAutonomousAgentResult(task);
}

const agentTaskService = createAgentTaskService({
  rootDir: ROOT_DIR,
  port: Number(process.env.PANEL_WEB_PORT) || 3999,
  readProjects,
  normalizeAgentPayloadAliases,
  hexRobots: HEXAGRAM_ROBOTS,
  getWorkerByHex,
  ensureWorkerGateway: ensureTenantWorkerGateway,
  checkHardLimit,
  estimateAgentTaskUnits,
  recordUsageBilling,
  chatHistoryService,
  workerWsCall,
  buildAutonomousPrompt,
  markAutonomousRun,
  pushAutonomousProgress,
  processAutonomousAgentResult,
  reportWorkerHealth,
  restartWorkerGateway: restartTenantWorkerGateway,
});

const triggerService = createTriggerService({
  cron,
  readProjects,
  hexDefinitionProjectId: HEX_DEFINITION_PROJECT_ID,
  dispatchAgentTask: agentTaskService.dispatchAgentTaskRequest,
});

app.use('/api/agent', createAgentRouter({
  discussService,
  appendAgentChatHistory: chatHistoryService.appendAgentChatHistory,
  agentTaskService,
  triggerNextWorkflowStep: (...args) => triggerService.triggerNextWorkflowStep(...args),
  tenantAccessControl,
}));

app.use('/api/yin', createYinRouter({
  getStatus: () => yinGatewayService.getStatusPayload(),
  getGatewayStatus: () => yinGatewayService.getGatewayStatusPayload(),
  getGatewayHealth: () => yinGatewayService.getGatewayHealthPayload(),
  yinService,
  tenantAccessControl,
}));

app.use('/api', createConfigRouter({
  configService,
  panelToken: PANEL_TOKEN,
  panelTokenCookieName: PANEL_TOKEN_COOKIE_NAME,
}));

app.use('/api/tenant-runtime', createTenantRuntimeRouter({
  tenantRuntimeResolver,
  tenantPaths,
  tenantSecurityRepo,
  tenantAccessControl,
  reconcileRunningAgentHealth,
}));

app.use('/api/autonomy', createAutonomyRouter({
  normalizeAgentPayloadAliases,
  hexRobots: HEXAGRAM_ROBOTS,
  autonomyStore,
  createAutonomousTaskRun,
  dispatchAutonomousAgentStep: (...args) => agentTaskService.dispatchAutonomousAgentStep(...args),
  resumeAutonomousRun,
  parseMentionedHexIds,
  tenantAccessControl,
}));

app.use('/api', createProjectDataRouter({
  projectDataService,
  readProjectMemory,
  tenantAccessControl,
}));

app.use('/api', createProjectDomainRouter({
  projectDomainService,
  tenantAccessControl,
}));

app.use('/api', createLegacyAdminRouter({
  legacyAdminService,
}));

app.use('/api', createDevtoolsRouter({
  devtoolsService,
}));

app.use('/api', createAgentMetaRouter({
  agentMetaService,
}));

app.use('/api', createProjectRunRouter({
  projectRunService,
}));

app.use('/api', createTriggerRouter({
  triggerService,
  tenantAccessControl,
}));

app.use('/api', createRuntimeControlRouter({
  runtimeControlService,
}));


// 未匹配的请求统一返回 JSON，避免浏览器收到 HTML 404 页
app.use((_req, res) => {
  if (!res.headersSent) res.status(404).json({ error: 'Not found' });
});

const PORT = Number(process.env.PANEL_WEB_PORT) || 3999;
const HOST = String(process.env.PANEL_WEB_HOST || '127.0.0.1').trim() || '127.0.0.1';

// 启动前检查：workers.conf 缺失时提示运行 install.sh
if (!fs.existsSync(WORKERS_CONF)) {
  console.warn('\n  [提示] workers.conf 不存在，员工启动功能将不可用。请先执行: ./install.sh\n');
} else {
  try { runtimeControlService.syncGatewayPortFromWorkersConf(); } catch (_) {}
  try { runtimeControlService.syncBrowserConfigInMoltbot(); } catch (_) {}
}

async function startServer() {
  if (DB_PHASE2_MODE) {
    try {
      await bootstrapPhase2TenantStateFromDb();
    } catch (err) {
      console.warn('[phase2 bootstrap] startup cache warmup failed:', err.message || err);
    }
  }
  const server = app.listen(PORT, HOST, () => {
    const displayHost = HOST.includes(':') ? `[${HOST}]` : HOST;
    console.log(`\n  OpenSwarm 面板已启动 → http://${displayHost}:${PORT}\n`);
    triggerService.reloadSchedules();
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n端口 ${PORT} 已被占用。请停止对应服务，或设置 PANEL_WEB_PORT 后重试。\n`);
      process.exit(1);
    }
    throw err;
  });
}

startServer().catch((err) => {
  console.error('[startup] panel failed to start:', err.message || err);
  process.exit(1);
});
