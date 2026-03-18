function createProjectRunService(options) {
  const {
    hexDefinitionProjectId,
    readProjects,
    normalizeAgentPayloadAliases,
    port,
  } = options;

  function checkRunToken(project, req) {
    const authHeader = req.headers.authorization || '';
    const apiKey = req.headers['x-api-key'] || '';
    const token = (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '') || apiKey;
    const projectToken = project.apiToken || project.config?.apiToken || '';
    const globalToken = process.env.OPENSWARM_RUN_TOKEN || '';
    if (projectToken && token === projectToken) return true;
    if (globalToken && token === globalToken) return true;
    return false;
  }

  function runProject(req, tenantId = 'public') {
    const projectId = req.params.id;
    if (projectId === hexDefinitionProjectId) return { error: { status: 400, message: 'hex-definition 无 run' } };
    const list = readProjects(tenantId);
    const project = list.find((p) => p.id === projectId);
    if (!project) return { error: { status: 404, message: '项目不存在' } };
    if (!checkRunToken(project, req)) return { error: { status: 401, message: '鉴权失败，需提供有效的 Authorization 或 X-API-Key' } };
    const body = normalizeAgentPayloadAliases(req.body || {});
    const baseUrl = `http://127.0.0.1:${port}`;
    if (body.workflowId) {
      const wf = (project.workflows || []).find((w) => w.id === body.workflowId);
      if (!wf || !wf.steps?.length) return { error: { status: 400, message: '流程不存在或为空' } };
      fetch(`${baseUrl}/api/agent/agent-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hexId: wf.steps[0].hexId || wf.steps[0].agentId,
          message: wf.steps[0].message,
          projectId,
          workflowId: body.workflowId,
          workflowStepIndex: 0,
          tenantId,
        }),
      }).catch((e) => console.warn('[run] workflow trigger failed:', e.message));
      return { ok: true, type: 'workflow', workflowId: body.workflowId };
    }
    if (body.triggerId) {
      const tr = (project.triggers || []).find((t) => t.id === body.triggerId);
      if (!tr || tr.enabled === false) return { error: { status: 400, message: '触发规则不存在或已禁用' } };
      fetch(`${baseUrl}/api/agent/agent-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hexId: tr.hexId || tr.agentId, message: tr.message, projectId, tenantId }),
      }).catch((e) => console.warn('[run] trigger failed:', e.message));
      return { ok: true, type: 'trigger', triggerId: body.triggerId };
    }
    const agentId = body.hexId || body.agentId;
    if (agentId && body.message) {
      fetch(`${baseUrl}/api/agent/agent-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hexId: agentId, message: body.message, projectId, tenantId }),
      }).catch((e) => console.warn('[run] agent-task failed:', e.message));
      return { ok: true, type: 'agent', agentId, hexId: agentId };
    }
    return { error: { status: 400, message: '请提供 agentId+message、workflowId 或 triggerId（兼容 hexId）' } };
  }

  return {
    runProject,
  };
}

module.exports = {
  createProjectRunService,
};
