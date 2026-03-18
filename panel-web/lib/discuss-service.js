const fs = require('fs');

function createDiscussService(options) {
  const {
    hexRobots,
    getWorkerByHex,
    ensureWorkerGateway,
    checkHardLimit,
    estimateAgentChatUnits,
    recordUsageBilling,
    readProjects,
    readHexDefinitionConfig,
    readProjectMemory,
    formatHexNameWithLabel,
    resolveAgentDisplayName,
    readAgentDefinition,
    maybePromoteDiscussRepliesToAutonomy,
    parseMentionedHexIds,
    getHexDefinitionProjectId,
    reportWorkerHealth,
    restartWorkerGateway,
  } = options;

  const HEX_FETCH_TIMEOUT_MS = 45000;
  const DISCUSS_TASK_MAX_MS = 90000;
  const taskStore = new Map();
  const taskFile = options.taskFile;

  function hexFetchSignal() {
    return AbortSignal.timeout ? AbortSignal.timeout(HEX_FETCH_TIMEOUT_MS) : undefined;
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          const err = new Error(`timeout after ${ms}ms`);
          err.code = 'HEX_FETCH_TIMEOUT';
          reject(err);
        }, ms);
      }),
    ]);
  }

  function loadTasks() {
    try {
      if (!taskFile || !fs.existsSync(taskFile)) return;
      const raw = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
      const cutoff = Date.now() - 600000;
      for (const [id, task] of Object.entries(raw)) {
        if (task.status === 'running' && task.createdAt < cutoff) {
          task.status = 'expired';
          task.error = '服务重启后任务超时';
        }
        taskStore.set(id, task);
      }
      console.log(`[hex-tasks] 加载 ${taskStore.size} 个历史任务`);
    } catch (e) {
      console.warn('[hex-tasks] 加载失败:', e.message);
    }
  }

  function saveTasks() {
    try {
      const obj = {};
      for (const [id, task] of taskStore.entries()) obj[id] = task;
      fs.writeFileSync(taskFile, JSON.stringify(obj), 'utf8');
    } catch (e) {
      console.warn('[hex-tasks] 保存失败:', e.message);
    }
  }

  function cleanupExpiredTasks() {
    const cutoff = Date.now() - 3600000;
    let changed = false;
    for (const [id, task] of taskStore.entries()) {
      if (task.createdAt < cutoff) {
        taskStore.delete(id);
        changed = true;
      }
    }
    if (changed) saveTasks();
  }

  function getTask(taskId) {
    return taskStore.get(taskId) || null;
  }

  async function buildProjectSystemMessage(projectId, tenantId = 'public') {
    if (!projectId) return null;
    try {
      if (projectId === getHexDefinitionProjectId()) {
        const hexDef = readHexDefinitionConfig(tenantId);
        const hexNamesWithLabels = (hexDef.hexIds || []).map((id) => formatHexNameWithLabel(id)).join('、');
        return {
          role: 'system',
          content: `当前是「员工自定义」场景，参与员工：${hexNamesWithLabels || '无'}。你可通过写入 workspace/我的定义.md 来更新自己的人设（角色、擅长、边界等）。与用户或其它员工讨论后，若达成共识即可写入该文件。产出文件时请在回复中写明完整路径。`
        };
      }
      const proj = readProjects(tenantId).find((p) => p.id === projectId);
      if (!proj) return null;
      const hexNamesWithLabels = (proj.hexIds || []).map((id) => formatHexNameWithLabel(id)).join('、');
      let memoryText = '';
      try {
        const mem = await readProjectMemory(projectId, tenantId);
        if (mem.entries && mem.entries.length > 0) {
          const recent = mem.entries.slice(-20);
          memoryText = '\n\n项目记忆（按时间）：\n' + recent.map((e) => `- ${e.date} [${e.type}] ${e.content}`).join('\n') + '\n\n此处为面板对话，项目记忆优先于你本地工作区记忆，若有冲突以项目记忆为准。';
        }
      } catch (_) {}
      return {
        role: 'system',
        content: `当前项目上下文：项目名称"${proj.name}"，项目ID "${projectId}"，参与员工：${hexNamesWithLabels || '无'}。你是该项目的参与者，请围绕项目背景作答。\n\n【产出路径】凡需产出文件，请写入 workspace/output/${projectId}/ 目录，并在回复中写明完整路径（如 workspace/output/${projectId}/文件名.md）。${memoryText}`
      };
    } catch (_) {
      return null;
    }
  }

  function buildRosterSummary(hexIds = []) {
    const ids = Array.isArray(hexIds) ? hexIds.filter(Boolean) : [];
    if (!ids.length) return '无';
    return ids.map((id) => {
      const display = typeof resolveAgentDisplayName === 'function' ? resolveAgentDisplayName(id) : '';
      const hex = hexRobots.find((item) => item.id === id);
      const fallback = hex ? hex.name : id;
      return `${display || fallback}(${id})`;
    }).join('、');
  }

  function buildAgentIdentitySystemMessage(hexId, participantHexIds = [], tenantId = 'public') {
    const hex = hexRobots.find((item) => item.id === hexId);
    const roleName = (typeof resolveAgentDisplayName === 'function' ? resolveAgentDisplayName(hexId) : '') || hex?.name || hexId;
    const teammateSummary = buildRosterSummary(participantHexIds);
    const definition = typeof readAgentDefinition === 'function' ? String(readAgentDefinition(hexId, tenantId) || '').trim() : '';
    const definitionSnippet = definition ? `\n\n【你的自定义职责说明】\n${definition.slice(0, 1200)}` : '';
    return {
      role: 'system',
      content:
        `你当前扮演的唯一员工身份是「${roleName}」(员工ID: ${hexId})。\n`
        + `你只能以这个身份发言，不能自称为其它员工、其它岗位或其它职责，即使用户@了别人、其它员工说错了、或上下文里出现其它岗位描述，也不能冒充。\n`
        + `如果任务更适合其它员工，请明确说明“我当前是${roleName}，我从${roleName}的职责视角补充如下”，或建议由对应员工处理。\n`
        + `当前团队成员职责表：${teammateSummary}。请始终区分你自己与其他员工。`
        + definitionSnippet,
    };
  }

  function buildMessages(projectSystemMsg, baseHistory) {
    const msgs = [];
    if (projectSystemMsg) msgs.push(projectSystemMsg);
    const MAX_CHARS = 60000;
    const KEEP_RECENT = 10;
    const COMPRESS_THRESHOLD = 30;
    const totalChars = baseHistory.reduce((sum, h) => sum + String(h.message || '').length, 0);
    const needCompress = baseHistory.length > COMPRESS_THRESHOLD || totalChars > MAX_CHARS;

    if (needCompress) {
      let recentPart = baseHistory.slice(-KEEP_RECENT);
      let recentChars = recentPart.reduce((sum, h) => sum + String(h.message || '').length, 0);
      let extra = baseHistory.slice(0, baseHistory.length - KEEP_RECENT);
      while (extra.length > 0 && recentChars + String(extra[extra.length - 1].message || '').length < MAX_CHARS * 0.7) {
        const item = extra.pop();
        recentPart = [item, ...recentPart];
        recentChars += String(item.message || '').length;
      }
      const summaryLines = extra.map((h) => {
        const type = h.type || 'user';
        const msg = String(h.message || '').slice(0, 80);
        if (type === 'user') return `用户: ${msg}`;
        if (type === 'hex' && h.name) return `${h.name}: ${msg}`;
        return null;
      }).filter(Boolean);
      if (summaryLines.length > 0) {
        msgs.push({ role: 'system', content: `【历史对话摘要（共${extra.length}条，已压缩）】\n${summaryLines.join('\n')}\n\n以下是最近的对话：` });
      }
      for (const h of recentPart) {
        const type = h.type || 'user';
        const msg = String(h.message || '');
        if (!msg) continue;
        if (type === 'user') msgs.push({ role: 'user', content: msg });
        else if (type === 'hex' && h.name) msgs.push({ role: 'assistant', content: `${h.name}: ${msg}` });
      }
    } else {
      for (const h of baseHistory.slice(-20)) {
        const type = h.type || 'user';
        const msg = String(h.message || '');
        if (!msg) continue;
        if (type === 'user') msgs.push({ role: 'user', content: msg });
        else if (type === 'hex' && h.name) msgs.push({ role: 'assistant', content: `${h.name}: ${msg}` });
      }
    }
    return msgs;
  }

  function resolveProjectHexIds(projectId, tenantId = 'public') {
    if (!projectId) return [];
    try {
      if (projectId === getHexDefinitionProjectId()) {
        const hexDef = readHexDefinitionConfig(tenantId);
        return Array.isArray(hexDef?.hexIds) ? hexDef.hexIds.filter(Boolean) : [];
      }
      const proj = readProjects(tenantId).find((p) => p.id === projectId);
      if (!proj) return [];
      const ids = proj.agentIds || proj.hexIds || [];
      return Array.isArray(ids) ? ids.filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }

  async function callHexChat({ hexId, messages, tenantId = 'public', onProgress = null }) {
    const hex = hexRobots.find((h) => h.id === hexId);
    let worker = hex ? await ensureWorkerGateway(hexId, tenantId) : null;
    const name = (typeof resolveAgentDisplayName === 'function' ? resolveAgentDisplayName(hexId) : '') || (hex ? hex.name : hexId);
    if (!worker || !parseInt(worker.port, 10)) return { hexId, name, reply: null, error: '无此员工或未配置端口' };

    async function doFetch(activeWorker) {
      const port = activeWorker ? parseInt(activeWorker.port, 10) : null;
      const token = activeWorker && activeWorker.token ? activeWorker.token : '';
      const url = `http://127.0.0.1:${port}/v1/chat/completions`;
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const startedAt = Date.now();
      try {
        const response = await withTimeout(fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ model: 'openclaw', messages, stream: true }),
          signal: hexFetchSignal(),
        }), HEX_FETCH_TIMEOUT_MS + 2000);
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          let errMsg = data.error?.message || data.message || `HTTP ${response.status}`;
          if (response.status === 429) errMsg = '智谱 API 限流(429)，请稍后重试';
          else if (response.status === 403) errMsg = 'API Key 无效或配额不足';
          else if (response.status >= 500) errMsg = `上游服务异常(${response.status})，请稍后重试`;
          return { reply: null, error: errMsg, code: `HTTP_${response.status}`, latencyMs: Date.now() - startedAt };
        }
        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (!contentType.includes('text/event-stream') || !response.body || typeof response.body.getReader !== 'function') {
          const data = await response.json().catch(() => ({}));
          const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
            ? String(data.choices[0].message.content)
            : '';
          if (typeof onProgress === 'function' && reply) onProgress(reply);
          return { reply, error: null, code: null, latencyMs: Date.now() - startedAt };
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let reply = '';

        function consumeEventBlock(block) {
          const lines = String(block || '').split('\n');
          const dataLines = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim());
          if (!dataLines.length) return false;
          const payload = dataLines.join('\n');
          if (!payload || payload === '[DONE]') return payload === '[DONE]';
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed && parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
            const chunk = delta && typeof delta.content === 'string' ? delta.content : '';
            if (chunk) {
              reply += chunk;
              if (typeof onProgress === 'function') onProgress(reply);
            }
          } catch (_) {}
          return false;
        }

        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() || '';
          let sawDone = false;
          for (const block of blocks) {
            if (consumeEventBlock(block)) {
              sawDone = true;
              break;
            }
          }
          if (done || sawDone) {
            if (buffer.trim()) consumeEventBlock(buffer);
            break;
          }
        }

        return { reply, error: null, code: null, latencyMs: Date.now() - startedAt };
      } catch (err) {
        const code = err.cause?.code || err.code;
        const msg = err.message || '';
        let hint = msg;
        if (err.name === 'TimeoutError' || code === 'ABORT_ERR' || code === 'HEX_FETCH_TIMEOUT') {
          hint = `响应超时（>${HEX_FETCH_TIMEOUT_MS / 1000}s）：员工进程可能卡住，系统将尝试自动恢复。`;
        } else if (code === 'ECONNREFUSED' || msg === 'fetch failed') {
          hint = '连接被拒绝：员工网关当前不可用，系统将尝试自动重启。';
        }
        return { reply: null, error: hint, code: code || err.name || 'REQUEST_FAILED', latencyMs: Date.now() - startedAt };
      }
    }

    let result = await doFetch(worker);
    if (!result.error) {
      if (typeof reportWorkerHealth === 'function') reportWorkerHealth(tenantId, hexId, { ok: true, latencyMs: result.latencyMs });
      return { hexId, name, reply: result.reply, error: null };
    }

    const shouldAutoRecover = typeof restartWorkerGateway === 'function'
      && /超时|连接被拒绝|不可用/i.test(String(result.error || ''));
    if (typeof reportWorkerHealth === 'function') {
      reportWorkerHealth(tenantId, hexId, { ok: false, error: result.error, code: result.code, latencyMs: result.latencyMs });
    }
    if (shouldAutoRecover) {
      try {
        await restartWorkerGateway(hexId, tenantId);
        worker = await ensureWorkerGateway(hexId, tenantId);
        const retried = await doFetch(worker);
        if (!retried.error) {
          if (typeof reportWorkerHealth === 'function') reportWorkerHealth(tenantId, hexId, { ok: true, latencyMs: retried.latencyMs });
          return { hexId, name, reply: retried.reply, error: null };
        }
        if (typeof reportWorkerHealth === 'function') {
          reportWorkerHealth(tenantId, hexId, { ok: false, error: retried.error, code: retried.code, latencyMs: retried.latencyMs });
        }
        return { hexId, name, reply: null, error: `${retried.error}（系统已自动重启 1 次）` };
      } catch (_) {
        return { hexId, name, reply: null, error: `${result.error}（自动重启失败）` };
      }
    }
    return { hexId, name, reply: null, error: result.error };
  }

  function markTaskDone(task, { results, error = null, warning = null }) {
    task.replies = Array.isArray(results) ? results : [];
    task.status = 'done';
    task.error = error;
    if (warning) task.warning = warning;
    task.updatedAt = Date.now();
    saveTasks();
  }

  function snapshotOrderedResults(hexIds, resultsById) {
    return hexIds
      .map((hexId) => resultsById.get(hexId))
      .filter(Boolean)
      .map((item) => ({ ...item }));
  }

  function updateRunningTaskResults(task, hexIds, resultsById) {
    task.replies = snapshotOrderedResults(hexIds, resultsById);
    task.updatedAt = Date.now();
    saveTasks();
  }

  async function executeChatTask(taskId, body, deps = {}) {
    const task = taskStore.get(taskId);
    if (!task) return;
    const startedAt = Date.now();
    try {
      const { message, hexIds, history, enableBroadcast, maxRounds, projectId } = body || {};
      const tenantId = deps.tenantId || body?.tenantId || 'public';
      const text = (message != null ? String(message) : '').trim();
      const ids = Array.isArray(hexIds) ? hexIds : [];
      const hist = Array.isArray(history) ? history : [];
      const broadcast = enableBroadcast === true;
      const rounds = Math.min(Math.max(parseInt(maxRounds, 10) || 2, 1), 5);
      if (!text) {
        markTaskDone(task, { results: [] });
        return;
      }
      const configuredProjectHexIds = resolveProjectHexIds(projectId, tenantId);
      const projectHexIds = ids.length
        ? ids
        : (configuredProjectHexIds.length ? configuredProjectHexIds : hexRobots.map((h) => h.id));
      const mentioned = parseMentionedHexIds(text);
      const hexList = mentioned.length > 0 ? projectHexIds.filter((id) => mentioned.includes(id)) : projectHexIds;
      const preflightBilling = checkHardLimit(projectId, estimateAgentChatUnits({
        inputChars: text.length,
        outputChars: 0,
        agentCount: Math.max(1, hexList.length),
        rounds,
        broadcast,
      }), tenantId);
      if (!preflightBilling.ok) {
        task.status = 'error';
        task.error = preflightBilling.error || '项目预算不足，无法执行';
        task.updatedAt = Date.now();
        saveTasks();
        return;
      }

      const projectSystemMsg = await buildProjectSystemMessage(projectId, tenantId);
      const firstRoundHistory = broadcast ? hist : hist.filter((h) => String(h && h.type) === 'user');
      const baseMessages = buildMessages(projectSystemMsg, firstRoundHistory);
      baseMessages.push({ role: 'user', content: text });

      const resultsById = new Map();
      const liveFlushAt = new Map();
      function pushLiveReply(hexId, nextReply) {
        const existing = resultsById.get(hexId) || {
          hexId,
          name: (typeof resolveAgentDisplayName === 'function' ? resolveAgentDisplayName(hexId) : '') || hexId,
          reply: '',
          error: null,
        };
        existing.reply = String(nextReply || '');
        existing.error = null;
        resultsById.set(hexId, existing);
        const now = Date.now();
        const last = liveFlushAt.get(hexId) || 0;
        if (now - last >= 250 || existing.reply.length < 32) {
          liveFlushAt.set(hexId, now);
          updateRunningTaskResults(task, hexList, resultsById);
        }
      }
      const hexReplies = new Map();
      await Promise.all(hexList.map(async (hexId) => {
        const identityMsg = buildAgentIdentitySystemMessage(hexId, hexList, tenantId);
        const result = await callHexChat({
          hexId,
          messages: [identityMsg, ...baseMessages],
          tenantId,
          onProgress: function(partialReply) {
            pushLiveReply(hexId, partialReply);
          },
        });
        resultsById.set(hexId, result);
        updateRunningTaskResults(task, hexList, resultsById);
        if (result.reply && broadcast) hexReplies.set(hexId, { name: result.name, reply: result.reply });
        return result;
      }));
      const results = snapshotOrderedResults(hexList, resultsById);

      if (Date.now() - startedAt >= DISCUSS_TASK_MAX_MS) {
        markTaskDone(task, {
          results,
          warning: `群聊讨论超过 ${Math.round(DISCUSS_TASK_MAX_MS / 1000)} 秒，已按当前结果提前收口`,
        });
        return;
      }

      if (broadcast && rounds >= 2 && hexReplies.size > 1) {
        const broadcastHistoryBase = [...hist, { type: 'user', message: text }];
        for (const [hexId, reply] of hexReplies) {
          const hex = hexRobots.find((h) => h.id === hexId);
          broadcastHistoryBase.push({ type: 'hex', name: hex ? hex.name : hexId, message: reply.reply });
        }
        const broadcastMessages = buildMessages(projectSystemMsg, broadcastHistoryBase);
        broadcastMessages.push({ role: 'user', content: '以上是群聊中的对话。请基于其他员工的观点，补充你的一句新看法；如果没有新增观点，请只回复“无”。' });
        const broadcastResults = await Promise.all(hexList.map(async (hexId) => {
          const identityMsg = buildAgentIdentitySystemMessage(hexId, hexList, tenantId);
          const result = await callHexChat({ hexId, messages: [identityMsg, ...broadcastMessages], tenantId });
          return { hexId, followUpReply: result.reply || '' };
        }));
        for (const { hexId, followUpReply } of broadcastResults) {
          if (!followUpReply) continue;
          if (String(followUpReply).trim() === '无') continue;
          const idx = results.findIndex((r) => r.hexId === hexId);
          if (idx >= 0 && results[idx].reply) results[idx].reply += '\n\n[看到其他员工的回复后] ' + followUpReply;
        }
      }

      if (broadcast && rounds >= 3) {
        const extraRoundCount = rounds - 2;
        for (let extraRound = 1; extraRound <= extraRoundCount; extraRound++) {
          if (Date.now() - startedAt >= DISCUSS_TASK_MAX_MS) {
            markTaskDone(task, {
              results,
              warning: `群聊讨论超过 ${Math.round(DISCUSS_TASK_MAX_MS / 1000)} 秒，已按当前结果提前收口`,
            });
            return;
          }
          const roundNum = 2 + extraRound;
          const activeHexIds = results.filter((r) => r.reply).map((r) => r.hexId);
          if (activeHexIds.length === 0) break;
          const roundBase = buildMessages(projectSystemMsg, hist);
          roundBase.push({ role: 'user', content: text });
          for (const r of results) {
            if (r.reply) roundBase.push({ role: 'assistant', content: `${r.name}: ${r.reply}` });
          }
          const roundPrompt = extraRound === extraRoundCount
            ? '以上是当前讨论。请再简短补充一句收口（可选，无则说「无」）。'
            : `以上是当前讨论（第${roundNum}轮）。请基于上面所有观点，补充你的新看法或进一步论证（如无新观点可说「无」）。`;
          roundBase.push({ role: 'user', content: roundPrompt });
          const roundResults = await Promise.all(activeHexIds.map(async (hexId) => {
            const identityMsg = buildAgentIdentitySystemMessage(hexId, hexList, tenantId);
            const result = await callHexChat({ hexId, messages: [identityMsg, ...roundBase], tenantId });
            return { hexId, extra: String(result.reply || '').trim() };
          }));
          for (const { hexId, extra } of roundResults) {
            if (!extra || extra === '无') continue;
            const existing = resultsById.get(hexId);
            if (existing && existing.reply) {
              existing.reply += `\n\n[第${roundNum}轮补充] ` + extra;
              resultsById.set(hexId, existing);
            }
          }
          updateRunningTaskResults(task, hexList, resultsById);
        }
      }

      markTaskDone(task, { results: snapshotOrderedResults(hexList, resultsById) });
      if (projectId) {
        try {
          const outputChars = results.reduce((sum, r) => sum + String((r && (r.reply || r.error)) || '').length, 0);
          const bill = recordUsageBilling({
            projectId,
            source: 'agent.chat',
            taskId,
            units: estimateAgentChatUnits({
              inputChars: text.length,
              outputChars,
              agentCount: Math.max(1, hexList.length),
              rounds,
              broadcast,
            }),
            inputChars: text.length,
            outputChars,
            meta: { agentCount: hexList.length, rounds, broadcast },
            tenantId,
          });
          if (bill && bill.event) {
            task.billing = {
              units: bill.event.units,
              amountCents: bill.event.amountCents,
              grossAmountCents: bill.event.grossAmountCents,
            };
          }
        } catch (e) {
          console.warn('[billing][agent.chat]', e.message);
        }
      }

      if (typeof deps.appendHistory === 'function' && projectId && text) {
        try {
          await deps.appendHistory(projectId, broadcast ? 'discuss' : 'single', text, results);
        } catch (e) {
          console.warn('[agent/chat] 自动保存历史失败:', e.message);
        }
      }

      if (projectId && broadcast) {
        try {
          await maybePromoteDiscussRepliesToAutonomy({ projectId, message: text, results, broadcast, tenantId });
        } catch (e) {
          console.warn('[agent/chat][autonomy]', e.message);
        }
      }
    } catch (err) {
      console.error('[api/agent/chat]', err);
      task.status = 'error';
      task.error = String((err && err.message) || err);
      task.updatedAt = Date.now();
      saveTasks();
    }
  }

  function createTask() {
    const taskId = `hextask_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const task = { status: 'running', replies: null, error: null, warning: null, createdAt: now, updatedAt: now };
    taskStore.set(taskId, task);
    saveTasks();
    return { taskId, task };
  }

  return {
    taskStore,
    loadTasks,
    saveTasks,
    cleanupExpiredTasks,
    getTask,
    createTask,
    executeChatTask,
  };
}

module.exports = {
  createDiscussService,
};
