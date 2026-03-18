function createTriggerService(options) {
  const {
    cron,
    readProjects,
    hexDefinitionProjectId,
    dispatchAgentTask,
  } = options;

  const cronTasks = new Map();

  function scheduleKey(projectId, scheduleId) {
    return `${projectId}:${scheduleId}`;
  }

  function fireScheduledTask(projectId, schedule, tenantId = 'public') {
    const { hexId, message } = schedule || {};
    if (!hexId || !message) return;
    dispatchAgentTask({
      hexId,
      message,
      projectId,
      tenantId,
    }).catch((e) => console.warn('[schedule] fire failed:', projectId, schedule?.id, e.message));
  }

  function triggerNextWorkflowStep(projectId, workflowId, nextStepIndex, tenantId = 'public') {
    try {
      const project = readProjects(tenantId).find((p) => p.id === projectId);
      if (!project) return;
      const workflows = Array.isArray(project.workflows) ? project.workflows : [];
      const wf = workflows.find((w) => w.id === workflowId);
      if (!wf || !Array.isArray(wf.steps) || nextStepIndex >= wf.steps.length) return;
      const step = wf.steps[nextStepIndex];
      if (!step || !step.hexId || !step.message) return;
      dispatchAgentTask({
        hexId: step.hexId,
        message: step.message,
        projectId,
        workflowId,
        workflowStepIndex: nextStepIndex,
        tenantId,
      }).catch((e) => console.warn('[workflow] trigger next failed:', e.message));
    } catch (e) {
      console.warn('[workflow]', e.message);
    }
  }

  function reloadSchedules() {
    cronTasks.forEach((task) => task.stop());
    cronTasks.clear();
    try {
      const list = readProjects('public');
      list.forEach((project) => {
        const schedules = Array.isArray(project.schedules) ? project.schedules : [];
        schedules.forEach((schedule) => {
          if (!schedule.id || !schedule.cron || !schedule.hexId || !schedule.message) return;
          if (schedule.enabled === false) return;
          if (!cron.validate(schedule.cron)) return;
          const key = scheduleKey(project.id, schedule.id);
          const task = cron.schedule(schedule.cron, () => fireScheduledTask(project.id, schedule, 'public'));
          cronTasks.set(key, task);
        });
      });
    } catch (e) {
      console.warn('[schedule] reload failed:', e.message);
    }
  }

  function triggerWebhook(projectId, triggerId, body = {}, tenantId = 'public') {
    if (projectId === hexDefinitionProjectId) return { error: { status: 400, message: 'hex-definition 无 triggers' } };
    const project = readProjects(tenantId).find((p) => p.id === projectId);
    if (!project) return { error: { status: 404, message: '项目不存在' } };
    const triggers = Array.isArray(project.triggers) ? project.triggers : [];
    const trigger = triggers.find((t) => t.id === triggerId);
    if (!trigger) return { error: { status: 404, message: '触发规则不存在' } };
    if (trigger.enabled === false) return { error: { status: 403, message: '触发已禁用' } };
    const hexId = trigger.hexId;
    const message = body.message || trigger.message || '';
    if (!hexId || !message) return { error: { status: 400, message: '触发规则缺少 hexId 或 message' } };
    fireScheduledTask(projectId, { hexId, message, id: trigger.id }, tenantId);
    return { ok: true, message: '已触发' };
  }

  function triggerWorkflow(projectId, workflowId, tenantId = 'public') {
    if (projectId === hexDefinitionProjectId) return { error: { status: 400, message: 'hex-definition 无 workflows' } };
    const project = readProjects(tenantId).find((p) => p.id === projectId);
    if (!project) return { error: { status: 404, message: '项目不存在' } };
    const workflows = Array.isArray(project.workflows) ? project.workflows : [];
    const wf = workflows.find((w) => w.id === workflowId);
    if (!wf || !Array.isArray(wf.steps) || wf.steps.length === 0) return { error: { status: 404, message: '流程不存在或为空' } };
    const step = wf.steps[0];
    if (!step || !step.hexId || !step.message) return { error: { status: 400, message: '流程第一步无效' } };
    dispatchAgentTask({
      hexId: step.hexId,
      message: step.message,
      projectId,
      workflowId,
      workflowStepIndex: 0,
      tenantId,
    }).catch((e) => console.warn('[workflow] trigger failed:', e.message));
    return { ok: true, message: '已触发流程' };
  }

  function triggerSchedule(projectId, scheduleId, tenantId = 'public') {
    if (projectId === hexDefinitionProjectId) return { error: { status: 400, message: 'hex-definition 无 schedules' } };
    const project = readProjects(tenantId).find((p) => p.id === projectId);
    if (!project) return { error: { status: 404, message: '项目不存在' } };
    const schedules = Array.isArray(project.schedules) ? project.schedules : [];
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) return { error: { status: 404, message: '定时任务不存在' } };
    fireScheduledTask(projectId, schedule, tenantId);
    return { ok: true, message: '已触发' };
  }

  return {
    reloadSchedules,
    fireScheduledTask,
    triggerNextWorkflowStep,
    triggerWebhook,
    triggerWorkflow,
    triggerSchedule,
  };
}

module.exports = {
  createTriggerService,
};
