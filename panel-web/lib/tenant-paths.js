const fs = require('fs');
const path = require('path');

function sanitizeId(value, fallback = 'public') {
  const raw = String(value || '').trim();
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  return safe || fallback;
}

function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (_) {}
  return dirPath;
}

function createTenantPaths(options = {}) {
  const dataDir = options.dataDir;
  if (!dataDir) throw new Error('dataDir is required');

  function tenantDir(tenantId) {
    return ensureDir(path.join(dataDir, 'tenants', sanitizeId(tenantId)));
  }

  function tenantChatDir(tenantId) {
    return ensureDir(path.join(tenantDir(tenantId), 'chat'));
  }

  function tenantMemoryDir(tenantId) {
    return ensureDir(path.join(tenantDir(tenantId), 'memory'));
  }

  function chatHistoryPath(tenantId, projectId, mode) {
    const safeProjectId = sanitizeId(projectId, 'default');
    return path.join(tenantChatDir(tenantId), `chat_${mode}_${safeProjectId}.json`);
  }

  function projectMemoryPath(tenantId, projectId) {
    const safeProjectId = sanitizeId(projectId, 'default');
    return path.join(tenantMemoryDir(tenantId), `project_memory_${safeProjectId}.json`);
  }

  function projectsFile(tenantId) {
    return path.join(tenantDir(tenantId), 'projects.json');
  }

  function autonomyRunsFile(tenantId) {
    return path.join(tenantDir(tenantId), 'autonomous-task-runs.json');
  }

  function hexDefinitionFile(tenantId) {
    return path.join(tenantDir(tenantId), 'hex-definition.json');
  }

  function billingEventsFile(tenantId) {
    return path.join(tenantDir(tenantId), 'billing-events.json');
  }

  function tenantMembersFile(tenantId) {
    return path.join(tenantDir(tenantId), 'tenant-members.json');
  }

  function tenantAuditLogFile(tenantId) {
    return path.join(tenantDir(tenantId), 'audit-log.json');
  }

  return {
    sanitizeId,
    ensureDir,
    tenantDir,
    tenantChatDir,
    tenantMemoryDir,
    chatHistoryPath,
    projectMemoryPath,
    projectsFile,
    autonomyRunsFile,
    hexDefinitionFile,
    billingEventsFile,
    tenantMembersFile,
    tenantAuditLogFile,
  };
}

module.exports = {
  createTenantPaths,
  sanitizeId,
  ensureDir,
};
