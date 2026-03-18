const express = require('express');
const { resolveTenantId } = require('../lib/tenant-scope');

function createProjectDataRouter(options) {
  const { projectDataService, readProjectMemory, tenantAccessControl } = options;
  const router = express.Router();
  const readGuard = tenantAccessControl ? tenantAccessControl.requireTenantRead((req) => resolveTenantId(req)) : [];
  const writeGuard = tenantAccessControl ? tenantAccessControl.requireTenantWrite((req) => resolveTenantId(req)) : [];

  router.get('/chat-history/:projectId/:mode', ...readGuard, async (req, res) => {
    const tenantId = resolveTenantId(req);
    const projectId = String(req.params.projectId || '').trim();
    let mode = req.params.mode;
    if (!projectId) return res.status(400).json({ error: 'projectId 不能为空' });
    if (mode === 'agent') mode = 'discuss';
    if (!['discuss', 'single', 'yin'].includes(mode)) return res.status(400).json({ error: '无效的 mode' });
    try {
      return res.json(await projectDataService.readChatHistory(projectId, mode, tenantId));
    } catch (e) {
      return res.status(500).json({ error: '读取失败: ' + e.message });
    }
  });

  router.post('/chat-history/:projectId/:mode', ...writeGuard, async (req, res) => {
    const tenantId = resolveTenantId(req);
    const projectId = String(req.params.projectId || '').trim();
    let mode = req.params.mode;
    if (!projectId) return res.status(400).json({ error: 'projectId 不能为空' });
    if (mode === 'agent') mode = 'discuss';
    if (!['discuss', 'single', 'yin'].includes(mode)) return res.status(400).json({ error: '无效的 mode' });
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages 必须是数组' });
    try {
      const result = await projectDataService.writeChatHistory(projectId, mode, messages, tenantId);
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: '写入失败: ' + e.message });
    }
  });

  router.delete('/chat-history/:projectId/:mode', ...writeGuard, async (req, res) => {
    try {
      const tenantId = resolveTenantId(req);
      const projectId = String(req.params.projectId || '').trim();
      let mode = req.params.mode;
      if (!projectId) return res.status(400).json({ error: 'projectId 不能为空' });
      if (mode === 'agent') mode = 'discuss';
      if (!['discuss', 'single', 'yin', 'all'].includes(mode)) return res.status(400).json({ error: '无效的 mode' });
      return res.json(await projectDataService.clearChatHistory(projectId, mode, tenantId));
    } catch (e) {
      return res.status(500).json({ error: '删除失败: ' + e.message });
    }
  });

  router.get('/project-memory/:id', ...readGuard, async (req, res) => {
    const tenantId = resolveTenantId(req);
    try {
      return res.json(await readProjectMemory(req.params.id, tenantId));
    } catch (e) {
      return res.status(500).json({ error: e.message || '读取项目记忆失败' });
    }
  });

  router.post('/project-memory/:id', ...writeGuard, async (req, res) => {
    const tenantId = resolveTenantId(req);
    const { type, content } = req.body || {};
    if (!content) return res.status(400).json({ error: 'content 必填' });
    try {
      return res.json(await projectDataService.appendProjectMemory(req.params.id, { type, content }, tenantId));
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  router.put('/project-memory/:id', ...writeGuard, async (req, res) => {
    const tenantId = resolveTenantId(req);
    const { entries } = req.body || {};
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries 必须是数组' });
    try {
      return res.json(await projectDataService.replaceProjectMemory(req.params.id, entries, tenantId));
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  router.delete('/project-memory/:id', ...writeGuard, async (req, res) => {
    try {
      const tenantId = resolveTenantId(req);
      return res.json(await projectDataService.clearProjectMemory(req.params.id, tenantId));
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  router.get('/project-files/:projectId', ...readGuard, (req, res) => {
    return res.json(projectDataService.listProjectFiles(req.params.projectId, resolveTenantId(req)));
  });

  router.get('/project-files/:projectId/download', ...readGuard, (req, res) => {
    const result = projectDataService.resolveProjectDownload(req.params.projectId, req.query || {}, resolveTenantId(req));
    if (result.error) return res.status(result.error.status).json({ error: result.error.message });
    return res.download(result.absPath, result.filename);
  });

  return router;
}

module.exports = {
  createProjectDataRouter,
};
