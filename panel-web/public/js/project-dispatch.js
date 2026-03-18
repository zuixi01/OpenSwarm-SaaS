(function() {
  function initProjectDispatch() {
    var btnDispatchTask = document.getElementById('btnDispatchTask');
    var dispatchPanel = document.getElementById('modalDispatch');
    var dispatchContext = document.getElementById('dispatchContext');
    var dispatchInstruction = document.getElementById('dispatchInstruction');
    var dispatchHexList = document.getElementById('dispatchHexList');
    var dispatchSendBtn = document.getElementById('dispatchSendBtn');
    var dispatchAutonomyBtn = document.getElementById('dispatchAutonomyBtn');
    var dispatchCancelBtn = document.getElementById('dispatchCancelBtn');
    var dispatchStatus = document.getElementById('dispatchStatus');

    function buildDiscussContext() {
      var msgs = window._hexChatCache && window._hexChatCache.discuss ? window._hexChatCache.discuss : [];
      if (!msgs.length) msgs = window._hexChatCache && window._hexChatCache.single ? window._hexChatCache.single : [];
      var lines = [];
      msgs.forEach(function(m) {
        if (!m.message) return;
        if (m.type === 'user') lines.push('【用户】' + m.message.slice(0, 200));
        else if (m.type === 'hex' && m.name) lines.push('【' + m.name + '】' + m.message.slice(0, 300));
        else if (m.type === 'summary') lines.push('【讨论摘要】' + m.message.slice(0, 400));
        else if (m.type === 'decision') lines.push('【主控的决策】' + m.message.slice(0, 400));
      });
      return lines.slice(-20).join('\n');
    }

    function openDispatchPanel() {
      if (!dispatchPanel) return;
      var ctx = buildDiscussContext();
      if (dispatchContext) dispatchContext.textContent = ctx || '（当前无讨论记录）';
      if (dispatchHexList) {
        dispatchHexList.innerHTML = '';
        window.hexList.forEach(function(h) {
          var chip = document.createElement('label');
          chip.className = 'dispatch-hex-chip';
          chip.dataset.hexId = h.id;
          var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.value = h.id;
          cb.addEventListener('change', function() {
            chip.classList.toggle('selected', cb.checked);
          });
          chip.appendChild(cb);
          chip.appendChild(document.createTextNode(window.getAgentDisplayName(h.id, h.label, h.name)));
          dispatchHexList.appendChild(chip);
        });
      }
      if (dispatchInstruction) dispatchInstruction.value = '';
      if (dispatchStatus) dispatchStatus.textContent = '';
      dispatchPanel.classList.add('show');
      dispatchPanel.setAttribute('aria-hidden', 'false');
      if (dispatchInstruction) dispatchInstruction.focus();
    }

    function closeDispatchPanel() {
      if (dispatchPanel) {
        dispatchPanel.classList.remove('show');
        dispatchPanel.setAttribute('aria-hidden', 'true');
      }
    }

    if (btnDispatchTask) {
      btnDispatchTask.addEventListener('click', function() {
        var showing = dispatchPanel && dispatchPanel.classList.contains('show');
        if (showing) closeDispatchPanel();
        else openDispatchPanel();
      });
    }
    if (dispatchCancelBtn) dispatchCancelBtn.addEventListener('click', closeDispatchPanel);
    if (dispatchPanel) {
      dispatchPanel.addEventListener('click', function(e) {
        if (e.target === dispatchPanel) closeDispatchPanel();
      });
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && dispatchPanel && dispatchPanel.classList.contains('show')) {
        closeDispatchPanel();
      }
    });

    if (dispatchSendBtn) {
      dispatchSendBtn.addEventListener('click', async function() {
        var instruction = dispatchInstruction ? dispatchInstruction.value.trim() : '';
        if (!instruction) { if (dispatchStatus) dispatchStatus.textContent = window.t('dispatchEnterInstruction'); return; }

        var selectedIds = [];
        if (dispatchHexList) {
          dispatchHexList.querySelectorAll('input[type=checkbox]:checked').forEach(function(cb) {
            selectedIds.push(cb.value);
          });
        }
        if (!selectedIds.length) { if (dispatchStatus) dispatchStatus.textContent = window.t('selectAtLeastOneHex'); return; }

        var ctx = dispatchContext ? dispatchContext.textContent : '';
        var fullMessage = ctx && ctx !== '（当前无讨论记录）'
          ? '【背景讨论记录】\n' + ctx + '\n\n【你的执行任务】\n' + instruction
          : instruction;

        dispatchSendBtn.disabled = true;
        if (dispatchStatus) dispatchStatus.textContent = window.t('dispatching');

        var results = [];
        for (var i = 0; i < selectedIds.length; i++) {
          var hexId = selectedIds[i];
          var hex = window.hexList.find(function(h) { return h.id === hexId; });
          var hexName = window.getAgentDisplayName(hexId, hex ? hex.label : '', hex ? hex.name : '');
          try {
            var resp = await fetch('/api/agent/agent-task', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hexId: hexId, message: fullMessage, projectId: window.projectId, sessionKey: 'main' })
            });
            var data = await resp.json();
            if (data.taskId) results.push({ hexId: hexId, hexName: hexName, taskId: data.taskId });
            else results.push({ hexId: hexId, hexName: hexName, error: data.error || '未知错误' });
          } catch (error) {
            results.push({ hexId: hexId, hexName: hexName, error: error.message });
          }
        }

        dispatchSendBtn.disabled = false;
        closeDispatchPanel();

        var modeRadio = document.querySelector('input[name="hexChatMode"][value="discuss"]');
        if (modeRadio && !modeRadio.checked) {
          modeRadio.checked = true;
          modeRadio.dispatchEvent(new Event('change'));
        }

        window.appendHexChatMsg(window.t('you'), '⚡ 派发任务：' + instruction, false, true, 'discuss');

        results.forEach(function(result) {
          if (result.error) {
            window.appendHexChatMsg(result.hexName, '⚡ 派发失败：' + result.error, true, true, 'discuss', result.hexId);
            return;
          }
          window.appendHexChatMsg(result.hexName, '⚡ 正在执行任务…', false, false, 'discuss', result.hexId);
          window._pollAgentTask(result.taskId, result.hexName);
        });
      });
    }

    if (dispatchAutonomyBtn) {
      dispatchAutonomyBtn.addEventListener('click', function() {
        var instruction = dispatchInstruction ? dispatchInstruction.value.trim() : '';
        if (!instruction) { if (dispatchStatus) dispatchStatus.textContent = window.t('dispatchEnterInstruction'); return; }

        var selectedIds = [];
        if (dispatchHexList) {
          dispatchHexList.querySelectorAll('input[type=checkbox]:checked').forEach(function(cb) {
            selectedIds.push(cb.value);
          });
        }
        if (selectedIds.length !== 1) {
          if (dispatchStatus) dispatchStatus.textContent = '自治接力必须选择 1 位首位员工';
          return;
        }

        var firstAgentId = selectedIds[0];
        var ctx = dispatchContext ? dispatchContext.textContent : '';
        var fullMessage = ctx && ctx !== '（当前无讨论记录）'
          ? '【背景讨论记录】\n' + ctx + '\n\n【当前要达成的目标】\n' + instruction
          : instruction;

        dispatchAutonomyBtn.disabled = true;
        dispatchSendBtn.disabled = true;
        if (dispatchStatus) dispatchStatus.textContent = '正在启动自治接力…';
        fetch('/api/autonomy/task-runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: window.projectId, hexId: firstAgentId, message: fullMessage, sessionKey: 'main' })
        })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (!data || !data.runId) throw new Error(data && data.error ? data.error : '未返回 runId');
            closeDispatchPanel();
            if (typeof window.setAutonomyStatus === 'function' && typeof window.autonomyAgentName === 'function') {
              window.setAutonomyStatus('自治接力已由 ' + window.autonomyAgentName(firstAgentId) + ' 发起：' + data.runId);
            }
            if (typeof window.loadAutonomyRuns === 'function') window.loadAutonomyRuns(true);
            if (typeof window.startAutonomyPolling === 'function') window.startAutonomyPolling();
            window.appendHexChatMsg(window.t('you'), '∞ 自治接力：' + instruction, false, true, 'discuss');
            if (typeof window.autonomyAgentName === 'function') {
              window.appendHexChatMsg(window.t('systemLabel'), '∞ 已从当前讨论创建自治接力，首位员工：' + window.autonomyAgentName(firstAgentId) + '，运行ID：' + data.runId, false, true, 'discuss');
            }
          })
          .catch(function(err) {
            if (dispatchStatus) dispatchStatus.textContent = '启动失败：' + (err && err.message ? err.message : '网络错误');
          })
          .finally(function() {
            dispatchAutonomyBtn.disabled = false;
            dispatchSendBtn.disabled = false;
          });
      });
    }
  }

  window.initProjectDispatch = initProjectDispatch;
})();
