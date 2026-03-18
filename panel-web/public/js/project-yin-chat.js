(function() {
  function initProjectYinChat() {
    var yinTaskKey = 'yinChatTask_' + (window.projectId || '');
    var yinPollTimer = null;
    var yinGatewayOnline = null;

    function updateYinStatus(ok) {
      yinGatewayOnline = ok;
      var dot = document.getElementById('yinStatusDot');
      var text = document.getElementById('yinStatusText');
      if (dot) {
        dot.classList.remove('online', 'offline');
        dot.classList.add(ok ? 'online' : 'offline');
      }
      if (text) text.textContent = ok ? '主控在线' : '主控离线';
      var hint = window.yinChatMessages && window.yinChatMessages.querySelector('.yin-chat-empty-hint');
      if (hint) {
        hint.textContent = ok
          ? (window.t('yinReady') || '主控已就绪，可与主控对话说明需求。')
          : '主控未连接，请到首页点击「主控·启动」。';
      }
    }

    function appendYinChatEmptyHint() {
      if (!window.yinChatMessages) return;
      var el = document.createElement('div');
      el.className = 'yin-chat-empty-hint';
      el.style.cssText = 'color:var(--text-dim);font-size:0.85rem;padding:12px 0;';
      el.textContent = yinGatewayOnline === true
        ? (window.t('yinReady') || '主控已就绪，可与主控对话说明需求。')
        : (yinGatewayOnline === false ? '主控未连接，请到首页点击「主控·启动」。' : '主控状态检测中…');
      window.yinChatMessages.appendChild(el);
      window.yinChatMessages.scrollTop = window.yinChatMessages.scrollHeight;
    }

    function pollYinGatewayStatus() {
      fetch('/api/yin/gateway/status').then(function(r) { return r.json(); })
        .then(function(data) { updateYinStatus(data && data.ok); })
        .catch(function() { updateYinStatus(false); });
    }

    function appendYinChatMsg(role, text, save) {
      if (save === undefined) save = true;
      if (!window.yinChatMessages) return;
      var hint = window.yinChatMessages.querySelector('.yin-chat-empty-hint');
      if (hint) hint.remove();
      var div = document.createElement('div');
      var isUser = role === 'user';
      div.className = 'hex-chat-msg ' + (isUser ? 'hex-chat-msg--user' : 'hex-chat-msg--hex');
      var who = role === 'user' ? window.t('me') : window.t('yinLabel');
      var rawText = String(text || '');
      var shouldCollapse = role !== 'user' && rawText.length > 260;
      var textHtml = role === 'user'
        ? window.escapeHtml(rawText).replace(/\n/g, '<br>')
        : ('<span class="hex-chat-md">' + (typeof marked !== 'undefined'
            ? marked.parse(rawText, { breaks: true, gfm: true })
            : window.escapeHtml(rawText).replace(/\n/g, '<br>')) + '</span>');
      var avatar = document.createElement('div');
      avatar.className = 'hex-chat-avatar';
      avatar.textContent = role === 'user' ? '我' : '主';
      var body = document.createElement('div');
      body.className = 'hex-chat-body';
      if (!isUser) {
        var nameSpan = document.createElement('span');
        nameSpan.className = 'hex-chat-name';
        nameSpan.textContent = who;
        body.appendChild(nameSpan);
      }
      var card = document.createElement('div');
      card.className = 'hex-chat-bubble';
      var head = document.createElement('div');
      head.className = 'hex-chat-card-head';
      var meta = document.createElement('div');
      meta.className = 'hex-chat-card-meta';
      meta.innerHTML = '<span class="hex-chat-card-role">' + window.escapeHtml(who) + '</span>';
      head.appendChild(meta);
      if (shouldCollapse) {
        var toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'hex-chat-card-toggle';
        toggleBtn.textContent = '收起';
        head.appendChild(toggleBtn);
      }
      var content = document.createElement('div');
      content.className = 'hex-chat-card-content';
      content.innerHTML = textHtml;
      card.appendChild(head);
      card.appendChild(content);
      body.appendChild(card);
      if (isUser) {
        div.appendChild(body);
        div.appendChild(avatar);
      } else {
        div.appendChild(avatar);
        div.appendChild(body);
      }
      if (shouldCollapse) {
        toggleBtn.addEventListener('click', function() {
          var collapsed = content.classList.toggle('is-collapsed');
          toggleBtn.textContent = collapsed ? '展开' : '收起';
        });
      }
      window.yinChatMessages.appendChild(div);
      window.yinChatMessages.scrollTop = window.yinChatMessages.scrollHeight;
      if (save) window.saveYinChatHistory();
    }

    function loadYinChatHistory() {
      if (!window.projectId || !window.yinChatMessages) return;
      fetch('/api/chat-history/' + encodeURIComponent(window.projectId) + '/yin')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var messages = data.messages || [];
          if (messages.length === 0) {
            try {
              var local = localStorage.getItem(window.getYinChatStorageKey());
              if (local) {
                messages = JSON.parse(local);
                if (messages.length > 0) {
                  fetch('/api/chat-history/' + encodeURIComponent(window.projectId) + '/yin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: messages })
                  }).catch(function() {});
                }
              }
            } catch (e) {}
          }
          window._yinChatCache = messages;
          messages.forEach(function(msg) { appendYinChatMsg(msg.role, msg.text, false); });
          if (messages.length === 0) appendYinChatEmptyHint();
        })
        .catch(function(e) {
          console.warn('从服务器加载主控对话历史失败，降级到 localStorage:', e);
          try {
            var local = localStorage.getItem(window.getYinChatStorageKey());
            if (local) {
              var msgs = JSON.parse(local);
              window._yinChatCache = msgs;
              msgs.forEach(function(msg) { appendYinChatMsg(msg.role, msg.text, false); });
            }
            if (window.yinChatMessages && !window.yinChatMessages.querySelectorAll('.yin-chat-msg').length) appendYinChatEmptyHint();
          } catch (e2) {
            if (window.yinChatMessages && !window.yinChatMessages.querySelectorAll('.yin-chat-msg').length) appendYinChatEmptyHint();
          }
        });
    }

    function removeYinThinkingMsg() {
      var el = window.yinChatMessages && window.yinChatMessages.querySelector('.yin-chat-msg.yin-thinking');
      if (el) el.remove();
    }

    function appendYinThinkingMsg() {
      removeYinThinkingMsg();
      if (!window.yinChatMessages) return;
      var div = document.createElement('div');
      div.className = 'hex-chat-msg hex-chat-msg--system yin-thinking';
      div.innerHTML = '<div class="hex-chat-body"><div class="hex-chat-bubble"><span class="yin-thinking-text">' + window.escapeHtml(window.t('yinThinking')) + '</span></div></div>';
      window.yinChatMessages.appendChild(div);
      window.yinChatMessages.scrollTop = window.yinChatMessages.scrollHeight;
    }

    function pollYinTask(taskId) {
      fetch('/api/yin/task/' + encodeURIComponent(taskId))
        .then(function(r) { return r.json(); })
        .then(function(task) {
          if (task.status === 'done') {
            try { sessionStorage.removeItem(yinTaskKey); } catch (e) {}
            removeYinThinkingMsg();
            if (task.reply) appendYinChatMsg('yin', task.reply);
            if (window.yinChatSend) window.yinChatSend.disabled = false;
            window.saveYinChatHistory();
            return;
          }
          if (task.status === 'error') {
            try { sessionStorage.removeItem(yinTaskKey); } catch (e) {}
            removeYinThinkingMsg();
            appendYinChatMsg('yin', task.error ? window.t('yinNoReplyWith', task.error) : '（' + window.t('yinNoReply') + '）');
            if (window.yinChatSend) window.yinChatSend.disabled = false;
            return;
          }
          yinPollTimer = setTimeout(function() { pollYinTask(taskId); }, 1500);
        })
        .catch(function() {
          yinPollTimer = setTimeout(function() { pollYinTask(taskId); }, 2000);
        });
    }

    if (window.yinChatSend) {
      window.yinChatSend.addEventListener('click', function() {
        var text = (window.yinChatInput && window.yinChatInput.value) ? window.yinChatInput.value.trim() : '';
        if (!text || !window.projectId) return;
        window.yinChatInput.value = '';
        appendYinChatMsg('user', text);
        window.yinChatSend.disabled = true;
        fetch('/api/yin/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, projectId: window.projectId, history: window.getYinChatHistoryForAPI() })
        })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            var taskId = data && data.taskId;
            if (!taskId) {
              var err = (data && data.error) ? data.error : '未返回 taskId';
              appendYinChatMsg('yin', window.t('yinNoReplyWith', err));
              window.yinChatSend.disabled = false;
              return;
            }
            try { sessionStorage.setItem(yinTaskKey, taskId); } catch (e) {}
            appendYinThinkingMsg();
            pollYinTask(taskId);
          })
          .catch(function(e) {
            appendYinChatMsg('yin', '（' + window.t('requestFailedWith', e.message || '网络错误') + '）');
            window.yinChatSend.disabled = false;
          });
      });
      window.addEventListener('beforeunload', function() {
        if (yinPollTimer) clearTimeout(yinPollTimer);
      });
      (function restoreYinTask() {
        try {
          var savedTaskId = sessionStorage.getItem(yinTaskKey);
          if (!savedTaskId) return;
          window.yinChatSend.disabled = true;
          appendYinThinkingMsg();
          window.show(window.t('waitingYinReply'));
          pollYinTask(savedTaskId);
        } catch (e) {}
      })();
    }

    pollYinGatewayStatus();
    setInterval(pollYinGatewayStatus, 2000);

    window.appendYinChatEmptyHint = appendYinChatEmptyHint;
    window.appendYinChatMsg = appendYinChatMsg;
    window.loadYinChatHistory = loadYinChatHistory;
  }

  window.initProjectYinChat = initProjectYinChat;
})();
