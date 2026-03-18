const express = require('express');
const { resolveTenantId } = require('../lib/tenant-scope');

function createTriggerRouter(options) {
  const { triggerService, tenantAccessControl } = options;
  const router = express.Router();
  const writeGuard = tenantAccessControl ? tenantAccessControl.requireTenantWrite((req) => resolveTenantId(req)) : [];

  router.post('/webhooks/:projectId/:triggerId', ...writeGuard, (req, res) => {
    try {
      const result = triggerService.triggerWebhook(req.params.projectId, req.params.triggerId, req.body || {}, resolveTenantId(req));
      if (result.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || '触发失败' });
    }
  });

  router.post('/projects/:projectId/workflows/:workflowId/trigger', ...writeGuard, (req, res) => {
    try {
      const result = triggerService.triggerWorkflow(req.params.projectId, req.params.workflowId, resolveTenantId(req));
      if (result.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || '触发失败' });
    }
  });

  router.post('/projects/:projectId/schedules/:scheduleId/trigger', ...writeGuard, (req, res) => {
    try {
      const result = triggerService.triggerSchedule(req.params.projectId, req.params.scheduleId, resolveTenantId(req));
      if (result.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || '触发失败' });
    }
  });

  return router;
}

module.exports = {
  createTriggerRouter,
};
