(function() {
  function initProjectHexChatHistory() {
    window._hexChatCache = window._hexChatCache || {};

    function renderMd(text) {
      if (typeof marked !== 'undefined') {
        try {
          return '<span class="hex-chat-md">' + marked.parse(String(text || ''), { breaks: true, gfm: true }) + '</span>';
        } catch (e) {}
      }
      return window.escapeHtml(text || '').replace(/\n/g, '<br>');
    }

    function getHexIdByDisplayName(displayName) {
      if (!displayName || !window.hexList.length) return null;
      var normalized = window.normalizeAgentDisplayName(displayName);
      for (var i = 0; i < window.hexList.length; i++) {
        var hex = window.hexList[i];
        var dn = window.getAgentDisplayName(hex.id, hex.label, hex.name);
        if (dn === displayName || window.normalizeAgentDisplayName(dn) === normalized) return hex.id;
      }
      var match = /^DG-(\d{2})$/i.exec(String(displayName).trim());
      if (match) {
        var candidateId = 'h' + match[1];
        if (window.hexList.some(function(hex) { return hex.id === candidateId; })) return candidateId;
      }
      return null;
    }

    function buildExecutionMetaHtml(meta) {
      if (!meta || typeof meta !== 'object') return '';
      var rows = [];
      if (Array.isArray(meta.skills) && meta.skills.length) {
        rows.push('<span class="hex-chat-evidence-pill">Skills · ' + window.escapeHtml(meta.skills.join('、')) + '</span>');
      }
      if (Array.isArray(meta.evidence) && meta.evidence.length) {
        rows.push('<span class="hex-chat-evidence-pill">执行痕迹 · ' + window.escapeHtml(meta.evidence.join(' · ')) + '</span>');
      }
      if (Array.isArray(meta.artifacts) && meta.artifacts.length) {
        rows.push('<span class="hex-chat-evidence-pill">产物 · ' + window.escapeHtml(meta.artifacts.join('、')) + '</span>');
      }
      return rows.length ? ('<div class="hex-chat-card-evidence">' + rows.join('') + '</div>') : '';
    }

    function appendHexChatMsg(hexName, reply, isError, save, mode, hexId, meta) {
      if (save === undefined) save = true;
      if (!mode) mode = window.getHexChatMode();
      var displayHexName = hexName;
      var isUser = displayHexName === '你' || displayHexName === window.t('you');
      var isSystem = displayHexName === '系统' || displayHexName === window.t('systemLabel');
      if (!isUser && !isSystem) displayHexName = window.normalizeAgentDisplayName(displayHexName);
      if (!hexId && !isUser && !isSystem) hexId = getHexIdByDisplayName(displayHexName);
      var hex = hexId ? window.hexList.find(function(item) { return item.id === hexId; }) : null;
      var avatarSrc = hex ? window.resolveBadgeAvatarSrc(hex, hexId) : '';

      var div = document.createElement('div');
      div.className = 'hex-chat-msg' + (isError ? ' err' : '') + (isUser ? ' hex-chat-msg--user' : isSystem ? ' hex-chat-msg--system' : ' hex-chat-msg--hex');
      div.setAttribute('data-mode', mode);
      div.setAttribute('data-name', displayHexName);
      div.setAttribute('data-message', reply || '');
      if (hexId && !isUser && !isSystem) div.setAttribute('data-hex-id', hexId);

      var replyText = String(reply || '');
      var replyHtml = isError || isUser ? window.escapeHtml(replyText).replace(/\n/g, '<br>') : renderMd(replyText);
      var modeLabel = mode === 'single'
        ? '<span class="hex-chat-mode-tag" title="群发单聊">单</span>'
        : '<span class="hex-chat-mode-tag" title="群讨论">群</span>';
      var shareBtn = mode === 'single' ? ' <span class="hex-chat-share" title="将本条同步到群讨论上下文">分享到群聊</span>' : '';
      var bubbleContent = modeLabel + replyHtml + shareBtn;

      if (isUser) {
        var body = document.createElement('div');
        body.className = 'hex-chat-body';
        var bubble = document.createElement('div');
        bubble.className = 'hex-chat-bubble';
        bubble.innerHTML = bubbleContent;
        body.appendChild(bubble);
        var avatar = document.createElement('div');
        avatar.className = 'hex-chat-avatar';
        avatar.setAttribute('title', displayHexName);
        avatar.textContent = window.t('you').slice(0, 1) || '你';
        div.appendChild(body);
        div.appendChild(avatar);
      } else if (isSystem) {
        var bodySys = document.createElement('div');
        bodySys.className = 'hex-chat-body';
        var bubbleSys = document.createElement('div');
        bubbleSys.className = 'hex-chat-bubble';
        bubbleSys.innerHTML = bubbleContent;
        bodySys.appendChild(bubbleSys);
        div.appendChild(bodySys);
      } else {
        var avatarHex = document.createElement('div');
        avatarHex.className = 'hex-chat-avatar';
        avatarHex.setAttribute('title', displayHexName);
        if (avatarSrc) {
          var img = document.createElement('img');
          img.src = avatarSrc;
          img.alt = '';
          avatarHex.appendChild(img);
        } else {
          avatarHex.textContent = (displayHexName || '?').slice(0, 1);
        }
        var bodyHex = document.createElement('div');
        bodyHex.className = 'hex-chat-body';
        var nameSpan = document.createElement('span');
        nameSpan.className = 'hex-chat-name';
        nameSpan.textContent = displayHexName;
        var bubbleHex = document.createElement('div');
        bubbleHex.className = 'hex-chat-bubble';
        var shouldCollapse = !isError && replyText.length > 260;
        var cardHead = document.createElement('div');
        cardHead.className = 'hex-chat-card-head';
        var cardMeta = document.createElement('div');
        cardMeta.className = 'hex-chat-card-meta';
        cardMeta.innerHTML = '<span class="hex-chat-mode-tag" title="' + (mode === 'single' ? '群发单聊' : '群讨论') + '">' + (mode === 'single' ? '单' : '群') + '</span>'
          + '<span class="hex-chat-card-role">' + window.escapeHtml(displayHexName) + '</span>';
        cardHead.appendChild(cardMeta);
        if (shouldCollapse) {
          var toggleBtn = document.createElement('button');
          toggleBtn.type = 'button';
          toggleBtn.className = 'hex-chat-card-toggle';
          toggleBtn.textContent = '收起';
          cardHead.appendChild(toggleBtn);
        }
        var cardContent = document.createElement('div');
        cardContent.className = 'hex-chat-card-content';
        cardContent.innerHTML = replyHtml + shareBtn;
        bubbleHex.appendChild(cardHead);
        bubbleHex.appendChild(cardContent);
        var evidenceHtml = buildExecutionMetaHtml(meta);
        if (evidenceHtml) {
          var evidence = document.createElement('div');
          evidence.innerHTML = evidenceHtml;
          bubbleHex.appendChild(evidence.firstChild);
        }
        if (shouldCollapse) {
          toggleBtn.addEventListener('click', function() {
            var collapsed = cardContent.classList.toggle('is-collapsed');
            toggleBtn.textContent = collapsed ? '展开' : '收起';
          });
        }
        bodyHex.appendChild(nameSpan);
        bodyHex.appendChild(bubbleHex);
        div.appendChild(avatarHex);
        div.appendChild(bodyHex);
      }

      window.hexChatMessages.appendChild(div);
      window.hexChatMessages.scrollTop = window.hexChatMessages.scrollHeight;
      if (save) saveHexChatHistory();
    }

    function upsertHexChatLiveMsg(taskId, hexName, partialText, mode, hexId, meta) {
      if (!window.hexChatMessages || !taskId) return;
      var key = String(taskId);
      var existing = window.hexChatMessages.querySelector('.hex-chat-msg[data-live-key="' + key + '"]');
      var displayHexName = window.normalizeAgentDisplayName(hexName || '');
      var hex = hexId ? window.hexList.find(function(item) { return item.id === hexId; }) : null;
      var avatarSrc = hex ? window.resolveBadgeAvatarSrc(hex, hexId) : '';
      var liveHtml = window.escapeHtml(String(partialText || '')).replace(/\n/g, '<br>');

      if (!existing) {
        var div = document.createElement('div');
        div.className = 'hex-chat-msg hex-chat-msg--hex is-live';
        div.setAttribute('data-mode', mode || 'discuss');
        div.setAttribute('data-name', displayHexName);
        div.setAttribute('data-message', partialText || '');
        div.setAttribute('data-live-key', key);
        if (hexId) div.setAttribute('data-hex-id', hexId);

        var avatarHex = document.createElement('div');
        avatarHex.className = 'hex-chat-avatar';
        avatarHex.setAttribute('title', displayHexName);
        if (avatarSrc) {
          var img = document.createElement('img');
          img.src = avatarSrc;
          img.alt = '';
          avatarHex.appendChild(img);
        } else {
          avatarHex.textContent = (displayHexName || '?').slice(0, 1);
        }

        var bodyHex = document.createElement('div');
        bodyHex.className = 'hex-chat-body';
        var nameSpan = document.createElement('span');
        nameSpan.className = 'hex-chat-name';
        nameSpan.textContent = displayHexName;
        var bubbleHex = document.createElement('div');
        bubbleHex.className = 'hex-chat-bubble';
        bubbleHex.innerHTML =
          '<div class="hex-chat-card-head">'
          + '<div class="hex-chat-card-meta">'
          + '<span class="hex-chat-mode-tag" title="执行任务">任务</span>'
          + '<span class="hex-chat-card-role">' + window.escapeHtml(displayHexName) + '</span>'
          + '<span class="hex-chat-card-role" style="opacity:.75;">生成中…</span>'
          + '</div>'
          + '</div>'
          + '<div class="hex-chat-card-content" data-live-content="1">' + liveHtml + '</div>'
          + buildExecutionMetaHtml(meta);
        bodyHex.appendChild(nameSpan);
        bodyHex.appendChild(bubbleHex);
        div.appendChild(avatarHex);
        div.appendChild(bodyHex);
        window.hexChatMessages.appendChild(div);
        existing = div;
      } else {
        if (existing.getAttribute('data-message') === String(partialText || '')) {
          return;
        }
        existing.setAttribute('data-message', partialText || '');
        var contentEl = existing.querySelector('[data-live-content="1"]');
        if (contentEl) contentEl.innerHTML = liveHtml;
        var evidenceWrap = existing.querySelector('.hex-chat-card-evidence');
        var nextEvidenceHtml = buildExecutionMetaHtml(meta);
        if (nextEvidenceHtml) {
          if (evidenceWrap) {
            var holder = document.createElement('div');
            holder.innerHTML = nextEvidenceHtml;
            evidenceWrap.replaceWith(holder.firstChild);
          } else {
            var bubble = existing.querySelector('.hex-chat-bubble');
            if (bubble) {
              var holder2 = document.createElement('div');
              holder2.innerHTML = nextEvidenceHtml;
              bubble.appendChild(holder2.firstChild);
            }
          }
        }
      }
      window.hexChatMessages.scrollTop = window.hexChatMessages.scrollHeight;
    }

    function clearHexChatLiveMsg(taskId) {
      if (!window.hexChatMessages || !taskId) return;
      var node = window.hexChatMessages.querySelector('.hex-chat-msg[data-live-key="' + String(taskId) + '"]');
      if (node) node.remove();
    }

    function finalizeHexChatLiveMsg(taskId, hexName, finalText, isError, mode, hexId, meta) {
      if (!window.hexChatMessages || !taskId) return false;
      var key = String(taskId);
      var node = window.hexChatMessages.querySelector('.hex-chat-msg[data-live-key="' + key + '"]');
      if (!node) return false;
      var displayHexName = window.normalizeAgentDisplayName(hexName || '');
      var finalReply = String(finalText || '');
      node.classList.remove('is-live');
      if (isError) node.classList.add('err');
      node.removeAttribute('data-live-key');
      node.setAttribute('data-mode', mode || 'discuss');
      node.setAttribute('data-name', displayHexName);
      node.setAttribute('data-message', finalReply);
      if (hexId) node.setAttribute('data-hex-id', hexId);

      var nameEl = node.querySelector('.hex-chat-name');
      if (nameEl) nameEl.textContent = displayHexName;
      var metaEl = node.querySelector('.hex-chat-card-meta');
      if (metaEl) {
        metaEl.innerHTML =
          '<span class="hex-chat-mode-tag" title="' + ((mode || 'discuss') === 'single' ? '群发单聊' : '群讨论') + '">' + ((mode || 'discuss') === 'single' ? '单' : '群') + '</span>'
          + '<span class="hex-chat-card-role">' + window.escapeHtml(displayHexName) + '</span>';
      }
      var contentEl = node.querySelector('[data-live-content="1"]') || node.querySelector('.hex-chat-card-content');
      if (contentEl) {
        contentEl.removeAttribute('data-live-content');
        contentEl.innerHTML = (isError ? window.escapeHtml(finalReply).replace(/\n/g, '<br>') : renderMd(finalReply));
        contentEl.classList.remove('is-collapsed');
      }
      var evidenceWrap = node.querySelector('.hex-chat-card-evidence');
      var nextEvidenceHtml = buildExecutionMetaHtml(meta);
      if (nextEvidenceHtml) {
        if (evidenceWrap) {
          var holder = document.createElement('div');
          holder.innerHTML = nextEvidenceHtml;
          evidenceWrap.replaceWith(holder.firstChild);
        } else {
          var bubble = node.querySelector('.hex-chat-bubble');
          if (bubble) {
            var holder2 = document.createElement('div');
            holder2.innerHTML = nextEvidenceHtml;
            bubble.appendChild(holder2.firstChild);
          }
        }
      }
      window.hexChatMessages.scrollTop = window.hexChatMessages.scrollHeight;
      return true;
    }

    function renderHexChatMessages(messages, currentMode) {
      if (!window.hexChatMessages) return;
      function renderSummaryShell(title, meta, contentHtml) {
        return '<div class="hex-chat-summary-card-head">'
          + '<div class="hex-chat-summary-label">' + title + '</div>'
          + (meta ? '<div class="hex-chat-summary-card-meta">' + meta + '</div>' : '')
          + '</div>'
          + '<div class="hex-chat-summary-content">' + contentHtml + '</div>';
      }
      var i = 0;
      while (i < messages.length) {
        var msg = messages[i];
        if (msg.type === 'summary') {
          var summaryDiv = document.createElement('div');
          summaryDiv.className = 'hex-chat-summary-block';
          summaryDiv.setAttribute('data-summary', msg.message || '');
          summaryDiv.setAttribute('data-hex-name', msg.hexName || '');
          var summaryHexName = window.normalizeAgentDisplayName(msg.hexName || '');
          var label = summaryHexName ? '📋 ' + window.escapeHtml(summaryHexName) + ' 的讨论摘要（历史）' : '📋 讨论摘要（历史）';
          summaryDiv.innerHTML = renderSummaryShell(label, '员工讨论 / 历史摘要', window.escapeHtml(msg.message || ''));
          if (i + 1 < messages.length && messages[i + 1].type === 'decision') {
            i += 1;
            var decisionMsg = messages[i];
            var decisionDiv = document.createElement('div');
            decisionDiv.className = 'hex-chat-yin-decision';
            decisionDiv.setAttribute('data-decision', decisionMsg.message || '');
            var parsed = window.parseYinDecision(decisionMsg.message || '');
            decisionDiv.innerHTML = window.renderYinDecision(parsed, decisionMsg.message || '');
            summaryDiv.appendChild(decisionDiv);
          }
          window.hexChatMessages.appendChild(summaryDiv);
        } else if (msg.type === 'decision') {
          var decisionDiv2 = document.createElement('div');
          decisionDiv2.className = 'hex-chat-yin-decision';
          decisionDiv2.setAttribute('data-decision', msg.message || '');
          var parsed2 = window.parseYinDecision(msg.message || '');
          decisionDiv2.innerHTML = window.renderYinDecision(parsed2, msg.message || '');
          window.hexChatMessages.appendChild(decisionDiv2);
        } else {
          var name = msg.name || (msg.type === 'user' ? window.t('you') : window.t('systemLabel'));
          if (msg.type === 'hex') name = name ? window.normalizeAgentDisplayName(name) : name;
          var msgMode = msg.mode || currentMode;
          var hexId = (msg.type === 'hex' && msg.hexId) ? msg.hexId : undefined;
          appendHexChatMsg(name, msg.message, msg.isError || false, false, msgMode, hexId);
        }
        i += 1;
      }
    }

    function saveHexChatHistory() {
      var currentMode = window.getHexChatMode();
      if (!window.projectId || !window.hexChatMessages) return;
      var messages = [];
      window.hexChatMessages.querySelectorAll('.hex-chat-msg').forEach(function(msg) {
        if (msg.hasAttribute('data-live-key')) return;
        var name = msg.getAttribute('data-name') || '';
        var text = msg.getAttribute('data-message') || '';
        var hexId = msg.getAttribute('data-hex-id') || undefined;
        var isError = msg.classList.contains('err');
        if (!text) return;
        var type = (name === '你' || name === window.t('you')) ? 'user' : (name === '系统' || name === window.t('systemLabel')) ? 'system' : 'hex';
        var obj = { type: type, name: (type === 'user') ? null : name, message: text, isError: isError, mode: currentMode };
        if (type === 'hex' && hexId) obj.hexId = hexId;
        messages.push(obj);
      });
      window.hexChatMessages.querySelectorAll('.hex-chat-summary-block').forEach(function(block) {
        var summaryText = block.getAttribute('data-summary');
        var hexName = block.getAttribute('data-hex-name') || '';
        if (!summaryText) {
          var contentEl = block.querySelector('.hex-chat-summary-content');
          summaryText = contentEl ? contentEl.textContent.trim() : '';
        }
        if (summaryText) messages.push({ type: 'summary', hexName: hexName, message: summaryText, mode: currentMode });
        var decisionBlock = block.querySelector('.hex-chat-yin-decision');
        if (decisionBlock) {
          var decisionText = decisionBlock.getAttribute('data-decision');
          if (!decisionText) {
            var contentEl2 = decisionBlock.querySelector('.hex-chat-summary-content');
            decisionText = contentEl2 ? contentEl2.textContent.trim() : '';
          }
          if (decisionText) messages.push({ type: 'decision', message: decisionText, mode: currentMode });
        }
      });
      window._hexChatCache[currentMode] = messages;
      fetch('/api/chat-history/' + encodeURIComponent(window.projectId) + '/' + currentMode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages })
      }).catch(function(e) { console.warn('保存员工对话历史到服务器失败:', e); });
      try { localStorage.setItem(window.getHexChatStorageKey(currentMode), JSON.stringify(messages)); } catch (e) {}
    }

    function loadHexChatHistory() {
      var currentMode = window.getHexChatMode();
      if (!window.projectId || !window.hexChatMessages) return;
      if (window._hexChatCache[currentMode]) {
        renderHexChatMessages(window._hexChatCache[currentMode], currentMode);
        return;
      }
      fetch('/api/chat-history/' + encodeURIComponent(window.projectId) + '/' + currentMode)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var messages = data.messages || [];
          if (messages.length === 0) {
            try {
              var local = localStorage.getItem(window.getHexChatStorageKey(currentMode));
              if (local) {
                messages = JSON.parse(local);
                if (messages.length > 0) {
                  fetch('/api/chat-history/' + encodeURIComponent(window.projectId) + '/' + currentMode, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: messages })
                  }).catch(function() {});
                }
              }
            } catch (e) {}
          }
          window._hexChatCache[currentMode] = messages;
          renderHexChatMessages(messages, currentMode);
        })
        .catch(function(e) {
          console.warn('从服务器加载员工对话历史失败，降级到 localStorage:', e);
          try {
            var local = localStorage.getItem(window.getHexChatStorageKey(currentMode));
            if (local) renderHexChatMessages(JSON.parse(local), currentMode);
          } catch (e2) {}
        });
    }

    function clearHexChatHistoryByMode(mode) {
      if (!window.projectId) return;
      var modesToClear = mode === 'all' ? ['single', 'discuss'] : [mode];
      modesToClear.forEach(function(m) {
        window._hexChatCache[m] = [];
        try { localStorage.removeItem(window.getHexChatStorageKey(m)); } catch (e) {}
        fetch('/api/chat-history/' + encodeURIComponent(window.projectId) + '/' + m, { method: 'DELETE' })
          .catch(function(e) { console.warn('清空服务器历史失败:', e); });
      });
      if (window.hexChatMessages) {
        window.hexChatMessages.innerHTML = '';
        loadHexChatHistory();
      }
    }

    function getHexChatHistory() {
      var currentMode = window.getHexChatMode();
      try {
        var messages = window._hexChatCache[currentMode] || [];
        if (messages.length === 0) {
          var local = localStorage.getItem(window.getHexChatStorageKey(currentMode));
          if (local) messages = JSON.parse(local);
        }
        if (messages.length > 0) {
          var filtered = messages.filter(function(msg) {
            var type = msg && msg.type;
            if (type !== 'user' && type !== 'hex') return false;
            if (currentMode === 'single') return type === 'user';
            return true;
          });
          return filtered.map(function(msg) {
            return { type: msg.type, name: msg.name || null, message: msg.message };
          });
        }
      } catch (e) {
        console.warn('获取员工对话历史失败:', e);
      }
      return [];
    }

    function setHexChatStatus(html) {
      if (!window.hexChatStatus) return;
      window.hexChatStatus.innerHTML = html || '';
      window.hexChatStatus.classList.toggle('show', !!html);
    }

    window.renderMd = renderMd;
    window.appendHexChatMsg = appendHexChatMsg;
    window.upsertHexChatLiveMsg = upsertHexChatLiveMsg;
    window.clearHexChatLiveMsg = clearHexChatLiveMsg;
    window.finalizeHexChatLiveMsg = finalizeHexChatLiveMsg;
    window.saveHexChatHistory = saveHexChatHistory;
    window.loadHexChatHistory = loadHexChatHistory;
    window.clearHexChatHistoryByMode = clearHexChatHistoryByMode;
    window.getHexChatHistory = getHexChatHistory;
    window.setHexChatStatus = setHexChatStatus;
    window.getHexIdByDisplayName = getHexIdByDisplayName;
  }

  window.initProjectHexChatHistory = initProjectHexChatHistory;
})();
