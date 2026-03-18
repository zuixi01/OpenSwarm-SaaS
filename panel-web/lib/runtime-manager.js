const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const runtimeRepo = require('./runtime-instance-repo');
const quotaRepo = require('./quota-repo');
const { isDbConfigured } = require('./db');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeTenantPath(tenantId) {
  return String(tenantId || '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isPidAlive(pid) {
  try {
    if (!pid) return false;
    process.kill(Number(pid), 0);
    return true;
  } catch (_) {
    return false;
  }
}

async function isPortOpen(port, host = '127.0.0.1', timeoutMs = 300) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch (_) {}
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(Number(port), host);
  });
}

class LocalTenantRuntimeManager {
  constructor(options = {}) {
    this.rootDir = options.rootDir || path.resolve(__dirname, '..', '..');
    this.openclawDir = options.openclawDir || path.join(this.rootDir, 'openclaw');
    this.runtimeBaseDir = options.runtimeBaseDir || path.join(this.rootDir, 'yin', 'tenants');
    this.logDir = options.logDir || '/tmp';
    this.portStart = Number(options.portStart || process.env.OPENSWARM_TENANT_RUNTIME_PORT_START || 19001);
    this.portEnd = Number(options.portEnd || process.env.OPENSWARM_TENANT_RUNTIME_PORT_END || 21999);
    this.waitStartMs = Number(options.waitStartMs || 15000);
    this.healthIntervalMs = Number(options.healthIntervalMs || 30000);
    this.maxAutoRestart = Number(options.maxAutoRestart || 3);
    this.openclawNodeCmd = String(options.openclawNodeCmd || process.env.OPENCLAW_NODE_CMD || '').trim() || this._resolveNodeCmd();
    this.runtimeTokenSecret = String(options.runtimeTokenSecret || process.env.OPENSWARM_RUNTIME_TOKEN_SECRET || 'openswarm-runtime-secret').trim();
    this._locks = new Map();
    this._sweeper = null;
  }

  _resolveNodeCmd() {
    const [majStr, minStr] = String(process.versions.node || '0.0').split('.');
    const maj = parseInt(majStr, 10) || 0;
    const min = parseInt(minStr, 10) || 0;
    if (maj > 22 || (maj === 22 && min >= 12)) return 'node';
    return 'npx -y node@22.12.0';
  }

  _runtimeStateDir(tenantId) {
    return path.join(this.runtimeBaseDir, sanitizeTenantPath(tenantId));
  }

  _runtimeLogFile(tenantId) {
    return path.join(this.logDir, `openswarm-runtime-${sanitizeTenantPath(tenantId)}.log`);
  }

  getGatewayTokenForTenant(tenantId) {
    return crypto
      .createHmac('sha256', this.runtimeTokenSecret)
      .update(`tenant:${String(tenantId || '')}`)
      .digest('hex')
      .slice(0, 48);
  }

  _withTenantLock(tenantId, fn) {
    const key = String(tenantId);
    const prev = this._locks.get(key) || Promise.resolve();
    const next = prev.then(fn).finally(() => {
      if (this._locks.get(key) === next) this._locks.delete(key);
    });
    this._locks.set(key, next.catch(() => {}));
    return next;
  }

  async _allocatePort() {
    const runtimes = await runtimeRepo.listAll();
    const used = new Set(runtimes.map((r) => Number(r.gatewayPort)).filter((n) => Number.isFinite(n) && n > 0));
    for (let p = this.portStart; p <= this.portEnd; p += 1) {
      if (used.has(p)) continue;
      // eslint-disable-next-line no-await-in-loop
      const open = await isPortOpen(p);
      if (!open) return p;
    }
    throw new Error(`no available tenant runtime port in range ${this.portStart}-${this.portEnd}`);
  }

  async _waitPortReady(port) {
    const started = Date.now();
    while (Date.now() - started < this.waitStartMs) {
      // eslint-disable-next-line no-await-in-loop
      const ready = await isPortOpen(port);
      if (ready) return true;
      // eslint-disable-next-line no-await-in-loop
      await sleep(500);
    }
    return false;
  }

