const express = require('express');
const { resolveTenantId } = require('../lib/tenant-scope');

function createAgentRouter(options) {
  const { discussService, appendAgentChatHistory, agentTaskService, triggerNextWorkflowStep, tenantAccessControl } = options;
  const router = express.Router();
  const readGuard = tenantAccessControl ? tenantAccessControl.requireTenantRead((req) => resolveTenantId(req)) : [];
  const writeGuard = tenantAccessControl ? tenantAccessControl.requireTenantWrite((req) => resolveTenantId(req)) : [];

  router.get('/task/:taskId', ...readGuard, (req, res) => {
    const task = discussService.getTask(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'task not found' });
    return res.json(task);
  });

  router.post('/chat', ...writeGuard, (req, res) => {
    const tenantId = resolveTenantId(req);
    const { taskId } = discussService.createTask();
    res.json({ taskId });
    void discussService.executeChatTask(taskId, req.body || {}, {
      tenantId,
      appendHistory: function(projectId, mode, userMessage, results) {
        return appendAgentChatHistory(projectId, mode, userMessage, results, tenantId);
      },
    });
  });

  router.post('/agent-task', ...writeGuard, (req, res) => {
    const body = {
      ...(req.body || {}),
      tenantId: resolveTenantId(req),
      onWorkflowStepDone: triggerNextWorkflowStep,
    };
    const result = agentTaskService.submitTask(body);
    return res.json(result);
  });

  router.get('/agent-task/:taskId', ...readGuard, (req, res) => {
    const task = agentTaskService.getTask(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'task not found' });
    return res.json({ ...task, agentTaskId: req.params.taskId });
  });

  return router;
}

module.exports = {
  createAgentRouter,
};
