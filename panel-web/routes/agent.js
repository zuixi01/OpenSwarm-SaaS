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

  router.get('/task/:taskId/stream', ...readGuard, (req, res) => {
    const taskId = String(req.params.taskId || '');
    const task = discussService.getTask(taskId);
    if (!task) return res.status(404).json({ error: 'task not found' });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    function send(eventName, payload) {
      try {
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${JSON.stringify(payload || {})}\n\n`);
      } catch (_) {}
    }

    send('snapshot', { taskId, task });
    const unsubscribe = typeof discussService.subscribeTask === 'function'
      ? discussService.subscribeTask(taskId, function(payload) {
          send(payload.event || 'message', payload);
          if (payload.event === 'done' || payload.event === 'failed') {
            clearInterval(heartbeat);
            unsubscribe();
            try { res.end(); } catch (_) {}
          }
        })
      : function noop() {};

    const heartbeat = setInterval(function() {
      try { res.write(': keepalive\n\n'); } catch (_) {}
    }, 15000);

    req.on('close', function() {
      clearInterval(heartbeat);
      unsubscribe();
    });
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
