const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const os = require('os');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeTenantId(tenantId) {
  return String(tenantId || 'public').replace(/[^a-zA-Z0-9._-]/g, '_') || 'public';
}

function copyFileIfExists(src, dest) {
  try {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  } catch (_) {}
}

function copyDirContentsIfMissing(srcDir, destDir) {
  try {
    if (!fs.existsSync(srcDir)) return;
    const stat = fs.statSync(srcDir);
    if (!stat.isDirectory()) return;
    fs.mkdirSync(destDir, { recursive: true });
    fs.readdirSync(srcDir, { withFileTypes: true }).forEach((entry) => {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      if (entry.isDirectory()) {
        copyDirContentsIfMissing(srcPath, destPath);
        return;
      }
      if (fs.existsSync(destPath)) return;
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    });
  } catch (_) {}
}

function copyWorkspaceBootstrap(srcRoot, destRoot) {
  const files = [
    'AGENTS.md',
    'BOOTSTRAP.md',
    'HEARTBEAT.md',
    'IDENTITY.md',
    'SOUL.md',
    'TOOLS.md',
    'USER.md',
    'MEMORY.md',
    'LABEL.txt',
  ];
  files.forEach((name) => copyFileIfExists(path.join(srcRoot, 'workspace', name), path.join(destRoot, 'workspace', name)));
  copyFileIfExists(path.join(srcRoot, 'workspace', '.openclaw', 'workspace-state.json'), path.join(destRoot, 'workspace', '.openclaw', 'workspace-state.json'));
  try {
    fs.mkdirSync(path.join(destRoot, 'workspace', 'output'), { recursive: true });
    fs.mkdirSync(path.join(destRoot, 'workspace', 'skills'), { recursive: true });
  } catch (_) {}
}

function copyStateBootstrap(srcRoot, destRoot, options = {}) {
  const includeDirs = Array.isArray(options.includeDirs) ? options.includeDirs : [];
  const includeFiles = Array.isArray(options.includeFiles) ? options.includeFiles : [];
  includeDirs.forEach((dir) => {
    copyDirContentsIfMissing(path.join(srcRoot, dir), path.join(destRoot, dir));
  });
  includeFiles.forEach((file) => {
    copyFileIfExists(path.join(srcRoot, file), path.join(destRoot, file));
  });
}

function buildPythonShimDir(baseDir) {
  const shimDir = path.join(baseDir, '.openswarm-shims');
  const shimFile = path.join(shimDir, 'python');
  try {
    fs.mkdirSync(shimDir, { recursive: true });
    fs.writeFileSync(
      shimFile,
      [
        '#!/usr/bin/env bash',
        'if command -v python3 >/dev/null 2>&1; then',
        '  exec "$(command -v python3)" "$@"',
        'fi',
        'echo "python3 not found" >&2',
        'exit 127',
        '',
      ].join('\n'),
      'utf8'
    );
    fs.chmodSync(shimFile, 0o755);
  } catch (_) {}
  return shimDir;
}

