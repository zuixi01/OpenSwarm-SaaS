function createProjectDomainService(options) {
  const {
    hexDefinitionProjectId,
    hexRobots,
    mainGatewayPort,
    rootDir,
    readProjects,
    writeProjects,
    readHexDefinitionConfig,
    writeHexDefinitionConfig,
    nextProjectId,
    normalizeProjectAgentSchema,
    normalizeProjectBillingConfig,
    normalizeAgentNodeAliases,
    normalizeWorkflowAliases,
    readSkillsLibrary,
    writeSkillsLibrary,
    readBillingPlans,
    writeBillingPlans,
    getPlanById,
    readBillingEvents,
    appendBillingEvent,
    usageSnapshot,
    readProjectTemplates,
    readSkillTemplates,
    applyDefaultHexSkills,
    nextTaskId,
    reloadSchedules,
    resolveMainGatewayToken,
    clearProjectState,
    clearAutonomyRuns,
  } = options;

  function listSkills() {
    return { skills: readSkillsLibrary() };
  }

  function saveSkills(skills) {
    if (!Array.isArray(skills)) throw new Error('skills 必须为数组');
    writeSkillsLibrary(skills);
    return { skills: readSkillsLibrary() };
  }

  function listSkillTemplates() {
    return { templates: readSkillTemplates() };
  }

  function listProjectTemplates() {
    return { templates: readProjectTemplates() };
  }

  async function autoConfigureProject(projectId, body = {}, tenantId = 'public') {
    if (projectId === hexDefinitionProjectId) {
      return { error: { status: 400, message: 'hex-definition 无 yang-configure' } };
    }
    const list = readProjects(tenantId);
    const project = list.find((p) => p.id === projectId);
    if (!project) return { error: { status: 404, message: '项目不存在' } };
    const agentIds = project.agentIds || project.hexIds || [];
    if (agentIds.length === 0) return { error: { status: 400, message: '请先选员工' } };
    const userDesc = String(body.description || '').trim();
    const apply = body.apply === true;

    const skills = readSkillsLibrary();
    const skillNames = skills.map((s) => s.id).join(', ');
    const agentNames = agentIds.map((id) => {
      const r = hexRobots.find((h) => h.id === id);
      return `${id}(${r ? r.name : id})`;
    }).join(', ');

    const prompt = `你是 OpenSwarm 的「策略」配置 Agent。根据项目信息，为每个数字员工分配合适的技能，并可选配置定时任务和触发规则。

项目名称：${project.name}
项目描述：${project.description || userDesc || '（无）'}
本项目数字员工：${agentNames}
可用技能：${skillNames}

当前配置（可参考或覆盖）：
agentSkills: ${JSON.stringify(project.agentSkills || project.hexSkills || {})}

请输出一个 JSON 对象，且仅输出 JSON，不要其他文字。格式：
{
  "agentSkills": { "员工id": ["skill1","skill2"], ... },
  "schedules": [{ "id":"s1","name":"名称","cron":"0 9 * * *","agentId":"员工id","message":"执行指令","enabled":true }],
  "triggers": [{ "id":"t1","type":"webhook","name":"名称","agentId":"员工id","message":"执行指令","enabled":true }]
}

规则：agentSkills 的 key 必须是本项目数字员工的 id；value 必须是技能 id，且只能从 [${skillNames}] 中选择。schedules 和 triggers 可为空数组。`;

    const headers = { 'Content-Type': 'application/json' };
    const token = resolveMainGatewayToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let resp;
    try {
      resp = await fetch(`http://127.0.0.1:${mainGatewayPort}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: 'openclaw', messages: [{ role: 'user', content: prompt }] }),
      });
    } catch (fetchErr) {
      const msg = String(fetchErr.cause?.message || fetchErr.message || '');
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
        return { error: { status: 503, message: '主控网关未启动。请点击「主控·启动」后再试。' } };
      }
      throw fetchErr;
    }

    const raw = await resp.text();
    let data = {};
    try {
      let jsonStr = raw;
      const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlock) jsonStr = codeBlock[1].trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) data = JSON.parse(jsonMatch[0]);
    } catch (_) {}

    const agentSkills = ((data.agentSkills && typeof data.agentSkills === 'object') ? data.agentSkills : data.hexSkills) || {};
    const schedules = Array.isArray(data.schedules) ? data.schedules : [];
    const triggers = Array.isArray(data.triggers) ? data.triggers : [];
    const validAgentSkills = {};
    const resolveSkillId = (s) => {
      const str = String(s || '').trim().toLowerCase();
      if (!str) return null;
      const byId = skills.find((sk) => sk.id.toLowerCase() === str);
      if (byId) return byId.id;
      const byName = skills.find((sk) => (sk.name || '').toLowerCase() === str);
      if (byName) return byName.id;
      return null;
    };
    agentIds.forEach((aid) => {
      const arr = Array.isArray(agentSkills[aid]) ? agentSkills[aid] : [];
      validAgentSkills[aid] = arr.map(resolveSkillId).filter(Boolean);
    });
    const validSchedules = schedules
      .map(normalizeAgentNodeAliases)
      .filter((s) => s.agentId && agentIds.includes(s.agentId) && s.cron && s.message);
    const validTriggers = triggers
      .map(normalizeAgentNodeAliases)
      .filter((t) => t.agentId && agentIds.includes(t.agentId) && t.message);

    if (apply) {
      const idx = list.findIndex((p) => p.id === projectId);
      if (idx >= 0) {
        list[idx].hexSkills = validAgentSkills;
        list[idx].agentSkills = validAgentSkills;
        list[idx].schedules = validSchedules;
        list[idx].triggers = validTriggers;
        normalizeProjectAgentSchema(list[idx]);
        writeProjects(list, tenantId);
        if (typeof reloadSchedules === 'function') reloadSchedules();
      }
    }

    return {
      agentSkills: validAgentSkills,
      hexSkills: validAgentSkills,
      schedules: validSchedules,
      triggers: validTriggers,
      applied: apply,
    };
  }

  function listProjects(tenantId = 'public') {
    const list = readProjects(tenantId).filter((p) => p.id !== hexDefinitionProjectId);
    const hexDef = readHexDefinitionConfig(tenantId);
    const virtual = {
      id: hexDefinitionProjectId,
      name: '员工编组',
      hexIds: hexDef.hexIds,
      agentIds: hexDef.hexIds,
      noDelete: true,
    };
    return [virtual, ...list.map(normalizeProjectAgentSchema)];
  }

  function createProject(body = {}, tenantId = 'public') {
    const name = body.name ? String(body.name).trim() : '';
    if (!name) return { error: { status: 400, message: '项目名称不能为空' } };
    const templateId = body.templateId ? String(body.templateId).trim() : '';
    const list = readProjects(tenantId);
    const id = nextProjectId(list);
    let project = {
      id, name, hexIds: [], hexSkills: {}, config: {}, hexConfig: {}, schedules: [], triggers: [], workflows: [],
      type: 'other', description: '', status: 'planning', budget: 0, revenue: 0,
      startDate: new Date().toISOString().slice(0, 10), tasks: [], tenantId,
    };
    if (templateId) {
      const tpl = readProjectTemplates().find((t) => t.id === templateId);
      if (tpl) {
        project.hexIds = Array.isArray(tpl.hexIds) ? [...tpl.hexIds] : [];
        project.hexSkills = tpl.hexSkills && typeof tpl.hexSkills === 'object' ? { ...tpl.hexSkills } : {};
        if (tpl.description) project.description = tpl.description;
      }
    }
    project = normalizeProjectAgentSchema(project);
    list.push(project);
    writeProjects(list, tenantId);
    return { status: 201, body: project };
  }

  function getProject(projectId, tenantId = 'public') {
    if (projectId === hexDefinitionProjectId) {
      const hexDef = readHexDefinitionConfig(tenantId);
      return {
        id: hexDefinitionProjectId,
        name: '员工编组',
        hexIds: hexDef.hexIds,
        agentIds: hexDef.hexIds,
        noDelete: true,
      };
    }
    const project = readProjects(tenantId).find((p) => p.id === projectId);
    if (!project) return { error: { status: 404, message: '项目不存在' } };
    if (!project.hexSkills || typeof project.hexSkills !== 'object') project.hexSkills = {};
    if (!project.config || typeof project.config !== 'object') project.config = {};
    if (!project.hexConfig || typeof project.hexConfig !== 'object') project.hexConfig = {};
    if (!Array.isArray(project.schedules)) project.schedules = [];
    if (!Array.isArray(project.triggers)) project.triggers = [];
    if (!Array.isArray(project.workflows)) project.workflows = [];
    return normalizeProjectAgentSchema(project);
  }

  function getProjectYinStatus(projectId, tenantId = 'public') {
    if (projectId === hexDefinitionProjectId) return { error: { status: 400, message: 'hex-definition 无 yin-status' } };
    const project = readProjects(tenantId).find((p) => p.id === projectId);
    if (!project) return { error: { status: 404, message: '项目不存在' } };
    const agentIds = project.agentIds || project.hexIds || [];
    const agentSkills = project.agentSkills || project.hexSkills || {};
    const config = project.config || {};
    const agentConfig = project.agentConfig || project.hexConfig || {};
    const agentList = agentIds.map((agentId) => {
      const robot = hexRobots.find((r) => String(r.id) === String(agentId));
      return {
        id: agentId,
        agentId,
        name: robot ? robot.name : agentId,
        skills: agentSkills[agentId] || [],
        config: agentConfig[agentId] || {},
      };
    });
    return {
      projectId: project.id,
      projectName: project.name,
      config,
      agentList,
      hexList: agentList,
      schedules: Array.isArray(project.schedules) ? project.schedules.map(normalizeAgentNodeAliases) : [],
      triggers: Array.isArray(project.triggers) ? project.triggers.map(normalizeAgentNodeAliases) : [],
      workflows: Array.isArray(project.workflows) ? project.workflows.map(normalizeWorkflowAliases) : [],
      apiToken: project.apiToken ? project.apiToken.slice(0, 8) + '…' : '',
      hasApiToken: !!project.apiToken,
    };
  }

  function updateProject(projectId, body = {}, tenantId = 'public') {
    if (projectId === hexDefinitionProjectId) {
      if (!Array.isArray(body.hexIds)) return { error: { status: 400, message: '仅允许更新 hexIds' } };
      const hexDef = readHexDefinitionConfig(tenantId);
      hexDef.hexIds = body.hexIds;
      writeHexDefinitionConfig(hexDef, tenantId);
      return {
        id: hexDefinitionProjectId,
        name: '员工编组',
        hexIds: hexDef.hexIds,
        agentIds: hexDef.hexIds,
        noDelete: true,
      };
    }
    const list = readProjects(tenantId);
    const idx = list.findIndex((p) => p.id === projectId);
    if (idx < 0) return { error: { status: 404, message: '项目不存在' } };
    const p = list[idx];
    if (!p.tenantId) p.tenantId = tenantId;
    if (!p.tasks) p.tasks = [];
    if (body.name != null) p.name = String(body.name).trim() || p.name;
    if (Array.isArray(body.hexIds)) {
      p.hexIds = body.hexIds;
      applyDefaultHexSkills(p);
    }
    if (body.hexSkills !== undefined) p.hexSkills = (typeof body.hexSkills === 'object' && body.hexSkills !== null) ? body.hexSkills : {};
    if (body.config !== undefined) p.config = (typeof body.config === 'object' && body.config !== null) ? body.config : {};
    if (body.hexConfig !== undefined) p.hexConfig = (typeof body.hexConfig === 'object' && body.hexConfig !== null) ? body.hexConfig : {};
    if (Array.isArray(body.schedules)) {
      p.schedules = body.schedules;
      if (typeof reloadSchedules === 'function') reloadSchedules();
    }
    if (Array.isArray(body.triggers)) p.triggers = body.triggers;
    if (Array.isArray(body.workflows)) p.workflows = body.workflows;
    if (body.apiToken !== undefined) p.apiToken = body.apiToken == null ? '' : String(body.apiToken).trim();
    if (body.type != null) p.type = String(body.type);
    if (body.description != null) p.description = String(body.description);
    if (body.status != null) p.status = String(body.status);
    if (body.budget != null) p.budget = Number(body.budget) || 0;
    if (body.revenue != null) p.revenue = Number(body.revenue) || 0;
    if (body.startDate != null) p.startDate = body.startDate == null ? '' : String(body.startDate);
    if (body.endDate !== undefined) p.endDate = body.endDate == null ? undefined : String(body.endDate);
    if (Array.isArray(body.tasks)) p.tasks = body.tasks;
    normalizeProjectAgentSchema(p);
    writeProjects(list, tenantId);
    return normalizeProjectAgentSchema(p);
  }

  function listBillingPlans() {
    return { plans: readBillingPlans() };
  }

  function saveBillingPlans(plans) {
    if (!Array.isArray(plans)) throw new Error('plans 必须为数组');
    writeBillingPlans(plans);
    return { plans: readBillingPlans() };
  }

  function getBillingSummary(projectId, tenantId = 'public') {
    const snap = usageSnapshot(projectId, Date.now(), tenantId);
    if (!snap) return { error: { status: 404, message: '项目不存在' } };
    return {
      projectId,
      cycle: snap.cycle,
      plan: snap.plan,
      billing: snap.billing,
      usage: {
        usedUnits: snap.usedUnits,
        overageUnits: snap.overageUnits,
        remainingIncludedUnits: snap.remainingIncludedUnits,
        usageGrossCents: snap.usageGrossCents,
        usageNetCents: snap.usageNetCents,
        creditAppliedCents: snap.creditAppliedCents,
        toppedUpCents: snap.toppedUpCents,
        cycleTotalCents: snap.cycleTotalCents,
      },
    };
  }

  function getBillingEvents(projectId, limitRaw, tenantId = 'public') {
    const snap = usageSnapshot(projectId, Date.now(), tenantId);
    if (!snap) return { error: { status: 404, message: '项目不存在' } };
    const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 100, 1), 500);
    const events = readBillingEvents(tenantId)
      .filter((e) => e.projectId === projectId)
      .sort((a, b) => Number(b.at || 0) - Number(a.at || 0))
      .slice(0, limit);
    return { projectId, events };
  }

  function updateProjectBilling(projectId, body = {}, tenantId = 'public') {
    const list = readProjects(tenantId);
    const idx = list.findIndex((p) => p.id === projectId);
    if (idx < 0) return { error: { status: 404, message: '项目不存在' } };
    const nextBilling = normalizeProjectBillingConfig({
      ...(list[idx].billing || {}),
      ...(body.billing && typeof body.billing === 'object' ? body.billing : {}),
      ...(body.planId != null ? { planId: body.planId } : {}),
      ...(body.hardLimitCents !== undefined ? { hardLimitCents: body.hardLimitCents } : {}),
    });
    const { plans } = getPlanById(nextBilling.planId);
    if (!plans.find((p) => p.id === nextBilling.planId)) {
      return { error: { status: 400, message: `未知套餐 planId: ${nextBilling.planId}` } };
    }
    list[idx].billing = nextBilling;
    if (!list[idx].tenantId) list[idx].tenantId = tenantId;
    writeProjects(list, tenantId);
    return { projectId, billing: nextBilling };
  }

  function topupProjectBilling(projectId, body = {}, tenantId = 'public') {
    const amount = Number(body.amountCents);
    if (!Number.isFinite(amount) || amount <= 0) return { error: { status: 400, message: 'amountCents 必须为正数' } };
    const list = readProjects(tenantId);
    const idx = list.findIndex((p) => p.id === projectId);
    if (idx < 0) return { error: { status: 404, message: '项目不存在' } };
    list[idx].billing = normalizeProjectBillingConfig(list[idx].billing);
    if (!list[idx].tenantId) list[idx].tenantId = tenantId;
    list[idx].billing.creditBalanceCents += Math.round(amount);
    writeProjects(list, tenantId);
    appendBillingEvent({
      id: `bill_topup_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
      kind: 'topup',
      at: Date.now(),
      cycle: new Date().toISOString().slice(0, 7),
      projectId,
      source: 'manual.topup',
      topupCents: Math.round(amount),
      amountCents: 0,
      note: String(body.note || ''),
    }, tenantId);
    return { projectId, billing: list[idx].billing };
  }

  function createProjectTask(projectId, body = {}, tenantId = 'public') {
    const list = readProjects(tenantId);
    const idx = list.findIndex((p) => p.id === projectId);
    if (idx < 0) return { error: { status: 404, message: '项目不存在' } };
    const project = list[idx];
    if (!project.tenantId) project.tenantId = tenantId;
    if (!project.tasks) project.tasks = [];
    const task = {
      id: nextTaskId(project.tasks),
      title: String(body.title || ''),
      assignedTo: String(body.assignedTo || ''),
      status: ['pending', 'in-progress', 'completed'].includes(body.status) ? body.status : 'pending',
      deadline: String(body.deadline || ''),
      dependencies: Array.isArray(body.dependencies) ? body.dependencies : [],
    };
    project.tasks.push(task);
    writeProjects(list, tenantId);
    return { status: 201, body: task };
  }

  function updateProjectTask(projectId, taskId, body = {}, tenantId = 'public') {
    const list = readProjects(tenantId);
    const idx = list.findIndex((p) => p.id === projectId);
    if (idx < 0) return { error: { status: 404, message: '项目不存在' } };
    const project = list[idx];
    if (!project.tenantId) project.tenantId = tenantId;
    if (!project.tasks) project.tasks = [];
    const ti = project.tasks.findIndex((t) => t.id === taskId);
    if (ti < 0) return { error: { status: 404, message: '任务不存在' } };
    if (body.title !== undefined) project.tasks[ti].title = String(body.title);
    if (body.assignedTo !== undefined) project.tasks[ti].assignedTo = String(body.assignedTo);
    if (['pending', 'in-progress', 'completed'].includes(body.status)) project.tasks[ti].status = body.status;
    if (body.deadline !== undefined) project.tasks[ti].deadline = String(body.deadline);
    if (Array.isArray(body.dependencies)) project.tasks[ti].dependencies = body.dependencies;
    writeProjects(list, tenantId);
    return project.tasks[ti];
  }

  function deleteProject(projectId, tenantId = 'public') {
    if (projectId === hexDefinitionProjectId) return { error: { status: 403, message: '员工自定义不可删除' } };
    let list = readProjects(tenantId);
    const len = list.length;
    list = list.filter((p) => p.id !== projectId);
    if (list.length === len) return { error: { status: 404, message: '项目不存在' } };
    writeProjects(list, tenantId);
    Promise.resolve()
      .then(() => (typeof clearProjectState === 'function' ? clearProjectState(projectId, tenantId) : null))
      .then(() => (typeof clearAutonomyRuns === 'function' ? clearAutonomyRuns(projectId, tenantId) : null))
      .catch(() => {});
    return { ok: true };
  }

  return {
    listSkills,
    saveSkills,
    listSkillTemplates,
    listProjectTemplates,
    autoConfigureProject,
    listProjects,
    createProject,
    getProject,
    getProjectYinStatus,
    updateProject,
    listBillingPlans,
    saveBillingPlans,
    getBillingSummary,
    getBillingEvents,
    updateProjectBilling,
    topupProjectBilling,
    createProjectTask,
    updateProjectTask,
    deleteProject,
  };
}

module.exports = {
  createProjectDomainService,
};
