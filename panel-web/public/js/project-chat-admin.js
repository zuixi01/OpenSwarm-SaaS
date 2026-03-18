(function() {
  function initProjectChatAdmin() {
    var overlay = document.getElementById('modalClearConfirm');
    var msgEl = document.getElementById('modalClearMessage');
    var chk = document.getElementById('modalClearMemory');
    var btnOk = document.getElementById('modalClearOk');
    var btnCancel = document.getElementById('modalClearCancel');

    function showClearConfirmModal(message) {
      if (!overlay || !msgEl || !chk || !btnOk || !btnCancel) {
        return Promise.resolve({ confirmed: false, clearMemory: false });
      }
      msgEl.textContent = message;
      chk.checked = false;
      overlay.classList.add('show');
      overlay.setAttribute('aria-hidden', 'false');
      return new Promise(function(resolve) {
        function done(confirmed, clearMemory) {
          overlay.classList.remove('show');
          overlay.setAttribute('aria-hidden', 'true');
          resolve({ confirmed: !!confirmed, clearMemory: !!clearMemory });
        }
        function onOk() {
          btnOk.removeEventListener('click', onOk);
          btnCancel.removeEventListener('click', onCancel);
          overlay.removeEventListener('click', onOverlay);
          done(true, chk.checked);
        }
        function onCancel() {
          btnOk.removeEventListener('click', onOk);
          btnCancel.removeEventListener('click', onCancel);
          overlay.removeEventListener('click', onOverlay);
          done(false, false);
        }
        function onOverlay(e) {
          if (e.target === overlay) onCancel();
        }
        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
        overlay.addEventListener('click', onOverlay);
      });
    }

    function clearProjectMemoryIfNeeded(confirmed) {
      if (!confirmed || !confirmed.clearMemory || !window.projectId) return;
      fetch('/api/project-memory/' + encodeURIComponent(window.projectId), { method: 'DELETE' }).catch(function() {});
    }

    var btnSingle = document.getElementById('hexChatClearSingle');
    var btnDiscuss = document.getElementById('hexChatClearDiscuss');
    var btnAll = document.getElementById('hexChatClearAll');
    var yinChatClearBtn = document.getElementById('yinChatClearBtn');
    var yinChatClearBtnShared = document.getElementById('yinChatClearBtnShared');

    if (btnSingle) {
      btnSingle.addEventListener('click', function() {
        showClearConfirmModal(window.t('confirmClearSingle')).then(function(result) {
          if (!result.confirmed) return;
          window.clearHexChatHistoryByMode('single');
          clearProjectMemoryIfNeeded(result);
          window.show(window.t('toastClearedSingle') + (result.clearMemory ? window.t('andMemory') : ''));
        });
      });
    }

    if (btnDiscuss) {
      btnDiscuss.addEventListener('click', function() {
        showClearConfirmModal(window.t('confirmClearDiscuss')).then(function(result) {
          if (!result.confirmed) return;
          window.clearHexChatHistoryByMode('discuss');
          clearProjectMemoryIfNeeded(result);
          window.show(window.t('toastClearedDiscuss') + (result.clearMemory ? window.t('andMemory') : ''));
        });
      });
    }

    if (btnAll) {
      btnAll.addEventListener('click', function() {
        showClearConfirmModal(window.t('confirmClearAllHex')).then(function(result) {
          if (!result.confirmed) return;
          window.clearHexChatHistoryByMode('all');
          clearProjectMemoryIfNeeded(result);
          window.show(window.t('toastClearedAll') + (result.clearMemory ? window.t('andMemory') : ''));
        });
      });
    }

    function bindYinClearButton(btn) {
      if (!btn) return;
      btn.addEventListener('click', function() {
        showClearConfirmModal(window.t('confirmClearYinChat')).then(function(result) {
          if (!result.confirmed) return;
          window._yinChatCache = [];
          if (window.yinChatMessages) {
            window.yinChatMessages.innerHTML = '';
            window.appendYinChatEmptyHint();
          }
          try { localStorage.removeItem(window.getYinChatStorageKey()); } catch (e) {}
          if (window.projectId) {
            fetch('/api/chat-history/' + encodeURIComponent(window.projectId) + '/yin', { method: 'DELETE' }).catch(function(e) {
              console.warn('清空主控历史失败:', e);
            });
          }
          clearProjectMemoryIfNeeded(result);
          window.show(window.t('toastClearedYin') + (result.clearMemory ? window.t('andMemory') : ''));
        });
      });
    }
    bindYinClearButton(yinChatClearBtn);
    bindYinClearButton(yinChatClearBtnShared);

    window.showClearConfirmModal = showClearConfirmModal;
  }

  window.initProjectChatAdmin = initProjectChatAdmin;
})();
