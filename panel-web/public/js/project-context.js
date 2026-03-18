(function() {
  var tFn = window.OPENSWARM_I18N && window.OPENSWARM_I18N.t
    ? window.OPENSWARM_I18N.t.bind(window.OPENSWARM_I18N)
    : function(k) {
        var args = Array.prototype.slice.call(arguments, 1);
        return (args.length
          ? (k || '').replace(/\{(\d+)\}/g, function(_, i) { return args[Number(i)] != null ? args[Number(i)] : _; })
          : k) || k;
      };
  var getHexDisplayNameFn = window.OPENSWARM_I18N && window.OPENSWARM_I18N.getHexDisplayName
    ? function(id, name) { return window.OPENSWARM_I18N.getHexDisplayName(id, name); }
    : function(id, name) { return name || id; };

  if (window.initDotGridBackground) {
    window.initDotGridBackground({
      containerId: 'starfield',
      dotSize: 1.8,
      gap: 24,
      baseColor: '85,125,168',
      activeColor: '64,211,255',
      bgColor: '5,10,22',
      pulse: 0.26,
      mouseRadius: 180,
      mouseStrength: 1
    });
  }

  var parsedProjectId = (function() {
    var match = /[?&]id=([^&]+)/.exec(window.location.search);
    return match ? decodeURIComponent(match[1]) : '';
  })();

  window.t = tFn;
  window.getHexDisplayName = getHexDisplayNameFn;
  window.projectId = parsedProjectId;
  window.nameEl = document.getElementById('projectPageTitle');
  window.flowTeamNameEl = document.getElementById('flowTeamName');
  window.breadcrumbSep = document.getElementById('breadcrumbSep');
  window.breadcrumbProject = document.getElementById('breadcrumbProject');
  window.ringEl = document.getElementById('ringHexes');
  window.emptyHint = document.getElementById('emptyRingHint');
  window.taijiActions = document.getElementById('taijiActions');
  window.btnOpenSelectHex = document.getElementById('btnOpenSelectHex');
  window.modalSelectHex = document.getElementById('modalSelectHex');
  window.selectHexGrid = document.getElementById('selectHexGrid');
  window.modalBtnDone = document.getElementById('modalBtnDone');
  window.toast = document.getElementById('toast');
  window.hexChatEmpty = document.getElementById('hexChatEmpty');
  window.hexChatFileWarn = document.getElementById('hexChatFileWarn');
  window.hexChatModeRow = document.getElementById('hexChatModeRow');
  window.hexChatStatus = document.getElementById('hexChatStatus');
  window.hexChatTargetHint = document.getElementById('hexChatTargetHint');
  window.sectionHexSwitches = document.getElementById('sectionHexSwitches');
  window.sectionYinDashboard = document.getElementById('sectionYinDashboard');
  window.hexSwitchesEl = document.getElementById('hexSwitches');
  window.hexRuntimeSummary = document.getElementById('hexRuntimeSummary');
  window.hexRuntimeSummaryText = document.getElementById('hexRuntimeSummaryText');
  window.hexRuntimeAlertText = document.getElementById('hexRuntimeAlertText');
  window.hexRuntimeBatchState = document.getElementById('hexRuntimeBatchState');
  window.hexRuntimeBatchStateTitle = document.getElementById('hexRuntimeBatchStateTitle');
  window.hexRuntimeBatchStateDesc = document.getElementById('hexRuntimeBatchStateDesc');
  window.hexRuntimeBatchStateElapsed = document.getElementById('hexRuntimeBatchStateElapsed');
  window.hexRuntimeBatchStateBar = document.getElementById('hexRuntimeBatchStateBar');
  window.hexChatRow = document.getElementById('hexChatRow');
  window.hexChatInput = document.getElementById('hexChatInput');
  window.hexChatSend = document.getElementById('hexChatSend');
  window.hexChatMessages = document.getElementById('hexChatMessages');
  window.hexChatRoundsBtn = document.getElementById('hexChatRoundsBtn');
  window.hexChatRoundsValue = document.getElementById('hexChatRoundsValue');
  window.hexChatRoundsPopover = document.getElementById('hexChatRoundsPopover');
  window.yinChatInput = document.getElementById('yinChatInput');
  window.yinChatSend = document.getElementById('yinChatSend');
  window.yinChatMessages = document.getElementById('yinChatMessages');
  window.chatWorkspaceShell = document.getElementById('chatWorkspaceShell');
  window.chatWorkspaceBody = document.getElementById('chatWorkspaceBody');
  window.chatWorkspaceToolbarSlot = document.getElementById('chatWorkspaceToolbarSlot');
  window.chatWorkspaceControls = document.getElementById('chatWorkspaceControls');
  window.chatTabHex = document.getElementById('chatTabHex');
  window.chatTabYin = document.getElementById('chatTabYin');
  window.chatResizer = document.getElementById('chatResizer');
  window.chatSectionsContainer = document.querySelector('.chat-sections-container');
  window.sectionHexChat = document.querySelector('.section-hex-chat');
  window.sectionYinChat = document.querySelector('.section-yin-chat');

  window.project = null;
  window.hexList = [];
  window.robots = [];
  window.tenantRuntime = null;
  window.tenantRuntimeAgents = [];
  window.tenantRuntimeAlerts = null;
  window.AGENT_SLOT_INDEX = { qian: 1, kun: 2, tai: 3, pi: 4, xun: 5, yu: 6, sui: 7, gu: 8, lin: 9, guan: 10 };

  window.getAgentNoTag = function(hexId) {
    if (window.AGENT_SLOT_INDEX[hexId]) return 'NO.' + String(window.AGENT_SLOT_INDEX[hexId]).padStart(2, '0');
    var match = /^h(\d{2})$/i.exec(String(hexId || ''));
    if (match) {
      var num = parseInt(match[1], 10);
      if (num >= 11 && num <= 64) return 'NO.' + String(num).padStart(2, '0');
    }
    return null;
  };

  window.getRobotLabel = function(hexId) {
    var robot = window.robots.find(function(item) { return item.id === hexId; });
    var label = robot && robot.label ? String(robot.label).trim() : '';
    return label || '';
  };

  window.getAgentDisplayName = function(hexId, maybeLabel, maybeName) {
    var label = maybeLabel ? String(maybeLabel).trim() : '';
    if (!label) label = window.getRobotLabel(hexId);
    if (label) return label;
    var code = getHexDisplayNameFn(hexId, '');
    if (code && /^DG-\d{2}$/i.test(String(code))) return String(code).toUpperCase();
    var noTag = window.getAgentNoTag(hexId);
    if (noTag) return noTag;
    var fallback = String(maybeName || '').trim();
    if (/^(DG-\d{2}|NO\.\d{2})$/i.test(fallback)) return fallback.toUpperCase();
    return 'NO.--';
  };

  window.normalizeAgentDisplayName = function(rawName) {
    var name = String(rawName || '').trim();
    if (!name) return '';
    if (/^(DG-\d{2}|NO\.\d{2}|NO\.\-\-)$/i.test(name)) return name.toUpperCase();
    for (var i = 0; i < window.hexList.length; i++) {
      var hex = window.hexList[i];
      var legacyName = hex && hex.name ? String(hex.name).trim() : '';
      if (legacyName && legacyName === name) return window.getAgentDisplayName(hex.id, hex.label, hex.name);
    }
    return name;
  };

  window.isFileProtocol = window.location.protocol === 'file:';
})();
