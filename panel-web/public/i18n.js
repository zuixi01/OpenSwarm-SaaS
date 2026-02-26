/**
 * Yinova 中英文切换 · 方案 A
 * 词典 + data-i18n + t() + apply()
 */
(function() {
  'use strict';

  const STORAGE_KEY = 'yinova_lang';

  const T = {
    zh: {
      // index
      title: 'Yinova · 六十四卦控制面板',
      configTitle: '配置 · Yinova',
      projectsTitle: '项目空间 · Yinova',
      projectTitle: '项目 · Yinova',
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
      yinClickStart: '阴 · 点击启动',
      yinClickStop: '阴 · 点击停止',
      yangDisplayOnly: '阳 · 技能组装',
      hexLabelWithCount: '卦象 · 已启动 {0}',
      btnCloseAllTerminals: '一键关闭所有终端',
      btnCloseAllTerminalsTitle: '关闭 64 卦中由面板打开的所有终端窗口（不停止网关）',
      btnStart: '启动',
      btnStop: '停止',
      statusRunning: '运行中',
      statusStopped: '未运行',
      hexLabel: '标签',
      hexLabelEdit: '编辑标签',
      hexLabelSet: '设置标签',
      hexLabelPrompt: '编辑该卦的标签（方便区分角色，卦与卦可见）',
      hexLabelSaved: '标签已保存',
      toastTerminalOpened: '已弹出终端',
      toastTerminalReused: '已激活已有终端',
      toastStopped: '已停止',
      toastStartFailed: '启动失败',
      toastStopFailed: '停止失败',
      toastRequestFailed: '请求失败',
      toastDisplayOnly: '仅作展示',
      toastYangComingSoon: '敬请期待2.0版本',
      yinDescGlobal: '此处对话与终端 TUI 独立',
      toastClosedAll: '已关闭所有卦终端并停止网关，正在更新状态…',
      toastNoTerminals: '没有由面板打开的终端',
      toastStatusUpdated: '状态已更新',
      toastCloseFailed: '关闭失败',
      // config
      configFirst: '首次配置',
      configSub: '选择模型提供商并填写 API Key，即可启用 Yinova 全部功能',
      modelProvider: '模型提供商',
      modelPrimary: '主模型',
      apiKeyRequired: 'API Key（必填）',
      apiKeyHint: '从对应提供商控制台获取 API Key',
      portHexLabel: '六十四卦起始端口',
      btnCheckPorts: '检测端口占用',
      btnSaveConfig: '保存配置',
      linkBackPanel: '已配置？返回主面板',
      checking: '检测中…',
      portFree: '空闲',
      portUsed: '已占用',
      portAutoFixed: '已检测到占用，已自动配置空闲端口',
      portMainLabel: '主网关',
      portHexLabelShort: '卦起始',
      portPanelLabel: '面板',
      checkFailed: '检测失败',
      fillApiKey: '请填写 API Key',
      configSaved: '配置已保存。阴与64卦已更新 API Key。若阴/卦正在运行，请重启后生效。',
      configured: '已配置',
      configuredPlaceholder: '已配置（留空则不修改）',
      requestFailed: '请求失败，请检查面板服务是否正常',
      provider: '模型提供商',
      apiKey: 'API Key',
      apiKeyPlaceholder: '在此粘贴你的 API Key',
      save: '保存',
      checkPorts: '检测端口占用',
      portMain: '主网关端口',
      portHexStart: '卦起始端口',
      panelPort: '面板端口',
      saved: '已保存',
      saveFailed: '保存失败',
      // projects
      backHome: '← 面板首页',
      linkBackToProjects: '← 项目列表',
      projects: '项目',
      newProject: '新建项目',
      projectName: '项目名称',
      selectHex: '选卦',
      noProjects: '暂无项目',
      deleteProject: '删除项目',
      // project (common)
      withYin: '与阴对话',
      withHex: '与卦对话',
      yinDesc: '此处对话仅属于当前项目，与终端 TUI 独立',
      inputToYin: '输入消息，与阴总控对话…',
      inputToHex: '输入消息，向本项目各卦发送…',
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
      projectList: '项目列表',
      inputProjectName: '输入项目名称',
      btnCreate: '新建',
      emptyHint: '暂无项目，上方创建后即可在项目内选卦、与阴对话。',
      withYinGlobal: '与阴对话（全局）',
      inputToYinShort: '输入消息与阴对话…',
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
      hexCount: '卦象 {0} 个',
      hexNotSelected: '未选',
      hexDefinitionName: '卦的自定义',
      me: '我',
      you: '你',
      yinLabel: '阴',
      confirmClearYinChat: '确定清空与阴的全部聊天记录？',
      yinNoReply: '暂时无法收到阴的回复',
      yinNoReplyWith: '（暂时无法收到阴的回复：{0}）',
      toastRequestFailedShort: '请求失败',
      yangClickStart: '阳 · 点击启动',
      yangClickStop: '阳 · 点击停止',
      createProject: '新建项目',
      btnSend: '发送',
      yinClickMain: '阴 · 平台总控 · 点击启动/停止',
      yinClickMainStart: '阴 · 平台总控 · 点击启动',
      yinClickMainStop: '阴 · 平台总控 · 点击停止',
      clickEditName: '点击编辑名称',
      // project
      hexSwitchesTitle: '本项目卦象 · 启停',
      selectHexModalTitle: '选择卦象 · 点击加入/取消加入本项目',
      modalDone: '完成',
      clearMemoryAlso: '同时清空本项目记忆',
      cancel: '取消',
      ok: '确定',
      pinFullscreen: '点击固定为全屏',
      layoutHexFull: '与卦对话全屏',
      layoutHalf: '左右各半，可拖动调整',
      layoutYinFull: '与阴对话全屏',
      modeLabel: '模式：',
      hexChatEmpty: '请先在「选卦」中为本项目添加卦象，再在此发消息；向本项目各卦群发，回复按卦展示（类似群聊）。',
      hexChatFileWarn: '当前为文件方式打开页面，与卦对话无法请求接口。请用浏览器打开：http://localhost:3999/project.html（并确保已启动面板）。',
      hexChatFileHint: '请用 http://localhost:3999/project.html 打开页面后再发消息',
      roundsSelect: '选择讨论轮数',
      roundN: '{0} 轮',
      roundSuffix: '轮',
      dispatchPanelTitle: '派发执行任务',
      dispatchContextLabel: '讨论背景（自动提取，可忽略）：',
      dispatchInstructionPlaceholder: '输入具体执行指令，例如：根据上面的讨论，生成一个完整的 PRD 文档，保存到 output/ 目录',
      selectExecHex: '选择执行卦：',
      dispatchSend: '派发',
      projectFilesTitle: '项目产出文件',
      refresh: '刷新',
      close: '关闭',
      loading: '加载中…',
      confirmClearSingle: '确定清空单聊与卦对话记录？',
      confirmClearDiscuss: '确定清空群聊与卦对话记录？',
      confirmClearAllHex: '确定清空全部与卦对话记录？',
      toastClearedSingle: '已清空单聊记录',
      toastClearedDiscuss: '已清空群聊记录',
      toastClearedAll: '已清空全部记录',
      toastClearedYin: '已清空与阴的聊天记录',
      andMemory: '及本项目记忆',
      toastSendStart: '已发送启动',
      toastSendStop: '已发送停止',
      toastSendBatchStart: '已发送一键启动',
      toastSendBatchStop: '已发送一键停止',
      hexChatNoConnect: '当前所选卦均无法连接。请在本页「本项目卦象 · 启停」处对需要对话的卦点击「启动」，等待显示为运行中后再发消息。',
      hexChatTimeout: '上次发送的消息因服务重启而超时，请重新发送。',
      serviceError: '服务异常',
      serviceErrorWith: '服务异常：{0}',
      taskFailed: '执行任务失败',
      taskFailedWith: '执行任务失败：{0}',
      noTaskId: '未收到任务 ID，请检查服务端日志。',
      requestFailedWith: '请求失败：{0}',
      connectPanelHint: '无法连接到面板接口。请用浏览器打开：{0} ，并确保已启动面板（在 panel-web 目录运行 node server.js 或双击 start-panel.command）。若当前是用文件方式打开的页面，请改用上述地址打开。',
      waitingHexReply: '正在等待卦的回复…',
      waitingHexReplyBg: '正在等待卦的回复…（后台运行中）',
      waitingYinReply: '等待阴回复中…（换页不中断）',
      pleaseEnterFromProjects: '请从项目列表进入',
      taskExecutedNoReply: '（任务已执行，无文字回复）',
      modeAgentLabel: '⚡ 执行任务模式',
      modeDiscussRound: '群讨论 · {0} 轮',
      modeSingleLabel: '群发单聊',
      hexParticipants: '{0} 卦',
      hexExecTaskElapsed: '⚡ {0} 正在执行任务… ({1}s)',
      systemLabel: '系统',
      hexChatSending: '正在向各卦发送…',
      hexChatExecTask: '⚡ 正在让 {0} 执行任务（工具模式）…',
      dispatchEnterInstruction: '请输入任务指令',
      selectAtLeastOneHex: '请至少选一个卦',
      dispatching: '派发中…',
      toastUpdated: '已更新',
      toastUpdateFailed: '更新失败',
      yinReady: '阴已就绪，可与阴对话说明需求。',
      dispatchInstructionPlaceholderAgent: '输入任务指令，用 @卦名 指定执行的卦（如 @乾 帮我写一首诗存到文件）…',
      pinFullscreenShort: '固定',
      clearSingleTitle: '只清空群发单聊产生的消息',
      clearDiscussTitle: '只清空群讨论产生的消息',
      clearAllTitle: '清空全部与卦对话历史',
      updateMemoryTitle: '让阴提炼本次对话的关键内容，存入项目记忆',
      projectFilesTitleShort: '项目产出文件',
      dispatchTaskTitle: '把当前讨论内容作为背景，派发执行任务给指定卦',
      modeSingleTitle: '群发单聊：所有卦都收到消息，但看不到其他卦的回复。@ 触发时只让被 @ 的卦回复。',
      modeDiscussTitle: '群讨论：各卦能看到其他卦的回复，并可追加讨论。',
      modeAgentTitle: '执行任务：通过 WebSocket 让指定卦真正调用工具执行任务（写文件、运行命令等），结果保存到项目产出目录。需指定 @卦名。',
      roundsTitle: '选择讨论轮数',
      roundsFixed1: '群发单聊固定 1 轮',
      roundsNoRounds: '执行任务模式不使用轮次',
      // lang toggle
      langZh: '中',
      langEn: 'EN',
    },
    en: {
      // index
      title: 'Yinova · 64 Hexagrams Control Panel',
      configTitle: 'Config · Yinova',
      projectsTitle: 'Projects · Yinova',
      projectTitle: 'Project · Yinova',
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
      yinClickStart: 'Yin · Click to start',
      yinClickStop: 'Yin · Click to stop',
      yangDisplayOnly: 'Yang · Skill assembly',
      hexLabelWithCount: 'Hexagrams · Running {0}',
      btnCloseAllTerminals: 'Close All Terminals',
      btnCloseAllTerminalsTitle: 'Close all terminal windows opened by panel (gateways keep running)',
      btnStart: 'Start',
      btnStop: 'Stop',
      statusRunning: 'Running',
      statusStopped: 'Stopped',
      hexLabel: 'Label',
      hexLabelEdit: 'Edit label',
      hexLabelSet: 'Set label',
      hexLabelPrompt: 'Edit this hex\'s label (visible to other hexes)',
      hexLabelSaved: 'Label saved',
      toastTerminalOpened: 'Terminal opened',
      toastTerminalReused: 'Existing terminal activated',
      toastStopped: 'Stopped',
      toastStartFailed: 'Start failed',
      toastStopFailed: 'Stop failed',
      toastRequestFailed: 'Request failed',
      toastDisplayOnly: 'Display only',
      toastYangComingSoon: 'Coming in v2.0',
      yinDescGlobal: 'This chat is independent from terminal TUI',
      toastClosedAll: 'Closed all hex terminals and gateways, updating…',
      toastNoTerminals: 'No panel-opened terminals',
      toastStatusUpdated: 'Status updated',
      toastCloseFailed: 'Close failed',
      // config
      configFirst: 'First-time Setup',
      configSub: 'Select provider and enter API Key to enable all Yinova features.',
      modelProvider: 'Model Provider',
      modelPrimary: 'Primary Model',
      apiKeyRequired: 'API Key (required)',
      apiKeyHint: 'Get API Key from provider console',
      portHexLabel: 'Hex Start Port',
      btnCheckPorts: 'Check Ports',
      btnSaveConfig: 'Save Config',
      linkBackPanel: 'Configured? Back to Panel',
      checking: 'Checking…',
      portFree: 'Free',
      portUsed: 'In Use',
      portAutoFixed: 'Ports in use detected. Auto-configured to free ports.',
      portMainLabel: 'Main GW',
      portHexLabelShort: 'Hex Start',
      portPanelLabel: 'Panel',
      checkFailed: 'Check failed',
      fillApiKey: 'Please enter API Key',
      configSaved: 'Config saved. Yin and 64 hexes updated. Restart Yin/hex if running.',
      configured: 'Configured',
      configuredPlaceholder: 'Configured (leave blank to keep)',
      requestFailed: 'Request failed. Check if panel is running.',
      provider: 'Model Provider',
      apiKey: 'API Key',
      apiKeyPlaceholder: 'Paste your API Key here',
      save: 'Save',
      checkPorts: 'Check Ports',
      portMain: 'Main Gateway Port',
      portHexStart: 'Hex Start Port',
      panelPort: 'Panel Port',
      saved: 'Saved',
      saveFailed: 'Save failed',
      // projects
      backHome: '← Panel',
      linkBackToProjects: '← Projects',
      projects: 'Projects',
      newProject: 'New Project',
      projectName: 'Project Name',
      selectHex: 'Select Hex',
      noProjects: 'No projects yet',
      deleteProject: 'Delete',
      // project (common)
      withYin: 'Chat with Yin',
      withHex: 'Chat with Hexes',
      yinDesc: 'This chat belongs to current project only; independent from terminal TUI',
      inputToYin: 'Message Yin master control…',
      inputToHex: 'Message hexes in this project…',
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
      projectList: 'Project List',
      inputProjectName: 'Enter project name',
      btnCreate: 'New',
      emptyHint: 'No projects yet. Create one above to select hexes and chat with Yin.',
      withYinGlobal: 'Chat with Yin (Global)',
      inputToYinShort: 'Message Yin…',
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
      hexCount: '{0} hexes',
      hexNotSelected: 'None',
      hexDefinitionName: 'Hex Definition',
      me: 'Me',
      you: 'You',
      yinLabel: 'Yin',
      confirmClearYinChat: 'Clear all chat history with Yin?',
      yinNoReply: 'Unable to receive Yin reply',
      yinNoReplyWith: '(Unable to receive Yin reply: {0})',
      toastRequestFailedShort: 'Request failed',
      yangClickStart: 'Yang · Click to start',
      yangClickStop: 'Yang · Click to stop',
      createProject: 'New Project',
      btnSend: 'Send',
      yinClickMain: 'Yin · Master · Click to start/stop',
      yinClickMainStart: 'Yin · Master · Click to start',
      yinClickMainStop: 'Yin · Master · Click to stop',
      clickEditName: 'Click to edit',
      // project
      hexSwitchesTitle: 'Project Hexes · Start/Stop',
      selectHexModalTitle: 'Select hexes · Click to add/remove',
      modalDone: 'Done',
      clearMemoryAlso: 'Also clear project memory',
      cancel: 'Cancel',
      ok: 'OK',
      pinFullscreen: 'Pin fullscreen',
      layoutHexFull: 'Hex chat fullscreen',
      layoutHalf: 'Split view, drag to resize',
      layoutYinFull: 'Yin chat fullscreen',
      modeLabel: 'Mode:',
      hexChatEmpty: 'Add hexes in "Select Hex" first, then send messages. Replies shown per hex (like group chat).',
      hexChatFileWarn: 'File protocol: API unavailable. Open http://localhost:3999/project.html in browser.',
      hexChatFileHint: 'Open http://localhost:3999/project.html in browser to send messages',
      roundsSelect: 'Select rounds',
      roundN: '{0} rounds',
      roundSuffix: 'rounds',
      dispatchPanelTitle: 'Dispatch Task',
      dispatchContextLabel: 'Context (auto-extracted):',
      dispatchInstructionPlaceholder: 'Enter instruction, e.g. Generate PRD to output/',
      selectExecHex: 'Select hex:',
      dispatchSend: 'Dispatch',
      projectFilesTitle: 'Project Output Files',
      refresh: 'Refresh',
      close: 'Close',
      loading: 'Loading…',
      confirmClearSingle: 'Clear single-chat hex records?',
      confirmClearDiscuss: 'Clear discuss hex records?',
      confirmClearAllHex: 'Clear all hex chat records?',
      toastClearedSingle: 'Single chat cleared',
      toastClearedDiscuss: 'Discuss chat cleared',
      toastClearedAll: 'All cleared',
      toastClearedYin: 'Yin chat cleared',
      andMemory: ' and project memory',
      toastSendStart: 'Start sent',
      toastSendStop: 'Stop sent',
      toastSendBatchStart: 'Batch start sent',
      toastSendBatchStop: 'Batch stop sent',
      hexChatNoConnect: 'Selected hexes cannot connect. Start them in "Hex Switches" section, then wait until running.',
      hexChatTimeout: 'Last message timed out. Please resend.',
      serviceError: 'Service error',
      serviceErrorWith: 'Service error: {0}',
      taskFailed: 'Task failed',
      taskFailedWith: 'Task failed: {0}',
      noTaskId: 'No task ID received. Check server logs.',
      requestFailedWith: 'Request failed: {0}',
      connectPanelHint: 'Cannot connect to panel. Open {0} in browser and ensure panel is running (node server.js in panel-web).',
      waitingHexReply: 'Waiting for hex replies…',
      waitingHexReplyBg: 'Waiting for hex replies… (running in background)',
      waitingYinReply: 'Waiting for Yin reply… (continues across pages)',
      pleaseEnterFromProjects: 'Please enter from project list',
      taskExecutedNoReply: '(Task executed, no text reply)',
      modeAgentLabel: '⚡ Execute Task',
      modeDiscussRound: 'Discuss · {0} rounds',
      modeSingleLabel: 'Single Chat',
      hexParticipants: '{0} hexes',
      hexExecTaskElapsed: '⚡ {0} executing… ({1}s)',
      systemLabel: 'System',
      hexChatSending: 'Sending to hexes…',
      hexChatExecTask: '⚡  Executing task with {0} (tool mode)…',
      dispatchEnterInstruction: 'Enter task instruction',
      selectAtLeastOneHex: 'Select at least one hex',
      dispatching: 'Dispatching…',
      toastUpdated: 'Updated',
      toastUpdateFailed: 'Update failed',
      yinReady: 'Yin ready. Chat with Yin to describe your needs.',
      dispatchInstructionPlaceholderAgent: 'Enter task instruction with @hexname (e.g. @乾 write a poem to file)…',
      pinFullscreenShort: 'Pin',
      clearSingleTitle: 'Clear single-chat messages only',
      clearDiscussTitle: 'Clear discuss messages only',
      clearAllTitle: 'Clear all hex chat history',
      updateMemoryTitle: 'Let Yin extract key content and save to project memory',
      projectFilesTitleShort: 'Project Output Files',
      dispatchTaskTitle: 'Dispatch task to selected hex with current discussion as context',
      modeSingleTitle: 'Single: All hexes receive message but cannot see others\' replies. @ triggers only the mentioned hex.',
      modeDiscussTitle: 'Discuss: Hexes see each other\'s replies and can add more.',
      modeAgentTitle: 'Execute: WebSocket lets specified hex run tools (write files, run commands). Results saved to project output. Use @hexname.',
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
    if (typeof window.YINOVA_APPLY_I18N === 'function') window.YINOVA_APPLY_I18N();
    if (typeof window.YINOVA_APPLY_I18N_EXTRAS === 'function') window.YINOVA_APPLY_I18N_EXTRAS();
  }

  // 64 卦英文模式：3 字母拼音缩写
  const HEX_NAME_EN = {
    qian: 'Qia', kun: 'Kun', tai: 'Tai', pi: 'Pi',
    xun: 'Xun', yu: 'Yu', sui: 'Sui', gu: 'Gu',
    lin: 'Lin', guan: 'Gua',
    h11: 'Tun', h12: 'Men', h13: 'Xu', h14: 'Son',
    h15: 'Shi', h16: 'Bi', h17: 'Xia', h18: 'Lv',
    h19: 'Ton', h20: 'Day', h21: 'Shk', h22: 'Ben',
    h23: 'Bo', h24: 'Fu', h25: 'Wu', h26: 'Dac',
    h27: 'Yi', h28: 'Dag', h29: 'Kan', h30: 'Li',
    h31: 'Xan', h32: 'Hen', h33: 'Dun', h34: 'Daz',
    h35: 'Jin', h36: 'Min', h37: 'Jia', h38: 'Kui',
    h39: 'Jan', h40: 'Xie', h41: 'Sun', h42: 'Yii',
    h43: 'Gya', h44: 'Gou', h45: 'Cui', h46: 'She',
    h47: 'Kon', h48: 'Jig', h49: 'Ge', h50: 'Din',
    h51: 'Zhe', h52: 'Gen', h53: 'Jia', h54: 'Gui',
    h55: 'Fen', h56: 'Lyu', h57: 'Xun', h58: 'Dui',
    h59: 'Hua', h60: 'Jie', h61: 'Zho', h62: 'Xio',
    h63: 'Jic', h64: 'Wei'
  };

  function getHexDisplayName(hexId, zhName) {
    if (getLang() === 'en' && hexId && HEX_NAME_EN[hexId]) return HEX_NAME_EN[hexId];
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
    var toggle = document.getElementById('yinova-lang-toggle');
    if (toggle) {
      toggle.innerHTML = lang === 'zh' ? '<span class="active">中</span><span>EN</span>' : '<span>中</span><span class="active">EN</span>';
      toggle.onclick = function() {
        setLang(getLang() === 'zh' ? 'en' : 'zh');
      };
    }
  }

  function injectLangToggleStyles() {
    if (document.getElementById('yinova-lang-styles')) return;
    var style = document.createElement('style');
    style.id = 'yinova-lang-styles';
    style.textContent = '.yinova-lang-toggle{display:inline-flex;align-items:center;gap:2px;padding:4px 8px;font-size:0.75rem;background:rgba(0,0,0,0.4);border:1px solid rgba(201,162,39,0.3);border-radius:4px;color:rgba(168,166,164,0.9);cursor:pointer;font-family:inherit;}.yinova-lang-toggle:hover{border-color:rgba(201,162,39,0.5);color:#c9a227;}.yinova-lang-toggle span{padding:0 2px;}.yinova-lang-toggle span.active{color:#c9a227;font-weight:600;}';
    (document.head || document.documentElement).appendChild(style);
  }

  function renderLangToggle() {
    const lang = getLang();
    return '<button type="button" id="yinova-lang-toggle" class="yinova-lang-toggle" title="中/EN" aria-label="Language">' +
      (lang === 'zh' ? '<span class="active">中</span><span>EN</span>' : '<span>中</span><span class="active">EN</span>') +
      '</button>';
  }

  window.YINOVA_I18N = {
    getLang: getLang,
    setLang: setLang,
    t: t,
    getHexDisplayName: getHexDisplayName,
    apply: apply,
    renderLangToggle: renderLangToggle,
    T: T,
  };

  window.YINOVA_APPLY_I18N = apply;

  function init() {
    injectLangToggleStyles();
    var wrap = document.getElementById('yinova-lang-toggle-wrap');
    if (wrap) wrap.innerHTML = renderLangToggle();
    apply();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
