const express = require('express');
const { resolveTenantId } = require('../lib/tenant-scope');

function createAutonomyRouter(options) {
  const {
    normalizeAgentPayloadAliases,
    hexRobots,
    autonomyStore,
    createAutonomousTaskRun,
    dispatchAutonomousAgentStep,
    resumeAutonomousRun,
    parseMentionedHexIds,
    tenantAccessControl,
  } = options;

  const router = express.Router();
  const readGuard = tenantAccessControl ? tenantAccessControl.requireTenantRead((req) => resolveTenantId(req)) : [];
  const writeGuard = tenantAccessControl ? tenantAccessControl.requireTenantWrite((req) => resolveTenantId(req)) : [];

  router.post('/task-runs', ...writeGuard, async (req, res) => {
    try {
      const tenantId = resolveTenantId(req);
      const body = normalizeAgentPayloadAliases(req.body || {});
      const projectId = String(body.projectId || '').trim();
      const agentId = String(body.hexId || body.agentId || '').trim();
      const message = String(body.message || '').trim();
      if (!projectId) return res.status(400).json({ error: 'projectId 不能为空' });
      if (!agentId) return res.status(400).json({ error: 'agentId(hexId) 不能为空' });
      if (!message) return res.status(400).json({ error: 'message 不能为空' });
      if (!hexRobots.some((robot) => robot.id === agentId)) return res.status(400).json({ error: '无效的员工 ID' });

      const run = createAutonomousTaskRun({ tenantId, projectId, initialAgentId: agentId, message, createdBy: 'user' });
      await dispatchAutonomousAgentStep(run, agentId, message, { depth: 0, sessionKey: String(body.sessionKey || 'main') });
      return res.status(201).json({ ok: true, runId: run.id, taskRun: run });
    } catch (err) {
      return res.status(500).json({ error: err.message || '创建自治任务失败' });
    }
  });

  router.get('/task-runs/:runId', ...readGuard, async (req, res) => {
    const tenantId = resolveTenantId(req);
    if (typeof autonomyStore.hydrateFromRepo === 'function') await autonomyStore.hydrateFromRepo(tenantId);
    const run = autonomyStore.get(req.params.runId, tenantId);
    if (!run) return res.status(404).json({ error: 'run not found' });
    return res.json(run);
  });

  router.post('/task-runs/:runId/retry-step', ...writeGuard, async (req, res) => {
    try {
      const tenantId = resolveTenantId(req);
      if (typeof autonomyStore.hydrateFromRepo === 'function') await autonomyStore.hydrateFromRepo(tenantId);
      const run = autonomyStore.get(req.params.runId, tenantId);
      if (!run) return res.status(404).json({ error: 'run not found' });
      const stepIndex = parseInt(req.body?.stepIndex, 10);
      if (!Number.isInteger(stepIndex) || stepIndex < 0 || !Array.isArray(run.steps) || stepIndex >= run.steps.length) {
        return res.status(400).json({ error: '无效的 stepIndex' });
      }
      const step = run.steps[stepIndex];
      const retryMessage = String(step.message || run.message || '').trim();
      await resumeAutonomousRun(run, step.agentId, retryMessage, {
        eventType: 'manual_retry',
        fromAgentId: 'user',
        stepIndex,
        reason: '用户从时间线重试该步',
        sessionKey: 'main',
      });
      return res.json({ ok: true, runId: run.id, stepIndex, agentId: step.agentId });
    } catch (err) {
      return res.status(500).json({ error: err.message || '重试该步失败' });
    }
  });

  router.post('/task-runs/:runId/reassign-step', ...writeGuard, async (req, res) => {
    try {
      const tenantId = resolveTenantId(req);
      if (typeof autonomyStore.hydrateFromRepo === 'function') await autonomyStore.hydrateFromRepo(tenantId);
      const run = autonomyStore.get(req.params.runId, tenantId);
      if (!run) return res.status(404).json({ error: 'run not found' });
      const stepIndex = parseInt(req.body?.stepIndex, 10);
      const rawAgentId = String(req.body?.agentId || '').trim();
      const parsedAgentId = parseMentionedHexIds('@' + rawAgentId)[0] || rawAgentId;
      const agentId = String(parsedAgentId || '').trim();
      if (!Number.isInteger(stepIndex) || stepIndex < 0 || !Array.isArray(run.steps) || stepIndex >= run.steps.length) {
        return res.status(400).json({ error: '无效的 stepIndex' });
      }
      if (!agentId) return res.status(400).json({ error: 'agentId 不能为空' });
      const step = run.steps[stepIndex];
      const reassignMessage = String(step.message || run.message || '').trim();
      await resumeAutonomousRun(run, agentId, reassignMessage, {
        eventType: 'manual_reassign',
        fromAgentId: step.agentId || 'user',
        stepIndex,
        reason: '用户从时间线改派该步',
        sessionKey: 'main',
      });
      return res.json({ ok: true, runId: run.id, stepIndex, agentId });
    } catch (err) {
      return res.status(500).json({ error: err.message || '改派该步失败' });
    }
  });

  router.get('/task-runs', ...readGuard, async (req, res) => {
    const tenantId = resolveTenantId(req);
    const projectId = String(req.query.projectId || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    if (typeof autonomyStore.hydrateFromRepo === 'function') await autonomyStore.hydrateFromRepo(tenantId, Math.max(limit, 200));
    let runs = autonomyStore.values(tenantId);
    if (projectId) runs = runs.filter((run) => String(run.projectId || '') === projectId);
    runs.sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
    return res.json({ runs: runs.slice(0, limit) });
  });

  router.delete('/task-runs', ...writeGuard, (req, res) => {
    try {
      const tenantId = resolveTenantId(req);
      const projectId = String(req.query.projectId || req.body?.projectId || '').trim();
      if (!projectId) return res.status(400).json({ error: 'projectId 不能为空' });
      const removed = autonomyStore.clearProject(projectId, tenantId);
      return res.json({ ok: true, projectId, removed });
    } catch (err) {
      return res.status(500).json({ error: err.message || '清除自治任务失败' });
    }
  });

  return router;
}

module.exports = {
  createAutonomyRouter,
};
