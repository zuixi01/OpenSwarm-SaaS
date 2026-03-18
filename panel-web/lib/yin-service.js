function createYinService(options) {
  const {
    getChatHistoryPath,
    normalizeAgentNameForPrompt,
    normalizeLegacyAgentMentions,
    readProjects,
    formatHexNameWithLabel,
    readProjectMemory,
    isPortInUse,
    startMainGatewayInBackground,
    getMainGatewayContext,
    MAIN_GATEWAY_PORT,
    MAIN_GATEWAY_HTTP,
    getMainGatewayToken,
  } = options;

  const taskStore = new Map();

  function getTask(taskId) {
    return taskStore.get(taskId) || null;
  }

  function readHexDiscussForYin(projectId, tenantId = 'public', maxMessages = 12, maxContentLen = 400) {
    try {
      const filePath = getChatHistoryPath(projectId, 'discuss', tenantId);
      const fs = require('fs');
      if (!fs.existsSync(filePath)) return '';
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.messages) ? data.messages : []);
      const recent = list.slice(-maxMessages);
      if (recent.length === 0) return '';
      const lines = recent.map((m) => {
        const name = m.type === 'user' ? '用户' : normalizeAgentNameForPrompt(m.name || '员工');
        const content = normalizeLegacyAgentMentions(String(m.message || '').slice(0, maxContentLen));
        return content ? `${name}：${content}` : null;
      }).filter(Boolean);
      return lines.length > 0 ? `【项目员工群最近讨论（供你监控决策）】\n${lines.join('\n\n')}` : '';
    } catch (_) {
      return '';
    }
  }

  async function buildYinMessages(projectId, history, text, tenantId = 'public') {
    const messages = [];
    if (projectId) {
      try {
        const projectList = readProjects(tenantId);
        const project = projectList.find((p) => p.id === projectId);
        if (project) {
          const agentNamesWithLabels = project.hexIds && project.hexIds.length > 0
            ? project.hexIds.map((id) => formatHexNameWithLabel(id)).join('、')
            : '无';
          let systemContent = `当前项目上下文：
- 项目ID: ${project.id}
- 项目名称: ${project.name}
- 已选数字员工: ${agentNamesWithLabels}

重要：用户正在项目"${project.name}"中与你对话。如果用户要求选员工、启动员工等操作，应该在这个项目中操作，而不是新建项目。只有在用户明确要求新建项目时，才创建新项目。
命名规则：只使用「数字员工标签」或「NO.xx」称呼员工，不要使用旧员工名（如数据分析师、爬虫专家、专业客服等）。`;
          const mem = await readProjectMemory(projectId, tenantId);
          if (Array.isArray(mem.entries) && mem.entries.length > 0) {
            const recent = mem.entries.slice(-8);
            const memLines = recent.map((e) => `- ${e.date} [${e.type || '备注'}] ${String(e.content || '').slice(0, 200)}`).filter(Boolean);
            if (memLines.length > 0) systemContent += `\n\n项目记忆（最近${memLines.length}条）：\n${memLines.join('\n')}`;
          }
          const discussContent = readHexDiscussForYin(projectId, tenantId);
          if (discussContent) {
            systemContent += `\n\n${discussContent}\n\n你可以基于以上员工群讨论内容回答用户关于「群里在聊什么」「讨论进展如何」等问题，并在用户请求时给出结构化决策意见。`;
          }
          messages.push({ role: 'system', content: systemContent });
        }
      } catch (_) {}
    }

    if (Array.isArray(history) && history.length > 0) {
      const YIN_COMPRESS = 18;
      const YIN_KEEP = 6;
      if (history.length > YIN_COMPRESS) {
        const oldPart = history.slice(0, history.length - YIN_KEEP);
        const recentPart = history.slice(-YIN_KEEP);
        const summaryLines = oldPart.map((h) => {
          const role = (h.role === 'yin' || h.role === 'command') ? '主控' : '用户';
          const content = normalizeLegacyAgentMentions(String(h.text || h.message || '').slice(0, 120));
          return content ? `${role}: ${content}` : null;
        }).filter(Boolean);
        if (summaryLines.length > 0) {
          messages.push({ role: 'system', content: `【历史对话摘要（共${oldPart.length}条，已压缩）】\n${summaryLines.join('\n')}\n\n以下是最近的对话：` });
        }
        for (const h of recentPart) {
          const role = (h.role === 'yin' || h.role === 'command') ? 'assistant' : 'user';
          const content = normalizeLegacyAgentMentions(String(h.text || h.message || ''));
          if (content) messages.push({ role, content });
        }
      } else {
        const recentHistory = history.slice(-10);
        for (const h of recentHistory) {
          const role = (h.role === 'yin' || h.role === 'command') ? 'assistant' : 'user';
          const content = normalizeLegacyAgentMentions(String(h.text || h.message || ''));
          if (content) messages.push({ role, content });
        }
      }
    }
    messages.push({ role: 'user', content: text });
    return messages;
  }

  async function createChatTask({ message, projectId, history, tenantId = 'public' }) {
    const text = (message != null ? String(message) : '').trim();
    if (!text) return { taskId: null, task: { status: 'done', reply: '', error: null, createdAt: Date.now() } };

    const taskId = `yintask_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const task = { status: 'running', reply: null, error: null, createdAt: Date.now() };
    taskStore.set(taskId, task);

    void (async () => {
      try {
        const gateway = typeof getMainGatewayContext === 'function'
          ? getMainGatewayContext(tenantId)
          : { port: MAIN_GATEWAY_PORT, http: MAIN_GATEWAY_HTTP, token: getMainGatewayToken() };
        if (!isPortInUse(gateway.port)) {
          await startMainGatewayInBackground(tenantId);
          for (let i = 0; i < 10; i++) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            if (isPortInUse(gateway.port)) break;
          }
        }
      } catch (_) {}

      const gateway = typeof getMainGatewayContext === 'function'
        ? getMainGatewayContext(tenantId)
        : { port: MAIN_GATEWAY_PORT, http: MAIN_GATEWAY_HTTP, token: getMainGatewayToken() };
      const headers = { 'Content-Type': 'application/json' };
      const token = gateway.token;
      if (token) headers.Authorization = `Bearer ${token}`;
      const YIN_CHAT_TIMEOUT_MS = 120000;
      const YIN_READINESS_TIMEOUT_MS = 5000;

      try {
        const readyCtrl = new AbortController();
        const readyTimer = setTimeout(() => readyCtrl.abort(), YIN_READINESS_TIMEOUT_MS);
        await fetch(`${gateway.http}/v1/models`, { method: 'GET', headers: { ...headers, Accept: 'application/json' }, signal: readyCtrl.signal });
        clearTimeout(readyTimer);
      } catch (readyErr) {
        if (readyErr.name === 'AbortError') {
          task.error = '主控未就绪（5 秒内无响应）。请查看主控所在终端的输出是否卡住、或到配置页检查 API Key 与模型。';
          task.status = 'error';
          setTimeout(() => { taskStore.delete(taskId); }, 300000);
          return;
        }
        const code = readyErr.cause?.code || readyErr.code;
        const msg = String(readyErr.cause?.message || readyErr.message || '');
        if (code === 'ECONNREFUSED' || msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
          task.error = '主控网关未启动。请点击「主控·启动」按钮。';
          task.status = 'error';
          setTimeout(() => { taskStore.delete(taskId); }, 300000);
          return;
        }
      }

      const messages = await buildYinMessages(projectId, history || [], text, tenantId);
      const doChatFetch = (signal) => fetch(`${gateway.http}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: 'openclaw', messages }),
        signal,
      });

      let response;
      let lastErr;
      for (let attempt = 1; attempt <= 2; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), YIN_CHAT_TIMEOUT_MS);
        try {
          response = await doChatFetch(controller.signal);
          clearTimeout(timeoutId);
          break;
        } catch (err) {
          clearTimeout(timeoutId);
          lastErr = err;
          if (err.name !== 'AbortError' || attempt >= 2) break;
        }
      }

      try {
        if (!response) {
          const err = lastErr;
          const code = err?.cause?.code || err?.code;
          const msg = String(err?.cause?.message || err?.message || '');
          if (err?.name === 'AbortError') {
            task.error = '主控在限定时间内未返回（已自动重试一次）。请查看主控终端是否卡住、或到配置页检查 API Key 与模型。';
          } else if (code === 'ECONNREFUSED' || msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
            task.error = '主控网关未启动。请点击「主控·启动」按钮。';
          } else if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('HEADERS_TIMEOUT')) {
            task.error = '主控网关响应超时。请检查主控是否卡住、网络或上游 API，稍后重试。';
          } else {
            task.error = (err?.message || '主控网关不可达') + '。请先启动主控网关（点主控·启动），或查看面板终端报错。';
          }
          task.status = 'error';
          setTimeout(() => { taskStore.delete(taskId); }, 300000);
          return;
        }

        const rawBody = await response.text();
        let data = {};
        try {
          if (rawBody.trim().startsWith('<') || rawBody.includes('<!DOCTYPE') || rawBody.includes('<html')) {
            task.error = '主控网关返回了网页而非 JSON。可能原因：1) 访问了错误路径（正确为 POST /v1/chat/completions）；2) 主控网关未启用 HTTP chatCompletions；3) 主控网关未正确启动。请确认 yin/moltbot.json 中 gateway.http.endpoints.chatCompletions.enabled = true，并先点击「主控·启动」。';
            task.status = 'error';
            return;
          }
          data = JSON.parse(rawBody);
        } catch (_) {
          if (rawBody.length > 200) task.error = '主控网关返回了非 JSON 格式。请确认主控网关已正确启动（点击主控·启动），且 yin/moltbot.json 中 gateway.http.endpoints.chatCompletions.enabled = true。';
          else task.error = '主控网关响应异常：' + (rawBody.slice(0, 100) || '空响应');
          task.status = 'error';
          return;
        }

        if (!response.ok) {
          const errMsg = data.error?.message || data.message || `HTTP ${response.status}`;
          if (response.status === 404 || response.status === 405) task.error = '主控网关未开启或不允许 HTTP Chat 接口。请在主控的配置（yin/moltbot.json）中设置 gateway.http.endpoints.chatCompletions.enabled = true 后重启主控网关。';
          else if (response.status === 401) task.error = '主控网关鉴权失败(Unauthorized)。请检查 yin/moltbot.json 或环境变量 OPENSWARM_GATEWAY_TOKEN。';
          else if (response.status === 429) task.error = '智谱 API 限流(429)。请稍后重试，或检查配置页面的 API Key 配额。';
          else if (response.status === 403) task.error = 'API Key 无效或配额不足。请到配置页面检查并更新 API Key。';
          else if (response.status >= 500) task.error = `上游服务异常(${response.status})。请稍后重试，或检查智谱控制台服务状态。`;
          else task.error = errMsg;
          task.status = 'error';
        } else {
          task.reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
            ? String(data.choices[0].message.content)
            : '';
          task.status = 'done';
        }
      } catch (err) {
        task.error = (err.message || '主控网关处理响应时出错') + '。请查看主控或面板终端日志。';
        task.status = 'error';
      }
      setTimeout(() => { taskStore.delete(taskId); }, 300000);
    })();

    return { taskId, task };
  }

  return {
    taskStore,
    getTask,
    createChatTask,
  };
}

module.exports = {
  createYinService,
};
