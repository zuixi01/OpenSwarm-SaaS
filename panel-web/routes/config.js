const express = require('express');

function createConfigRouter(options) {
  const {
    configService,
    panelToken,
    panelTokenCookieName,
  } = options;

  const router = express.Router();

  router.get('/config', (_req, res) => {
    try {
      return res.json(configService.listConfig());
    } catch (error) {
      return res.status(500).json({ error: error.message || '读取配置失败' });
    }
  });

  router.post('/panel-login', (req, res) => {
    if (!panelToken) return res.status(400).json({ error: '面板未启用鉴权' });
    const token = req.body && req.body.token ? String(req.body.token).trim() : '';
    if (token !== panelToken) return res.status(401).json({ error: '令牌无效' });
    res.cookie(panelTokenCookieName, token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    return res.json({ ok: true });
  });

  router.get('/config/check-ports', (req, res) => {
    try {
      return res.json(configService.checkPorts(req.query || {}));
    } catch (error) {
      return res.status(500).json({ error: error.message || '检测失败' });
    }
  });

  router.post('/config', (req, res) => {
    try {
      return res.json(configService.saveConfig(req.body || {}));
    } catch (error) {
      const status = String(error.message || '').includes('API Key') ? 400 : 500;
      return res.status(status).json({ error: error.message || '保存配置失败' });
    }
  });

  router.post('/config/restart-openclaw', async (_req, res) => {
    try {
      if (!configService || typeof configService.restartOpenClawRuntimes !== 'function') {
        return res.status(400).json({ error: '当前环境不支持重启 OpenClaw runtime' });
      }
      return res.json(await configService.restartOpenClawRuntimes());
    } catch (error) {
      return res.status(500).json({ error: error.message || '重启 OpenClaw runtime 失败' });
    }
  });

  return router;
}

module.exports = {
  createConfigRouter,
};
