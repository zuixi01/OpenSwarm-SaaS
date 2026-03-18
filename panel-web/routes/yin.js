const express = require('express');
const { resolveTenantId } = require('../lib/tenant-scope');

function createYinRouter(options) {
  const {
    getStatus,
    getGatewayStatus,
    getGatewayHealth,
    yinService,
    tenantAccessControl,
  } = options;

  const router = express.Router();
  const readGuard = tenantAccessControl ? tenantAccessControl.requireTenantRead((req) => resolveTenantId(req)) : [];
  const writeGuard = tenantAccessControl ? tenantAccessControl.requireTenantWrite((req) => resolveTenantId(req)) : [];

  router.get('/status', ...readGuard, (_req, res) => {
    res.json(getStatus());
  });

  router.get('/gateway/status', ...readGuard, (_req, res) => {
    res.json(getGatewayStatus());
  });

  router.get('/gateway/health', ...readGuard, async (_req, res) => {
    try {
      const out = await getGatewayHealth();
      res.status(out.ok ? 200 : 503).json(out);
    } catch (err) {
      res.status(503).json({ ok: false, error: err.message || 'gateway health failed' });
    }
  });

  router.get('/task/:taskId', ...readGuard, (req, res) => {
    const task = yinService.getTask(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'task not found' });
    return res.json(task);
  });

  router.post('/chat', ...writeGuard, async (req, res) => {
    const { message, projectId, history } = req.body || {};
    const result = await yinService.createChatTask({ message, projectId, history, tenantId: resolveTenantId(req) });
    if (!result.taskId) return res.json({ taskId: null, reply: '', error: null });
    return res.json({ taskId: result.taskId });
  });

  return router;
}

module.exports = {
  createYinRouter,
};
