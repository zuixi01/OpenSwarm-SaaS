/**
 * OpenSwarm 中英文切换 · 方案 A
 * 词典 + data-i18n + t() + apply()
 */
(function() {
  'use strict';

  const STORAGE_KEY = 'openswarm_lang';

  const T = {
    zh: {
      // index
      title: 'OpenSwarm - AI数字员工平台',
      configTitle: '配置 · OpenSwarm',
      projectsTitle: '项目空间 · OpenSwarm',
      projectTitle: '项目 · OpenSwarm',
      btnConfig: '配置',
      btnProjects: '项目空间',
      monitorTitle: '系统负载',
      monitorCollapse: '折叠',
      monitorExpand: '展开',
      mem: '内存',
      cpuPct: 'CPU 使用率',
      cpuLoad: 'CPU 负载 (1/5 min)',
      cpus: 'CPU 核数',
      swap: '交换已用',
      monitorRefresh: '每 5 秒刷新 · 上次',
      yinClickStart: '主控 · 点击启动',
      yinClickStop: '主控 · 点击停止',
      yangDisplayOnly: '策略 · 技能组装',
      hexLabelWithCount: '数字员工 · 已启动 {0}',
      btnCloseAllTerminals: '一键关闭所有终端',
      btnCloseAllTerminalsTitle: '关闭 64 员工中由面板打开的所有终端窗口（不停止网关）',
      btnStart: '启动',
      btnStop: '停止',
      statusRunning: '运行中',
      statusStopped: '未运行',
      hexLabel: '标签',
      hexLabelEdit: '编辑标签',
      hexLabelSet: '设置标签',
      hexLabelPrompt: '编辑该员工的标签（方便区分角色，员工与员工可见）',
      hexLabelSaved: '标签已保存',
      badgeRoleFallback: '通用数字员工',
      badgeMotto: '先澄清目标，再执行动作。',
      badgePortUnknown: '端口未配置',
      toastTerminalOpened: '已弹出终端',
      toastTerminalReused: '已激活已有终端',
      toastStopped: '已停止',
      toastStartFailed: '启动失败',
      toastStopFailed: '停止失败',
      toastRequestFailed: '请求失败',
      toastDisplayOnly: '仅作展示',
      toastYangComingSoon: '敬请期待2.0版本',
      yinDescGlobal: '此处对话与终端 TUI 独立',
      toastClosedAll: '已关闭所有员工终端并停止网关，正在更新状态…',
      toastNoTerminals: '没有由面板打开的终端',
      toastStatusUpdated: '状态已更新',
      toastCloseFailed: '关闭失败',
      // config
      configFirst: '首次配置',
      configSub: '选择模型提供商并填写 API Key，即可启用 OpenSwarm 全部功能',
      modelProvider: '模型提供商',
      modelPrimary: '主模型',
      apiKeyRequired: 'API Key（必填）',
      apiKeyHint: '从对应提供商控制台获取 API Key',
      portHexLabel: '数字员工起始端口',
      btnCheckPorts: '检测端口占用',
      btnSaveConfig: '保存配置',
      linkBackPanel: '已配置？返回主面板',
      checking: '检测中…',
      portFree: '空闲',
      portUsed: '已占用',
      portAutoFixed: '已检测到占用，已自动配置空闲端口',
      portMainLabel: '主网关',
      portHexLabelShort: '员工起始',
      portPanelLabel: '面板',
      checkFailed: '检测失败',
      fillApiKey: '请填写 API Key',
      configSaved: '配置已保存。主控与64位数字员工已更新 API Key。若主控/员工正在运行，请重启后生效。',
      configured: '已配置',
      configuredPlaceholder: '已配置（留空则不修改）',
      requestFailed: '请求失败，请检查面板服务是否正常',
      provider: '模型提供商',
      apiKey: 'API Key',
      apiKeyPlaceholder: '在此粘贴你的 API Key',
      save: '保存',
      checkPorts: '检测端口占用',
      portMain: '主网关端口',
      portHexStart: '员工起始端口',
      panelPort: '面板端口',
      saved: '已保存',
      saveFailed: '保存失败',
      // projects
      backHome: '← 面板首页',
      linkBackToProjects: '← 团队列表',
      projects: '项目',
      newProject: '新建项目',
      projectName: '项目名称',
      selectHex: '选员工',
      noProjects: '暂无项目',
      deleteProject: '删除项目',
      // project (common)
      withYin: '与主控对话',
      withHex: '与员工对话',
      yinDesc: '此处对话仅属于当前项目，与终端 TUI 独立',
      inputToYin: '输入消息，与主控协作…',
      inputToHex: '输入消息，向本项目各员工发送…',
      send: '发送',
      modeSingle: '群发单聊',
      modeDiscuss: '群讨论',
      modeAgent: '执行任务',
      rounds: '多轮',
      clearSingle: '清空单聊',
      clearDiscuss: '清空群聊',
      clearAll: '清空全部',
      updateMemory: '📝 更新记忆',
      extractingMemory: '📝 提炼中…',
      memoryUpdatedCount: '📝 已更新 {0} 条记忆',
      outputFiles: '📁 产出文件',
      dispatchTask: '⚡ 派发任务',
      batchStart: '一键启动',
      batchStop: '一键停止',
      startAll: '一键启动',
      stopAll: '一键停止',
      pin: '固定',
      clearRecord: '清空记录',
      // config dynamic
      apiKeyLabelWithProvider: '{0} API Key（必填）',
      localNoKey: '（本地无需 Key）',
      localNoKeyHint: '本地运行，无需配置 API Key',
      apiKeyHintGetFrom: '从 {0} 控制台获取',
      defaultModel: '默认',
      // projects
      projectList: '团队列表',
      inputProjectName: '输入项目名称',
      btnCreate: '新建',
      emptyHint: '暂无项目，上方创建后即可在项目内选员工、与主控对话。',
      withYinGlobal: '与主控对话（全局）',
      inputToYinShort: '输入消息与主控对话…',
      resizeTitle: '拖动调整宽度',
      confirmDeleteProject: '确定删除项目「{0}」？',
      btnDelete: '删除',
      toastRenamed: '已重命名为：{0}',
      toastRenameFailed: '重命名失败',
      toastDeleted: '已删除',
      toastDeleteFailed: '删除失败',
      toastLoadProjectsFailed: '加载项目列表失败',
      toastEnterProjectName: '请输入项目名称',
      toastCreated: '已创建：{0}',
      toastCreateFailed: '创建失败',
      hexCount: '数字员工 {0} 个',
      hexNotSelected: '未选',
      hexDefinitionName: '员工编组',
      me: '我',
      you: '你',
      yinLabel: '主控',
      confirmClearYinChat: '确定清空与主控的全部聊天记录？',
      yinNoReply: '暂时无法收到主控的回复',
      yinNoReplyWith: '（暂时无法收到主控的回复：{0}）',
      toastRequestFailedShort: '请求失败',
      yangClickStart: '策略 · 点击启动',
      yangClickStop: '策略 · 点击停止',
      createProject: '新建团队',
      btnSend: '发送',
      yinClickMain: '主控 · 平台总控 · 点击启动/停止',
      yinClickMainStart: '主控 · 平台总控 · 点击启动',
      yinClickMainStop: '主控 · 平台总控 · 点击停止',
      clickEditName: '点击编辑名称',
      // project
      hexSwitchesTitle: '本项目数字员工 · 启停',
      selectHexModalTitle: '选择数字员工 · 点击加入/取消加入本项目',
      modalDone: '完成',
      clearMemoryAlso: '同时清空本项目记忆',
      cancel: '取消',
      ok: '确定',
      pinFullscreen: '点击固定为全屏',
      layoutHexFull: '与员工对话全屏',
      layoutHalf: '左右各半，可拖动调整',
      layoutYinFull: '与主控对话全屏',
      modeLabel: '模式：',
      hexChatEmpty: '请先在「选员工」中为本项目添加数字员工，再在此发消息；向本项目各员工群发，回复按员工展示（类似群聊）。',
      hexChatFileWarn: '当前为文件方式打开页面，与员工对话无法请求接口。请用浏览器打开：http://localhost:3999/project.html（并确保已启动面板）。',
      hexChatFileHint: '请用 http://localhost:3999/project.html 打开页面后再发消息',
      roundsSelect: '选择讨论轮数',
      roundN: '{0} 轮',
      roundSuffix: '轮',
      dispatchPanelTitle: '派发执行任务',
      dispatchContextLabel: '讨论背景（自动提取，可忽略）：',
      dispatchInstructionPlaceholder: '输入具体执行指令，例如：根据上面的讨论，生成一个完整的 PRD 文档，保存到 output/ 目录',
      selectExecHex: '选择执行员工：',
      dispatchSend: '派发',
      projectFilesTitle: '项目产出文件',
      refresh: '刷新',
      close: '关闭',
      loading: '加载中…',
      confirmClearSingle: '确定清空单聊与员工对话记录？',
      confirmClearDiscuss: '确定清空群聊与员工对话记录？',
      confirmClearAllHex: '确定清空全部与员工对话记录？',
      toastClearedSingle: '已清空单聊记录',
      toastClearedDiscuss: '已清空群聊记录',
      toastClearedAll: '已清空全部记录',
      toastClearedYin: '已清空与主控的聊天记录',
      andMemory: '及本项目记忆',
      toastSendStart: '已发送启动',
      toastSendStop: '已发送停止',
      toastSendBatchStart: '已发送一键启动',
      toastSendBatchStop: '已发送一键停止',
      hexChatNoConnect: '当前所选员工均无法连接。请在本页「本项目数字员工 · 启停」处对需要对话的员工点击「启动」，等待显示为运行中后再发消息。',
      hexChatTimeout: '上次发送的消息因服务重启而超时，请重新发送。',
      serviceError: '服务异常',
      serviceErrorWith: '服务异常：{0}',
      taskFailed: '执行任务失败',
      taskFailedWith: '执行任务失败：{0}',
      noTaskId: '未收到任务 ID，请检查服务端日志。',
      requestFailedWith: '请求失败：{0}',
      connectPanelHint: '无法连接到面板接口。请用浏览器打开：{0} ，并确保已启动面板（在 panel-web 目录运行 node server.js 或双击 start-panel.command）。若当前是用文件方式打开的页面，请改用上述地址打开。',
      waitingHexReply: '正在等待员工的回复…',
      waitingHexReplyBg: '正在等待员工的回复…（后台运行中）',
      waitingYinReply: '等待主控回复中…（换页不中断）',
      yinThinking: '思考中…',
      pleaseEnterFromProjects: '请从项目列表进入',
      taskExecutedNoReply: '（任务已执行，无文字回复）',
      modeAgentLabel: '⚡ 执行任务模式',
      modeDiscussRound: '群讨论 · {0} 轮',
      modeSingleLabel: '群发单聊',
      hexParticipants: '{0} 员工',
      hexExecTaskElapsed: '⚡ {0} 正在执行任务… ({1}s)',
      systemLabel: '系统',
      hexChatSending: '正在向各员工发送…',
      hexChatExecTask: '⚡ 正在让 {0} 执行任务（工具模式）…',
      dispatchEnterInstruction: '请输入任务指令',
      selectAtLeastOneHex: '请至少选一个员工',
      dispatching: '派发中…',
      toastUpdated: '已更新',
      toastUpdateFailed: '更新失败',
      yinReady: '主控已就绪，可与主控对话说明需求。',
      dispatchInstructionPlaceholderAgent: '输入任务指令，用 @DG-01 指定执行员工（如 @DG-01 生成日报并保存到文件）…',
      pinFullscreenShort: '固定',
      clearSingleTitle: '只清空群发单聊产生的消息',
      clearDiscussTitle: '只清空群讨论产生的消息',
      clearAllTitle: '清空全部与员工对话历史',
      updateMemoryTitle: '让主控提炼本次对话的关键内容，存入项目记忆',
      projectFilesTitleShort: '项目产出文件',
      dispatchTaskTitle: '把当前讨论内容作为背景，派发执行任务给指定员工',
      modeSingleTitle: '群发单聊：所有员工都收到消息，但看不到其他员工的回复。@ 触发时只让被 @ 的员工回复。',
      modeDiscussTitle: '群讨论：各员工能看到其他员工的回复，并可追加讨论。',
      modeAgentTitle: '执行任务：通过 WebSocket 让指定员工真正调用工具执行任务（写文件、运行命令等），结果保存到项目产出目录。需指定 @DG-01。',
      roundsTitle: '选择讨论轮数',
      roundsFixed1: '群发单聊固定 1 轮',
      roundsNoRounds: '执行任务模式不使用轮次',
      // lang toggle
      langZh: '中',
      langEn: 'EN',
    },
    en: {
      // index
      title: 'OpenSwarm - AI Digital Employee Platform',
      configTitle: 'Config · OpenSwarm',
      projectsTitle: 'Projects · OpenSwarm',
      projectTitle: 'Project · OpenSwarm',
      btnConfig: 'Config',
      btnProjects: 'Projects',
      monitorTitle: 'System Load',
      monitorCollapse: 'Collapse',
      monitorExpand: 'Expand',
      mem: 'Memory',
      cpuPct: 'CPU Usage',
      cpuLoad: 'CPU Load (1/5 min)',
      cpus: 'CPU Cores',
      swap: 'Swap Used',
      monitorRefresh: 'Refresh every 5s · Last',
      yinClickStart: 'Command · Click to start',
      yinClickStop: 'Command · Click to stop',
      yangDisplayOnly: 'Strategy · Skill assembly',
      hexLabelWithCount: 'Digital Employees · Running {0}',
      btnCloseAllTerminals: 'Close All Terminals',
      btnCloseAllTerminalsTitle: 'Close all terminal windows opened by panel (gateways keep running)',
      btnStart: 'Start',
      btnStop: 'Stop',
      statusRunning: 'Running',
      statusStopped: 'Stopped',
      hexLabel: 'Label',
      hexLabelEdit: 'Edit label',
      hexLabelSet: 'Set label',
      hexLabelPrompt: 'Edit this employee\'s label (visible to other employees)',
      hexLabelSaved: 'Label saved',
      badgeRoleFallback: 'Generalist agent',
      badgeMotto: 'Question everything before you act.',
      badgePortUnknown: 'Port unavailable',
      toastTerminalOpened: 'Terminal opened',
      toastTerminalReused: 'Existing terminal activated',
      toastStopped: 'Stopped',
      toastStartFailed: 'Start failed',
      toastStopFailed: 'Stop failed',
      toastRequestFailed: 'Request failed',
      toastDisplayOnly: 'Display only',
      toastYangComingSoon: 'Coming in v2.0',
      yinDescGlobal: 'This chat is independent from terminal TUI',
      toastClosedAll: 'Closed all employee terminals and gateways, updating…',
      toastNoTerminals: 'No panel-opened terminals',
      toastStatusUpdated: 'Status updated',
      toastCloseFailed: 'Close failed',
      // config
      configFirst: 'First-time Setup',
      configSub: 'Select provider and enter API Key to enable all OpenSwarm features.',
      modelProvider: 'Model Provider',
      modelPrimary: 'Primary Model',
      apiKeyRequired: 'API Key (required)',
      apiKeyHint: 'Get API Key from provider console',
      portHexLabel: 'Employee Start Port',
      btnCheckPorts: 'Check Ports',
      btnSaveConfig: 'Save Config',
      linkBackPanel: 'Configured? Back to Panel',
      checking: 'Checking…',
      portFree: 'Free',
      portUsed: 'In Use',
      portAutoFixed: 'Ports in use detected. Auto-configured to free ports.',
      portMainLabel: 'Main GW',
      portHexLabelShort: 'Employee Start',
      portPanelLabel: 'Panel',
      checkFailed: 'Check failed',
      fillApiKey: 'Please enter API Key',
      configSaved: 'Config saved. Command and all employees updated. Restart if still running.',
      configured: 'Configured',
      configuredPlaceholder: 'Configured (leave blank to keep)',
      requestFailed: 'Request failed. Check if panel is running.',
      provider: 'Model Provider',
      apiKey: 'API Key',
      apiKeyPlaceholder: 'Paste your API Key here',
      save: 'Save',
      checkPorts: 'Check Ports',
      portMain: 'Main Gateway Port',
      portHexStart: 'Employee Start Port',
      panelPort: 'Panel Port',
      saved: 'Saved',
      saveFailed: 'Save failed',
      // projects
      backHome: '← Panel',
      linkBackToProjects: '← Team List',
      projects: 'Projects',
      newProject: 'New Project',
      projectName: 'Project Name',
      selectHex: 'Select Employee',
      noProjects: 'No projects yet',
      deleteProject: 'Delete',
      // project (common)
      withYin: 'Chat with Command',
      withHex: 'Chat with Employees',
      yinDesc: 'This chat belongs to current project only; independent from terminal TUI',
      inputToYin: 'Message Command center…',
      inputToHex: 'Message employees in this project…',
      send: 'Send',
      modeSingle: 'Single Chat',
      modeDiscuss: 'Group Discuss',
      modeAgent: 'Execute Task',
      rounds: 'Rounds',
      clearSingle: 'Clear Single',
      clearDiscuss: 'Clear Discuss',
      clearAll: 'Clear All',
      updateMemory: '📝 Update Memory',
      extractingMemory: '📝 Extracting…',
      memoryUpdatedCount: '📝 Updated {0} items',
      outputFiles: '📁 Output Files',
      dispatchTask: '⚡ Dispatch Task',
      batchStart: 'Start All',
      batchStop: 'Stop All',
      startAll: 'Start All',
      stopAll: 'Stop All',
      pin: 'Pin',
      clearRecord: 'Clear',
      // config dynamic
      apiKeyLabelWithProvider: '{0} API Key (required)',
      localNoKey: '(local, no Key)',
      localNoKeyHint: 'Local, no API Key needed',
      apiKeyHintGetFrom: 'Get from {0} console',
      defaultModel: 'Default',
      // projects
      projectList: 'Team List',
      inputProjectName: 'Enter project name',
      btnCreate: 'New',
      emptyHint: 'No projects yet. Create one above to select employees and chat with Command.',
      withYinGlobal: 'Chat with Command (Global)',
      inputToYinShort: 'Message Command…',
      resizeTitle: 'Drag to resize',
      confirmDeleteProject: 'Delete project "{0}"?',
      btnDelete: 'Delete',
      toastRenamed: 'Renamed to: {0}',
      toastRenameFailed: 'Rename failed',
      toastDeleted: 'Deleted',
      toastDeleteFailed: 'Delete failed',
      toastLoadProjectsFailed: 'Failed to load projects',
      toastEnterProjectName: 'Please enter project name',
      toastCreated: 'Created: {0}',
      toastCreateFailed: 'Create failed',
      hexCount: '{0} employees',
      hexNotSelected: 'None',
      hexDefinitionName: 'Employee Definition',
      me: 'Me',
      you: 'You',
      yinLabel: 'Command',
      confirmClearYinChat: 'Clear all chat history with Command?',
      yinNoReply: 'Unable to receive Command reply',
      yinNoReplyWith: '(Unable to receive Command reply: {0})',
      toastRequestFailedShort: 'Request failed',
      yangClickStart: 'Strategy · Click to start',
      yangClickStop: 'Strategy · Click to stop',
      createProject: 'New Team',
      btnSend: 'Send',
      yinClickMain: 'Command · Master · Click to start/stop',
      yinClickMainStart: 'Command · Master · Click to start',
      yinClickMainStop: 'Command · Master · Click to stop',
      clickEditName: 'Click to edit',
      // project
      hexSwitchesTitle: 'Project Employees · Start/Stop',
      selectHexModalTitle: 'Select employees · Click to add/remove',
      modalDone: 'Done',
      clearMemoryAlso: 'Also clear project memory',
      cancel: 'Cancel',
      ok: 'OK',
      pinFullscreen: 'Pin fullscreen',
      layoutHexFull: 'Employee chat fullscreen',
      layoutHalf: 'Split view, drag to resize',
      layoutYinFull: 'Command chat fullscreen',
      modeLabel: 'Mode:',
      hexChatEmpty: 'Add employees in "Select Employee" first, then send messages. Replies shown per employee (like group chat).',
      hexChatFileWarn: 'File protocol: API unavailable. Open http://localhost:3999/project.html in browser.',
      hexChatFileHint: 'Open http://localhost:3999/project.html in browser to send messages',
      roundsSelect: 'Select rounds',
      roundN: '{0} rounds',
      roundSuffix: 'rounds',
      dispatchPanelTitle: 'Dispatch Task',
      dispatchContextLabel: 'Context (auto-extracted):',
      dispatchInstructionPlaceholder: 'Enter instruction, e.g. Generate PRD to output/',
      selectExecHex: 'Select employee:',
      dispatchSend: 'Dispatch',
      projectFilesTitle: 'Project Output Files',
      refresh: 'Refresh',
      close: 'Close',
      loading: 'Loading…',
      confirmClearSingle: 'Clear single-chat employee records?',
      confirmClearDiscuss: 'Clear discuss employee records?',
      confirmClearAllHex: 'Clear all employee chat records?',
      toastClearedSingle: 'Single chat cleared',
      toastClearedDiscuss: 'Discuss chat cleared',
      toastClearedAll: 'All cleared',
      toastClearedYin: 'Command chat cleared',
      andMemory: ' and project memory',
      toastSendStart: 'Start sent',
      toastSendStop: 'Stop sent',
      toastSendBatchStart: 'Batch start sent',
      toastSendBatchStop: 'Batch stop sent',
      hexChatNoConnect: 'Selected employees cannot connect. Start them in "Project Employees · Start/Stop" section, then wait until running.',
      hexChatTimeout: 'Last message timed out. Please resend.',
      serviceError: 'Service error',
      serviceErrorWith: 'Service error: {0}',
      taskFailed: 'Task failed',
      taskFailedWith: 'Task failed: {0}',
      noTaskId: 'No task ID received. Check server logs.',
      requestFailedWith: 'Request failed: {0}',
      connectPanelHint: 'Cannot connect to panel. Open {0} in browser and ensure panel is running (node server.js in panel-web).',
      waitingHexReply: 'Waiting for employee replies…',
      waitingHexReplyBg: 'Waiting for employee replies… (running in background)',
      waitingYinReply: 'Waiting for Command reply… (continues across pages)',
      yinThinking: 'Thinking…',
      pleaseEnterFromProjects: 'Please enter from project list',
      taskExecutedNoReply: '(Task executed, no text reply)',
      modeAgentLabel: '⚡ Execute Task',
      modeDiscussRound: 'Discuss · {0} rounds',
      modeSingleLabel: 'Single Chat',
      hexParticipants: '{0} employees',
      hexExecTaskElapsed: '⚡ {0} executing… ({1}s)',
      systemLabel: 'System',
      hexChatSending: 'Sending to employees…',
      hexChatExecTask: '⚡  Executing task with {0} (tool mode)…',
      dispatchEnterInstruction: 'Enter task instruction',
      selectAtLeastOneHex: 'Select at least one employee',
      dispatching: 'Dispatching…',
      toastUpdated: 'Updated',
      toastUpdateFailed: 'Update failed',
      yinReady: 'Command ready. Chat with Command to describe your needs.',
      dispatchInstructionPlaceholderAgent: 'Enter task instruction with @DG-01 (e.g. @DG-01 generate a daily report and save to file)…',
      pinFullscreenShort: 'Pin',
      clearSingleTitle: 'Clear single-chat messages only',
      clearDiscussTitle: 'Clear discuss messages only',
      clearAllTitle: 'Clear all employee chat history',
      updateMemoryTitle: 'Let Command extract key content and save to project memory',
      projectFilesTitleShort: 'Project Output Files',
      dispatchTaskTitle: 'Dispatch task to selected employee with current discussion as context',
      modeSingleTitle: 'Single: All employees receive message but cannot see others\' replies. @ triggers only the mentioned employee.',
      modeDiscussTitle: 'Discuss: Employees see each other\'s replies and can add more.',
      modeAgentTitle: 'Execute: WebSocket lets specified employee run tools (write files, run commands). Results saved to project output. Use @DG-01.',
      roundsTitle: 'Select discussion rounds',
      roundsFixed1: 'Single mode fixed at 1 round',
      roundsNoRounds: 'Agent mode does not use rounds',
      // lang toggle
      langZh: '中',
      langEn: 'EN',
    },
  };

  function getLang() {
    try {
      const l = localStorage.getItem(STORAGE_KEY);
      if (l === 'en' || l === 'zh') return l;
    } catch (_) {}
    return 'zh';
  }

  function setLang(lang) {
    if (lang !== 'zh' && lang !== 'en') return;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {}
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    if (typeof window.OPENSWARM_APPLY_I18N === 'function') window.OPENSWARM_APPLY_I18N();
    if (typeof window.OPENSWARM_APPLY_I18N_EXTRAS === 'function') window.OPENSWARM_APPLY_I18N_EXTRAS();
  }

  const AGENT_SLOT_INDEX = {
    qian: 1,
    kun: 2,
    tai: 3,
    pi: 4,
    xun: 5,
    yu: 6,
    sui: 7,
    gu: 8,
    lin: 9,
    guan: 10,
  };

  function getAgentCode(hexId) {
    if (!hexId) return null;
    if (AGENT_SLOT_INDEX[hexId]) return 'DG-' + String(AGENT_SLOT_INDEX[hexId]).padStart(2, '0');
    var m = /^h(\d{2})$/.exec(String(hexId));
    if (m) {
      var n = parseInt(m[1], 10);
      if (n >= 11 && n <= 64) return 'DG-' + String(n).padStart(2, '0');
    }
    return null;
  }

  function getHexDisplayName(hexId, zhName) {
    var code = getAgentCode(hexId);
    if (code) return code;
    return zhName || hexId || '';
  }

  function t(key, ...args) {
    const lang = getLang();
    const dict = T[lang] || T.zh;
    let s = dict[key];
    if (s == null) s = T.zh[key] || key;
    if (args && args.length > 0) {
      args.forEach(function(a, i) {
        s = s.replace(new RegExp('\\{' + i + '\\}', 'g'), String(a));
      });
    }
    return s;
  }

  function apply() {
    const lang = getLang();
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      const key = el.getAttribute('data-i18n');
      const argsAttr = el.getAttribute('data-i18n-args');
      let args = [];
      if (argsAttr) {
        try {
          args = JSON.parse(argsAttr);
        } catch (_) {}
      }
      const dict = T[lang] || T.zh;
      let s = dict[key];
      if (s == null) s = T.zh[key] || el.textContent;
      args.forEach(function(a, i) {
        s = s.replace(new RegExp('\\{' + i + '\\}', 'g'), String(a));
      });
      if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.placeholder !== undefined) {
        el.placeholder = s;
      } else {
        el.textContent = s;
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
      const key = el.getAttribute('data-i18n-placeholder');
      const dict = T[lang] || T.zh;
      const s = dict[key] || T.zh[key] || el.placeholder || '';
      el.placeholder = s;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
      const key = el.getAttribute('data-i18n-title');
      const dict = T[lang] || T.zh;
      const s = dict[key] || T.zh[key] || el.title || '';
      el.title = s;
    });
    var titleKey = document.body.getAttribute('data-i18n-title');
    if (titleKey) {
      const dict = T[lang] || T.zh;
      document.title = dict[titleKey] || T.zh[titleKey] || document.title;
    }
    var toggle = document.getElementById('openswarm-lang-toggle');
    if (toggle) {
      toggle.innerHTML = lang === 'zh' ? '<span class="active">中</span><span>EN</span>' : '<span>中</span><span class="active">EN</span>';
      toggle.onclick = function() {
        setLang(getLang() === 'zh' ? 'en' : 'zh');
      };
    }
  }

  function injectLangToggleStyles() {
    if (document.getElementById('openswarm-lang-styles')) return;
    var style = document.createElement('style');
    style.id = 'openswarm-lang-styles';
    style.textContent = '.openswarm-lang-toggle{display:inline-flex;align-items:center;gap:2px;padding:4px 8px;font-size:0.75rem;background:rgba(0,0,0,0.4);border:1px solid rgba(57,208,255,0.35);border-radius:4px;color:rgba(168,166,164,0.9);cursor:pointer;font-family:inherit;}.openswarm-lang-toggle:hover{border-color:rgba(57,208,255,0.55);color:#39d0ff;}.openswarm-lang-toggle span{padding:0 2px;}.openswarm-lang-toggle span.active{color:#39d0ff;font-weight:600;}';
    (document.head || document.documentElement).appendChild(style);
  }

  function renderLangToggle() {
    const lang = getLang();
    return '<button type="button" id="openswarm-lang-toggle" class="openswarm-lang-toggle" title="中/EN" aria-label="Language">' +
      (lang === 'zh' ? '<span class="active">中</span><span>EN</span>' : '<span>中</span><span class="active">EN</span>') +
      '</button>';
  }

  window.OPENSWARM_I18N = {
    getLang: getLang,
    setLang: setLang,
    t: t,
    getHexDisplayName: getHexDisplayName,
    apply: apply,
    renderLangToggle: renderLangToggle,
    T: T,
  };

  window.OPENSWARM_APPLY_I18N = apply;

  function init() {
    injectLangToggleStyles();
    var wrap = document.getElementById('openswarm-lang-toggle-wrap');
    if (wrap) wrap.innerHTML = renderLangToggle();
    apply();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
