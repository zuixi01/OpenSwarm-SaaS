(function() {
  function initProjectCore() {
    if (window.hexChatFileWarn && window.isFileProtocol) window.hexChatFileWarn.style.display = 'block';

    function setHexChatFormEnabled(enabled) {
      var on = enabled && !window.isFileProtocol;
      var hexPending = (typeof window._activeTaskId !== 'undefined' && window._activeTaskId != null)
        || (typeof window._activeAgentTasks !== 'undefined' && window._activeAgentTasks && window._activeAgentTasks.size > 0)
        || (typeof window._hexChatRestoring !== 'undefined' && window._hexChatRestoring);
      if (window.hexChatSend) window.hexChatSend.disabled = !on || !!hexPending;
      if (window.hexChatInput) {
        window.hexChatInput.disabled = !on;
        window.hexChatInput.placeholder = on ? window.t('inputToHex') : window.t('hexChatFileHint');
      }
    }

    function show(msg) {
      window.toast.textContent = msg;
      window.toast.classList.add('show');
      setTimeout(function() { window.toast.classList.remove('show'); }, 3000);
    }

    function escapeHtml(s) {
      var div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    }

    function stripNativeTitles(root) {
      if (!root) return;
      if (root.nodeType === 1) {
        if (root.hasAttribute && root.hasAttribute('title')) root.removeAttribute('title');
        if (root.hasAttribute && root.hasAttribute('data-i18n-title')) root.removeAttribute('data-i18n-title');
      }
      var nodes = root.querySelectorAll ? root.querySelectorAll('[title],[data-i18n-title]') : [];
      nodes.forEach(function(node) {
        node.removeAttribute('title');
        node.removeAttribute('data-i18n-title');
      });
    }

    var hexChatStorageKeyPrefix = 'hex_chat_history_project_';
    var hexChatModeKeyPrefix = 'hex_chat_mode_project_';
    var hexChatRoundsKeyPrefix = 'hex_chat_max_rounds_project_';
    var yinChatStorageKeyPrefix = 'yin_chat_history_project_';

    function getHexChatStorageKey(modeOverride) {
      if (!window.projectId) return null;
      var mode = modeOverride || getHexChatMode();
      return hexChatStorageKeyPrefix + window.projectId + '_' + mode;
    }

    function getHexChatModeKey() {
      return window.projectId ? hexChatModeKeyPrefix + window.projectId : null;
    }

    function getHexChatMode() {
      var key = getHexChatModeKey();
      if (!key) return 'discuss';
      try {
        var value = localStorage.getItem(key);
        return (value === 'single' || value === 'discuss' || value === 'agent') ? value : 'discuss';
      } catch (e) {
        return 'discuss';
      }
    }

    function setHexChatMode(mode) {
      var key = getHexChatModeKey();
      if (!key || (mode !== 'single' && mode !== 'discuss' && mode !== 'agent')) return;
      try { localStorage.setItem(key, mode); } catch (e) {}
    }

    function updateHexChatModeUI() {
      var mode = getHexChatMode();
      document.querySelectorAll('input[name="hexChatMode"]').forEach(function(radio) {
        radio.checked = radio.value === mode;
      });
      var isAgent = mode === 'agent';
      if (window.hexChatInput) {
        window.hexChatInput.placeholder = isAgent ? window.t('dispatchInstructionPlaceholderAgent') : window.t('inputToHex');
      }
    }

    function getHexChatMaxRoundsKey() {
      return window.projectId ? hexChatRoundsKeyPrefix + window.projectId : null;
    }

    function getHexChatMaxRounds() {
      var key = getHexChatMaxRoundsKey();
      if (!key) return 2;
      try {
        var value = parseInt(localStorage.getItem(key), 10);
        return (value >= 1 && value <= 5) ? value : 2;
      } catch (e) {
        return 2;
      }
    }

    function setHexChatMaxRounds(n) {
      var key = getHexChatMaxRoundsKey();
      if (!key || n < 1 || n > 5) return;
      try { localStorage.setItem(key, String(n)); } catch (e) {}
    }

    function updateHexChatRoundsUI() {
      var mode = getHexChatMode();
      var isDiscuss = mode === 'discuss';
      var isAgent = mode === 'agent';
      var rounds = isDiscuss ? getHexChatMaxRounds() : 1;
      if (window.hexChatRoundsValue) window.hexChatRoundsValue.textContent = rounds;
      if (window.hexChatRoundsBtn) {
        window.hexChatRoundsBtn.classList.toggle('disabled', !isDiscuss);
        window.hexChatRoundsBtn.title = isDiscuss ? window.t('roundsTitle') : (isAgent ? window.t('roundsNoRounds') : window.t('roundsFixed1'));
      }
      var roundsWrap = document.getElementById('hexChatRoundsWrap');
      if (roundsWrap) roundsWrap.style.display = isAgent ? 'none' : '';
      if (window.hexChatRoundsPopover) {
        window.hexChatRoundsPopover.querySelectorAll('.hex-chat-rounds-opt').forEach(function(btn) {
          btn.classList.toggle('active', parseInt(btn.getAttribute('data-rounds'), 10) === rounds);
        });
      }
    }

    function updateHexChatState() {
      var el = document.getElementById('hexChatState');
      var mode = getHexChatMode();
      var isDiscuss = mode === 'discuss';
      var isAgent = mode === 'agent';
      var rounds = isDiscuss ? getHexChatMaxRounds() : 1;
      var targetIds = (window.project && window.project.hexIds && window.project.hexIds.length) ? window.project.hexIds.slice() : [];
      var participants = targetIds.length ? window.t('hexParticipants', targetIds.length) : '';
      if (el) {
        if (isAgent) {
          el.textContent = window.t('modeAgentLabel') + (participants ? ' · ' + participants : '');
        } else {
          el.textContent = isDiscuss
            ? (window.t('modeDiscussRound', rounds) + (participants ? ' · ' + participants : ''))
            : (window.t('modeSingleLabel') + (participants ? ' · ' + participants : ''));
        }
      }

      renderHexChatTargetHint();
    }

    function resolveHexChatTargetIds(text) {
      var projectIds = (window.project && window.project.hexIds && window.project.hexIds.length) ? window.project.hexIds.slice() : [];
      if (!projectIds.length) return [];
      if (!text || typeof window.parseMentionedHexNamesFromText !== 'function') return projectIds;
      var mentioned = window.parseMentionedHexNamesFromText(text, projectIds);
      return mentioned && mentioned.length ? mentioned : projectIds;
    }

    function renderHexChatTargetHint() {
      var hintEl = window.hexChatTargetHint || document.getElementById('hexChatTargetHint');
      if (!hintEl) return;
      var mode = getHexChatMode();
      if (mode === 'agent') {
        hintEl.style.display = 'none';
        return;
      }
      var projectIds = (window.project && window.project.hexIds && window.project.hexIds.length) ? window.project.hexIds.slice() : [];
      if (!projectIds.length) {
        hintEl.style.display = 'none';
        return;
      }
      var inputText = window.hexChatInput && typeof window.hexChatInput.value === 'string' ? window.hexChatInput.value.trim() : '';
      var activeTargetIds = resolveHexChatTargetIds(inputText);
      var displayNames = activeTargetIds.map(function(hexId) {
        var hex = (window.hexList || []).find(function(item) { return item.id === hexId; }) || { id: hexId };
        return window.getAgentDisplayName(hexId, hex.label, hex.name);
      });
      var preview = displayNames.slice(0, 5).join('、');
      var more = displayNames.length > 5 ? (' 等 ' + displayNames.length + ' 人') : '';
      var narrowed = inputText && activeTargetIds.length < projectIds.length;
      hintEl.innerHTML = narrowed
        ? '<strong>命中</strong>' + activeTargetIds.length + ' 人 · ' + window.escapeHtml(preview + more)
        : '<strong>目标</strong>' + displayNames.length + ' 人 · ' + window.escapeHtml(preview + more);
      hintEl.style.display = '';
    }

    function getYinChatStorageKey() {
      return window.projectId ? yinChatStorageKeyPrefix + window.projectId : null;
    }

    function getYinChatHistoryForAPI() {
      return (window._yinChatCache || []).slice(-15);
    }

    function saveYinChatHistory() {
      if (!window.projectId || !window.yinChatMessages) return;
      var messages = [];
      window.yinChatMessages.querySelectorAll('.yin-chat-msg').forEach(function(msg) {
        var role = msg.classList.contains('user') ? 'user' : 'yin';
        var text = msg.textContent.replace(/^(我|主控)\s*/, '');
        messages.push({ role: role, text: text });
      });
      window._yinChatCache = messages;
      fetch('/api/chat-history/' + encodeURIComponent(window.projectId) + '/yin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages })
      }).catch(function(e) { console.warn('保存主控对话历史到服务器失败:', e); });
      try { localStorage.setItem(getYinChatStorageKey(), JSON.stringify(messages)); } catch (e) {}
    }

    stripNativeTitles(document.body);
    if (document.body && typeof MutationObserver !== 'undefined') {
      var titleStripObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'attributes') {
            if (mutation.attributeName === 'title' || mutation.attributeName === 'data-i18n-title') {
              mutation.target.removeAttribute(mutation.attributeName);
            }
            return;
          }
          mutation.addedNodes.forEach(function(node) {
            if (node && node.nodeType === 1) stripNativeTitles(node);
          });
        });
      });
      titleStripObserver.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['title', 'data-i18n-title']
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && window.modalSelectHex.classList.contains('show') && typeof window.closeSelectHexModal === 'function') window.closeSelectHexModal();
      var modalScheduleEl = document.getElementById('modalSchedule');
      var modalTriggerEl = document.getElementById('modalTrigger');
      var modalWorkflowEl = document.getElementById('modalWorkflow');
      var modalConfigEl = document.getElementById('modalConfig');
      if (e.key === 'Escape' && modalScheduleEl && modalScheduleEl.classList.contains('show') && typeof window.closeScheduleModal === 'function') window.closeScheduleModal();
      if (e.key === 'Escape' && modalTriggerEl && modalTriggerEl.classList.contains('show') && typeof window.closeTriggerModal === 'function') window.closeTriggerModal();
      if (e.key === 'Escape' && modalWorkflowEl && modalWorkflowEl.classList.contains('show') && typeof window.closeWorkflowModal === 'function') window.closeWorkflowModal();
      if (e.key === 'Escape' && modalConfigEl && modalConfigEl.classList.contains('show') && typeof window.closeConfigModal === 'function') window.closeConfigModal();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        var target = e.target;
        if (target && (target.id === 'hexChatInput' || target.id === 'yinChatInput')) {
          e.preventDefault();
          if (target.id === 'hexChatInput' && window.hexChatSend && !window.hexChatSend.disabled) window.hexChatSend.click();
          if (target.id === 'yinChatInput' && window.yinChatSend && !window.yinChatSend.disabled) window.yinChatSend.click();
        }
      }
    });

    window.setHexChatFormEnabled = setHexChatFormEnabled;
    window.show = show;
    window.escapeHtml = escapeHtml;
    window.stripNativeTitles = stripNativeTitles;
    window.getHexChatStorageKey = getHexChatStorageKey;
    window.getHexChatModeKey = getHexChatModeKey;
    window.getHexChatMode = getHexChatMode;
    window.resolveHexChatTargetIds = resolveHexChatTargetIds;
    window.renderHexChatTargetHint = renderHexChatTargetHint;
    window.setHexChatMode = setHexChatMode;
    window.updateHexChatModeUI = updateHexChatModeUI;
    window.getHexChatMaxRoundsKey = getHexChatMaxRoundsKey;
    window.getHexChatMaxRounds = getHexChatMaxRounds;
    window.setHexChatMaxRounds = setHexChatMaxRounds;
    window.updateHexChatRoundsUI = updateHexChatRoundsUI;
    window.updateHexChatState = updateHexChatState;
    window.getYinChatStorageKey = getYinChatStorageKey;
    window.getYinChatHistoryForAPI = getYinChatHistoryForAPI;
    window.saveYinChatHistory = saveYinChatHistory;
  }

  window.initProjectCore = initProjectCore;
})();
