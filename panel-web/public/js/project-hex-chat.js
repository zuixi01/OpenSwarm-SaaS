(function() {
  function initProjectHexChat() {
    window.currentRequestAbortController = null;
    window._activeTaskId = window._activeTaskId || null;
    window._activeTaskTimer = window._activeTaskTimer || null;
    window._activeTaskStream = window._activeTaskStream || null;
    window._hexChatRestoring = window._hexChatRestoring || false;
    window._activeEnableBroadcast = window._activeEnableBroadcast || false;
    window._activeHexIds = window._activeHexIds || [];

    function shareToDiscuss(hexName, message) {
      var key = window.getHexChatStorageKey('discuss');
      if (!key) return;
      try {
        var stored = localStorage.getItem(key) || '[]';
        var messages = JSON.parse(stored);
        var type = (hexName === '你' || hexName === window.t('you')) ? 'user' : 'hex';
        messages.push({
          type: type,
          name: (hexName === '你' || hexName === window.t('you')) ? null : hexName,
          message: message,
          isError: false,
          mode: 'discuss'
        });
        localStorage.setItem(key, JSON.stringify(messages));
        if (window.getHexChatMode() === 'discuss' && window.hexChatMessages) {
          window.appendHexChatMsg(hexName, message, false, false, 'discuss');
        }
      } catch (e) {
        console.warn('分享到群聊失败:', e);
      }
    }

    function buildDiscussContext() {
      var msgs = window._hexChatCache && window._hexChatCache.discuss ? window._hexChatCache.discuss : [];
      if (!msgs.length) msgs = window._hexChatCache && window._hexChatCache.single ? window._hexChatCache.single : [];
      var lines = [];
      msgs.forEach(function(m) {
        if (!m || !m.message) return;
        if (m.type === 'user') lines.push('【用户】' + String(m.message).slice(0, 200));
        else if (m.type === 'hex' && m.name) lines.push('【' + m.name + '】' + String(m.message).slice(0, 300));
        else if (m.type === 'summary') lines.push('【讨论摘要】' + String(m.message).slice(0, 400));
        else if (m.type === 'decision') lines.push('【主控的决策】' + String(m.message).slice(0, 400));
      });
      return lines.slice(-20).join('\n');
    }

    function detectExecutionIntent(text, hexIds) {
      var message = String(text || '').trim();
      if (!message) return null;
      var mentioned = typeof window.parseMentionedHexNamesFromText === 'function'
        ? window.parseMentionedHexNamesFromText(message, hexIds || [])
        : [];
      if (!mentioned.length) return null;
      var executeRe = /分析|调研|生成|整理|撰写|汇总|导出|爬取|搜索|统计|处理|制作|编写|抓取|查询|完成|执行|产出|报告|方案|文档|表格|ppt|文件|数据/;
      if (!executeRe.test(message)) return null;
      var autonomyRe = /交给|交由|转给|再给|然后给|接着给|继续给|再由|然后由|接力|下一步|下一棒|完成后|再让|随后@|并交给|并让/;
      var route = (mentioned.length > 1 || autonomyRe.test(message)) ? 'autonomy' : 'agent';
      return {
        route: route,
        mentioned: mentioned,
        firstAgentId: mentioned[0],
      };
    }

    function buildRepliesContext(replies) {
      return (replies || []).filter(function(r) { return r && r.reply; }).map(function(r) {
        var displayName = window.getAgentDisplayName(r.hexId, '', r.name);
        return '【' + displayName + '】' + r.reply;
      }).join('\n\n');
    }

    function summarizeReplyForExecution(reply) {
      var text = String(reply || '').replace(/\s+/g, ' ').trim();
      if (!text) return '';
      var lines = text
        .split(/(?<=[。！？\n])/)
        .map(function(line) { return String(line || '').trim(); })
        .filter(Boolean)
        .filter(function(line) {
          return !/我是|我当前是|我的工作流程|关于这份|负责内容创作|负责撰写|负责角色|职责|分工|等待/.test(line);
        });
      return lines.slice(0, 2).join(' ');
    }

    function buildAutonomyExecutionBrief(text, intent, replies) {
      var message = String(text || '').trim();
      var mentioned = intent && Array.isArray(intent.mentioned) ? intent.mentioned.slice() : [];
      var firstAgentId = intent && intent.firstAgentId ? intent.firstAgentId : (mentioned[0] || '');
      var projectName = window.project && window.project.name ? window.project.name : '';
      var roleHints = (replies || [])
        .filter(function(reply) { return reply && reply.reply; })
        .map(function(reply) {
          var summary = summarizeReplyForExecution(reply.reply);
          if (!summary) return '';
          var displayName = window.getAgentDisplayName(reply.hexId, '', reply.name);
          return '- ' + displayName + '：' + summary;
        })
        .filter(Boolean)
        .slice(0, 3);
      var lines = [];
      lines.push('【执行目标】');
      lines.push(message);
      if (projectName) {
        lines.push('');
        lines.push('【项目】');
        lines.push(projectName);
      }
      lines.push('');
      lines.push('【执行要求】');
      lines.push('1. 第一棒员工必须直接执行，不要重复介绍角色，不要只复述分工。');
      lines.push('2. 如果任务要求分析报告，必须先完成数据搜集/分析，并写出实际文件到 workspace/output/<projectId>/ 。');
      lines.push('3. 如果下一棒需要接力，交接内容只保留必要结论、产物路径和下一步动作。');
      lines.push('4. 不得静默改写用户要求的年份、季度、品类或目标格式；若数据不存在，必须明确说明。');
      if (firstAgentId) {
        lines.push('');
        lines.push('【首位执行员工】');
        lines.push(window.getAgentDisplayName(firstAgentId, '', ''));
      }
      if (mentioned.length > 1) {
        lines.push('');
        lines.push('【候选接力员工】');
        mentioned.slice(1).forEach(function(agentId) {
          lines.push('- ' + window.getAgentDisplayName(agentId, '', ''));
        });
      }
      if (roleHints.length) {
        lines.push('');
        lines.push('【讨论中已形成的有效结论】');
        lines = lines.concat(roleHints);
      }
      return lines.join('\n');
    }

    function dispatchAutoExecution(text, intent, hexIds, contextOverride) {
      var ctx = contextOverride || buildDiscussContext();
      var fullMessage = ctx
        ? ('【背景讨论记录】\n' + ctx + '\n\n【当前要执行的任务】\n' + text)
        : text;

      if (intent.route === 'autonomy') {
        var firstAgentId = intent.firstAgentId;
        var autonomyBrief = buildAutonomyExecutionBrief(text, intent, window._lastDiscussReplies || []);
        window.appendHexChatMsg(window.t('you'), '∞ 自治接力：' + text, false, true, 'discuss');
        window.hexChatSend.disabled = true;
        window.setHexChatStatus('已识别为多员工执行任务，正在启动自治接力…');
        fetch('/api/autonomy/task-runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: window.projectId, hexId: firstAgentId, message: autonomyBrief || fullMessage, sessionKey: 'main' })
        })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (!data || !data.runId) throw new Error(data && data.error ? data.error : '未返回 runId');
            if (typeof window.setAutonomyStatus === 'function' && typeof window.autonomyAgentName === 'function') {
              window.setAutonomyStatus('自治接力已由 ' + window.autonomyAgentName(firstAgentId) + ' 发起：' + data.runId);
            }
            if (typeof window.loadAutonomyRuns === 'function') window.loadAutonomyRuns(true);
            if (typeof window.startAutonomyPolling === 'function') window.startAutonomyPolling();
            if (typeof window.autonomyAgentName === 'function') {
              window.appendHexChatMsg(window.t('systemLabel'), '∞ 已从群聊自动转为自治接力，首位员工：' + window.autonomyAgentName(firstAgentId) + '，运行ID：' + data.runId, false, true, 'discuss');
            }
            window.setHexChatStatus('');
            window.hexChatSend.disabled = false;
          })
          .catch(function(err) {
            window.setHexChatStatus('');
            window.appendHexChatMsg(window.t('systemLabel'), '自治接力启动失败：' + ((err && err.message) || '网络错误'), true, false);
            window.hexChatSend.disabled = false;
          });
        return true;
      }

      var targetHexId = intent.firstAgentId || (hexIds && hexIds[0]);
      var hex = window.hexList.find(function(h) { return h.id === targetHexId; }) || { id: targetHexId };
      var targetHexName = window.getAgentDisplayName(targetHexId, hex.label, hex.name);
      window.appendHexChatMsg(window.t('you'), '[任务] ' + text, false, true, 'discuss');
      window.hexChatSend.disabled = true;
      window.setHexChatStatus(window.t('hexChatExecTask', targetHexName));
      fetch('/api/agent/agent-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hexId: targetHexId, message: fullMessage, projectId: window.projectId, sessionKey: 'main' })
      })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.error) {
            window.setHexChatStatus('');
            window.appendHexChatMsg(window.t('systemLabel'), window.t('taskFailedWith', data.error), true, false);
            window.hexChatSend.disabled = false;
            return;
          }
          window.appendHexChatMsg(window.t('systemLabel'), '⚡ 已从群聊自动转为执行任务：' + targetHexName, false, true, 'discuss');
          window._pollAgentTask(data.taskId, targetHexName);
        })
        .catch(function(e) {
          window.setHexChatStatus('');
          window.appendHexChatMsg(window.t('systemLabel'), window.t('requestFailedWith', e.message || '网络错误'), true);
          window.hexChatSend.disabled = false;
        });
      return true;
    }

    function scheduleAutoExecution(text, intent, hexIds, taskId) {
      window._pendingDiscussExecution = {
        text: text,
        intent: intent,
        hexIds: (hexIds || []).slice(),
        taskId: taskId || null,
      };
      window.setHexChatStatus('已识别为执行型任务，先进行群聊分析，结束后自动转执行…');
    }

    function flushAutoExecutionAfterDiscuss(replies, enableBroadcast, hexIds) {
      var pending = window._pendingDiscussExecution;
      if (!pending) return false;
      if (!enableBroadcast) return false;
      window._lastDiscussReplies = Array.isArray(replies) ? replies.slice() : [];
      var context = buildRepliesContext(replies);
      window._pendingDiscussExecution = null;
      window.appendHexChatMsg(window.t('systemLabel'), pending.intent.route === 'autonomy'
        ? '∞ 讨论完成，已自动转入自治接力…'
        : '⚡ 讨论完成，已自动转入执行任务…', false, true, 'discuss');
      dispatchAutoExecution(pending.text, pending.intent, pending.hexIds || hexIds || [], context);
      return true;
    }

    function parseYinDecision(text) {
      var result = { decision: '', confidence: '', reason: '', actions: '', raw: text };
      var lines = String(text || '').split('\n');
      var currentKey = null;
      var buffer = [];
      lines.forEach(function(line) {
        var m;
        if ((m = line.match(/^决策[：:]\s*(.+)/))) {
          result.decision = m[1].trim();
          currentKey = null;
        } else if ((m = line.match(/^置信度[：:]\s*(.+)/))) {
          result.confidence = m[1].trim();
          currentKey = null;
        } else if ((m = line.match(/^理由[：:]\s*(.*)/))) {
          buffer = [m[1]];
          currentKey = 'reason';
        } else if ((m = line.match(/^行动项[：:]\s*(.*)/))) {
          if (currentKey === 'reason') result.reason = buffer.join('\n').trim();
          buffer = [m[1]];
          currentKey = 'actions';
        } else if (currentKey) {
          buffer.push(line);
        }
      });
      if (currentKey === 'reason') result.reason = buffer.join('\n').trim();
      if (currentKey === 'actions') result.actions = buffer.join('\n').trim();
      return result;
    }

    function renderSummaryShell(title, meta, contentHtml, actionsHtml) {
      return '<div class="hex-chat-summary-card-head">'
        + '<div class="hex-chat-summary-label">' + title + '</div>'
        + (meta ? '<div class="hex-chat-summary-card-meta">' + meta + '</div>' : '')
        + '</div>'
        + '<div class="hex-chat-summary-content">' + contentHtml + '</div>'
        + (actionsHtml ? '<div class="hex-chat-summary-actions">' + actionsHtml + '</div>' : '');
    }

    function renderYinDecision(parsed, rawText) {
      var decisionColor = { '执行': '#4caf82', '暂缓': '#f0a020', '放弃': '#e05a5a' }[parsed.decision] || 'var(--gold)';
      var confidenceIcon = { '高': '🟢', '中': '🟡', '低': '🔴' }[parsed.confidence] || '⚪';
      var bodyHtml = '';
      if (parsed.decision) {
        bodyHtml += '<div class="hex-chat-decision-main">'
          + '<span class="hex-chat-decision-verdict" style="font-size:20px;font-weight:700;color:' + decisionColor + ';">' + window.escapeHtml(parsed.decision) + '</span>'
          + (parsed.confidence ? '<span style="font-size:13px;">' + confidenceIcon + ' 置信度：' + window.escapeHtml(parsed.confidence) + '</span>' : '')
          + '</div>';
        if (parsed.reason) {
          bodyHtml += '<div style="font-size:13px;color:var(--text-muted);margin-bottom:6px;line-height:1.5;">' + window.escapeHtml(parsed.reason).replace(/\n/g, '<br>') + '</div>';
        }
        if (parsed.actions) {
          bodyHtml += '<div style="font-size:13px;border-top:1px solid rgba(255,255,255,.08);padding-top:6px;">'
            + '<strong style="color:var(--text-muted);font-size:11px;">行动项</strong><br>'
            + window.escapeHtml(parsed.actions).replace(/\n/g, '<br>')
            + '</div>';
        }
      } else {
        bodyHtml += window.escapeHtml(rawText);
      }
      return renderSummaryShell(
        '🧭 主控 · 决策总结',
        '项目裁决 / 收口动作',
        bodyHtml,
        '<button type="button" class="hex-chat-decision-copy">复制决策</button>'
      );
    }

    function triggerYinDecision(summaryText, summaryDiv) {
      var yinBtn = summaryDiv && summaryDiv.querySelector('.hex-chat-ask-yin-btn');
      if (yinBtn) {
        yinBtn.disabled = true;
        yinBtn.textContent = '主控正在决策…';
      }
      if (summaryDiv) {
        var oldDecision = summaryDiv.querySelector('.hex-chat-yin-decision');
        if (oldDecision) oldDecision.remove();
      }
      var yinHistory = window.getYinChatHistoryForAPI();
      var yinPrompt = '以下是项目员工群的讨论摘要：\n\n' + summaryText + '\n\n请你作为项目管理者，严格按以下格式给出决策（每个标签必须有内容）：\n\n决策：执行 / 暂缓 / 放弃（三选一）\n置信度：高 / 中 / 低（三选一）\n理由：（1-3句话，简洁有力）\n行动项：（谁负责什么，格式：- 负责人：任务内容）\n\n要求：严格按格式，不要多余内容，不超过200字。';

      function renderDecisionResult(reply, errMsg) {
        if (!summaryDiv) return;
        var decisionDiv = document.createElement('div');
        decisionDiv.className = 'hex-chat-yin-decision';
        if (reply) {
          decisionDiv.setAttribute('data-decision', reply);
          var parsed = parseYinDecision(reply);
          decisionDiv.innerHTML = renderYinDecision(parsed, reply);
          var copyBtn = decisionDiv.querySelector('.hex-chat-decision-copy');
          if (copyBtn) {
            copyBtn.addEventListener('click', function() {
              navigator.clipboard && navigator.clipboard.writeText(reply).then(function() {
                copyBtn.textContent = '已复制✓';
                setTimeout(function() { copyBtn.textContent = '复制决策'; }, 2000);
              });
            });
          }
          window.saveHexChatHistory();
        } else if (errMsg && errMsg.indexOf('未配置') !== -1) {
          decisionDiv.innerHTML = renderSummaryShell('🧭 主控 · 决策总结', '项目裁决 / 收口动作', '主控对话未配置，无法获取决策', '');
        } else {
          decisionDiv.innerHTML = renderSummaryShell('🧭 主控 · 决策总结', '项目裁决 / 收口动作', '主控的决策获取失败', '<button type="button" class="hex-chat-ask-yin-btn">重试</button>');
          var retryBtn = decisionDiv.querySelector('.hex-chat-ask-yin-btn');
          if (retryBtn) retryBtn.addEventListener('click', function() { triggerYinDecision(summaryText, summaryDiv); });
        }
        summaryDiv.appendChild(decisionDiv);
        if (window.hexChatMessages) window.hexChatMessages.scrollTop = window.hexChatMessages.scrollHeight;
        var btnAfter = summaryDiv && summaryDiv.querySelector('.hex-chat-ask-yin-btn');
        if (btnAfter) {
          btnAfter.disabled = false;
          btnAfter.textContent = '@主控 请求决策';
        }
      }

      fetch('/api/yin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: yinPrompt, projectId: window.projectId, history: yinHistory })
      })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var taskId = data && data.taskId;
          if (!taskId) {
            renderDecisionResult(null, data && data.error ? data.error : '未返回 taskId');
            return;
          }
          function poll() {
            fetch('/api/yin/task/' + encodeURIComponent(taskId))
              .then(function(r) { return r.json(); })
              .then(function(task) {
                if (task.status === 'done') {
                  renderDecisionResult(task.reply || null, null);
                  return;
                }
                if (task.status === 'error') {
                  renderDecisionResult(null, task.error || '未知错误');
                  return;
                }
                setTimeout(poll, 1500);
              })
              .catch(function() { setTimeout(poll, 2000); });
          }
          poll();
        })
        .catch(function() {
          if (summaryDiv) {
            var decisionDiv = document.createElement('div');
            decisionDiv.className = 'hex-chat-yin-decision';
            decisionDiv.innerHTML = renderSummaryShell('🧭 主控 · 决策总结', '项目裁决 / 收口动作', '主控的决策获取失败，网络错误', '');
            summaryDiv.appendChild(decisionDiv);
          }
          var btnAfter = summaryDiv && summaryDiv.querySelector('.hex-chat-ask-yin-btn');
          if (btnAfter) {
            btnAfter.disabled = false;
            btnAfter.textContent = '@主控 请求决策';
          }
        });
    }

    function doSummaryRequest(hexId, hexName, prompt, summaryDiv, hexIds, replies) {
      summaryDiv.innerHTML = renderSummaryShell('📋 ' + window.escapeHtml(hexName) + ' 的讨论摘要', '员工讨论 / 摘要整理', '正在整理摘要…', '');
      if (window.hexChatMessages) window.hexChatMessages.scrollTop = window.hexChatMessages.scrollHeight;

      function showSummaryError(msg) {
        if (!summaryDiv) return;
        summaryDiv.innerHTML = renderSummaryShell('📋 讨论摘要', '员工讨论 / 摘要整理', window.escapeHtml(msg), '<button type="button" class="hex-chat-summary-retry">重试</button>');
        var retryBtn = summaryDiv.querySelector('.hex-chat-summary-retry');
        if (retryBtn) retryBtn.addEventListener('click', function() {
          doSummaryRequest(hexId, hexName, prompt, summaryDiv, hexIds, replies);
        });
      }

      function renderSummaryReply(reply) {
        var regenSelect = '';
        if (hexIds && hexIds.length > 1) {
          regenSelect = '<select class="hex-chat-regen-select" title="换一个员工重新生成摘要">';
          hexIds.forEach(function(hid) {
            var hex = window.hexList.find(function(item) { return item.id === hid; });
            var label = window.getAgentDisplayName(hid, hex ? hex.label : '', hex ? hex.name : '');
            regenSelect += '<option value="' + window.escapeHtml(hid) + '"' + (hid === hexId ? ' selected' : '') + '>' + window.escapeHtml(label) + '</option>';
          });
          regenSelect += '</select>';
        }
        summaryDiv.setAttribute('data-summary', reply);
        summaryDiv.setAttribute('data-hex-name', hexName);
        summaryDiv.innerHTML = renderSummaryShell(
          '📋 ' + window.escapeHtml(hexName) + ' 的讨论摘要',
          '员工讨论 / 摘要整理' + (regenSelect ? '<span class="hex-chat-regen-wrap"> · 换人摘要：' + regenSelect + '</span>' : ''),
          window.escapeHtml(reply),
          '<button type="button" class="hex-chat-ask-yin-btn">@主控 请求决策</button>'
        );

        var regenSelectEl = summaryDiv.querySelector('.hex-chat-regen-select');
        if (regenSelectEl) {
          regenSelectEl.addEventListener('change', function() {
            var newHexId = this.value;
            var newHex = window.hexList.find(function(h) { return h.id === newHexId; });
            var newHexName = window.getAgentDisplayName(newHexId, newHex ? newHex.label : '', newHex ? newHex.name : '');
            var discussContent = (replies || []).filter(function(r) { return r.reply; }).map(function(r) {
              var displayName = window.getAgentDisplayName(r.hexId, '', r.name);
              return displayName + '：' + r.reply;
            }).join('\n\n');
            var newPrompt = '以下是刚刚的群讨论内容：\n\n' + discussContent + '\n\n请你作为汇报者，客观整理以上讨论的核心观点和分歧，不加入你自己的判断。格式：核心观点（每人一句）、分歧点（如有）。简洁，不超过200字。';
            doSummaryRequest(newHexId, newHexName, newPrompt, summaryDiv, hexIds, replies);
          });
        }

        var yinBtn = summaryDiv.querySelector('.hex-chat-ask-yin-btn');
        if (yinBtn) yinBtn.addEventListener('click', function() { triggerYinDecision(reply, summaryDiv); });

        if (window.hexChatMessages) window.hexChatMessages.scrollTop = window.hexChatMessages.scrollHeight;
        window.saveHexChatHistory();
      }

      function pollSummaryTask(taskId) {
        fetch('/api/agent/task/' + taskId)
          .then(function(r) { return r.json(); })
          .then(function(task) {
            if (task.status === 'done') {
              var reply = task.replies && task.replies[0] && task.replies[0].reply;
              if (reply) renderSummaryReply(reply);
              else showSummaryError('摘要获取失败');
            } else if (task.status === 'error') {
              showSummaryError('摘要获取失败：' + (task.error || '未知错误'));
            } else {
              setTimeout(function() { pollSummaryTask(taskId); }, 2000);
            }
          })
          .catch(function() { setTimeout(function() { pollSummaryTask(taskId); }, 3000); });
      }

      fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          hexIds: [hexId],
          history: [],
          enableBroadcast: false,
          maxRounds: 1,
          projectId: window.projectId
        })
      })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.taskId) pollSummaryTask(data.taskId);
          else showSummaryError('摘要获取失败');
        })
        .catch(function() { showSummaryError('摘要获取失败，网络错误'); });
    }

    function triggerDiscussSummary(hexIds, replies) {
      if (!hexIds || !hexIds.length) return;
      var summaryHexId = hexIds[0];
      var summaryHex = window.hexList.find(function(h) { return h.id === summaryHexId; });
      var summaryHexName = window.getAgentDisplayName(summaryHexId, summaryHex ? summaryHex.label : '', summaryHex ? summaryHex.name : '');
      var discussContent = replies.filter(function(r) { return r.reply; }).map(function(r) {
        var displayName = window.getAgentDisplayName(r.hexId, '', r.name);
        return displayName + '：' + r.reply;
      }).join('\n\n');
      if (!discussContent) return;
      var summaryPrompt = '以下是刚刚的群讨论内容：\n\n' + discussContent + '\n\n请你作为汇报者，客观整理以上讨论的核心观点和分歧，不加入你自己的判断（判断留给管理者）。格式：核心观点（每人一句）、分歧点（如有）。简洁，不超过200字。';
      var summaryDiv = document.createElement('div');
      summaryDiv.className = 'hex-chat-summary-block';
      summaryDiv.innerHTML = '<div class="hex-chat-summary-label">📋 ' + window.escapeHtml(summaryHexName) + ' 正在整理摘要…</div>';
      if (window.hexChatMessages) {
        window.hexChatMessages.appendChild(summaryDiv);
        window.hexChatMessages.scrollTop = window.hexChatMessages.scrollHeight;
      }
      doSummaryRequest(summaryHexId, summaryHexName, summaryPrompt, summaryDiv, hexIds, replies);
    }

    function onHexChatDone(replies, enableBroadcast, hexIds) {
      function isConnectivityFailure(reply) {
        var err = String((reply && reply.error) || '');
        if (!err) return false;
        return /无法连接|连接被拒绝|不可用|未配置端口|无此员工|HTTP 404|HTTP 405|接口仍在预热|接口尚未就绪|对话接口/.test(err);
      }
      var successReplies = replies.filter(function(reply) { return !!reply.reply; });
      var failedReplies = replies.filter(function(reply) { return !reply.reply; });
      var statusParts = [];
      if (successReplies.length) statusParts.push('<span class="st-item st-ok">成功 ' + successReplies.length + '</span>');
      if (failedReplies.length) statusParts.push('<span class="st-item st-fail">失败 ' + failedReplies.length + '</span>');
      window.setHexChatStatus(statusParts.length ? statusParts.join(' ') : '');
      var allFailed = replies.length > 0 && successReplies.length === 0;
      var activeTaskId = window._activeTaskId || 'done';
      successReplies.forEach(function(reply) {
        var displayName = window.getAgentDisplayName(reply.hexId, '', reply.name);
        var finalized = typeof window.finalizeHexChatLiveMsg === 'function'
          ? window.finalizeHexChatLiveMsg(activeTaskId + ':' + reply.hexId, displayName, reply.reply || '—', false, enableBroadcast ? 'discuss' : 'single', reply.hexId)
          : false;
        if (!finalized) {
          window.appendHexChatMsg(displayName, reply.reply || '—', false, true, undefined, reply.hexId);
        }
      });
      if (typeof window.clearHexChatLiveMsg === 'function') {
        failedReplies.forEach(function(reply) {
          if (!reply || !reply.hexId) return;
          window.clearHexChatLiveMsg(activeTaskId + ':' + reply.hexId);
        });
      }
      if (failedReplies.length) {
        var grouped = {};
        failedReplies.forEach(function(reply) {
          var err = String(reply.error || '未知错误').trim() || '未知错误';
          if (!grouped[err]) grouped[err] = [];
          grouped[err].push(window.getAgentDisplayName(reply.hexId, '', reply.name));
        });
        var summaryLines = Object.keys(grouped).map(function(err) {
          return '- ' + grouped[err].join('、') + '：' + err;
        });
        window.appendHexChatMsg(
          window.t('systemLabel'),
          '以下员工本轮未返回成功结果：\n' + summaryLines.join('\n'),
          true,
          true
        );
      }
      if (allFailed && replies.length > 0) {
        var allConnectivityFailed = failedReplies.length === replies.length && failedReplies.every(isConnectivityFailure);
        window.appendHexChatMsg(
          window.t('systemLabel'),
          window.t(allConnectivityFailed ? 'hexChatNoConnect' : 'hexChatAllFailedButReachable'),
          true,
          false
        );
      }
      if (enableBroadcast && !allFailed && successReplies.length >= 2) {
        triggerDiscussSummary(hexIds, replies);
      }
      if (!allFailed && successReplies.length) {
        flushAutoExecutionAfterDiscuss(replies, enableBroadcast, hexIds);
      } else {
        window._pendingDiscussExecution = null;
      }
      if (window.hexChatSend) window.hexChatSend.disabled = false;
      if (window._activeTaskStream && window._activeTaskStream.taskId === activeTaskId) {
        try { window._activeTaskStream.es.close(); } catch (_) {}
        window._activeTaskStream = null;
      }
      window._activeTaskId = null;
    }

    function closeTaskStream(taskId) {
      if (!window._activeTaskStream) return;
      if (taskId && window._activeTaskStream.taskId !== taskId) return;
      try { window._activeTaskStream.es.close(); } catch (_) {}
      window._activeTaskStream = null;
    }

    function handleRunningTaskSnapshot(taskId, task, enableBroadcast, hexIds) {
      if (!task || window._activeTaskId !== taskId) return;
      if (Array.isArray(task.replies) && typeof window.upsertHexChatLiveMsg === 'function') {
        task.replies.forEach(function(reply) {
          if (!reply || !reply.hexId || !reply.reply) return;
          var liveName = window.getAgentDisplayName(reply.hexId, '', reply.name);
          window.upsertHexChatLiveMsg(taskId + ':' + reply.hexId, liveName, reply.reply, enableBroadcast ? 'discuss' : 'single', reply.hexId);
        });
      }
      if (task.status === 'done') {
        if (typeof window.refreshRuntimeSnapshot === 'function') window.refreshRuntimeSnapshot();
        closeTaskStream(taskId);
        onHexChatDone(task.replies || [], enableBroadcast, hexIds);
        return true;
      }
      if (task.status === 'error') {
        if (typeof window.refreshRuntimeSnapshot === 'function') window.refreshRuntimeSnapshot();
        closeTaskStream(taskId);
        window.setHexChatStatus('');
        if (typeof window.clearHexChatLiveMsg === 'function') {
          (hexIds || []).forEach(function(hexId) {
            window.clearHexChatLiveMsg(taskId + ':' + hexId);
          });
        }
        window.appendHexChatMsg(window.t('systemLabel'), window.t('serviceErrorWith', task.error || '未知错误'), true, false);
        if (window.hexChatSend) window.hexChatSend.disabled = false;
        window._activeTaskId = null;
        return true;
      }
      return false;
    }

    function pollTask(taskId, enableBroadcast, hexIds) {
      if (window._activeTaskId !== taskId) return;
      fetch('/api/agent/task/' + taskId)
        .then(function(r) { return r.json(); })
        .then(function(task) {
          if (window._activeTaskId !== taskId) return;
          if (task.status === 'running' && Array.isArray(task.replies) && typeof window.upsertHexChatLiveMsg === 'function') {
            task.replies.forEach(function(reply) {
              if (!reply || !reply.hexId || !reply.reply) return;
              var liveName = window.getAgentDisplayName(reply.hexId, '', reply.name);
              window.upsertHexChatLiveMsg(taskId + ':' + reply.hexId, liveName, reply.reply, enableBroadcast ? 'discuss' : 'single', reply.hexId);
            });
          }
          if (task.status === 'done') {
            if (typeof window.refreshRuntimeSnapshot === 'function') window.refreshRuntimeSnapshot();
            onHexChatDone(task.replies || [], enableBroadcast, hexIds);
          } else if (task.status === 'error') {
            if (typeof window.refreshRuntimeSnapshot === 'function') window.refreshRuntimeSnapshot();
            window.setHexChatStatus('');
            if (typeof window.clearHexChatLiveMsg === 'function') {
              (hexIds || []).forEach(function(hexId) {
                window.clearHexChatLiveMsg(taskId + ':' + hexId);
              });
            }
            window.appendHexChatMsg(window.t('systemLabel'), window.t('serviceErrorWith', task.error || '未知错误'), true, false);
            if (window.hexChatSend) window.hexChatSend.disabled = false;
            window._activeTaskId = null;
          } else {
            var hasPartialReplies = Array.isArray(task.replies) && task.replies.some(function(reply) {
              return !!(reply && reply.reply);
            });
            window._activeTaskTimer = setTimeout(function() { pollTask(taskId, enableBroadcast, hexIds); }, hasPartialReplies ? 350 : 900);
          }
        })
        .catch(function() {
          if (window._activeTaskId !== taskId) return;
          window._activeTaskTimer = setTimeout(function() { pollTask(taskId, enableBroadcast, hexIds); }, 1200);
        });
    }

    function startTaskStream(taskId, enableBroadcast, hexIds) {
      if (typeof EventSource === 'undefined') {
        pollTask(taskId, enableBroadcast, hexIds);
        return;
      }
      closeTaskStream();
      var es = new EventSource('/api/agent/task/' + encodeURIComponent(taskId) + '/stream');
      var receivedEvent = false;
      var fallbackTimer = setTimeout(function() {
        if (receivedEvent || window._activeTaskId !== taskId) return;
        closeTaskStream(taskId);
        pollTask(taskId, enableBroadcast, hexIds);
      }, 2500);

      function markReceived() {
        receivedEvent = true;
        clearTimeout(fallbackTimer);
      }

      function parsePayload(event) {
        try { return JSON.parse(event.data || '{}'); } catch (_) { return {}; }
      }

      es.addEventListener('snapshot', function(event) {
        markReceived();
        var payload = parsePayload(event);
        handleRunningTaskSnapshot(taskId, payload.task || null, enableBroadcast, hexIds);
      });

      es.addEventListener('reply', function(event) {
        markReceived();
        if (window._activeTaskId !== taskId || typeof window.upsertHexChatLiveMsg !== 'function') return;
        var payload = parsePayload(event);
        if (!payload || !payload.hexId || !payload.reply) return;
        var liveName = window.getAgentDisplayName(payload.hexId, '', payload.name);
        window.upsertHexChatLiveMsg(taskId + ':' + payload.hexId, liveName, payload.reply, enableBroadcast ? 'discuss' : 'single', payload.hexId);
      });

      es.addEventListener('done', function(event) {
        markReceived();
        var payload = parsePayload(event);
        if (typeof window.refreshRuntimeSnapshot === 'function') window.refreshRuntimeSnapshot();
        closeTaskStream(taskId);
        onHexChatDone((payload.task && payload.task.replies) || [], enableBroadcast, hexIds);
      });

      es.addEventListener('failed', function(event) {
        markReceived();
        var payload = parsePayload(event);
        if (typeof window.refreshRuntimeSnapshot === 'function') window.refreshRuntimeSnapshot();
        closeTaskStream(taskId);
        window.setHexChatStatus('');
        if (typeof window.clearHexChatLiveMsg === 'function') {
          (hexIds || []).forEach(function(hexId) {
            window.clearHexChatLiveMsg(taskId + ':' + hexId);
          });
        }
        window.appendHexChatMsg(window.t('systemLabel'), window.t('serviceErrorWith', (payload.task && payload.task.error) || '未知错误'), true, false);
        if (window.hexChatSend) window.hexChatSend.disabled = false;
        window._activeTaskId = null;
      });

      es.onerror = function() {
        if (window._activeTaskId !== taskId) {
          closeTaskStream(taskId);
          return;
        }
        if (!receivedEvent) {
          closeTaskStream(taskId);
          pollTask(taskId, enableBroadcast, hexIds);
        }
      };

      window._activeTaskStream = { taskId: taskId, es: es };
    }

    function fetchRuntimeAgentItems() {
      return fetch('/api/tenant-runtime/runtime/agents')
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
        .then(function(result) {
          if (!result.ok || (result.data && result.data.error)) return [];
          var items = Array.isArray(result.data && result.data.items) ? result.data.items : [];
          window.tenantRuntimeAgents = items;
          return items;
        })
        .catch(function() { return []; });
    }

    function getRuntimeAgentMap(items) {
      var map = {};
      (items || []).forEach(function(item) {
        if (item && item.agentId) map[item.agentId] = item;
      });
      return map;
    }

    function getWarmingHexIds(hexIds, items) {
      var runtimeMap = getRuntimeAgentMap(items || window.tenantRuntimeAgents || []);
      return (hexIds || []).filter(function(hexId) {
        var item = runtimeMap[hexId];
        return !!(item && item.running && String(item.readinessStatus || '') === 'warming');
      });
    }

    function waitForChatReady(hexIds, timeoutMs) {
      var limit = Math.max(0, Number(timeoutMs || 0));
      if (!hexIds || !hexIds.length || limit <= 0) return Promise.resolve(false);
      var startedAt = Date.now();
      return fetchRuntimeAgentItems().then(function(items) {
        if (!getWarmingHexIds(hexIds, items).length) return false;
        function poll() {
          return fetchRuntimeAgentItems().then(function(nextItems) {
            if (!getWarmingHexIds(hexIds, nextItems).length) return false;
            if (Date.now() - startedAt >= limit) return true;
            return new Promise(function(resolve) {
              setTimeout(function() { resolve(poll()); }, 1000);
            });
          });
        }
        return poll();
      });
    }

    function submitAgentChat(payload, options) {
      var opts = options || {};
      return fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.error) {
            window.setHexChatStatus('<span class="st-fail">' + window.escapeHtml(window.t('serviceErrorWith', data.error)) + '</span>');
            window.appendHexChatMsg(window.t('systemLabel'), window.t('serviceErrorWith', data.error), true, false);
            window.hexChatSend.disabled = false;
            return;
          }
          var taskId = data.taskId;
          if (!taskId) {
            window.appendHexChatMsg(window.t('systemLabel'), window.t('noTaskId'), true, false);
            window.hexChatSend.disabled = false;
            return;
          }
          if (typeof opts.onTaskId === 'function') opts.onTaskId(taskId);
          window._activeTaskId = taskId;
          window._activeEnableBroadcast = !!opts.enableBroadcast;
          window._activeHexIds = opts.hexIds || payload.hexIds || [];
          startTaskStream(taskId, !!opts.enableBroadcast, opts.hexIds || payload.hexIds || []);
        })
        .catch(function(e) {
          window.setHexChatStatus('');
          var msg = e.message || '网络错误';
          var hint = window.t('requestFailedWith', msg);
          if (/load failed|failed to fetch|networkerror|network error/i.test(String(msg)) || msg === 'Load failed') {
            hint = window.t('connectPanelHint', 'http://localhost:3999/project.html' + (window.projectId ? '?id=' + window.projectId : ''));
          }
          window.appendHexChatMsg(window.t('systemLabel'), hint, true);
          window.hexChatSend.disabled = false;
        });
    }

    if (window.hexChatSend) {
      window.hexChatSend.addEventListener('click', function() {
        var text = (window.hexChatInput && window.hexChatInput.value) ? window.hexChatInput.value.trim() : '';
        if (!text || !window.project || !window.project.hexIds || !window.project.hexIds.length) return;
        window.hexChatInput.value = '';
        var hexIds = window.project.hexIds;
        var checkedMode = document.querySelector('input[name="hexChatMode"]:checked');
        var chatModeVal = checkedMode ? checkedMode.value : window.getHexChatMode();

        if (chatModeVal === 'agent') {
          var mentioned = window.parseMentionedHexNamesFromText(text, hexIds);
          var targetHexId = mentioned.length > 0 ? mentioned[0] : hexIds[0];
          var hex = window.hexList.find(function(h) { return h.id === targetHexId; }) || { id: targetHexId };
          var targetHexName = window.getAgentDisplayName(targetHexId, hex.label, hex.name);
          window.appendHexChatMsg(window.t('you'), '[任务] ' + text, false);
          window.hexChatSend.disabled = true;
          window.setHexChatStatus(window.t('hexChatExecTask', targetHexName));
          fetch('/api/agent/agent-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hexId: targetHexId, message: text, projectId: window.projectId })
          })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              if (data.error) {
                window.setHexChatStatus('');
                window.appendHexChatMsg(window.t('systemLabel'), window.t('taskFailedWith', data.error), true, false);
                window.hexChatSend.disabled = false;
                return;
              }
              window._pollAgentTask(data.taskId, targetHexName);
            })
            .catch(function(e) {
              window.setHexChatStatus('');
              window.appendHexChatMsg(window.t('systemLabel'), window.t('requestFailedWith', e.message || '网络错误'), true);
              window.hexChatSend.disabled = false;
            });
          return;
        }

        if (chatModeVal === 'discuss') {
          var autoIntent = detectExecutionIntent(text, hexIds);
          if (autoIntent) {
            window.appendHexChatMsg(window.t('you'), text, false);
            window.hexChatSend.disabled = true;
            window.setHexChatStatus(window.t('hexChatSending'));
            var discussHistory = window.getHexChatHistory();
            window.currentRequestAbortController = null;
            var autoPayload = {
              message: text,
              hexIds: hexIds,
              history: discussHistory,
              enableBroadcast: true,
              maxRounds: window.getHexChatMaxRounds(),
              projectId: window.projectId
            };
            waitForChatReady(hexIds, 8000).then(function(stillWarming) {
              if (stillWarming) {
                window.appendHexChatMsg(window.t('systemLabel'), window.t('hexChatWarmingContinue'), true, true);
                window.setHexChatStatus(window.t('hexChatSending'));
              }
              submitAgentChat(autoPayload, {
                enableBroadcast: true,
                hexIds: hexIds,
                onTaskId: function(discussTaskId) {
                  scheduleAutoExecution(text, autoIntent, hexIds, discussTaskId);
                }
              });
            });
            fetchRuntimeAgentItems().then(function(items) {
              if (getWarmingHexIds(hexIds, items).length) {
                window.setHexChatStatus(window.t('hexChatWarmingWait'));
              }
            });
            return;
          }
        }

        window.appendHexChatMsg(window.t('you'), text, false);
        window.hexChatSend.disabled = true;
        window.setHexChatStatus(window.t('hexChatSending'));
        var history = window.getHexChatHistory();
        var enableBroadcast = chatModeVal === 'discuss';
        var maxRounds = window.getHexChatMaxRounds();
        window.currentRequestAbortController = null;
        var payload = {
          message: text,
          hexIds: hexIds,
          history: history,
          enableBroadcast: enableBroadcast,
          maxRounds: maxRounds,
          projectId: window.projectId
        };
        waitForChatReady(hexIds, 8000).then(function(stillWarming) {
          if (stillWarming) {
            window.appendHexChatMsg(window.t('systemLabel'), window.t('hexChatWarmingContinue'), true, true);
            window.setHexChatStatus(window.t('hexChatSending'));
          }
          submitAgentChat(payload, {
            enableBroadcast: enableBroadcast,
            hexIds: hexIds
          });
        });
        fetchRuntimeAgentItems().then(function(items) {
          if (getWarmingHexIds(hexIds, items).length) {
            window.setHexChatStatus(window.t('hexChatWarmingWait'));
          }
        });
      });
    }

    if (window.hexChatMessages) {
      window.hexChatMessages.addEventListener('click', function(e) {
        if (e.target && e.target.classList && e.target.classList.contains('hex-chat-share')) {
          var msg = e.target.closest('.hex-chat-msg');
          if (!msg) return;
          shareToDiscuss(msg.getAttribute('data-name') || '你', msg.getAttribute('data-message') || '');
        }
      });
    }

    if (window.hexChatRoundsBtn && window.hexChatRoundsPopover) {
      window.hexChatRoundsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (window.hexChatRoundsBtn.classList.contains('disabled')) return;
        window.hexChatRoundsPopover.classList.toggle('show');
      });
      window.hexChatRoundsPopover.addEventListener('click', function(e) { e.stopPropagation(); });
      window.hexChatRoundsPopover.querySelectorAll('.hex-chat-rounds-opt').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var rounds = parseInt(btn.getAttribute('data-rounds'), 10);
          window.setHexChatMaxRounds(rounds);
          window.updateHexChatRoundsUI();
          window.updateHexChatState();
          window.hexChatRoundsPopover.classList.remove('show');
        });
      });
      document.addEventListener('click', function() { window.hexChatRoundsPopover.classList.remove('show'); });
    }

    window.parseYinDecision = parseYinDecision;
    window.renderYinDecision = renderYinDecision;
    window.triggerYinDecision = triggerYinDecision;
    window.triggerDiscussSummary = triggerDiscussSummary;
    window._pollTask = pollTask;
    window._onHexChatDone = onHexChatDone;
  }

  window.initProjectHexChat = initProjectHexChat;
})();