function normalizeOpenClawPermissionsConfig(data) {
  if (!data || typeof data !== 'object') return;
  data.browser = data.browser && typeof data.browser === 'object' ? data.browser : {};
  data.browser.enabled = true;
  data.browser.ssrfPolicy = data.browser.ssrfPolicy && typeof data.browser.ssrfPolicy === 'object'
    ? data.browser.ssrfPolicy
    : {};
  data.browser.ssrfPolicy.dangerouslyAllowPrivateNetwork = true;
  const browserAllowedHosts = new Set(Array.isArray(data.browser.ssrfPolicy.allowedHostnames) ? data.browser.ssrfPolicy.allowedHostnames : []);
  browserAllowedHosts.add('localhost');
  browserAllowedHosts.add('127.0.0.1');
  browserAllowedHosts.add('::1');
  data.browser.ssrfPolicy.allowedHostnames = Array.from(browserAllowedHosts);

  data.tools = data.tools && typeof data.tools === 'object' ? data.tools : {};
  data.tools.profile = 'full';
  const additiveTools = [
    'group:fs',
    'group:runtime',
    'group:web',
    'group:ui',
    'group:memory',
    'group:sessions',
    'group:automation',
    'group:nodes',
    'group:messaging',
    'group:openclaw',
  ];
  const existingAlsoAllow = Array.isArray(data.tools.alsoAllow) ? data.tools.alsoAllow : [];
  data.tools.alsoAllow = Array.from(new Set([...existingAlsoAllow, ...additiveTools]));

  data.tools.exec = data.tools.exec && typeof data.tools.exec === 'object' ? data.tools.exec : {};
  data.tools.exec.security = 'full';
  data.tools.exec.ask = 'off';
  data.tools.web = data.tools.web && typeof data.tools.web === 'object' ? data.tools.web : {};
  data.tools.web.fetch = data.tools.web.fetch && typeof data.tools.web.fetch === 'object' ? data.tools.web.fetch : {};
  data.tools.web.fetch.enabled = true;
  if ('ssrfPolicy' in data.tools.web.fetch) delete data.tools.web.fetch.ssrfPolicy;

  const search = data.tools.web.search && typeof data.tools.web.search === 'object'
    ? data.tools.web.search
    : {};
  const provider = typeof search.provider === 'string' ? search.provider.trim().toLowerCase() : '';
  const explicitKey =
    (search.kimi && typeof search.kimi.apiKey === 'string' && search.kimi.apiKey.trim()) ||
    (typeof search.apiKey === 'string' && search.apiKey.trim()) ||
    '';
  const envKeys = {
    brave: process.env.BRAVE_API_KEY,
    firecrawl: process.env.FIRECRAWL_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    grok: process.env.XAI_API_KEY,
    kimi: process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY,
    perplexity: process.env.PERPLEXITY_API_KEY || process.env.OPENROUTER_API_KEY,
  };

  if (!provider) {
    data.tools.web.search = {
      ...search,
      enabled: true,
    };
    return;
  }

  const providerHasKey = Boolean(explicitKey || envKeys[provider]);
  data.tools.web.search = {
    ...search,
    provider,
    enabled: true,
  };
  if (explicitKey && typeof explicitKey === 'string') {
    data.tools.web.search.apiKey = explicitKey;
  } else if (!providerHasKey && 'apiKey' in data.tools.web.search) {
    delete data.tools.web.search.apiKey;
  }
}