  _spawnRuntime(runtime) {
    if (!fs.existsSync(path.join(this.openclawDir, 'openclaw.mjs'))) {
      throw new Error(`openclaw.mjs not found in ${this.openclawDir}`);
    }
    fs.mkdirSync(runtime.stateDir, { recursive: true });
    fs.mkdirSync(this.logDir, { recursive: true });

    const logFile = this._runtimeLogFile(runtime.tenantId);
    const gatewayToken = this.getGatewayTokenForTenant(runtime.tenantId);
    const cmd = [
      `cd "${this.openclawDir}"`,
      'unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy',
      `exec env OPENCLAW_STATE_DIR="${runtime.stateDir}" OPENCLAW_GATEWAY_PORT=${runtime.gatewayPort} OPENCLAW_GATEWAY_TOKEN="${gatewayToken}" ${this.openclawNodeCmd} openclaw.mjs gateway >> "${logFile}" 2>&1`,
    ].join(' && ');

    const child = spawn('bash', ['-lc', cmd], {
      cwd: this.rootDir,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    const pid = Number(child.pid);
    if (!Number.isFinite(pid) || pid <= 0) {
      throw new Error('failed to parse runtime pid');
    }
    return pid;
  }

  async _stopByPort(port) {
    if (!Number.isFinite(Number(port))) return;
    const cmd = `pids=$(lsof -ti :${Number(port)} 2>/dev/null || true); if [ -n "$pids" ]; then kill -9 $pids 2>/dev/null || true; fi`;
    spawnSync('bash', ['-lc', cmd], { stdio: 'ignore' });
  }

  async _startRuntime(runtime) {
    const desiredAgents = Math.max(1, Number(runtime.desiredAgents || 1));
    const stateDir = runtime.stateDir || this._runtimeStateDir(runtime.tenantId);
    const gatewayPort = Number(runtime.gatewayPort);
    if (!Number.isFinite(gatewayPort) || gatewayPort <= 0) {
      throw new Error('runtime gateway port is invalid');
    }

    const pid = this._spawnRuntime({ ...runtime, stateDir, gatewayPort });
    const ready = await this._waitPortReady(gatewayPort);
    if (!ready) {
      await this._stopByPort(gatewayPort);
      return runtimeRepo.updateRuntime(runtime.id, {
        status: 'failed',
        pid: null,
        runningAgents: 0,
        heartbeatAt: new Date(),
        crashCount: Number(runtime.crashCount || 0) + 1,
      });
    }
    return runtimeRepo.updateRuntime(runtime.id, {
      status: 'running',
      endpoint: `http://127.0.0.1:${gatewayPort}`,
      gatewayPort,
      stateDir,
      pid,
      desiredAgents,
      runningAgents: desiredAgents,
      heartbeatAt: new Date(),
      lastStartedAt: new Date(),
    });
  }

  async ensureRuntimeForTenant(tenantId, options = {}) {
    return this._withTenantLock(tenantId, async () => {
      const quota = await quotaRepo.ensureDefaultQuota(tenantId, options.planCode || 'free');
      let runtime = await runtimeRepo.getByTenantId(tenantId);

      const desiredAgents = Math.max(1, Math.min(
        Number(options.desiredAgents || runtime?.desiredAgents || 1),
        Math.max(1, quota.maxAgentsPerRuntime)
      ));

      if (!runtime) {
        const port = await this._allocatePort();
        runtime = await runtimeRepo.createRuntime({
          tenantId,
          mode: String(options.mode || 'local'),
          region: String(options.region || 'local'),
          endpoint: `http://127.0.0.1:${port}`,
          gatewayPort: port,
          stateDir: this._runtimeStateDir(tenantId),
          pid: null,
          desiredAgents,
          runningAgents: 0,
          limits: {
            maxAgentsPerRuntime: quota.maxAgentsPerRuntime,
            maxConcurrency: quota.maxConcurrency,
            authManaged: true,
          },
        });
      } else {
        if (!runtime.gatewayPort) {
          const port = await this._allocatePort();
          runtime = await runtimeRepo.updateRuntime(runtime.id, {
            gatewayPort: port,
            endpoint: `http://127.0.0.1:${port}`,
          });
        }
        if (!runtime.stateDir) {
          runtime = await runtimeRepo.updateRuntime(runtime.id, {
            stateDir: this._runtimeStateDir(tenantId),
          });
        }
        if (desiredAgents !== runtime.desiredAgents) {
          runtime = await runtimeRepo.updateRuntime(runtime.id, { desiredAgents });
        }
        const mergedLimits = {
          ...(runtime.limits || {}),
          maxAgentsPerRuntime: quota.maxAgentsPerRuntime,
          maxConcurrency: quota.maxConcurrency,
          authManaged: true,
        };
        runtime = await runtimeRepo.updateRuntime(runtime.id, { limits: mergedLimits });
      }

      const live = await isPortOpen(runtime.gatewayPort);
      const authManaged = !!(runtime.limits && runtime.limits.authManaged);
      if (runtime.status === 'running' && live && authManaged) {
        return runtimeRepo.updateRuntime(runtime.id, { heartbeatAt: new Date() });
      }
      if (runtime.status === 'running' && live && !authManaged) {
        await this.stopRuntime(runtime.id, runtime.tenantId);
        const latest = await runtimeRepo.getByIdForTenant(runtime.id, runtime.tenantId);
        return this._startRuntime(latest || runtime);
      }
      return this._startRuntime(runtime);
    });
  }

  async getRuntime(runtimeId, tenantId) {
    const runtime = await runtimeRepo.getByIdForTenant(runtimeId, tenantId);
    if (!runtime) return null;
    if (runtime.status === 'running') {
      const live = await isPortOpen(runtime.gatewayPort);
      if (live) return runtimeRepo.updateRuntime(runtime.id, { heartbeatAt: new Date() });
      return runtimeRepo.updateRuntime(runtime.id, {
        status: 'failed',
        runningAgents: 0,
        pid: null,
        crashCount: Number(runtime.crashCount || 0) + 1,
        heartbeatAt: new Date(),
      });
    }
    return runtime;
  }

  async startRuntime(runtimeId, tenantId) {
    const runtime = await runtimeRepo.getByIdForTenant(runtimeId, tenantId);
    if (!runtime) return null;
    return this._withTenantLock(tenantId, async () => {
      const latest = await runtimeRepo.getByIdForTenant(runtimeId, tenantId);
      if (!latest) return null;
      const live = latest.gatewayPort ? await isPortOpen(latest.gatewayPort) : false;
      if (latest.status === 'running' && live) {
        return runtimeRepo.updateRuntime(latest.id, { heartbeatAt: new Date() });
      }
      return this._startRuntime(latest);
    });
  }

  async stopRuntime(runtimeId, tenantId) {
    const runtime = await runtimeRepo.getByIdForTenant(runtimeId, tenantId);
    if (!runtime) return null;
    return this._withTenantLock(tenantId, async () => {
      const latest = await runtimeRepo.getByIdForTenant(runtimeId, tenantId);
      if (!latest) return null;
      try {
        if (latest.pid && isPidAlive(latest.pid)) {
          try { process.kill(Number(latest.pid), 'SIGTERM'); } catch (_) {}
          await sleep(500);
          if (isPidAlive(latest.pid)) {
            try { process.kill(Number(latest.pid), 'SIGKILL'); } catch (_) {}
          }
        }
      } catch (_) {}
      await this._stopByPort(latest.gatewayPort);
      return runtimeRepo.updateRuntime(latest.id, {
        status: 'stopped',
        pid: null,
        runningAgents: 0,
        heartbeatAt: new Date(),
        lastStoppedAt: new Date(),
      });
    });
  }

  async scaleRuntime(runtimeId, tenantId, desiredAgents) {
    const runtime = await runtimeRepo.getByIdForTenant(runtimeId, tenantId);
    if (!runtime) return null;
    const quota = await quotaRepo.ensureDefaultQuota(tenantId, 'free');
    const clamped = Math.max(1, Math.min(Number(desiredAgents || 1), Math.max(1, quota.maxAgentsPerRuntime)));
    const patch = { desiredAgents: clamped };
    if (runtime.status === 'running') patch.runningAgents = clamped;
    return runtimeRepo.updateRuntime(runtime.id, patch);
  }

  async listAgents(runtimeId, tenantId) {
    const runtime = await runtimeRepo.getByIdForTenant(runtimeId, tenantId);
    if (!runtime) return [];
    const count = Math.max(1, Number(runtime.desiredAgents || 1));
    const coordinator = {
      id: `${runtime.id}:main`,
      runtimeId: runtime.id,
      agentKey: 'main',
      role: 'coordinator',
      status: runtime.status === 'running' ? 'running' : 'stopped',
      endpoint: runtime.endpoint || null,
    };
    const workers = [];
    for (let i = 1; i <= count; i += 1) {
      workers.push({
        id: `${runtime.id}:worker:${i}`,
        runtimeId: runtime.id,
        agentKey: `worker-${i}`,
        role: 'worker',
        status: runtime.status === 'running' ? 'running' : 'stopped',
        endpoint: runtime.endpoint || null,
      });
    }
    return [coordinator, ...workers];
  }

  async healthCheck(runtimeId, tenantId) {
    const runtime = await runtimeRepo.getByIdForTenant(runtimeId, tenantId);
    if (!runtime) return { ok: false, reason: 'runtime not found' };
    if (runtime.status !== 'running') return { ok: false, reason: `runtime status=${runtime.status}` };
    const live = await isPortOpen(runtime.gatewayPort);
    if (!live) return { ok: false, reason: 'gateway unreachable' };
    await runtimeRepo.updateRuntime(runtime.id, { heartbeatAt: new Date() });
    return { ok: true };
  }

  async sweepOnce() {
    if (!isDbConfigured()) return;
    const running = await runtimeRepo.listRunning();
    for (const runtime of running) {
      // eslint-disable-next-line no-await-in-loop
      const live = await isPortOpen(runtime.gatewayPort);
      if (!live) {
        const crashCount = Number(runtime.crashCount || 0) + 1;
        // eslint-disable-next-line no-await-in-loop
        await runtimeRepo.updateRuntime(runtime.id, {
          status: 'failed',
          pid: null,
          runningAgents: 0,
          crashCount,
          heartbeatAt: new Date(),
        });
        if (crashCount <= this.maxAutoRestart) {
          // eslint-disable-next-line no-await-in-loop
          await this.ensureRuntimeForTenant(runtime.tenantId, { desiredAgents: runtime.desiredAgents });
        }
        // eslint-disable-next-line no-continue
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const quota = await quotaRepo.ensureDefaultQuota(runtime.tenantId, 'free');
      const idleMs = Math.max(1, quota.recycleIdleMinutes) * 60 * 1000;
      const heartbeat = runtime.heartbeatAt ? new Date(runtime.heartbeatAt).getTime() : 0;
      const age = Date.now() - heartbeat;
      if (heartbeat > 0 && age > idleMs) {
        // eslint-disable-next-line no-await-in-loop
        await this.stopRuntime(runtime.id, runtime.tenantId);
      } else {
        // eslint-disable-next-line no-await-in-loop
        await runtimeRepo.updateRuntime(runtime.id, { heartbeatAt: new Date() });
      }
    }
  }

  startSweeper() {
    if (this._sweeper) return;
    if (!isDbConfigured()) return;
    this._sweeper = setInterval(() => {
      this.sweepOnce().catch((err) => {
        console.warn('[runtime-manager] sweep error:', err.message || err);
      });
    }, this.healthIntervalMs);
    if (typeof this._sweeper.unref === 'function') this._sweeper.unref();
  }
}

module.exports = {
  LocalTenantRuntimeManager,
  isPortOpen,
};
