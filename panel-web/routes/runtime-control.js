const express = require('express');

function createRuntimeControlRouter(options) {
  const { runtimeControlService } = options;
  const router = express.Router();

  router.get('/robots', (req, res) => {
    return res.json(runtimeControlService.listRobots({ nocache: !!req.query.nocache }));
  });

  router.get('/system', (_req, res) => {
    return res.json(runtimeControlService.getSystemStats());
  });

  router.get('/health', (_req, res) => {
    return res.status(200).json({ ok: true, service: 'openswarm-panel', ts: Date.now() });
  });

  router.post('/open-tui/:robot', (req, res) => {
    try {
      const result = runtimeControlService.openRobotTui(req.params.robot);
      if (result.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      console.error('open-tui error:', err);
      return res.status(500).json({ error: err.message || '启动失败' });
    }
  });

  router.post('/start-first-10', (req, res) => {
    try {
      return res.json(runtimeControlService.startFirstTen());
    } catch (err) {
      console.error('start-first-10 error:', err);
      return res.status(500).json({ error: err.message || '一键启动失败' });
    }
  });

  router.post('/close-all-agent-terminals', async (_req, res) => {
    try {
      return res.json(await runtimeControlService.closeAllAgentTerminals());
    } catch (err) {
      console.error('close-all-agent-terminals error:', err);
      return res.status(500).json({ error: err.message || '关闭失败' });
    }
  });

  router.post('/stop/:robot', async (req, res) => {
    try {
      const result = await runtimeControlService.stopRobot(req.params.robot, req.body || {});
      if (result.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      console.error('stop error:', err);
      return res.status(500).json({ error: err.message || '停止失败' });
    }
  });

  return router;
}

module.exports = {
  createRuntimeControlRouter,
};
