const fs = require('fs');

function createChatHistoryService(options) {
  const { getChatHistoryPath, queuedWriteFile, chatHistoryRepo } = options;

  async function appendAgentChatHistory(projectId, mode, userMessage, results, tenantId = 'public') {
    if (!projectId || !userMessage) return;
    if (chatHistoryRepo) {
      const batch = [{ role: 'user', content: String(userMessage), metadata: { type: 'user' } }];
      for (const r of results || []) {
        if (r.reply) {
          batch.push({
            role: 'assistant',
            runtimeAgentId: r.hexId || r.agentId || null,
            content: String(r.reply),
            metadata: { type: 'hex', name: r.name || null, isError: false },
          });
        } else if (r.error) {
          batch.push({
            role: 'assistant',
            runtimeAgentId: r.hexId || r.agentId || null,
            content: String(r.error),
            metadata: { type: 'hex', name: r.name || null, isError: true },
          });
        }
      }
      const stored = await chatHistoryRepo.appendBatch(tenantId, projectId, mode, batch);
      if (stored) return;
    }
    const histPath = getChatHistoryPath(projectId, mode, tenantId);
    let stored = [];
    try {
      stored = JSON.parse(fs.readFileSync(histPath, 'utf8'));
    } catch (_) {
      stored = [];
    }
    if (!Array.isArray(stored)) stored = [];
    stored.push({ type: 'user', message: userMessage, ts: Date.now() });
    for (const r of results || []) {
      if (r.reply) stored.push({ type: 'hex', name: r.name, message: r.reply, ts: Date.now() });
      else if (r.error) stored.push({ type: 'hex', name: r.name, message: r.error, isError: true, ts: Date.now() });
    }
    await queuedWriteFile(histPath, JSON.stringify(stored, null, 2));
  }

  async function appendAgentTaskHistory(projectId, message, reply, hex, tenantId = 'public') {
    if (!projectId || !message || !reply || !hex) return;
    if (chatHistoryRepo) {
      const stored = await chatHistoryRepo.appendBatch(tenantId, projectId, 'single', [
        { role: 'user', content: `[任务] ${message}`, metadata: { type: 'user' } },
        { role: 'assistant', runtimeAgentId: hex.id || null, content: String(reply), metadata: { type: 'hex', name: hex.name || null } },
      ]);
      if (stored) return;
    }
    const histPath = getChatHistoryPath(projectId, 'single', tenantId);
    let stored = [];
    try {
      stored = JSON.parse(fs.readFileSync(histPath, 'utf8'));
    } catch (_) {
      stored = [];
    }
    if (!Array.isArray(stored)) stored = [];
    stored.push({ type: 'user', message: `[任务] ${message}`, ts: Date.now() });
    stored.push({ type: 'hex', name: hex.name, message: reply, ts: Date.now() });
    await queuedWriteFile(histPath, JSON.stringify(stored, null, 2));
  }

  return {
    appendAgentChatHistory,
    appendAgentTaskHistory,
  };
}

module.exports = {
  createChatHistoryService,
};
