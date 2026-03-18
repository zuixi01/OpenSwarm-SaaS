const express = require('express');
const { resolveTenantId } = require('../lib/tenant-scope');

function createProjectRunRouter(options) {
  const { projectRunService } = options;
  const router = express.Router();

  router.post('/projects/:id/run', (req, res) => {
    try {
      const result = projectRunService.runProject(req, resolveTenantId(req));
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || '执行失败' });
    }
  });

  return router;
}

module.exports = {
  createProjectRunRouter,
};
