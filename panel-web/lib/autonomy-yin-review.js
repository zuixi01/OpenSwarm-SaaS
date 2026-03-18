function createAutonomyYinReviewService(options) {
  const {
    hexRobots,
    countAutonomousAgentSteps,
    maxAgentRepeats,
    markAutonomousRun,
    dispatchAutonomousAgentStep,
    requestYinTask,
    getYinTask,
    parseAutonomousYinDecision,
  } = options;

  function buildAutonomousYinPrompt(run) {
    const steps = Array.isArray(run.steps) ? run.steps : [];
    const stepLines = steps.slice(-6).map((step, idx) => {
      const directive = step.directive || {};
      return [
        `${idx + 1}. ${step.agentName || step.agentId || '员工'}`,
        directive.status ? `状态=${directive.status}` : '',
        directive.handoffTo ? `下一棒=${directive.handoffTo}` : '',
        step.error ? `错误=${step.error}` : '',
        step.reply ? `回复=${String(step.reply).slice(0, 300)}` : '',
      ].filter(Boolean).join(' | ');
    });
    return `你正在仲裁一个“员工自治接力”项目任务。

项目ID：${run.projectId || '未知'}
运行ID：${run.id}
原始目标：${String(run.message || '').slice(0, 600)}

最近接力过程：
${stepLines.join('\n') || '暂无'}

请严格按以下格式给出仲裁：
决策：继续由某员工接力 / 需要用户澄清 / 终止任务
指定员工：DG-xx 或 无
理由：1-3 句话
行动项：
- ...

要求：简洁、可执行，不超过220字。`;
  }

  async function maybeContinueAutonomousRunAfterYinReview(run, decision) {
    if (!run || !decision) return;
    const normalized = String(decision.decision || '').replace(/\s+/g, '');
    if (!normalized) return;
    if (normalized.includes('需要用户澄清')) {
      run.events.push({ type: 'yin_review_waiting_user', at: Date.now(), reason: decision.reason || '' });
      return markAutonomousRun(run, { status: 'waiting_user' });
    }
    if (normalized.includes('终止任务')) {
      run.events.push({ type: 'yin_review_terminated', at: Date.now(), reason: decision.reason || '' });
      return markAutonomousRun(run, { status: 'terminated' });
    }
    if (!normalized.includes('继续由某员工接力')) return;

    const nextAgentId = decision.designatedAgentId;
    if (!nextAgentId || !hexRobots.some((robot) => robot.id === nextAgentId)) {
      run.events.push({ type: 'yin_review_invalid_agent', at: Date.now(), raw: decision.raw || '' });
      return markAutonomousRun(run, { status: 'waiting_user', lastError: '主控未指定有效员工，需用户介入' });
    }
    if (countAutonomousAgentSteps(run, nextAgentId) >= maxAgentRepeats) {
      run.events.push({ type: 'yin_review_agent_repeat_limit', at: Date.now(), agentId: nextAgentId });
      return markAutonomousRun(run, { status: 'waiting_user', lastError: `主控指定员工 ${nextAgentId} 已达到接力上限` });
    }
    const handoffMessage = decision.actions
      ? `主控仲裁后指定你继续接力。请按以下行动项执行：\n${decision.actions}`
      : '主控仲裁后指定你继续接力。请基于原始目标与最近接力记录继续推进任务。';
    await dispatchAutonomousAgentStep(run, nextAgentId, handoffMessage, {
      depth: (run.steps || []).length,
      fromAgentId: 'yin',
      sessionKey: 'main',
    });
    run.events.push({ type: 'yin_review_continued', at: Date.now(), agentId: nextAgentId });
    return markAutonomousRun(run, { status: 'running', currentAgentId: nextAgentId });
  }

  async function triggerYinReviewForAutonomousRun(run) {
    if (!run || !run.id) return;
    if (run.yinReview && (run.yinReview.status === 'running' || run.yinReview.status === 'done')) return;
    const prompt = buildAutonomousYinPrompt(run);
    run.events.push({ type: 'yin_review_requested', at: Date.now() });
    markAutonomousRun(run, { yinReview: { status: 'running', requestedAt: Date.now(), reply: '', error: '' } });
    try {
      const data = await requestYinTask({ message: prompt, projectId: run.projectId, history: [], tenantId: run.tenantId || 'public' });
      if (!data || !data.taskId) throw new Error(data && data.error ? data.error : '未返回 yin taskId');
      run.yinReview = { status: 'running', taskId: data.taskId, requestedAt: Date.now(), reply: '', error: '' };
      markAutonomousRun(run, { yinReview: run.yinReview });

      let attempts = 0;
      while (attempts < 80) {
        attempts += 1;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const task = getYinTask(data.taskId);
        if (!task) continue;
        if (task.status === 'done') {
          const decision = parseAutonomousYinDecision(task.reply || '');
          run.events.push({ type: 'yin_review_completed', at: Date.now() });
          markAutonomousRun(run, {
            yinReview: {
              status: 'done',
              taskId: data.taskId,
              requestedAt: run.yinReview.requestedAt,
              reply: task.reply || '',
              error: '',
              decision,
            },
          });
          await maybeContinueAutonomousRunAfterYinReview(run, decision);
          return;
        }
        if (task.status === 'error') {
          run.events.push({ type: 'yin_review_failed', at: Date.now(), error: task.error || '未知错误' });
          return markAutonomousRun(run, {
            yinReview: {
              status: 'error',
              taskId: data.taskId,
              requestedAt: run.yinReview.requestedAt,
              reply: '',
              error: task.error || '未知错误',
            },
          });
        }
      }
      run.events.push({ type: 'yin_review_timeout', at: Date.now() });
      return markAutonomousRun(run, {
        yinReview: {
          status: 'error',
          taskId: data.taskId,
          requestedAt: run.yinReview.requestedAt,
          reply: '',
          error: '等待主控仲裁超时',
        },
      });
    } catch (e) {
      run.events.push({ type: 'yin_review_failed', at: Date.now(), error: e.message || '主控仲裁失败' });
      return markAutonomousRun(run, {
        yinReview: {
          status: 'error',
          requestedAt: Date.now(),
          reply: '',
          error: e.message || '主控仲裁失败',
        },
      });
    }
  }

  return {
    buildAutonomousYinPrompt,
    maybeContinueAutonomousRunAfterYinReview,
    triggerYinReviewForAutonomousRun,
  };
}

module.exports = {
  createAutonomyYinReviewService,
};
