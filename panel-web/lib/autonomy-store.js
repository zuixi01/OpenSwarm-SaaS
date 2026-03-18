const fs = require('fs');
const { isDbConfigured } = require('./db');

class AutonomousRunStore {
  constructor(options = {}) {
    this.file = options.file;
    this.resolveFile = options.resolveFile;
    this.repo = options.repo || null;
    this.runs = new Map();
    this.loadedTenants = new Set();
  }

  getFile(tenantId = 'public') {
    return this.resolveFile ? this.resolveFile(tenantId) : this.file;
  }

  ensureTenantLoaded(tenantId = 'public') {
    const key = String(tenantId || 'public');
    if (this.loadedTenants.has(key)) return;
    this.load(key);
  }

  load(tenantId = 'public') {
    if (this.repo && isDbConfigured()) {
      this.loadedTenants.add(String(tenantId || 'public'));
      return;
    }
    try {
      const file = this.getFile(tenantId);
      if (!file || !fs.existsSync(file)) {
        this.loadedTenants.add(String(tenantId || 'public'));
        return;
      }
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      Object.entries(raw || {}).forEach(([id, run]) => {
        this.runs.set(id, run);
      });
      this.loadedTenants.add(String(tenantId || 'public'));
    } catch (e) {
      console.warn('[autonomy] 加载任务运行失败:', e.message);
    }
  }

  async hydrateFromRepo(tenantId = 'public', limit = 1000) {
    if (!this.repo || typeof this.repo.listByTenant !== 'function') return null;
    try {
      const runs = await this.repo.listByTenant(tenantId, { limit });
      if (!Array.isArray(runs) || !runs.length) return [];
      this.replaceTenantRuns(tenantId, runs);
      return runs;
    } catch (_) {
      return null;
    }
  }

  replaceTenantRuns(tenantId = 'public', runs = []) {
    const key = String(tenantId || 'public');
    for (const [id, run] of this.runs.entries()) {
      if (String(run?.tenantId || 'public') === key) this.runs.delete(id);
    }
    for (const run of Array.isArray(runs) ? runs : []) {
      if (!run || !run.id) continue;
      this.runs.set(run.id, { ...run, tenantId: key });
    }
    this.loadedTenants.add(key);
  }

  save(tenantId = 'public') {
    try {
      const obj = {};
      for (const [id, run] of this.runs.entries()) {
        if (String(run.tenantId || 'public') === String(tenantId || 'public')) {
          obj[id] = run;
          if (this.repo) this.repo.upsert(run).catch(() => {});
        }
      }
      if (!(this.repo && isDbConfigured())) {
        const file = this.getFile(tenantId);
        fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
      }
    } catch (e) {
      console.warn('[autonomy] 保存任务运行失败:', e.message);
    }
  }

  get(id, tenantId = 'public') {
    this.ensureTenantLoaded(tenantId);
    const run = this.runs.get(id) || null;
    if (!run) return null;
    if (String(run.tenantId || 'public') !== String(tenantId || 'public')) return null;
    return run;
  }

  set(run) {
    if (!run || !run.id) return run;
    if (!run.tenantId) run.tenantId = 'public';
    this.runs.set(run.id, run);
    this.save(run.tenantId);
    return run;
  }

  mark(run, patch = {}) {
    Object.assign(run, patch, { updatedAt: Date.now() });
    return this.set(run);
  }

  values(tenantId = 'public') {
    this.ensureTenantLoaded(tenantId);
    return Array.from(this.runs.values()).filter((run) => String(run.tenantId || 'public') === String(tenantId || 'public'));
  }

  clearProject(projectId, tenantId = 'public') {
    this.ensureTenantLoaded(tenantId);
    if (!projectId) return 0;
    var removed = 0;
    for (const [id, run] of this.runs.entries()) {
      if (String(run.projectId || '') === String(projectId) && String(run.tenantId || 'public') === String(tenantId || 'public')) {
        this.runs.delete(id);
        removed += 1;
      }
    }
    if (removed) this.save(tenantId);
    if (removed && this.repo) this.repo.clearProject(projectId, tenantId).catch(() => {});
    return removed;
  }

  getActiveForProject(projectId, tenantId = 'public') {
    this.ensureTenantLoaded(tenantId);
    if (!projectId) return null;
    const runs = this.values(tenantId)
      .filter((run) => String(run.projectId || '') === String(projectId) && ['running', 'needs_yin'].includes(run.status))
      .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
    return runs[0] || null;
  }
}

module.exports = {
  AutonomousRunStore,
};
