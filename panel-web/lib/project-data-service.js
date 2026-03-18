const fs = require('fs');
const path = require('path');

function createProjectDataService(options) {
  const {
    getChatHistoryPath,
    queuedWriteFile,
    chatHistoryRepo,
    getProjectMemoryPath,
    readProjectMemory,
    projectMemoryRepo,
    parseWorkersConf,
    hexRobots,
    normalizeAgentPayloadAliases,
    getWorkerByHex,
  } = options;

  async function readChatHistory(projectId, mode, tenantId = 'public') {
    if (chatHistoryRepo) {
      try {
        const messages = await chatHistoryRepo.readHistory(tenantId, projectId, mode);
        if (messages) return { messages };
      } catch (_) {}
    }
    const filePath = getChatHistoryPath(projectId, mode, tenantId);
    try {
      if (!fs.existsSync(filePath)) return { messages: [] };
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.messages) ? data.messages : []);
      return { messages: list };
    } catch (_) {
      return { messages: [] };
    }
  }

  async function writeChatHistory(projectId, mode, messages, tenantId = 'public') {
    if (chatHistoryRepo) {
      const stored = await chatHistoryRepo.overwriteHistory(tenantId, projectId, mode, messages);
      if (stored) return { ok: true, count: messages.length };
    }
    const filePath = getChatHistoryPath(projectId, mode, tenantId);
    await queuedWriteFile(filePath, JSON.stringify(messages, null, 2));
    return { ok: true, count: messages.length };
  }

  async function clearChatHistory(projectId, mode, tenantId = 'public') {
    if (chatHistoryRepo) {
      try {
        const cleared = await chatHistoryRepo.clearHistory(tenantId, projectId, mode);
        if (cleared) return { ok: true };
      } catch (_) {}
    }
    if (mode === 'all') {
      ['discuss', 'single', 'yin'].forEach((m) => {
        const p = getChatHistoryPath(projectId, m, tenantId);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
      return { ok: true };
    }
    const p = getChatHistoryPath(projectId, mode, tenantId);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return { ok: true };
  }

  async function appendProjectMemory(projectId, { type, content }, tenantId = 'public') {
    const mem = await readProjectMemory(projectId, tenantId);
    const date = new Date().toISOString().slice(0, 10);
    mem.entries.push({ date, type: type || '备注', content: String(content) });
    if (projectMemoryRepo) {
      const stored = await projectMemoryRepo.replace(projectId, tenantId, mem.entries);
      if (stored) return { ok: true, count: mem.entries.length };
    }
    fs.writeFileSync(getProjectMemoryPath(projectId, tenantId), JSON.stringify(mem, null, 2), 'utf8');
    return { ok: true, count: mem.entries.length };
  }

  async function replaceProjectMemory(projectId, entries, tenantId = 'public') {
    const mem = { projectId, entries };
    if (projectMemoryRepo) {
      const stored = await projectMemoryRepo.replace(projectId, tenantId, entries);
      if (stored) return { ok: true, count: entries.length };
    }
    fs.writeFileSync(getProjectMemoryPath(projectId, tenantId), JSON.stringify(mem, null, 2), 'utf8');
    return { ok: true, count: entries.length };
  }

  async function clearProjectMemory(projectId, tenantId = 'public') {
    if (projectMemoryRepo) {
      const cleared = await projectMemoryRepo.clear(projectId, tenantId);
      if (cleared) return { ok: true };
    }
    const p = getProjectMemoryPath(projectId, tenantId);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return { ok: true };
  }

  async function clearProjectState(projectId, tenantId = 'public') {
    await clearChatHistory(projectId, 'all', tenantId);
    await clearProjectMemory(projectId, tenantId);
    return { ok: true };
  }

  function listProjectFiles(projectId, tenantId = 'public') {
    const rows = String(tenantId || 'public') === 'public'
      ? parseWorkersConf()
      : hexRobots
        .map((hex) => getWorkerByHex(hex.id, tenantId))
        .filter(Boolean);
    const files = [];
    for (const row of rows) {
      const outputDir = path.join(row.stateDir, 'workspace', 'output', projectId);
      if (!fs.existsSync(outputDir)) continue;
      const hex = hexRobots.find((h) => String(h.workerId) === String(row.workerId) || String(h.id) === String(row.agentId || row.id));
      const hexName = hex ? hex.name : `worker${row.workerId}`;
      try {
        const walk = (dir, base = '') => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const rel = base ? `${base}/${entry.name}` : entry.name;
            if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
            else {
              const abs = path.join(dir, entry.name);
              const stat = fs.statSync(abs);
              files.push({
                hexId: hex?.id || row.workerId,
                agentId: hex?.id || row.workerId,
                hexName,
                agentName: hexName,
                name: entry.name,
                path: rel,
                absPath: abs,
                size: stat.size,
                mtime: stat.mtimeMs,
              });
            }
          }
        };
        walk(outputDir);
      } catch (_) {}
    }
    files.sort((a, b) => b.mtime - a.mtime);
    return { files };
  }

  function resolveProjectDownload(projectId, query, tenantId = 'public') {
    const normalizedQuery = normalizeAgentPayloadAliases(query || {});
    const hexId = normalizedQuery.hexId || normalizedQuery.agentId;
    const relPath = normalizedQuery.path;
    if (!hexId || !relPath) {
      return { error: { status: 400, message: '缺少 agentId(hexId) 或 path' } };
    }
    const safe = path.normalize(relPath).replace(/^(\.\.[/\\])+/, '');
    const worker = getWorkerByHex(hexId, tenantId);
    if (!worker) return { error: { status: 404, message: '未找到该员工' } };
    const baseDir = path.join(worker.stateDir, 'workspace', 'output', projectId);
    const absPath = path.join(baseDir, safe);
    if (!absPath.startsWith(baseDir)) return { error: { status: 403, message: '非法路径' } };
    if (!fs.existsSync(absPath)) return { error: { status: 404, message: '文件不存在' } };
    return { absPath, filename: path.basename(absPath) };
  }

  return {
    readChatHistory,
    writeChatHistory,
    clearChatHistory,
    appendProjectMemory,
    replaceProjectMemory,
    clearProjectMemory,
    clearProjectState,
    listProjectFiles,
    resolveProjectDownload,
  };
}

module.exports = {
  createProjectDataService,
};
