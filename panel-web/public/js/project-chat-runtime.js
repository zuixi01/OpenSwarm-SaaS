(function() {
  function initProjectChatRuntime() {
    window._activeAgentTasks = window._activeAgentTasks || new Set();
    window._activeAgentTaskId = window._activeAgentTaskId || null;
    window._activeAgentTaskTimer = window._activeAgentTaskTimer || null;
    window._activeAgentTaskStreamState = window._activeAgentTaskStreamState || {};

    function mergeStreamSnapshots(lines) {
      var merged = '';
      (lines || []).forEach(function(line) {
        var next = String(line || '').trim();
        if (!next) return;
        if (!merged) {
          merged = next;
          return;
        }
        if (next === merged) return;
        if (next.indexOf(merged) === 0 || next.length > merged.length && next.indexOf(merged.slice(-80)) >= 0) {
          merged = next;
          return;
        }
        if (merged.indexOf(next) === 0) return;
        var overlap = 0;
        var maxOverlap = Math.min(merged.length, next.length);
        for (var i = maxOverlap; i >= 12; i -= 1) {
          if (merged.slice(-i) === next.slice(0, i)) {
            overlap = i;
            break;
          }
        }
        merged += (overlap ? next.slice(overlap) : ('\n' + next));
      });
      return merged;
    }

    function extractStreamText(task) {
      var progress = Array.isArray(task && task.progress) ? task.progress : [];
      var streamLines = progress
        .filter(function(entry) { return entry && entry.stage === 'stream' && entry.message; })
        .map(function(entry) { return String(entry.message || '').trim(); })
        .filter(Boolean);
      if (!streamLines.length) return '';
      return mergeStreamSnapshots(streamLines);
    }

    function buildTaskEvidenceMeta(task) {
      var meta = {};
      var mountedSkills = Array.isArray(task && task.mountedSkillIds) ? task.mountedSkillIds.filter(Boolean) : [];
      var progress = Array.isArray(task && task.progress) ? task.progress : [];
      var stageMap = {
        agent_dispatched: '已派发',
        history_snapshot: '读取会话',
        stream: '实时输出',
        history_reply: '取回回复',
        preview_reply: '预览回复',
        completed: '执行完成'
      };
      var evidence = [];
      progress.forEach(function(entry) {
        var label = stageMap[String(entry && entry.stage || '')];
        if (label && evidence.indexOf(label) < 0) evidence.push(label);
      });
      if (mountedSkills.length) meta.skills = mountedSkills;
      if (evidence.length) meta.evidence = evidence;
      return (meta.skills || meta.evidence) ? meta : null;
    }

    window._pollAgentTask = function(taskId, hexName) {
      window._activeAgentTasks.add(taskId);
      window._activeAgentTaskId = taskId;
      fetch('/api/agent/agent-task/' + taskId)
        .then(function(r) { return r.json(); })
        .then(function(task) {
          if (!window._activeAgentTasks.has(taskId)) return;
          var resolvedHexName = hexName || window.getAgentDisplayName(task.hexId, '', task.hexName);
          var streamText = extractStreamText(task);
          var taskMeta = buildTaskEvidenceMeta(task);
          if (streamText && typeof window.upsertHexChatLiveMsg === 'function') {
            window.upsertHexChatLiveMsg(taskId, resolvedHexName, streamText, 'discuss', task.hexId, taskMeta);
          }
          if (task.status === 'done') {
            if (typeof window.refreshRuntimeSnapshot === 'function') window.refreshRuntimeSnapshot();
            window._activeAgentTasks.delete(taskId);
            if (window._activeAgentTaskId === taskId) window._activeAgentTaskId = null;
            if (window._activeAgentTasks.size === 0) window.setHexChatStatus('');
            if (typeof window.clearHexChatLiveMsg === 'function') window.clearHexChatLiveMsg(taskId);
            window.appendHexChatMsg(resolvedHexName, task.reply || '（任务已执行，无文字回复）', false, true, 'discuss', task.hexId, taskMeta);
            if (window._activeAgentTasks.size === 0 && window.hexChatSend) window.hexChatSend.disabled = false;
            if (typeof window.saveHexChatHistory === 'function') window.saveHexChatHistory();
          } else if (task.status === 'error') {
            if (typeof window.refreshRuntimeSnapshot === 'function') window.refreshRuntimeSnapshot();
            window._activeAgentTasks.delete(taskId);
            if (window._activeAgentTaskId === taskId) window._activeAgentTaskId = null;
            if (window._activeAgentTasks.size === 0) window.setHexChatStatus('');
            if (typeof window.clearHexChatLiveMsg === 'function') window.clearHexChatLiveMsg(taskId);
            window.appendHexChatMsg(window.t('systemLabel'), window.t('taskFailedWith', task.error || '未知错误'), true, false);
            if (window._activeAgentTasks.size === 0 && window.hexChatSend) window.hexChatSend.disabled = false;
          } else {
            var elapsed = task.createdAt ? Math.round((Date.now() - task.createdAt) / 1000) : 0;
            var statusHexName = resolvedHexName;
            window.setHexChatStatus(window.t('hexExecTaskElapsed', statusHexName, elapsed));
            window._activeAgentTaskTimer = setTimeout(function() { window._pollAgentTask(taskId, hexName); }, 2000);
          }
        })
        .catch(function() {
          if (!window._activeAgentTasks.has(taskId)) return;
          window._activeAgentTaskTimer = setTimeout(function() { window._pollAgentTask(taskId, hexName); }, 3000);
        });
    };

    window.parseMentionedHexNamesFromText = function(text, hexIds) {
      if (!text || !hexIds) return [];
      var result = [];
      for (var i = 0; i < window.hexList.length; i++) {
        var hex = window.hexList[i];
        if (hexIds.indexOf(hex.id) < 0) continue;
        var displayName = window.getAgentDisplayName(hex.id, hex.label, hex.name);
        var legacyName = hex && hex.name ? String(hex.name) : '';
        if ((legacyName && text.indexOf('@' + legacyName) >= 0) || text.indexOf('@' + displayName) >= 0) {
          result.push(hex.id);
        }
      }
      return result;
    };

    function restoreSavedHexTask() {
      var taskKey = 'hexChatTask_' + window.projectId;
      var savedTask = null;
      try {
        savedTask = JSON.parse(localStorage.getItem(taskKey) || 'null');
      } catch (e) {}
      if (!savedTask || !savedTask.taskId) return;
      if (Date.now() - savedTask.ts > 300000) {
        localStorage.removeItem(taskKey);
        return;
      }

      window._hexChatRestoring = true;
      if (window.hexChatSend) window.hexChatSend.disabled = true;
      window.setHexChatStatus(window.t('waitingHexReply'));
      fetch('/api/agent/task/' + savedTask.taskId)
        .then(function(r) { return r.json(); })
        .then(function(task) {
          localStorage.removeItem(taskKey);
          window._hexChatRestoring = false;
          if (task.status === 'done') {
            if (window.hexChatMessages) window.hexChatMessages.innerHTML = '';
            window._hexChatCache.single = null;
            window._hexChatCache.discuss = null;
            window.setHexChatStatus('');
            if (window.hexChatSend) window.hexChatSend.disabled = false;
            window.loadHexChatHistory();
          } else if (task.status === 'running') {
            window.setHexChatStatus(window.t('waitingHexReplyBg'));
            window._activeTaskId = savedTask.taskId;
            window._activeEnableBroadcast = savedTask.enableBroadcast || false;
            window._activeHexIds = savedTask.hexIds || [];
            window._pollTask(savedTask.taskId, savedTask.enableBroadcast, savedTask.hexIds);
          } else if (task.status === 'expired') {
            window.appendHexChatMsg(window.t('systemLabel'), window.t('hexChatTimeout'), true, false);
            window.setHexChatStatus('');
            if (window.hexChatSend) window.hexChatSend.disabled = false;
          } else {
            if (task.error) {
              window.appendHexChatMsg(window.t('systemLabel'), window.t('serviceErrorWith', task.error), true, false);
            }
            window.setHexChatStatus('');
            if (window.hexChatSend) window.hexChatSend.disabled = false;
          }
        })
        .catch(function() {
          window._hexChatRestoring = false;
          localStorage.removeItem(taskKey);
          window.setHexChatStatus('');
          if (window.hexChatSend) window.hexChatSend.disabled = false;
          if (window.hexChatMessages) window.hexChatMessages.innerHTML = '';
          window._hexChatCache.single = null;
          window._hexChatCache.discuss = null;
          window.loadHexChatHistory();
        });

    }

    function saveTask() {
      var taskKey = 'hexChatTask_' + window.projectId;
      if (!window._activeTaskId) return;
      try {
        localStorage.setItem(taskKey, JSON.stringify({
          taskId: window._activeTaskId,
          enableBroadcast: window._activeEnableBroadcast,
          hexIds: window._activeHexIds,
          ts: Date.now()
        }));
      } catch (e) {}
    }

    document.querySelectorAll('input[name="hexChatMode"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        var isAgent = radio.value === 'agent' && radio.checked;
        var roundsWrap = document.getElementById('hexChatRoundsWrap');
        if (roundsWrap) roundsWrap.style.display = isAgent ? 'none' : '';
        if (radio.checked) {
          if (radio.value !== 'agent') window.setHexChatMode(radio.value);
          if (window.hexChatInput) {
            window.hexChatInput.placeholder = isAgent
              ? '输入任务指令，用 @DG-01 指定执行员工（如 @DG-01 生成日报并存到文件）…'
              : '输入消息，向本项目各员工发送…';
          }
          window.updateHexChatRoundsUI();
          window.updateHexChatState();
          if (window.hexChatMessages) {
            window.hexChatMessages.innerHTML = '';
            window.loadHexChatHistory();
          }
        }
      });
    });

    if (window.hexChatInput) {
      window.hexChatInput.addEventListener('input', function() {
        if (typeof window.renderHexChatTargetHint === 'function') window.renderHexChatTargetHint();
      });
    }

    restoreSavedHexTask();
    window.addEventListener('beforeunload', saveTask);
    window.addEventListener('pagehide', saveTask);
  }

  window.initProjectChatRuntime = initProjectChatRuntime;
})();
