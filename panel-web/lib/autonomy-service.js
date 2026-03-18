const { randomUUID } = require('crypto');

function countAutonomousAgentSteps(run, agentId) {
  return (run.steps || []).filter((step) => step.agentId === agentId).length;
}

function createAutonomyService(options) {
  const {
    store,
    parser,
    hexRobots,
    maxSteps,
    maxAgentRepeats,
    parseMentionedHexIds,
    dispatchAutonomousAgentStep,
    triggerYinReviewForAutonomousRun,
  } = options;

  function buildAutonomousPrompt(message, context = {}) {
    const userMessage = String(message || '').trim();
    const projectId = String(context.projectId || '').trim();
    const skillIds = Array.isArray(context.skillIds) ? context.skillIds.filter(Boolean) : [];
    const skillHint = skillIds.length
      ? `本轮已挂载项目 skills：${skillIds.join('、')}。请优先调用这些 skills 或相关工具完成任务动作，而不是只口头描述计划。`
      : '本轮未挂载项目专用 skills，如需执行请优先使用可用工具链完成实际动作。';
    return `${userMessage}

你正在参与一个“员工自治接力”任务。你必须真的执行任务，并且在结束前输出一段最终总结。不要只调用工具后结束，不要只写文件路径，不要省略最终回复。
如果你是首位执行员工，先直接做任务，不要先介绍自己的岗位职责，不要先复述团队分工。
${skillHint}
你的最终回复必须严格分为两部分：
1. 先用 3-8 行中文说明你做了什么、产出了什么、是否需要下一位员工接力。
2. 再在回复末尾输出一个完整结构化区块，必须放在 <autonomy_result> 标签内，优先使用 JSON。

格式示例：
\`\`\`text
我已经完成了需求草案，并写入 workspace/output/p1/prd.md。
下一步需要产品经理继续细化排期和里程碑。

<autonomy_result>
\`\`\`json
{"status":"handoff","artifacts":["workspace/output/p1/file.md"],"handoff_to":"DG-02","handoff_message":"请基于该文件继续执行下一步","needs_yin":false,"task_done":false}
\`\`\`
</autonomy_result>
\`\`\`

规则：
1. 若你已完成整体任务，设置 status=completed 且 task_done=true。
2. 若需要另一位员工接力，设置 status=handoff，并提供 handoff_to 与 handoff_message。
3. 若卡住或需要管理决策，设置 status=blocked 或 needs_yin=true。
4. artifacts 填你产出的文件路径。
5. handoff_to 只写数字员工标签，如 DG-02。
6. 若没有任何产出、没有文本总结、没有 <autonomy_result> 结构化区块，都视为任务未完成。
7. 不得静默改写用户要求的年份、季度、地区、品类、文件类型。若找不到对应年份/季度的可信数据，必须明确说明“未找到该时间范围的可靠数据”，不能用别的年份冒充。
8. 若你在回复中声称写入了文件，artifacts 中必须列出该文件，且文件必须真实存在于 workspace/output/${projectId || '<projectId>'}/ 或其子目录。
9. 若任务要求“分析报告/调研报告/销售报告”，首棒员工必须先完成实际分析并产出报告文件，再决定是否交接给下一位员工。`;
  }

  function createAutonomousTaskRun({ projectId, initialAgentId, message, createdBy, tenantId = 'public' }) {
    const runId = `autorun_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const run = {
      id: runId,
      projectId: projectId || '',
      initialAgentId,
      createdBy: createdBy || 'user',
      tenantId,
      status: 'running',
      message: String(message || ''),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      currentAgentId: initialAgentId,
      steps: [],
      artifacts: [],
      events: [{
        type: 'run_started',
        at: Date.now(),
        agentId: initialAgentId,
        message: String(message || '')
      }]
    };
    return store.set(run);
  }

  function buildSyntheticAutonomousTaskFromDiscussReply(runId, projectId, result, seedMessage) {
    return {
      id: `discuss_${Date.now()}_${randomUUID().slice(0, 6)}`,
      status: 'done',
      reply: String(result.reply || ''),
      error: result.error || null,
      hexName: result.name || result.hexId,
      agentName: result.name || result.hexId,
      agentId: result.hexId,
      hexId: result.hexId,
      projectId: projectId || '',
      sessionKey: 'main',
      autonomousRunId: runId,
      createdAt: Date.now(),
      source: 'agent.chat',
      seedMessage: seedMessage || ''
    };
  }

  async function maybePromoteDiscussRepliesToAutonomy({ projectId, message, results, broadcast, tenantId = 'public' }) {
    if (!projectId || !broadcast || !Array.isArray(results) || results.length === 0) return;
    const candidates = results
      .filter((result) => result && result.reply)
      .map((result) => ({ result, directive: parser.parseAutonomousDirective(result.reply) }))
      .filter(({ directive }) => directive.handoffTo || directive.taskDone || directive.needsYin || directive.status === 'blocked' || directive.status === 'completed');

    if (candidates.length !== 1) {
      const activeRun = store.getActiveForProject(projectId, tenantId);
      if (activeRun && candidates.length > 1) {
        activeRun.events.push({
          type: 'discuss_autonomy_ambiguous',
          at: Date.now(),
          message: '群聊中出现多个自治候选，未自动接续',
          candidates: candidates.map((c) => ({ agentId: c.result.hexId, status: c.directive.status || '', handoffTo: c.directive.handoffTo || null }))
        });
        store.mark(activeRun, {});
      }
      return;
    }

    const candidate = candidates[0];
    let run = store.getActiveForProject(projectId, tenantId);
    if (!run) {
      run = createAutonomousTaskRun({
        projectId,
        initialAgentId: candidate.result.hexId,
        message: String(message || ''),
        createdBy: 'discuss',
        tenantId,
      });
      run.events.push({
        type: 'promoted_from_discuss',
        at: Date.now(),
        agentId: candidate.result.hexId,
        message: String(message || '').slice(0, 500)
      });
      store.mark(run, { status: 'running', currentAgentId: candidate.result.hexId });
    } else {
      run.events.push({
        type: 'continued_from_discuss',
        at: Date.now(),
        agentId: candidate.result.hexId,
        message: String(message || '').slice(0, 500)
      });
      store.mark(run, {});
    }

    const syntheticTask = buildSyntheticAutonomousTaskFromDiscussReply(run.id, projectId, candidate.result, message);
    await processAutonomousAgentResult(syntheticTask);
  }

  function pushAutonomousProgress(runId, payload = {}) {
    const run = store.get(runId, payload.tenantId || 'public');
    if (!run) return;
    const progress = {
      at: Date.now(),
      stage: String(payload.stage || '').trim() || 'running',
      message: String(payload.message || '').trim(),
      agentId: payload.agentId || run.currentAgentId || null,
      taskId: payload.taskId || null,
    };
    run.live = progress;
    run.events.push({
      type: 'step_progress',
      at: progress.at,
      stage: progress.stage,
      message: progress.message,
      agentId: progress.agentId,
      taskId: progress.taskId
    });
    while (run.events.length > 200) run.events.shift();
    store.set(run);
  }

  async function resumeAutonomousRun(run, agentId, message, meta = {}) {
    if (!run || !run.id) throw new Error('run 不存在');
    if (!agentId || !hexRobots.some((robot) => robot.id === agentId)) throw new Error('无效的员工 ID');
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) throw new Error('缺少可执行的任务指令');
    run.events.push({
      type: meta.eventType || 'manual_resume',
      at: Date.now(),
      agentId,
      fromAgentId: meta.fromAgentId || null,
      stepIndex: Number.isInteger(meta.stepIndex) ? meta.stepIndex : null,
      reason: meta.reason || '',
      message: normalizedMessage
    });
    store.mark(run, { status: 'running', currentAgentId: agentId, lastError: '' });
    await dispatchAutonomousAgentStep(run, agentId, normalizedMessage, {
      depth: (run.steps || []).length,
      fromAgentId: meta.fromAgentId || null,
      sessionKey: meta.sessionKey || 'main'
    });
  }

  async function processAutonomousAgentResult(task) {
    const run = store.get(task.autonomousRunId, task.tenantId || 'public');
    if (!run || run.status === 'completed' || run.status === 'failed' || run.status === 'needs_yin') return;

    const agentId = task.hexId || task.agentId;
    const reply = String(task.reply || '');
    const directive = parser.parseAutonomousDirective(reply);
    const step = {
      taskId: task.id || null,
      at: Date.now(),
      agentId,
      agentName: task.hexName || task.agentName || agentId,
      message: String(task.message || task.seedMessage || ''),
      reply,
      error: task.error || null,
      directive,
    };
    run.steps.push(step);
    run.live = null;
    if (directive.artifacts && directive.artifacts.length) {
      directive.artifacts.forEach((artifact) => {
        if (!run.artifacts.includes(artifact)) run.artifacts.push(artifact);
      });
    }

    if (task.error) {
      run.status = 'failed';
      run.events.push({ type: 'step_failed', at: Date.now(), agentId, error: task.error });
      return store.mark(run, { currentAgentId: agentId, lastError: task.error });
    }

    run.events.push({
      type: 'step_completed',
      at: Date.now(),
      agentId,
      status: directive.status || 'unstructured',
      handoffTo: directive.handoffTo || null
    });

    if (directive.taskDone || directive.status === 'completed') {
      return store.mark(run, { status: 'completed', currentAgentId: agentId });
    }
    if (directive.needsYin || directive.status === 'needs_yin' || directive.status === 'blocked') {
      store.mark(run, { status: 'needs_yin', currentAgentId: agentId });
      triggerYinReviewForAutonomousRun(run).catch((e) => console.warn('[autonomy][yin-review]', e.message));
      return;
    }

    const nextAgentId = directive.handoffTo;
    const canHandoff = nextAgentId && hexRobots.some((robot) => robot.id === nextAgentId);
    const currentStepCount = (run.steps || []).length;
    if (!canHandoff) {
      store.mark(run, { status: 'needs_yin', currentAgentId: agentId, lastError: '未产生有效接力目标' });
      triggerYinReviewForAutonomousRun(run).catch((e) => console.warn('[autonomy][yin-review]', e.message));
      return;
    }
    if (currentStepCount >= maxSteps) {
      store.mark(run, { status: 'needs_yin', currentAgentId: agentId, lastError: '超过最大接力步数' });
      triggerYinReviewForAutonomousRun(run).catch((e) => console.warn('[autonomy][yin-review]', e.message));
      return;
    }
    if (countAutonomousAgentSteps(run, nextAgentId) >= maxAgentRepeats) {
      store.mark(run, { status: 'needs_yin', currentAgentId: agentId, lastError: `员工 ${nextAgentId} 接力次数过多` });
      triggerYinReviewForAutonomousRun(run).catch((e) => console.warn('[autonomy][yin-review]', e.message));
      return;
    }

    const handoffMessage = directive.handoffMessage || `请接手继续处理当前项目任务。上一位员工 ${step.agentName} 已完成其部分，请查看其回复和产出后继续执行。`;
    try {
      await dispatchAutonomousAgentStep(run, nextAgentId, handoffMessage, {
        depth: currentStepCount,
        fromAgentId: agentId,
        sessionKey: task.sessionKey || 'main'
      });
      return store.mark(run, { status: 'running', currentAgentId: nextAgentId });
    } catch (e) {
      return store.mark(run, { status: 'failed', currentAgentId: agentId, lastError: e.message || '自动接力派发失败' });
    }
  }

  function parseAutonomousYinDecision(text) {
    const reply = String(text || '').trim();
    const result = {
      raw: reply,
      decision: '',
      designatedAgentId: null,
      reason: '',
      actions: ''
    };
    if (!reply) return result;
    const lines = reply.split('\n');
    let current = null;
    let buffer = [];
    lines.forEach((line) => {
      let m = line.match(/^决策[：:]\s*(.+)$/);
      if (m) {
        result.decision = String(m[1]).trim();
        current = null;
        return;
      }
      m = line.match(/^指定员工[：:]\s*(.+)$/);
      if (m) {
        const parsed = parseMentionedHexIds('@' + String(m[1]).trim());
        result.designatedAgentId = parsed[0] || null;
        current = null;
        return;
      }
      m = line.match(/^理由[：:]\s*(.*)$/);
      if (m) {
        buffer = [String(m[1]).trim()];
        current = 'reason';
        return;
      }
      m = line.match(/^行动项[：:]\s*(.*)$/);
      if (m) {
        if (current === 'reason') result.reason = buffer.join('\n').trim();
        buffer = [String(m[1]).trim()];
        current = 'actions';
        return;
      }
      if (current) buffer.push(line);
    });
    if (current === 'reason') result.reason = buffer.join('\n').trim();
    if (current === 'actions') result.actions = buffer.join('\n').trim();
    return result;
  }

  return {
    buildAutonomousPrompt,
    createAutonomousTaskRun,
    maybePromoteDiscussRepliesToAutonomy,
    pushAutonomousProgress,
    resumeAutonomousRun,
    processAutonomousAgentResult,
    parseAutonomousYinDecision,
  };
}

module.exports = {
  createAutonomyService,
  countAutonomousAgentSteps,
};
