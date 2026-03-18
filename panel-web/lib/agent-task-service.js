const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { runAgentTask } = require('./worker-dispatcher');

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(src, entry.name);
    const targetPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(sourcePath, targetPath);
    else fs.copyFileSync(sourcePath, targetPath);
  }
}

function createAgentTaskService(options) {
  const {
    rootDir,
    port,
    readProjects,
    normalizeAgentPayloadAliases,
    hexRobots,
    getWorkerByHex,
    ensureWorkerGateway,
    checkHardLimit,
    estimateAgentTaskUnits,
    recordUsageBilling,
    chatHistoryService,
    workerWsCall,
    timeoutMs = 180000,
    buildAutonomousPrompt,
    markAutonomousRun,
    pushAutonomousProgress,
    processAutonomousAgentResult,
    reportWorkerHealth,
    restartWorkerGateway,
  } = options;

  const taskStore = new Map();

  function buildExecutionPrompt(message, context = {}) {
    const userMessage = String(message || '').trim();
    const projectId = String(context.projectId || '').trim();
    const skillIds = Array.isArray(context.skillIds) ? context.skillIds.filter(Boolean) : [];
    const skillHint = skillIds.length
      ? `本轮已挂载项目 skills：${skillIds.join('、')}。你必须优先调用这些 skills 或相关工具链执行，不要只做口头分析。`
      : '本轮没有挂载项目专用 skills。请优先使用你可用的浏览器、抓取、文件、执行工具完成任务，不要只做口头分析。';
    return `${userMessage}

你现在处于“执行任务模式”，不是普通聊天模式。
${skillHint}

执行要求：
1. 先执行，再总结。不要先介绍自己的岗位、分工或计划。
2. 若任务需要搜索、抓取、读写文件、整理报告，请直接调用对应 skills / tools 动手完成。
3. 如果你声称产出了报告、表格、清单或文档，必须真实写入 workspace/output/${projectId || '<projectId>'}/ 或其子目录。
4. 最终回复必须包含：
   - 你实际执行了什么
   - 产出了什么
   - 产物路径（如果有）
   - 如果受阻，明确说出卡点和下一步建议
5. 不得把用户要求的年份、季度、品类、地区静默改掉；找不到数据时要明确说明，而不是用别的时间范围替代。`;
  }

  function getTask(taskId) {
    return taskStore.get(taskId) || null;
  }

  function getProjectSkillIds(projectId, hexId, tenantId = 'public') {
    if (!projectId || !hexId) return [];
    try {
      const list = readProjects(tenantId);
      const project = list.find((item) => item.id === projectId);
      if (!project || !project.hexSkills || typeof project.hexSkills !== 'object') return [];
      const skillIds = project.hexSkills[hexId];
      if (!Array.isArray(skillIds)) return [];
      const skillsSrcDir = path.join(rootDir, 'skills');
      const valid = [];
      const dropped = [];
      skillIds.filter(Boolean).forEach((skillId) => {
        const src = path.join(skillsSrcDir, skillId);
        if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
          valid.push(skillId);
        } else {
          dropped.push(skillId);
        }
      });
      if (dropped.length) {
        console.warn('[projectSkills] 忽略不存在的 skills:', dropped.join(', '), `project=${projectId}`, `agent=${hexId}`);
      }
      return valid;
    } catch (error) {
      console.warn('[projectSkills]', error.message);
      return [];
    }
  }

  function mountHexSkillsForProject(projectId, hexId, stateDir, tenantId = 'public') {
    if (!projectId || !stateDir) return [];
    const mountedSkillIds = [];
    try {
      const skillIds = getProjectSkillIds(projectId, hexId, tenantId);
      if (!skillIds.length) return mountedSkillIds;

      const skillsSrcDir = path.join(rootDir, 'skills');
      const hexSkillsDir = path.join(stateDir, 'workspace', 'skills');
      if (!fs.existsSync(hexSkillsDir)) fs.mkdirSync(hexSkillsDir, { recursive: true });

      for (const skillId of skillIds) {
        const src = path.join(skillsSrcDir, skillId);
        if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) continue;
        const dest = path.join(hexSkillsDir, skillId);
        try {
          if (fs.existsSync(dest)) {
            try { fs.rmSync(dest, { recursive: true }); } catch (_) {}
          }
          copyDirSync(src, dest);
          mountedSkillIds.push(skillId);
        } catch (error) {
          console.warn('[mountHexSkills] 复制 skill', skillId, '失败:', error.message);
        }
      }
    } catch (error) {
      console.warn('[mountHexSkills]', error.message);
    }
    return mountedSkillIds;
  }

  function dispatchAgentTaskRequest(payload) {
    return fetch(`http://127.0.0.1:${port}/api/agent/agent-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  function dispatchAutonomousAgentStep(run, agentId, message, dispatchOptions = {}) {
    const autonomySkillIds = getProjectSkillIds(run.projectId, agentId, run.tenantId || 'public');
    const payload = {
      hexId: agentId,
      message: buildAutonomousPrompt(String(message || ''), {
        projectId: run.projectId || '',
        agentId,
        skillIds: autonomySkillIds,
      }),
      projectId: run.projectId,
      tenantId: run.tenantId || 'public',
      sessionKey: dispatchOptions.sessionKey || 'main',
      autonomousRunId: run.id,
      autonomousDepth: dispatchOptions.depth || (run.steps || []).length,
      autonomousFromAgentId: dispatchOptions.fromAgentId || null,
    };
    run.events.push({
      type: 'dispatch_requested',
      at: Date.now(),
      agentId,
      fromAgentId: dispatchOptions.fromAgentId || null,
      message: String(message || ''),
      skillIds: autonomySkillIds,
    });
    markAutonomousRun(run, { currentAgentId: agentId });
    return dispatchAgentTaskRequest(payload);
  }

  function submitTask(body = {}) {
    const taskId = `agttask_${Date.now()}_${randomUUID().slice(0, 6)}`;
    const task = {
      id: taskId,
      status: 'running',
      reply: null,
      hexName: null,
      agentName: null,
      error: null,
      createdAt: Date.now(),
      progress: [],
    };
    taskStore.set(taskId, task);
    void executeTask(taskId, body);
    return { taskId, agentTaskId: taskId };
  }

  async function executeTask(taskId, body = {}) {
    const task = getTask(taskId);
    if (!task) throw new Error('task not found');
    try {
      const payload = normalizeAgentPayloadAliases(body || {});
      const agentId = payload.hexId || payload.agentId;
      const { message, projectId, workflowId, workflowStepIndex, onWorkflowStepDone } = payload;
      const tenantId = payload.tenantId || 'public';
      const requestedSessionKey = String(payload.sessionKey || '').trim();
      const effectiveSessionKey = (!requestedSessionKey || requestedSessionKey === 'main')
        ? `task:${projectId || 'global'}:${agentId || 'unknown'}`
        : requestedSessionKey;
      payload.sessionKey = effectiveSessionKey;
      const mountedSkillIds = getProjectSkillIds(projectId, agentId, tenantId);
      payload.message = buildExecutionPrompt(message, {
        projectId,
        agentId,
        skillIds: mountedSkillIds,
      });
      await runAgentTask(task, payload, {
        normalizeAgentPayloadAliases,
        HEXAGRAM_ROBOTS: hexRobots,
        getWorkerByHex,
        ensureWorkerGateway,
        mountHexSkillsForProject: (nextProjectId, hexId, stateDir) => mountHexSkillsForProject(nextProjectId, hexId, stateDir, tenantId),
        checkHardLimit: (nextProjectId, estimatedUnits) => checkHardLimit(nextProjectId, estimatedUnits, tenantId),
        estimateAgentTaskUnits,
        recordUsageBilling: (billingPayload) => recordUsageBilling({ ...billingPayload, tenantId }),
        pushAutonomousProgress: (runId, progressPayload) => pushAutonomousProgress(runId, { ...progressPayload, tenantId }),
        processAutonomousAgentResult,
        callHexAgentWS: workerWsCall,
        AGENT_TASK_TIMEOUT_MS: timeoutMs,
        reportWorkerHealth,
        restartWorkerGateway,
      });

      const lastReply = task.reply;
      const lastError = task.error;
      const hex = hexRobots.find((item) => item.id === agentId);

      if (projectId && message && lastReply && !lastError && hex) {
        try {
          await chatHistoryService.appendAgentTaskHistory(projectId, message, lastReply, hex, tenantId);
        } catch (error) {
          console.warn('[agent-task] 保存历史失败:', error.message);
        }
      }

      if (!lastError && projectId && workflowId != null && workflowStepIndex != null && typeof onWorkflowStepDone === 'function') {
        onWorkflowStepDone(projectId, workflowId, workflowStepIndex + 1, tenantId);
      }
    } catch (error) {
      task.status = 'error';
      task.error = error.message || '执行失败';
      task.lastProgress = { at: Date.now(), stage: 'failed', message: task.error };
      task.progress = Array.isArray(task.progress) ? task.progress : [];
      task.progress.push(task.lastProgress);
      if (task.autonomousRunId) {
        pushAutonomousProgress(task.autonomousRunId, {
          stage: 'failed',
          message: task.error,
          agentId: task.hexId || task.agentId,
          taskId,
          tenantId: task.tenantId || 'public',
        });
      }
      if (task.autonomousRunId) await processAutonomousAgentResult(task);
    }
    return task;
  }

  return {
    getTask,
    submitTask,
    executeTask,
    dispatchAgentTaskRequest,
    dispatchAutonomousAgentStep,
    mountHexSkillsForProject,
  };
}

module.exports = {
  createAgentTaskService,
};
