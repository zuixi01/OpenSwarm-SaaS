const express = require('express');

function createLegacyAdminRouter(options) {
  const { legacyAdminService } = options;
  const router = express.Router();

  router.get('/agents', (_req, res) => {
    try { return res.json(legacyAdminService.listAgents()); } catch (err) { return res.status(500).json({ error: err.message || '读取员工画像失败' }); }
  });
  router.get('/agents/:id', (req, res) => {
    try {
      const result = legacyAdminService.getAgent(req.params.id);
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) { return res.status(500).json({ error: err.message || '读取员工画像失败' }); }
  });
  router.put('/agents/:id', (req, res) => {
    try {
      const result = legacyAdminService.updateAgent(req.params.id, req.body || {});
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) { return res.status(500).json({ error: err.message || '更新员工画像失败' }); }
  });
  router.get('/agents/:id/supervisor', (req, res) => {
    try { return res.json(legacyAdminService.getAgentSupervisor(req.params.id)); } catch (err) { return res.status(500).json({ error: err.message || '查询失败' }); }
  });
  router.get('/agents/:id/subordinates', (req, res) => {
    try { return res.json(legacyAdminService.getAgentSubordinates(req.params.id)); } catch (err) { return res.status(500).json({ error: err.message || '查询失败' }); }
  });

  router.get('/revenue', (_req, res) => {
    try { return res.json(legacyAdminService.getRevenueSummary()); } catch (err) { return res.status(500).json({ error: err.message || '读取收益失败' }); }
  });
  router.post('/revenue/transactions', (req, res) => {
    try {
      const result = legacyAdminService.createRevenueTransaction(req.body || {});
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.status(result.status || 201).json(result.body);
    } catch (err) { return res.status(500).json({ error: err.message || '记录交易失败' }); }
  });
  router.get('/revenue/transactions', (req, res) => {
    try { return res.json(legacyAdminService.listRevenueTransactions(req.query.limit)); } catch (err) { return res.status(500).json({ error: err.message || '读取交易失败' }); }
  });
  router.get('/revenue/pool', (_req, res) => {
    try { return res.json(legacyAdminService.getRevenuePool()); } catch (err) { return res.status(500).json({ error: err.message || '读取升级池失败' }); }
  });
  router.post('/revenue/pool/upgrade', (req, res) => {
    try {
      const result = legacyAdminService.upgradeRevenuePool(req.body || {});
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) { return res.status(500).json({ error: err.message || '升级支出失败' }); }
  });

  router.get('/reports', (_req, res) => {
    try { return res.json(legacyAdminService.listReports()); } catch (err) { return res.status(500).json({ error: err.message || '读取汇报失败' }); }
  });
  router.post('/reports', (req, res) => {
    try {
      const result = legacyAdminService.createReport(req.body || {});
      return res.status(result.status || 201).json(result.body);
    } catch (err) { return res.status(500).json({ error: err.message || '生成汇报失败' }); }
  });
  router.get('/reports/latest', (_req, res) => {
    try {
      const result = legacyAdminService.getLatestReport();
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) { return res.status(500).json({ error: err.message || '读取汇报失败' }); }
  });
  router.post('/reports/generate', (req, res) => {
    try {
      const result = legacyAdminService.generateReport(req.body || {});
      return res.status(result.status || 201).json(result.body);
    } catch (err) { return res.status(500).json({ error: err.message || '生成汇报失败' }); }
  });

  router.get('/match-agents', (req, res) => {
    try { return res.json(legacyAdminService.matchAgents(req.query || {})); } catch (err) { return res.status(500).json({ error: err.message || '员工能力匹配失败' }); }
  });
  router.get('/decisions', (req, res) => {
    try { return res.json(legacyAdminService.listDecisions(req.query.limit)); } catch (err) { return res.status(500).json({ error: err.message || '读取决策日志失败' }); }
  });
  router.post('/decisions', (req, res) => {
    try {
      const result = legacyAdminService.createDecision(req.body || {});
      return res.status(result.status || 201).json(result.body);
    } catch (err) { return res.status(500).json({ error: err.message || '记录决策失败' }); }
  });
  router.post('/projects/:id/assign-tasks', (req, res) => {
    try {
      const result = legacyAdminService.assignProjectTasks(req.params.id, req.query || {});
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) { return res.status(500).json({ error: err.message || '任务分配失败' }); }
  });

  router.get('/health/agents', (_req, res) => {
    try { return res.json(legacyAdminService.listHealthAgents()); } catch (err) { return res.status(500).json({ error: err.message || '健康检查失败' }); }
  });
  router.get('/alerts/rules', (_req, res) => {
    try { return res.json(legacyAdminService.listAlertRules()); } catch (err) { return res.status(500).json({ error: err.message || '读取告警规则失败' }); }
  });
  router.post('/alerts/rules', (req, res) => {
    try {
      const result = legacyAdminService.createAlertRule(req.body || {});
      return res.status(result.status || 201).json(result.body);
    } catch (err) { return res.status(500).json({ error: err.message || '添加规则失败' }); }
  });
  router.get('/alerts/events', (req, res) => {
    try { return res.json(legacyAdminService.listAlertEvents(req.query.limit)); } catch (err) { return res.status(500).json({ error: err.message || '读取告警事件失败' }); }
  });
  router.post('/alerts/check', (_req, res) => {
    try { return res.json(legacyAdminService.checkAlerts()); } catch (err) { return res.status(500).json({ error: err.message || '告警检查失败' }); }
  });
  router.post('/self-heal/agents', async (_req, res) => {
    try { return res.json(await legacyAdminService.selfHealAgents()); } catch (err) { return res.status(500).json({ error: err.message || '自愈执行失败' }); }
  });
  router.get('/hierarchy', (_req, res) => {
    try { return res.json(legacyAdminService.getHierarchy()); } catch (err) { return res.status(500).json({ error: err.message || '读取分级失败' }); }
  });

  return router;
}

module.exports = {
  createLegacyAdminRouter,
};
