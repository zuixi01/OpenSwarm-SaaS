const express = require('express');

function createDevtoolsRouter(options) {
  const { devtoolsService } = options;
  const router = express.Router();

  router.post('/cursor/install', (req, res) => {
    try {
      const result = devtoolsService.cursorInstall(req.body || {});
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) { return res.status(500).json({ error: err.message || '安装执行失败' }); }
  });
  router.post('/cursor/code', (req, res) => {
    try {
      const result = devtoolsService.cursorCode(req.body || {});
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) { return res.status(500).json({ error: err.message || '写入代码失败' }); }
  });
  router.get('/cursor/configure', (req, res) => {
    try { return res.json(devtoolsService.getCursorConfigure(req.query.hexId)); } catch (err) { return res.status(500).json({ error: err.message || '读取配置失败' }); }
  });
  router.post('/cursor/configure', (req, res) => {
    try {
      const result = devtoolsService.setCursorConfigure(req.body || {});
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) { return res.status(500).json({ error: err.message || '写入配置失败' }); }
  });

  router.post('/github/pull', (req, res) => {
    try {
      const result = devtoolsService.githubPull(req.body || {});
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) { return res.status(500).json({ error: err.message || 'git pull 失败' }); }
  });
  router.post('/github/sync', (req, res) => {
    try {
      const result = devtoolsService.githubSync(req.body || {});
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) { return res.status(500).json({ error: err.message || 'git sync 失败' }); }
  });
  router.post('/github/commit', (req, res) => {
    try {
      const result = devtoolsService.githubCommit(req.body || {});
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) { return res.status(500).json({ error: err.message || 'git commit 失败' }); }
  });

  router.get('/platforms', (_req, res) => {
    try { return res.json(devtoolsService.listPlatformsSummary()); } catch (err) { return res.status(500).json({ error: err.message || '读取平台列表失败' }); }
  });
  router.post('/platforms/connect', (req, res) => {
    try {
      const result = devtoolsService.connectPlatform(req.body || {});
      return res.status(result.status || 201).json(result.body);
    } catch (err) { return res.status(500).json({ error: err.message || '连接平台失败' }); }
  });
  router.delete('/platforms/:id', (req, res) => {
    try {
      const result = devtoolsService.deletePlatform(req.params.id);
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) { return res.status(500).json({ error: err.message || '断开平台失败' }); }
  });
  router.get('/platforms/:id/tasks', (req, res) => {
    try {
      const result = devtoolsService.getPlatformTasks(req.params.id);
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) { return res.status(500).json({ error: err.message || '拉取任务失败' }); }
  });
  router.post('/platforms/:id/tasks/fetch', (req, res) => {
    try {
      const result = devtoolsService.fetchPlatformTasks(req.params.id);
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) { return res.status(500).json({ error: err.message || '拉取任务失败' }); }
  });
  router.post('/platforms/:id/tasks/:taskId/accept', (req, res) => {
    try {
      const result = devtoolsService.acceptPlatformTask(req.params.id, req.params.taskId, req.body || {});
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) { return res.status(500).json({ error: err.message || '接受任务失败' }); }
  });
  router.post('/pipeline/platform-to-project', (req, res) => {
    try {
      const result = devtoolsService.pipelinePlatformToProject(req.body || {});
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) { return res.status(500).json({ error: err.message || 'pipeline 执行失败' }); }
  });

  return router;
}

module.exports = {
  createDevtoolsRouter,
};
