(function() {
  function initProjectLayout() {
    var panelHex = window.sectionHexChat;
    var panelYin = window.sectionYinChat;
    var tabHex = window.chatTabHex;
    var tabYin = window.chatTabYin;
    var toolbar = document.getElementById('hexChatToolbar');
    var toolbarSlot = window.chatWorkspaceToolbarSlot;
    var controlsSlot = window.chatWorkspaceControls;
    var modeRow = window.hexChatModeRow;
    var targetHint = window.hexChatTargetHint;
    var CHANNEL_KEY = 'chat_workspace_channel';

    function getChannel() {
      try {
        var saved = localStorage.getItem(CHANNEL_KEY);
        return saved === 'yin' ? 'yin' : 'hex';
      } catch (e) {
        return 'hex';
      }
    }

    function saveChannel(channel) {
      try { localStorage.setItem(CHANNEL_KEY, channel); } catch (e) {}
    }

    function moveToolbar() {
      if (!toolbar || !toolbarSlot || toolbar.parentNode === toolbarSlot) return;
      toolbarSlot.appendChild(toolbar);
    }

    function moveControls() {
      if (controlsSlot && modeRow && modeRow.parentNode !== controlsSlot) controlsSlot.appendChild(modeRow);
      if (controlsSlot && targetHint && targetHint.parentNode !== controlsSlot) controlsSlot.appendChild(targetHint);
    }

    function applyChannel(channel) {
      moveToolbar();
      moveControls();
      var useYin = channel === 'yin';
      if (panelHex) panelHex.classList.toggle('is-hidden', useYin);
      if (panelYin) panelYin.classList.toggle('is-hidden', !useYin);
      if (tabHex) tabHex.classList.toggle('active', !useYin);
      if (tabYin) tabYin.classList.toggle('active', useYin);
      if (controlsSlot) controlsSlot.style.display = useYin ? 'none' : 'flex';
      if (typeof window.renderHexChatTargetHint === 'function' && !useYin) {
        window.renderHexChatTargetHint();
      }
      setTimeout(function() {
        if (useYin && window.yinChatInput) window.yinChatInput.focus();
        if (!useYin && window.hexChatInput) window.hexChatInput.focus();
      }, 20);
      if (window.chatSectionsContainer) {
        window.chatSectionsContainer.classList.remove('is-booting');
      }
    }

    if (tabHex) {
      tabHex.addEventListener('click', function() {
        saveChannel('hex');
        applyChannel('hex');
      });
    }

    if (tabYin) {
      tabYin.addEventListener('click', function() {
        saveChannel('yin');
        applyChannel('yin');
      });
    }

    window._applyLayoutMode = function(mode) {
      var channel = mode === 'yin' ? 'yin' : 'hex';
      saveChannel(channel);
      applyChannel(channel);
    };

    window._setChatWorkspaceChannel = function(channel) {
      var next = channel === 'yin' ? 'yin' : 'hex';
      saveChannel(next);
      applyChannel(next);
    };

    window.addEventListener('load', function() {
      setTimeout(function() {
        moveToolbar();
        moveControls();
        applyChannel(getChannel());
      }, 80);
    });
  }

  window.initProjectLayout = initProjectLayout;
})();
