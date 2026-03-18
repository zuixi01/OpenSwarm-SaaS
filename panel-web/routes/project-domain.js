const express = require('express');
const { resolveTenantId } = require('../lib/tenant-scope');

function createProjectDomainRouter(options) {
  const { projectDomainService, tenantAccessControl } = options;
  const router = express.Router();
  const readGuard = tenantAccessControl ? tenantAccessControl.requireTenantRead((req) => resolveTenantId(req)) : [];
  const writeGuard = tenantAccessControl ? tenantAccessControl.requireTenantWrite((req) => resolveTenantId(req)) : [];

  router.get('/skills', (_req, res) => {
    try {
      return res.json(projectDomainService.listSkills());
    } catch (err) {
      return res.status(500).json({ error: err.message || '读取技能库失败' });
    }
  });

  router.put('/skills', (req, res) => {
    try {
      const skills = req.body?.skills;
      if (!Array.isArray(skills)) return res.status(400).json({ error: 'skills 必须为数组' });
      return res.json(projectDomainService.saveSkills(skills));
    } catch (err) {
      return res.status(500).json({ error: err.message || '保存技能库失败' });
    }
  });

  router.get('/skills/templates', (_req, res) => res.json(projectDomainService.listSkillTemplates()));
  router.get('/project-templates', (_req, res) => res.json(projectDomainService.listProjectTemplates()));

  router.post('/projects/:id/yang-configure', ...writeGuard, async (req, res) => {
    try {
      const tenantId = resolveTenantId(req);
      const result = await projectDomainService.autoConfigureProject(req.params.id, req.body || {}, tenantId);
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      console.error('[yang-configure]', err);
      return res.status(500).json({ error: err.message || '策略配置失败' });
    }
  });

  router.get('/projects', ...readGuard, (req, res) => {
    try {
      return res.json(projectDomainService.listProjects(resolveTenantId(req)));
    } catch (err) {
      return res.status(500).json({ error: err.message || '读取项目列表失败' });
    }
  });

  router.post('/projects', ...writeGuard, (req, res) => {
    try {
      const result = projectDomainService.createProject(req.body || {}, resolveTenantId(req));
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.status(result.status || 201).json(result.body);
    } catch (err) {
      return res.status(500).json({ error: err.message || '创建项目失败' });
    }
  });

  router.get('/projects/:id', ...readGuard, (req, res) => {
    try {
      const result = projectDomainService.getProject(req.params.id, resolveTenantId(req));
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || '读取项目失败' });
    }
  });

  router.get('/projects/:id/yin-status', ...readGuard, (req, res) => {
    try {
      const result = projectDomainService.getProjectYinStatus(req.params.id, resolveTenantId(req));
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || '读取 yin-status 失败' });
    }
  });

  router.put('/projects/:id', ...writeGuard, (req, res) => {
    try {
      const result = projectDomainService.updateProject(req.params.id, req.body || {}, resolveTenantId(req));
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || '更新项目失败' });
    }
  });

  router.delete('/projects/:id', ...writeGuard, (req, res) => {
    try {
      const result = projectDomainService.deleteProject(req.params.id, resolveTenantId(req));
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || '删除项目失败' });
    }
  });

  router.get('/billing/plans', (_req, res) => {
    try {
      return res.json(projectDomainService.listBillingPlans());
    } catch (err) {
      return res.status(500).json({ error: err.message || '读取套餐失败' });
    }
  });

  router.put('/billing/plans', (req, res) => {
    try {
      const plans = req.body?.plans;
      if (!Array.isArray(plans)) return res.status(400).json({ error: 'plans 必须为数组' });
      return res.json(projectDomainService.saveBillingPlans(plans));
    } catch (err) {
      return res.status(500).json({ error: err.message || '保存套餐失败' });
    }
  });

  router.get('/billing/projects/:id/summary', ...readGuard, (req, res) => {
    try {
      const result = projectDomainService.getBillingSummary(req.params.id, resolveTenantId(req));
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || '读取账单失败' });
    }
  });

  router.get('/billing/projects/:id/events', ...readGuard, (req, res) => {
    try {
      const result = projectDomainService.getBillingEvents(req.params.id, req.query.limit, resolveTenantId(req));
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || '读取账单事件失败' });
    }
  });

  router.put('/billing/projects/:id', ...writeGuard, (req, res) => {
    try {
      const result = projectDomainService.updateProjectBilling(req.params.id, req.body || {}, resolveTenantId(req));
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || '更新账单配置失败' });
    }
  });

  router.post('/billing/projects/:id/topup', ...writeGuard, (req, res) => {
    try {
      const result = projectDomainService.topupProjectBilling(req.params.id, req.body || {}, resolveTenantId(req));
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || '充值失败' });
    }
  });

  router.post('/projects/:id/tasks', ...writeGuard, (req, res) => {
    try {
      const result = projectDomainService.createProjectTask(req.params.id, req.body || {}, resolveTenantId(req));
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.status(result.status || 201).json(result.body);
    } catch (err) {
      return res.status(500).json({ error: err.message || '添加任务失败' });
    }
  });

  router.put('/projects/:id/tasks/:taskId', ...writeGuard, (req, res) => {
    try {
      const result = projectDomainService.updateProjectTask(req.params.id, req.params.taskId, req.body || {}, resolveTenantId(req));
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || '更新任务失败' });
    }
  });

  return router;
}

module.exports = {
  createProjectDomainRouter,
};
