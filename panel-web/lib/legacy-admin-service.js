function createLegacyAdminService(options) {
  const {
    hexRobots,
    readProjects,
    writeProjects,
    readHexagramProfiles,
    writeHexagramProfiles,
    getHexagramProfilesMerged,
    defaultHexagramProfile,
    scoreHexagramForNeeds,
    readRevenueState,
    writeRevenueState,
    nextTransactionId,
    readReports,
    writeReports,
    readDecisions,
    writeDecisions,
    nextTaskId,
    runtimeControlService,
    runtimeAdapter,
    getWorkerByHex,
    readHierarchy,
    readAlertRules,
    writeAlertRules,
    readAlertEvents,
    appendAlertEvent,
  } = options;

  function listAgents() {
    return getHexagramProfilesMerged().map((p) => ({ ...p, agentId: p.id }));
  }

  function getAgent(agentId) {
    const p = getHexagramProfilesMerged().find((x) => x.id === agentId);
    if (!p) return { error: { status: 404, message: '员工不存在' } };
    return { ...p, agentId: p.id };
  }

  function updateAgent(agentId, body = {}) {
    const hex = hexRobots.find((h) => h.id === agentId);
    if (!hex) return { error: { status: 404, message: '员工不存在' } };
    const profiles = readHexagramProfiles();
    const byId = {};
    profiles.forEach((p) => { byId[p.id] = p; });
    const base = byId[hex.id] || defaultHexagramProfile(hex);
    const next = { ...base, id: hex.id, name: hex.name, workerId: hex.workerId };
    if (body.capabilities && typeof body.capabilities === 'object') {
      next.capabilities = { coding: 5, writing: 5, trading: 5, marketing: 5, design: 5, analysis: 5, ...base.capabilities, ...body.capabilities };
    }
    if (body.expertise !== undefined) next.expertise = Array.isArray(body.expertise) ? body.expertise : [];
    if (body.currentProject !== undefined) next.currentProject = body.currentProject == null ? null : String(body.currentProject);
    if (body.status !== undefined) next.status = ['idle', 'working', 'learning', 'upgrading'].includes(body.status) ? body.status : base.status;
    if (body.performance && typeof body.performance === 'object') {
      next.performance = { revenue: 0, tasksCompleted: 0, avgRating: 0, ...base.performance, ...body.performance };
    }
    byId[hex.id] = next;
    writeHexagramProfiles(hexRobots.map((h) => byId[h.id] || defaultHexagramProfile(h)));
    return { ...next, agentId: next.id };
  }

  function getRevenueSummary() {
    const s = readRevenueState();
    return { totalRevenue: s.totalRevenue, upgradePool: s.upgradePool, availableFunds: s.availableFunds, transactionCount: s.transactions.length };
  }

  function createRevenueTransaction(body = {}) {
    const type = body.type === 'income' || body.type === 'expense' || body.type === 'upgrade' ? body.type : 'income';
    const amount = Number(body.amount);
    if (Number.isNaN(amount) || amount <= 0) return { error: { status: 400, message: 'amount 须为正数' } };
    const state = readRevenueState();
    const id = nextTransactionId(state.transactions);
    const tx = {
      id,
      type,
      amount: type === 'expense' || type === 'upgrade' ? -amount : amount,
      source: String(body.source || ''),
      timestamp: body.timestamp || new Date().toISOString(),
      description: String(body.description || ''),
    };
    state.transactions.push(tx);
    if (type === 'income') {
      state.totalRevenue += amount;
      state.upgradePool += Math.floor(amount * 0.2 * 100) / 100;
      state.availableFunds += amount;
    } else {
      state.availableFunds -= amount;
      if (type === 'upgrade') state.upgradePool = Math.max(0, state.upgradePool - amount);
    }
    writeRevenueState(state);
    return { status: 201, body: tx };
  }

  function listRevenueTransactions(limitRaw) {
    const s = readRevenueState();
    const limit = Math.min(parseInt(limitRaw, 10) || 100, 500);
    return s.transactions.slice(-limit).reverse();
  }

  function getRevenuePool() {
    const s = readRevenueState();
    return { upgradePool: s.upgradePool, totalRevenue: s.totalRevenue };
  }

  function upgradeRevenuePool(body = {}) {
    const amount = Number(body.amount);
    const description = String(body.description || body.use || '');
    if (Number.isNaN(amount) || amount <= 0) return { error: { status: 400, message: 'amount 须为正数' } };
    const state = readRevenueState();
    if (amount > state.upgradePool) return { error: { status: 400, message: '升级池余额不足' } };
    const id = nextTransactionId(state.transactions);
    state.transactions.push({
      id,
      type: 'upgrade',
      amount: -amount,
      source: body.source || 'pool',
      timestamp: new Date().toISOString(),
      description: description || '升级支出',
    });
    state.upgradePool -= amount;
    state.availableFunds -= amount;
    writeRevenueState(state);
    return { ok: true, upgradePool: state.upgradePool, transactionId: id };
  }

  function listReports() {
    return readReports();
  }

  function createReport(body = {}) {
    const list = readReports();
    const id = `r${list.length + 1}`;
    const report = {
      id,
      type: body.type || 'daily',
      title: String(body.title || ''),
      content: String(body.content || ''),
      createdAt: body.createdAt || new Date().toISOString(),
    };
    list.push(report);
    writeReports(list);
    return { status: 201, body: report };
  }

  function getLatestReport() {
    const list = readReports();
    if (list.length === 0) return { error: { status: 404, message: '暂无汇报' } };
    return list[list.length - 1];
  }

  function generateReport(body = {}) {
    const type = body.type || 'daily';
    const rev = readRevenueState();
    const profiles = getHexagramProfilesMerged();
    const decisions = readDecisions().slice(-10).reverse();
    const projects = readProjects();
    const lines = [
      `# ${(type === 'daily' ? '日报' : type === 'weekly' ? '周报' : '月报')} - ${new Date().toISOString().slice(0, 10)}`,
      '',
      '## 收益概览',
      `- 总收益: ${rev.totalRevenue}`,
      `- 升级资金池: ${rev.upgradePool} (20%)`,
      '',
      '## 各员工表现',
      ...profiles.slice(0, 10).map((p) => `- ${p.name} (${p.id}): ${(p.performance && p.performance.revenue)} 收益, 状态 ${p.status}`),
      '',
      '## 近期决策',
      ...decisions.slice(0, 5).map((d) => `- [${d.type}] ${JSON.stringify(d.payload).slice(0, 80)}`),
      '',
      '## 项目与待办',
      ...projects.slice(0, 5).map((p) => `- ${p.name}: ${(p.tasks && p.tasks.filter((t) => t.status !== 'completed').length)} 待办`),
    ];
    const content = lines.join('\n');
    const list = readReports();
    const id = `r${list.length + 1}`;
    const report = { id, type, title: `${type}-${new Date().toISOString().slice(0, 10)}`, content, createdAt: new Date().toISOString() };
    list.push(report);
    writeReports(list);
    return { status: 201, body: { id, type, title: report.title, contentLength: content.length } };
  }

  function matchAgents(query = {}) {
    const needStr = query.need || query.needs || '';
    const needs = needStr ? String(needStr).split(/[,，\s]/).map((s) => s.trim()).filter(Boolean) : [];
    const limit = Math.min(parseInt(query.limit, 10) || 10, 64);
    const preferIdle = query.preferIdle !== 'false';
    const scored = getHexagramProfilesMerged().map((p) => ({ ...p, _score: scoreHexagramForNeeds(p, needs), _idle: p.status === 'idle' }));
    scored.sort((a, b) => {
      if (preferIdle && a._idle !== b._idle) return a._idle ? -1 : 1;
      return b._score - a._score;
    });
    return scored.slice(0, limit).map(({ _score, _idle, ...p }) => ({ ...p, matchScore: _score }));
  }

  function listDecisions(limitRaw) {
    const limit = Math.min(parseInt(limitRaw, 10) || 50, 200);
    return readDecisions().slice(-limit).reverse();
  }

  function createDecision(body = {}) {
    const list = readDecisions();
    const id = `d${list.length + 1}`;
    const decision = { id, type: String(body.type || ''), payload: body.payload != null ? body.payload : {}, createdAt: body.createdAt || new Date().toISOString() };
    list.push(decision);
    writeDecisions(list);
    return { status: 201, body: decision };
  }

  function assignProjectTasks(projectId, query = {}) {
    const list = readProjects();
    const idx = list.findIndex((p) => p.id === projectId);
    if (idx < 0) return { error: { status: 404, message: '项目不存在' } };
    const project = list[idx];
    if (!project.tasks) project.tasks = [];
    const pending = project.tasks.filter((t) => t.status === 'pending');
    if (pending.length === 0) return { assigned: 0, message: '无待分配任务' };
    const idle = getHexagramProfilesMerged().filter((p) => p.status === 'idle');
    const needs = String(query.need || '').trim().split(/[,，\s]/).map((s) => s.trim()).filter(Boolean);
    const scored = idle.map((p) => ({ ...p, _score: scoreHexagramForNeeds(p, needs.length ? needs : ['coding']) }));
    scored.sort((a, b) => b._score - a._score);
    let assigned = 0;
    pending.forEach((task, i) => {
      const hex = scored[i % scored.length];
      if (!hex) return;
      const ti = project.tasks.findIndex((t) => t.id === task.id);
      if (ti >= 0) {
        project.tasks[ti].assignedTo = hex.id;
        project.tasks[ti].status = 'in-progress';
        assigned += 1;
      }
    });
    const hexProfiles = readHexagramProfiles();
    const byId = {};
    hexProfiles.forEach((p) => { byId[p.id] = p; });
    pending.slice(0, scored.length).forEach((task, i) => {
      const hex = scored[i];
      if (hex && byId[hex.id]) {
        byId[hex.id].currentProject = project.id;
        byId[hex.id].status = 'working';
      }
    });
    writeHexagramProfiles(hexRobots.map((h) => byId[h.id] || defaultHexagramProfile(h)));
    writeProjects(list);
    return { assigned, totalPending: pending.length };
  }

  function listHealthAgents() {
    return runtimeControlService.listRobots().filter((r) => r.id !== 'main').map((r) => ({ id: r.id, agentId: r.id, name: r.name, running: !!r.running, port: r.port }));
  }

  function listAlertRules() { return readAlertRules(); }
  function createAlertRule(body = {}) {
    const list = readAlertRules();
    const item = { id: `ar${list.length + 1}`, name: body.name || '', condition: body.condition || '', severity: body.severity || 'warning', action: body.action || 'notify', createdAt: new Date().toISOString() };
    list.push(item);
    writeAlertRules(list);
    return { status: 201, body: item };
  }
  function listAlertEvents(limitRaw) {
    const limit = Math.min(parseInt(limitRaw, 10) || 50, 200);
    return readAlertEvents().slice(-limit).reverse();
  }
  function checkAlerts() {
    const events = [];
    const hexList = runtimeControlService.listRobots().filter((r) => r.id !== 'main');
    hexList.filter((r) => !r.running).forEach((r) => {
      events.push({ type: 'hexagram_crashed', hexId: r.id, severity: 'critical' });
      appendAlertEvent({ type: 'hexagram_crashed', hexId: r.id, severity: 'critical' });
    });
    const rev = readRevenueState();
    if (rev.transactions.length >= 2) {
      const lastTwo = rev.transactions.slice(-2);
      const a = lastTwo[1].amount;
      const b = lastTwo[0].amount;
      if (a > 0 && b < a * 0.7) {
        events.push({ type: 'revenue_drop', severity: 'warning' });
        appendAlertEvent({ type: 'revenue_drop', severity: 'warning' });
      }
    }
    return { checked: true, events };
  }
  async function selfHealAgents() {
    const list = runtimeControlService.listRobots().filter((r) => r.id !== 'main' && !r.running);
    const restarted = [];
    for (const r of list) {
      const worker = getWorkerByHex(r.id);
      if (worker) {
        try {
          runtimeAdapter.startWorkerGateway(worker);
          restarted.push(r.id);
          const dec = readDecisions();
          dec.push({ id: `d${dec.length + 1}`, type: 'self_heal', payload: { hexId: r.id }, createdAt: new Date().toISOString() });
          writeDecisions(dec);
        } catch (_) {}
      }
    }
    return { restarted, restartedAgents: restarted, count: restarted.length };
  }

  function getHierarchy() { return readHierarchy(); }
  function getAgentSupervisor(agentId) {
    const h = readHierarchy();
    for (const [sup, ids] of Object.entries(h.supervisors || {})) {
      if (ids.includes(agentId)) return { supervisor: sup, supervisorAgentId: sup };
    }
    return { supervisor: null, supervisorAgentId: null };
  }
  function getAgentSubordinates(agentId) {
    const h = readHierarchy();
    const ids = (h.supervisors || {})[agentId];
    return ids ? { subordinates: ids, subordinateAgentIds: ids } : { subordinates: [], subordinateAgentIds: [] };
  }

  return {
    listAgents,
    getAgent,
    updateAgent,
    getRevenueSummary,
    createRevenueTransaction,
    listRevenueTransactions,
    getRevenuePool,
    upgradeRevenuePool,
    listReports,
    createReport,
    getLatestReport,
    generateReport,
    matchAgents,
    listDecisions,
    createDecision,
    assignProjectTasks,
    listHealthAgents,
    listAlertRules,
    createAlertRule,
    listAlertEvents,
    checkAlerts,
    selfHealAgents,
    getHierarchy,
    getAgentSupervisor,
    getAgentSubordinates,
  };
}

module.exports = {
  createLegacyAdminService,
};
