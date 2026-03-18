const { isDbConfigured, query: dbQuery } = require('./db');
const chatRepo = require('./chat-repo');

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function normalizeMode(raw) {
  const mode = String(raw || 'discuss').trim();
  if (mode === 'agent') return 'discuss';
  return ['discuss', 'single', 'yin'].includes(mode) ? mode : 'discuss';
}

function mapStoredMessage(row) {
  if (!row) return null;
  const role = String(row.role || '').trim();
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  if (role === 'user') {
    return {
      type: 'user',
      role: 'user',
      message: row.content || '',
      text: row.content || '',
      ts: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
      metadata,
    };
  }
  if (role === 'assistant') {
    return {
      type: metadata.type || 'hex',
      role: 'assistant',
      name: metadata.name || metadata.agentName || metadata.runtimeAgentId || null,
      message: row.content || '',
      text: row.content || '',
      isError: !!metadata.isError,
      ts: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
      metadata,
    };
  }
  return {
    type: metadata.type || 'system',
    role,
    message: row.content || '',
    text: row.content || '',
    ts: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
    metadata,
  };
}

function createChatHistoryRepo() {
  async function ensureSession(tenantId, projectId, mode) {
    const items = await chatRepo.listSessionsByProject(tenantId, projectId, { limit: 20 });
    const targetMode = normalizeMode(mode);
    const found = items.find((item) => String(item.mode || '') === targetMode);
    if (found) return found;
    return chatRepo.createSession({ tenantId, projectId, mode: targetMode });
  }

  async function findSession(tenantId, projectId, mode) {
    const items = await chatRepo.listSessionsByProject(tenantId, projectId, { limit: 20 });
    const targetMode = normalizeMode(mode);
    return items.find((item) => String(item.mode || '') === targetMode) || null;
  }

  async function readHistory(tenantId, projectId, mode) {
    if (!isDbConfigured()) return null;
    if (!isUuidLike(tenantId) || !isUuidLike(projectId)) return null;
    const session = await findSession(tenantId, projectId, mode);
    if (!session) return null;
    const items = await chatRepo.listMessagesBySession(tenantId, session.id, { limit: 1000 });
    return items.map(mapStoredMessage);
  }

  async function overwriteHistory(tenantId, projectId, mode, messages) {
    if (!isDbConfigured()) return null;
    if (!isUuidLike(tenantId) || !isUuidLike(projectId)) return null;
    const session = await ensureSession(tenantId, projectId, mode);
    await dbQuery('delete from chat_messages where tenant_id = $1 and session_id = $2', [tenantId, session.id]);
    for (const message of Array.isArray(messages) ? messages : []) {
      const type = String(message.type || '').trim();
      const isUser = type === 'user' || message.role === 'user';
      await chatRepo.appendMessage({
        tenantId,
        projectId,
        sessionId: session.id,
        role: isUser ? 'user' : 'assistant',
        runtimeAgentId: message.agentId || message.hexId || null,
        content: String(message.message || message.text || '').trim(),
        metadata: {
          type: type || (isUser ? 'user' : 'hex'),
          name: message.name || null,
          isError: !!message.isError,
        },
      });
    }
    return { ok: true, count: Array.isArray(messages) ? messages.length : 0, sessionId: session.id };
  }

  async function appendBatch(tenantId, projectId, mode, entries) {
    if (!isDbConfigured()) return null;
    if (!isUuidLike(tenantId) || !isUuidLike(projectId)) return null;
    const session = await ensureSession(tenantId, projectId, mode);
    for (const entry of entries || []) {
      const role = String(entry.role || '').trim() || 'assistant';
      await chatRepo.appendMessage({
        tenantId,
        projectId,
        sessionId: session.id,
        role,
        runtimeAgentId: entry.runtimeAgentId || null,
        content: String(entry.content || '').trim(),
        metadata: entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {},
      });
    }
    return { ok: true, count: Array.isArray(entries) ? entries.length : 0, sessionId: session.id };
  }

  async function clearHistory(tenantId, projectId, mode) {
    if (!isDbConfigured()) return null;
    if (!isUuidLike(tenantId) || !isUuidLike(projectId)) return null;
    if (mode === 'all') {
      const sessions = await chatRepo.listSessionsByProject(tenantId, projectId, { limit: 100 });
      if (!sessions.length) return null;
      for (const session of sessions) {
        await dbQuery('delete from chat_messages where tenant_id = $1 and session_id = $2', [tenantId, session.id]);
      }
      return { ok: true };
    }
    const session = await findSession(tenantId, projectId, mode);
    if (!session) return null;
    await dbQuery('delete from chat_messages where tenant_id = $1 and session_id = $2', [tenantId, session.id]);
    return { ok: true };
  }

  return {
    readHistory,
    overwriteHistory,
    appendBatch,
    clearHistory,
  };
}

module.exports = {
  createChatHistoryRepo,
};
