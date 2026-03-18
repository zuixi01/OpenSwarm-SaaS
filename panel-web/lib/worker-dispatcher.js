async function runAgentTask(task, body, deps) {
  const {
    normalizeAgentPayloadAliases,
    HEXAGRAM_ROBOTS,
    getWorkerByHex,
    ensureWorkerGateway,
    mountHexSkillsForProject,
    checkHardLimit,
    estimateAgentTaskUnits,
    recordUsageBilling,
    pushAutonomousProgress,
    processAutonomousAgentResult,
    callHexAgentWS,
    AGENT_TASK_TIMEOUT_MS,
    reportWorkerHealth,
    restartWorkerGateway,
  } = deps;

  const payload = normalizeAgentPayloadAliases(body || {});
  const agentId = payload.hexId || payload.agentId;
  const { message, projectId, sessionKey, autonomousRunId, autonomousDepth, autonomousFromAgentId, tenantId } = payload;
  if (!agentId || !message) {
    task.status = 'error';
    task.error = '缺少 agentId(hexId) 或 message';
    return;
  }

  const hex = HEXAGRAM_ROBOTS.find((h) => h.id === agentId);
  const worker = hex ? await ensureWorkerGateway(agentId, payload.tenantId || 'public') : null;
  if (!hex || !worker) {
    task.status = 'error';
    task.error = '未找到该员工';
    return;
  }

  const port = parseInt(worker.port, 10);
  const token = worker.token || '';
  const stateDir = worker.stateDir || '';
  task.hexName = hex.name;
  task.agentName = hex.name;
  task.agentId = agentId;
  task.hexId = agentId;
  task.projectId = projectId || '';
  task.tenantId = tenantId || 'public';
  task.sessionKey = sessionKey || 'main';
  task.message = String(message || '');
  task.autonomousRunId = autonomousRunId || null;
  task.autonomousDepth = Number.isFinite(Number(autonomousDepth)) ? Number(autonomousDepth) : null;
  task.autonomousFromAgentId = autonomousFromAgentId || null;

  const reportTaskProgress = ({ stage, message: progressMessage }) => {
    const entry = { at: Date.now(), stage: String(stage || 'running'), message: String(progressMessage || '') };
    task.lastProgress = entry;
    task.progress.push(entry);
    while (task.progress.length > 30) task.progress.shift();
    if (task.autonomousRunId) {
      pushAutonomousProgress(task.autonomousRunId, {
        stage: entry.stage,
        message: entry.message,
        agentId,
        taskId: task.id,
      });
    }
  };
  reportTaskProgress({ stage: 'queued', message: '任务已入队，准备连接员工执行环境' });

  const preflightBilling = checkHardLimit(projectId, estimateAgentTaskUnits({
    inputChars: String(message || '').length,
    outputChars: 0,
    hasError: false,
  }));
  if (!preflightBilling.ok) {
    task.status = 'error';
    task.error = preflightBilling.error || '项目预算不足，无法执行';
    return;
  }

  const mountedSkillIds = mountHexSkillsForProject(projectId, agentId, stateDir) || [];
  task.mountedSkillIds = mountedSkillIds;

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;
  let lastReply = null;
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    reportTaskProgress({ stage: 'attempt', message: `开始第 ${attempt}/${MAX_RETRIES} 次执行尝试` });
    const startedAt = Date.now();
    let result = await callHexAgentWS({
      port,
      token,
      message,
      sessionKey,
      stateDir,
      timeoutMs: AGENT_TASK_TIMEOUT_MS,
      onProgress: reportTaskProgress,
    });
    if (result && result.error === '__RETRY_WITHOUT_DEVICE_SIGNATURE__') {
      reportTaskProgress({ stage: 'retry_unsigned', message: '签名设备握手失败，正在切换兼容模式重试' });
      result = await callHexAgentWS({
        port,
        token,
        message,
        sessionKey,
        stateDir,
        timeoutMs: AGENT_TASK_TIMEOUT_MS,
        disableDeviceSignature: true,
        onProgress: reportTaskProgress,
      });
    }
    lastReply = result.reply;
    lastError = result.error;
    if (!lastError) {
      if (typeof reportWorkerHealth === 'function') {
        reportWorkerHealth(tenantId, agentId, { ok: true, latencyMs: Date.now() - startedAt });
      }
      break;
    }
    if (typeof reportWorkerHealth === 'function') {
      reportWorkerHealth(tenantId, agentId, {
        ok: false,
        error: lastError,
        code: /超时/.test(String(lastError)) ? 'TASK_TIMEOUT' : (/连接|WS/.test(String(lastError)) ? 'UNREACHABLE' : 'TASK_FAILED'),
        latencyMs: Date.now() - startedAt,
      });
    }
    if (attempt < MAX_RETRIES && typeof restartWorkerGateway === 'function' && /超时|连接|WS|fetch/i.test(String(lastError))) {
      try {
        reportTaskProgress({ stage: 'recovering', message: '检测到员工响应异常，正在自动重启后重试' });
        // eslint-disable-next-line no-await-in-loop
        await restartWorkerGateway(agentId, tenantId);
      } catch (_) {}
    }
    if (attempt < MAX_RETRIES) {
      reportTaskProgress({ stage: 'retry_wait', message: `本次尝试失败：${lastError}，${Math.floor(RETRY_DELAY_MS / 1000)} 秒后重试` });
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  task.reply = lastReply;
  task.error = lastError;
  task.status = lastError ? 'error' : 'done';
  reportTaskProgress({ stage: lastError ? 'failed' : 'done', message: lastError ? `执行失败：${lastError}` : '执行完成，已写入最终结果' });

  if (projectId) {
    try {
      const outputChars = String(lastReply || lastError || '').length;
      const bill = recordUsageBilling({
        projectId,
        source: 'agent.task',
        taskId: task.id,
        units: estimateAgentTaskUnits({
          inputChars: String(message || '').length,
          outputChars,
          hasError: !!lastError,
        }),
        inputChars: String(message || '').length,
        outputChars,
        meta: { agentId, hasError: !!lastError },
      });
      if (bill && bill.event) {
        task.billing = {
          units: bill.event.units,
          amountCents: bill.event.amountCents,
          grossAmountCents: bill.event.grossAmountCents,
        };
      }
    } catch (e) {
      console.warn('[billing][agent.task]', e.message);
    }
  }

  if (task.autonomousRunId) {
    await processAutonomousAgentResult(task);
  }
}

module.exports = {
  runAgentTask,
};
