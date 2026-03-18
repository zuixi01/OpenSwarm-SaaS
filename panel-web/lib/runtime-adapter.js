const path = require('path');

class LocalRuntimeAdapter {
  constructor(options) {
    this.options = options || {};
  }

  get mode() {
    return 'local';
  }

  _sleep(seconds) {
    try {
      this.options.execSync && this.options.execSync(`sleep ${seconds}`, { stdio: 'pipe' });
    } catch (_) {}
  }

  _sanitizeEnv(env) {
    const out = { ...(env || {}) };
    delete out.http_proxy;
    delete out.https_proxy;
    delete out.HTTP_PROXY;
    delete out.HTTPS_PROXY;
    delete out.ALL_PROXY;
    delete out.all_proxy;
    return out;
  }

  _isPortInUse(port) {
    return this.options.isPortInUse ? this.options.isPortInUse(port) : false;
  }

  _resolveWorkerById(workerId) {
    const rows = this.options.parseWorkersConf ? this.options.parseWorkersConf() : [];
    return rows.find((r) => String(r.workerId) === String(workerId)) || null;
  }

  startWorkerGateway(worker) {
    if (!worker || !worker.workerId) return { ok: false, error: 'worker missing' };
    const env = this._sanitizeEnv({ ...(this.options.getConfigEnv ? this.options.getConfigEnv() : process.env), RUN_GATEWAY_BACKGROUND: '1' });
    const child = this.options.spawn('bash', [this.options.startWorkerScript, String(worker.workerId)], {
      cwd: this.options.rootDir,
      env,
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
    return { ok: true };
  }

  ensureWorkerGateway(worker, opts = {}) {
    if (!worker || !worker.workerId) return { ok: false, error: 'worker missing' };
    const waitSeconds = Number.isFinite(opts.waitSeconds) ? opts.waitSeconds : 12;
    const restart = opts.restart === true;
    const port = parseInt(worker.port, 10);
    if (!Number.isFinite(port)) return { ok: false, error: 'invalid worker port' };

    if (restart) {
      this.stopGatewayByPort(port);
      this._sleep(1);
    }

    if (!this._isPortInUse(port)) {
      this.startWorkerGateway(worker);
      this._sleep(2);
      for (let i = 0; i < waitSeconds; i++) {
        if (this._isPortInUse(port)) break;
        this._sleep(1);
      }
    }

    return { ok: this._isPortInUse(port), port };
  }

  startMainGateway() {
    const env = this._sanitizeEnv(this.options.getConfigEnv ? this.options.getConfigEnv() : process.env);
    const yinDir = path.join(this.options.rootDir, 'yin');
    const cmd = `cd ${this.options.openclawDir} && OPENCLAW_STATE_DIR="${yinDir}" OPENCLAW_GATEWAY_PORT=${this.options.mainGatewayPort} nohup ${this.options.openclawNodeCmd} openclaw.mjs gateway </dev/null >> "${this.options.mainGatewayLog}" 2>&1 &`;
    const child = this.options.spawn('bash', ['-c', cmd], {
      stdio: 'ignore',
      detached: true,
      env,
    });
    child.unref();
    return { ok: true };
  }

  stopMainGateway() {
    return this.stopGatewayByPort(this.options.mainGatewayPort);
  }

  stopGatewayByPort(port) {
    const p = parseInt(port, 10);
    if (!Number.isFinite(p)) return { ok: false, error: 'invalid port' };
    this.options.spawnSync('bash', [this.options.stopWorkerScript, '--port', String(p)], {
      cwd: this.options.rootDir,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      stdio: 'pipe',
    });
    return { ok: true, port: p };
  }

  listAgents() {
    const rows = this.options.parseWorkersConf ? this.options.parseWorkersConf() : [];
    return [
      {
        id: 'main',
        role: 'coordinator',
        port: this.options.mainGatewayPort,
        status: this._isPortInUse(this.options.mainGatewayPort) ? 'running' : 'stopped',
      },
      ...rows.map((r) => ({
        id: String(r.workerId),
        role: 'worker',
        port: parseInt(r.port, 10),
        status: this._isPortInUse(parseInt(r.port, 10)) ? 'running' : 'stopped',
      })),
    ];
  }
}

class K8sRuntimeAdapter {
  get mode() {
    return 'k8s';
  }

  _notImplemented(method) {
    throw new Error(`not implemented: K8sRuntimeAdapter.${method}`);
  }

  startWorkerGateway() { return this._notImplemented('startWorkerGateway'); }
  ensureWorkerGateway() { return this._notImplemented('ensureWorkerGateway'); }
  startMainGateway() { return this._notImplemented('startMainGateway'); }
  stopMainGateway() { return this._notImplemented('stopMainGateway'); }
  stopGatewayByPort() { return this._notImplemented('stopGatewayByPort'); }
  listAgents() { return this._notImplemented('listAgents'); }
}

function createRuntimeAdapter(mode, options) {
  const m = String(mode || 'local').trim().toLowerCase();
  if (m === 'k8s') return new K8sRuntimeAdapter(options);
  return new LocalRuntimeAdapter(options);
}

module.exports = {
  LocalRuntimeAdapter,
  K8sRuntimeAdapter,
  createRuntimeAdapter,
};
