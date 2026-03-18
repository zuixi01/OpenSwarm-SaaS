const express = require('express');

function createAgentMetaRouter(options) {
  const { agentMetaService } = options;
  const router = express.Router();

  router.post('/agent-definition/:hexId', (req, res) => {
    try {
      const result = agentMetaService.writeAgentDefinition(req.params.hexId, req.body && req.body.content);
      if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message || '写入员工定义失败' });
    }
  });

  router.get('/agent/:id/label', (req, res) => {
    const result = agentMetaService.getAgentLabel(req.params.id);
    if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
    return res.json(result);
  });

  router.put('/agent/:id/label', (req, res) => {
    const result = agentMetaService.setAgentLabel(req.params.id, req.body && req.body.label);
    if (result?.error) return res.status(result.error.status).json({ error: result.error.message });
    return res.json(result);
  });

  return router;
}

module.exports = {
  createAgentMetaRouter,
};