function patchGatewayConfig(filePath, port, token) {
  try {
    if (!fs.existsSync(filePath)) return;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    data.gateway = data.gateway || {};
    data.gateway.port = Number(port);
    data.gateway.mode = data.gateway.mode || 'local';
    data.gateway.bind = data.gateway.bind || 'loopback';
    data.gateway.auth = data.gateway.auth || {};
    data.gateway.auth.mode = 'token';
    data.gateway.auth.token = String(token || '');
    data.gateway.http = data.gateway.http || {};
    data.gateway.http.endpoints = data.gateway.http.endpoints || {};
    data.gateway.http.endpoints.chatCompletions = data.gateway.http.endpoints.chatCompletions || {};
    data.gateway.http.endpoints.chatCompletions.enabled = true;
    normalizeOpenClawPermissionsConfig(data);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (_) {}
}

class TenantRuntimeResolver {
  constructor(options = {}) {
    this.rootDir = options.rootDir;
    this.runtimeBaseDir = options.runtimeBaseDir || path.join(this.rootDir, 'runtime', 'tenants');
    this.registryFile = options.registryFile || path.join(this.rootDir, 'panel-web', 'data', 'tenant-runtime-registry.json');
    this.openclawDir = options.openclawDir;
    this.openclawNodeCmd = options.openclawNodeCmd || 'node';
    this.mainGatewayPort = Number(options.mainGatewayPort || 18789);
    this.getMainGatewayToken = options.getMainGatewayToken || (() => '');
    this.publicParseWorkersConf = options.publicParseWorkersConf;
    this.agentRobots = options.agentRobots || [];
    this.isPortInUse = options.isPortInUse || (() => false);
    this.portStart = Number(options.portStart || 22000);
    this.portEnd = Number(options.portEnd || 52000);
    this.blockSize = Number(options.blockSize || 80);
    this.projectsFileForTenant = options.projectsFileForTenant || null;
    this.hexDefinitionFileForTenant = options.hexDefinitionFileForTenant || null;
    this.getAgentRuntimeHealth = options.getAgentRuntimeHealth || null;
    this.setAgentRuntimeHealth = options.setAgentRuntimeHealth || null;
    this.pendingStarts = new Map();
  }

  readRegistry() {
    try {
      if (!fs.existsSync(this.registryFile)) return {};
      const raw = JSON.parse(fs.readFileSync(this.registryFile, 'utf8'));
      return raw && typeof raw === 'object' ? raw : {};
    } catch (_) {
      return {};
    }
  }

  writeRegistry(registry) {
    fs.mkdirSync(path.dirname(this.registryFile), { recursive: true });
    fs.writeFileSync(this.registryFile, JSON.stringify(registry, null, 2), 'utf8');
  }

  ensureTenantAssignment(tenantId) {
    const safeTenantId = sanitizeTenantId(tenantId);
    if (safeTenantId === 'public') {
      return { tenantId: 'public', basePort: null };
    }
    const registry = this.readRegistry();
    if (registry[safeTenantId]) return registry[safeTenantId];
    const used = new Set(Object.values(registry).map((item) => Number(item.basePort)).filter((n) => Number.isFinite(n) && n > 0));
    let basePort = null;
    for (let port = this.portStart; port + this.blockSize < this.portEnd; port += this.blockSize) {
      if (used.has(port)) continue;
      basePort = port;
      break;
    }
    if (!basePort) throw new Error('没有可用的租户 runtime 端口块');
    registry[safeTenantId] = { tenantId: safeTenantId, basePort };
    this.writeRegistry(registry);
    return registry[safeTenantId];
  }

  tenantRoot(tenantId) {
    return path.join(this.runtimeBaseDir, sanitizeTenantId(tenantId));
  }

  tenantMainStateDir(tenantId) {
    return path.join(this.tenantRoot(tenantId), 'yin');
  }

  tenantWorkerStateDir(tenantId, agentId) {
    return path.join(this.tenantRoot(tenantId), 'agents', String(agentId || 'unknown'));
  }

  tenantMetaFile(tenantId) {
    return path.join(this.tenantRoot(tenantId), 'runtime-meta.json');
  }

  readTenantMeta(tenantId) {
    const safeTenantId = sanitizeTenantId(tenantId);
    const file = this.tenantMetaFile(safeTenantId);
    try {
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (raw && typeof raw === 'object') {
          return {
            tenantId: safeTenantId,
            desiredAgents: Math.max(1, Number(raw.desiredAgents || 1)),
            updatedAt: raw.updatedAt || null,
          };
        }
      }
    } catch (_) {}
    return {
      tenantId: safeTenantId,
      desiredAgents: 1,
      updatedAt: null,
    };
  }

  writeTenantMeta(tenantId, patch = {}) {
    const safeTenantId = sanitizeTenantId(tenantId);
    const next = {
      ...this.readTenantMeta(safeTenantId),
      ...(patch && typeof patch === 'object' ? patch : {}),
      tenantId: safeTenantId,
      desiredAgents: Math.max(1, Number(patch?.desiredAgents || this.readTenantMeta(safeTenantId).desiredAgents || 1)),
      updatedAt: new Date().toISOString(),
    };
    fs.mkdirSync(this.tenantRoot(safeTenantId), { recursive: true });
    fs.writeFileSync(this.tenantMetaFile(safeTenantId), JSON.stringify(next, null, 2), 'utf8');
    return next;
  }

  setDesiredAgents(tenantId, desiredAgents) {
    return this.writeTenantMeta(tenantId, {
      desiredAgents: Math.max(1, Number(desiredAgents || 1)),
    });
  }

  getDesiredAgents(tenantId) {
    return Math.max(1, Number(this.readTenantMeta(tenantId).desiredAgents || 1));
  }

  getPublicWorkerByAgent(agentId) {
    const agent = this.agentRobots.find((item) => item.id === agentId);
    if (!agent) return null;
    const rows = this.publicParseWorkersConf ? this.publicParseWorkersConf() : [];
    return rows.find((row) => String(row.workerId) === String(agent.workerId)) || null;
  }

  bootstrapMainState(tenantId) {
    const dest = this.tenantMainStateDir(tenantId);
    const src = path.join(this.rootDir, 'yin');
    const assignment = this.ensureTenantAssignment(tenantId);
    fs.mkdirSync(dest, { recursive: true });
    copyStateBootstrap(src, dest, {
      includeDirs: [
        'agents',
        'canvas',
        'claws',
        'cron',
        'devices',
        'identity',
        'memory',
        path.join('workspace', '.openclaw'),
      ],
      includeFiles: [
        'moltbot.json',
      ],
    });
    copyFileIfExists(path.join(src, 'moltbot.json'), path.join(dest, 'moltbot.json'));
    copyFileIfExists(path.join(src, 'agents', 'main', 'agent', 'auth-profiles.json'), path.join(dest, 'agents', 'main', 'agent', 'auth-profiles.json'));
    copyFileIfExists(path.join(src, 'agents', 'main', 'agent', 'models.json'), path.join(dest, 'agents', 'main', 'agent', 'models.json'));
    copyWorkspaceBootstrap(src, dest);
    patchGatewayConfig(path.join(dest, 'moltbot.json'), Number(assignment.basePort), this.buildGatewayToken(tenantId, 'main'));
    return dest;
  }

  bootstrapWorkerState(tenantId, agentId) {
    const publicWorker = this.getPublicWorkerByAgent(agentId);
    if (!publicWorker || !publicWorker.stateDir) throw new Error(`未找到员工 ${agentId} 的公开 runtime 模板`);
    const dest = this.tenantWorkerStateDir(tenantId, agentId);
    const assignment = this.ensureTenantAssignment(tenantId);
    const agent = this.agentRobots.find((item) => item.id === agentId);
    fs.mkdirSync(dest, { recursive: true });
    copyStateBootstrap(publicWorker.stateDir, dest, {
      includeDirs: [
        'agents',
        'canvas',
        'cron',
        'devices',
        'identity',
        'memory',
        path.join('workspace', '.openclaw'),
      ],
      includeFiles: [
        'moltbot.json',
      ],
    });
    copyFileIfExists(path.join(publicWorker.stateDir, 'moltbot.json'), path.join(dest, 'moltbot.json'));
    copyFileIfExists(path.join(publicWorker.stateDir, 'agents', 'main', 'agent', 'auth-profiles.json'), path.join(dest, 'agents', 'main', 'agent', 'auth-profiles.json'));
    copyFileIfExists(path.join(publicWorker.stateDir, 'agents', 'main', 'agent', 'models.json'), path.join(dest, 'agents', 'main', 'agent', 'models.json'));
    copyWorkspaceBootstrap(publicWorker.stateDir, dest);
    patchGatewayConfig(
      path.join(dest, 'moltbot.json'),
      Number(assignment.basePort) + Number(agent.workerId),
      this.buildGatewayToken(tenantId, agentId)
    );
    return dest;
  }

  getMainGatewayContext(tenantId = 'public') {
    if (String(tenantId || 'public') === 'public') {
      return {
        tenantId: 'public',
        stateDir: path.join(this.rootDir, 'yin'),
        port: this.mainGatewayPort,
        token: this.getMainGatewayToken(),
        http: `http://127.0.0.1:${this.mainGatewayPort}`,
      };
    }
    const assignment = this.ensureTenantAssignment(tenantId);
    const safeTenantId = sanitizeTenantId(tenantId);
    return {
      tenantId: safeTenantId,
      stateDir: this.bootstrapMainState(safeTenantId),
      port: Number(assignment.basePort),
      token: this.buildGatewayToken(safeTenantId, 'main'),
      http: `http://127.0.0.1:${Number(assignment.basePort)}`,
    };
  }

  getWorkerByAgent(agentId, tenantId = 'public') {
    if (String(tenantId || 'public') === 'public') {
      return this.getPublicWorkerByAgent(agentId);
    }
    const safeTenantId = sanitizeTenantId(tenantId);
    const assignment = this.ensureTenantAssignment(safeTenantId);
    const agent = this.agentRobots.find((item) => item.id === agentId);
    if (!agent) return null;
    return {
      workerId: agent.workerId,
      stateDir: this.bootstrapWorkerState(safeTenantId, agentId),
      port: Number(assignment.basePort) + Number(agent.workerId),
      token: this.buildGatewayToken(safeTenantId, agentId),
      tenantId: safeTenantId,
      tenantScoped: true,
    };
  }

  buildGatewayToken(tenantId, key) {
    return crypto
      .createHmac('sha256', 'openswarm-tenant-runtime')
      .update(`${sanitizeTenantId(tenantId)}:${String(key || '')}`)
      .digest('hex')
      .slice(0, 48);
  }

  resolveGatewayLockPath(stateDir) {
    try {
      const configPath = path.join(stateDir, 'moltbot.json');
      const hash = crypto.createHash('sha256').update(configPath).digest('hex').slice(0, 8);
      const uid = typeof process.getuid === 'function' ? process.getuid() : null;
      const lockDir = path.join(os.tmpdir(), uid != null ? `openclaw-${uid}` : 'openclaw');
      return path.join(lockDir, `gateway.${hash}.lock`);
    } catch (_) {
      return null;
    }
  }

  cleanupGatewayLock(stateDir, port) {
    const lockPath = this.resolveGatewayLockPath(stateDir);
    if (!lockPath) return false;
    try {
      if (this.isPortInUse(Number(port))) return false;
      if (fs.existsSync(lockPath)) {
        fs.rmSync(lockPath, { force: true });
        return true;
      }
    } catch (_) {}
    return false;
  }

  readGatewayLog(port) {
    try {
      const logPath = `/tmp/openswarm-tenant-${Number(port)}.log`;
      if (!fs.existsSync(logPath)) return '';
      return fs.readFileSync(logPath, 'utf8');
    } catch (_) {
      return '';
    }
  }

  startGateway(stateDir, port, token) {
    this.cleanupGatewayLock(stateDir, port);
    const shimDir = buildPythonShimDir(stateDir);
    const cmd = [
      `cd "${this.openclawDir}"`,
      'unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy',
      `exec env PATH="${shimDir}:$PATH" OPENCLAW_STATE_DIR="${stateDir}" OPENCLAW_GATEWAY_PORT=${Number(port)} OPENCLAW_GATEWAY_TOKEN="${token}" ${this.openclawNodeCmd} openclaw.mjs gateway run >/tmp/openswarm-tenant-${Number(port)}.log 2>&1`,
    ].join(' && ');
    const child = spawn('bash', ['-lc', cmd], {
      cwd: this.rootDir,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  }

  async ensureGatewayStarted(key, stateDir, port, token) {
    const startKey = String(key || port);
    if (this.isPortInUse(Number(port))) return true;
    if (this.pendingStarts.has(startKey)) {
      return this.pendingStarts.get(startKey);
    }
    const pending = (async () => {
      this.startGateway(stateDir, port, token);
      let ready = await this.waitUntilPortReady(port);
      if (ready || this.isPortInUse(Number(port))) {
        return true;
      }
      const gatewayLog = this.readGatewayLog(port);
      if (
        !this.isPortInUse(Number(port)) &&
        /gateway already running|lock timeout|Port \d+ is already in use/i.test(gatewayLog || '')
      ) {
        this.cleanupGatewayLock(stateDir, port);
        this.startGateway(stateDir, port, token);
        ready = await this.waitUntilPortReady(port, 10000);
      }
      return ready || this.isPortInUse(Number(port));
    })();
    this.pendingStarts.set(startKey, pending);
    try {
      return await pending;
    } finally {
      this.pendingStarts.delete(startKey);
    }
  }

  stopGatewayByPort(port) {
    const targetPort = Number(port);
    if (!Number.isFinite(targetPort) || targetPort <= 0) return false;
    try {
      spawnSync(
        'bash',
        [
          '-lc',
          [
            `pids="$(lsof -ti tcp:${targetPort} 2>/dev/null || true)"`,
            'if [ -n "$pids" ]; then kill -TERM $pids 2>/dev/null || true; sleep 1; fi',
            `pids="$(lsof -ti tcp:${targetPort} 2>/dev/null || true)"`,
            'if [ -n "$pids" ]; then kill -KILL $pids 2>/dev/null || true; fi',
          ].join('; '),
        ],
        { stdio: 'ignore' }
      );
    } catch (_) {}
    return !this.isPortInUse(targetPort);
  }

  async waitUntilPortReady(port, timeoutMs = 15000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (this.isPortInUse(Number(port))) return true;
      // eslint-disable-next-line no-await-in-loop
      await sleep(500);
    }
    return this.isPortInUse(Number(port));
  }

  async ensureWorkerGateway(agentId, tenantId = 'public') {
    const worker = this.getWorkerByAgent(agentId, tenantId);
    if (!worker) return null;
    if (this.isPortInUse(Number(worker.port))) return worker;
    if (typeof this.setAgentRuntimeHealth === 'function') {
      this.setAgentRuntimeHealth(tenantId, agentId, {
        status: 'healthy',
        lastSuccessCode: 'PORT_ONLINE',
        lastSuccessAt: null,
        lastError: null,
        lastErrorCode: null,
      });
    }
    await this.ensureGatewayStarted(`worker:${sanitizeTenantId(tenantId)}:${String(agentId)}`, worker.stateDir, worker.port, worker.token || '');
    return worker;
  }

  async ensureMainGateway(tenantId = 'public') {
    const gateway = this.getMainGatewayContext(tenantId);
    if (this.isPortInUse(Number(gateway.port))) return gateway;
    await this.ensureGatewayStarted(`main:${sanitizeTenantId(tenantId)}`, gateway.stateDir, gateway.port, gateway.token || '');
    return gateway;
  }

  stopWorkerGateway(agentId, tenantId = 'public') {
    const worker = this.getWorkerByAgent(agentId, tenantId);
    if (!worker) return false;
    if (typeof this.setAgentRuntimeHealth === 'function') {
      this.setAgentRuntimeHealth(tenantId, agentId, {
        status: 'offline',
        lastSuccessCode: null,
      });
    }
    return this.stopGatewayByPort(worker.port);
  }

  stopMainGateway(tenantId = 'public') {
    const gateway = this.getMainGatewayContext(tenantId);
    return this.stopGatewayByPort(gateway.port);
  }

  listKnownTenantIds() {
    const found = new Set(['public']);
    try {
      Object.keys(this.readRegistry() || {}).forEach((tenantId) => found.add(sanitizeTenantId(tenantId)));
    } catch (_) {}
    try {
      if (fs.existsSync(this.runtimeBaseDir)) {
        fs.readdirSync(this.runtimeBaseDir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .forEach((entry) => found.add(sanitizeTenantId(entry.name)));
      }
    } catch (_) {}
    try {
      if (typeof this.projectsFileForTenant === 'function') {
        const dataTenantsDir = path.dirname(this.projectsFileForTenant('public'));
        const tenantsRoot = path.dirname(dataTenantsDir);
        if (fs.existsSync(tenantsRoot)) {
          fs.readdirSync(tenantsRoot, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .forEach((entry) => found.add(sanitizeTenantId(entry.name)));
        }
      }
    } catch (_) {}
    return Array.from(found);
  }

  readTenantProjects(tenantId) {
    if (typeof this.projectsFileForTenant !== 'function') return [];
    try {
      const file = this.projectsFileForTenant(tenantId);
      if (!file || !fs.existsSync(file)) return [];
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(raw) ? raw : [];
    } catch (_) {
      return [];
    }
  }

  readTenantHexDefinition(tenantId) {
    if (typeof this.hexDefinitionFileForTenant !== 'function') return null;
    try {
      const file = this.hexDefinitionFileForTenant(tenantId);
      if (!file || !fs.existsSync(file)) return null;
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      return raw && typeof raw === 'object' ? raw : null;
    } catch (_) {
      return null;
    }
  }

  discoverTenantAgentIds(tenantId = 'public') {
    const safeTenantId = sanitizeTenantId(tenantId);
    const discovered = new Set();
    const ordered = [];
    const push = (agentId) => {
      const normalized = String(agentId || '').trim();
      if (!normalized || discovered.has(normalized)) return;
      if (!this.agentRobots.find((item) => item.id === normalized)) return;
      discovered.add(normalized);
      ordered.push(normalized);
    };

    const hexDefinition = this.readTenantHexDefinition(safeTenantId);
    if (hexDefinition && Array.isArray(hexDefinition.hexIds)) hexDefinition.hexIds.forEach(push);

    this.readTenantProjects(safeTenantId).forEach((project) => {
      const ids = Array.isArray(project?.hexIds) ? project.hexIds : (Array.isArray(project?.agentIds) ? project.agentIds : []);
      ids.forEach(push);
    });

    try {
      const agentsDir = path.join(this.tenantRoot(safeTenantId), 'agents');
      if (fs.existsSync(agentsDir)) {
        fs.readdirSync(agentsDir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .forEach((entry) => push(entry.name));
      }
    } catch (_) {}

    if (!ordered.length) {
      this.agentRobots
        .slice(0, this.getDesiredAgents(safeTenantId))
        .forEach((item) => push(item.id));
    }

    const sortOrder = new Map(this.agentRobots.map((item, index) => [item.id, index]));
    ordered.sort((a, b) => (sortOrder.get(a) ?? 9999) - (sortOrder.get(b) ?? 9999));
    return ordered;
  }

  getManagedAgentIds(tenantId = 'public') {
    const discovered = this.discoverTenantAgentIds(tenantId);
    const desiredAgents = this.getDesiredAgents(tenantId);
    return discovered.slice(0, desiredAgents);
  }

  getAgentStatus(agentId, tenantId = 'public') {
    const worker = this.getWorkerByAgent(agentId, tenantId);
    const agent = this.agentRobots.find((item) => item.id === agentId);
    if (!worker) return null;
    const running = this.isPortInUse(Number(worker.port));
    const health = typeof this.getAgentRuntimeHealth === 'function'
      ? this.getAgentRuntimeHealth(tenantId, agentId)
      : null;
    const healthStatus = !running
      ? 'offline'
      : (health && typeof health.status === 'string' ? health.status : 'healthy');
    const lastSuccessCode = health && health.lastSuccessCode ? String(health.lastSuccessCode) : '';
    const readinessStatus = !running
      ? 'offline'
      : (healthStatus === 'recovering'
        ? 'warming'
        : (healthStatus === 'degraded'
          ? 'degraded'
          : (lastSuccessCode === 'CHAT_READY' ? 'ready' : 'warming')));
    return {
      agentId,
      agentKey: agentId,
      role: agent?.name || agentId,
      status: running ? (healthStatus === 'healthy' ? 'running' : healthStatus) : 'stopped',
      running,
      healthStatus,
      readinessStatus,
      health,
      port: Number(worker.port),
      stateDir: worker.stateDir,
      endpoint: `http://127.0.0.1:${Number(worker.port)}`,
      managed: this.getManagedAgentIds(tenantId).includes(agentId),
      workerId: worker.workerId,
      tenantId: sanitizeTenantId(tenantId),
    };
  }

  listAgentStatuses(tenantId = 'public') {
    return this.discoverTenantAgentIds(tenantId)
      .map((agentId) => this.getAgentStatus(agentId, tenantId))
      .filter(Boolean);
  }

  getTenantOverview(tenantId = 'public') {
    const safeTenantId = sanitizeTenantId(tenantId);
    const desiredAgents = this.getDesiredAgents(safeTenantId);
    const main = this.getMainGatewayContext(safeTenantId);
    const mainRunning = this.isPortInUse(Number(main.port));
    const agents = this.listAgentStatuses(safeTenantId);
    const managed = agents.filter((item) => item.managed);
    const runningAgents = managed.filter((item) => item.running).length;
    const degradedAgents = managed.filter((item) => item.running && item.healthStatus && item.healthStatus !== 'healthy').length;
    const overallStatus = mainRunning && runningAgents === managed.length && degradedAgents === 0
      ? 'running'
      : (mainRunning || runningAgents > 0 ? 'partial' : 'stopped');

    return {
      tenantId: safeTenantId,
      runtime: {
        id: `local:${safeTenantId}`,
        mode: 'local-file',
        status: overallStatus,
        endpoint: main.http,
        gatewayPort: Number(main.port),
        desiredAgents,
        runningAgents,
        managedAgents: managed.length,
        degradedAgents,
        mainRunning,
        heartbeatAt: null,
        pid: null,
      },
      main: {
        stateDir: main.stateDir,
        port: Number(main.port),
        token: main.token,
        status: mainRunning ? 'running' : 'stopped',
        endpoint: main.http,
      },
      agents,
    };
  }

  async healthCheck(tenantId = 'public') {
    const overview = this.getTenantOverview(tenantId);
    const items = [
      {
        kind: 'main',
        key: 'main',
        status: overview.main.status,
        port: overview.main.port,
        endpoint: overview.main.endpoint,
      },
      ...overview.agents.map((agent) => ({
        kind: 'worker',
        key: agent.agentId,
        status: agent.status,
        port: agent.port,
        endpoint: agent.endpoint,
      })),
    ];
    return {
      ok: overview.runtime.status === 'running' || overview.runtime.status === 'partial',
      tenantId: overview.tenantId,
      runtime: overview.runtime,
      items,
    };
  }

  async ensureTenantRuntime(tenantId = 'public', options = {}) {
    const safeTenantId = sanitizeTenantId(tenantId);
    const desiredAgents = Math.max(1, Number(options.desiredAgents || this.getDesiredAgents(safeTenantId) || 1));
    this.setDesiredAgents(safeTenantId, desiredAgents);
    await this.ensureMainGateway(safeTenantId);
    for (const agentId of this.getManagedAgentIds(safeTenantId)) {
      // eslint-disable-next-line no-await-in-loop
      await this.ensureWorkerGateway(agentId, safeTenantId);
    }
    return this.getTenantOverview(safeTenantId);
  }

  async startRuntime(tenantId = 'public', options = {}) {
    const safeTenantId = sanitizeTenantId(tenantId);
    if (options.agentId) {
      await this.ensureWorkerGateway(String(options.agentId), safeTenantId);
      return this.getTenantOverview(safeTenantId);
    }
    if (options.target === 'main') {
      await this.ensureMainGateway(safeTenantId);
      return this.getTenantOverview(safeTenantId);
    }
    return this.ensureTenantRuntime(safeTenantId, options);
  }

  async stopRuntime(tenantId = 'public', options = {}) {
    const safeTenantId = sanitizeTenantId(tenantId);
    if (options.agentId) {
      this.stopWorkerGateway(String(options.agentId), safeTenantId);
      return this.getTenantOverview(safeTenantId);
    }
    if (options.target === 'main') {
      this.stopMainGateway(safeTenantId);
      return this.getTenantOverview(safeTenantId);
    }
    this.stopMainGateway(safeTenantId);
    this.discoverTenantAgentIds(safeTenantId).forEach((agentId) => {
      this.stopWorkerGateway(agentId, safeTenantId);
    });
    return this.getTenantOverview(safeTenantId);
  }

  async scaleRuntime(tenantId = 'public', desiredAgents = 1) {
    const safeTenantId = sanitizeTenantId(tenantId);
    const nextDesired = Math.max(1, Number(desiredAgents || 1));
    this.setDesiredAgents(safeTenantId, nextDesired);
    const managed = new Set(this.getManagedAgentIds(safeTenantId));
    this.discoverTenantAgentIds(safeTenantId).forEach((agentId) => {
      if (!managed.has(agentId)) this.stopWorkerGateway(agentId, safeTenantId);
    });
    return this.getTenantOverview(safeTenantId);
  }
}

module.exports = {
  TenantRuntimeResolver,
  sanitizeTenantId,
};
