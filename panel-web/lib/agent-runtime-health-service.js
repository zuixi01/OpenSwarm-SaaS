const fs = require('fs');
const path = require('path');

function normalizeTenantId(tenantId) {
  return String(tenantId || 'public').trim() || 'public';
}

function normalizeAgentId(agentId) {
  return String(agentId || '').trim();
}

function createAgentRuntimeHealthService(options = {}) {
  const file = options.file || path.join(process.cwd(), 'panel-web', 'data', 'agent-runtime-health.json');
  const cache = new Map();

  function load() {
    try {
      if (!fs.existsSync(file)) return;
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!raw || typeof raw !== 'object') return;
      Object.entries(raw).forEach(([tenantId, tenantEntries]) => {
        const tenantMap = new Map();
        if (tenantEntries && typeof tenantEntries === 'object') {
          Object.entries(tenantEntries).forEach(([agentId, value]) => {
            if (value && typeof value === 'object') tenantMap.set(agentId, value);
          });
        }
        cache.set(tenantId, tenantMap);
      });
    } catch (error) {
      console.warn('[agent-runtime-health] load failed:', error.message);
    }
  }

  function save() {
    try {
      const data = {};
      for (const [tenantId, tenantEntries] of cache.entries()) {
        data[tenantId] = {};
        for (const [agentId, value] of tenantEntries.entries()) {
          data[tenantId][agentId] = value;
        }
      }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.warn('[agent-runtime-health] save failed:', error.message);
    }
  }

  function getTenantMap(tenantId, create = false) {
    const normalized = normalizeTenantId(tenantId);
    let tenantMap = cache.get(normalized);
    if (!tenantMap && create) {
      tenantMap = new Map();
      cache.set(normalized, tenantMap);
    }
    return tenantMap || null;
  }

  function getAgentState(tenantId, agentId) {
    const normalizedAgentId = normalizeAgentId(agentId);
    if (!normalizedAgentId) return null;
    const tenantMap = getTenantMap(tenantId, false);
    return tenantMap ? (tenantMap.get(normalizedAgentId) || null) : null;
  }

  function setAgentState(tenantId, agentId, patch = {}) {
    const normalizedAgentId = normalizeAgentId(agentId);
    if (!normalizedAgentId) return null;
    const tenantMap = getTenantMap(tenantId, true);
    const previous = tenantMap.get(normalizedAgentId) || {
      tenantId: normalizeTenantId(tenantId),
      agentId: normalizedAgentId,
      status: 'healthy',
      consecutiveFailures: 0,
      totalFailures: 0,
      autoRestartCount: 0,
      lastError: null,
      lastErrorCode: null,
      lastErrorAt: null,
      lastSuccessAt: null,
      lastSuccessCode: null,
      lastRecoveryAt: null,
      updatedAt: null,
    };
    const next = {
      ...previous,
      ...(patch && typeof patch === 'object' ? patch : {}),
      tenantId: normalizeTenantId(tenantId),
      agentId: normalizedAgentId,
      updatedAt: new Date().toISOString(),
    };
    tenantMap.set(normalizedAgentId, next);
    save();
    return next;
  }

  function markSuccess(tenantId, agentId, meta = {}) {
    const successCode = String(meta.code || '').trim() || null;
    return setAgentState(tenantId, agentId, {
      status: 'healthy',
      consecutiveFailures: 0,
      lastError: null,
      lastErrorCode: null,
      lastSuccessAt: new Date().toISOString(),
      lastSuccessCode: successCode,
      lastLatencyMs: Number.isFinite(Number(meta.latencyMs)) ? Number(meta.latencyMs) : null,
    });
  }

  function markFailure(tenantId, agentId, error, meta = {}) {
    const previous = getAgentState(tenantId, agentId) || { consecutiveFailures: 0, totalFailures: 0, autoRestartCount: 0 };
    const code = String(meta.code || '').trim() || null;
    const errorText = String(error || '').trim() || 'unknown error';
    const status = meta.status || (code === 'ECONNREFUSED' ? 'offline' : 'degraded');
    return setAgentState(tenantId, agentId, {
      status,
      consecutiveFailures: Number(previous.consecutiveFailures || 0) + 1,
      totalFailures: Number(previous.totalFailures || 0) + 1,
      lastError: errorText,
      lastErrorCode: code,
      lastErrorAt: new Date().toISOString(),
      lastLatencyMs: Number.isFinite(Number(meta.latencyMs)) ? Number(meta.latencyMs) : null,
    });
  }

  function markAutoRestart(tenantId, agentId) {
    const previous = getAgentState(tenantId, agentId) || { autoRestartCount: 0 };
    return setAgentState(tenantId, agentId, {
      status: 'recovering',
      autoRestartCount: Number(previous.autoRestartCount || 0) + 1,
      lastRecoveryAt: new Date().toISOString(),
    });
  }

  load();

  return {
    getAgentState,
    setAgentState,
    markSuccess,
    markFailure,
    markAutoRestart,
  };
}

module.exports = {
  createAgentRuntimeHealthService,
};
