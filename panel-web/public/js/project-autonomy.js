(function() {
  function initProjectAutonomy() {
    var btnAutonomyPanel = document.getElementById('btnAutonomyPanel');
    var autonomyPanel = document.getElementById('modalAutonomy');
    var btnAutonomyRefresh = document.getElementById('btnAutonomyRefresh');
    var btnAutonomyClear = document.getElementById('btnAutonomyClear');
    var btnAutonomyClose = document.getElementById('btnAutonomyClose');
    var autonomyAgentSelect = document.getElementById('autonomyAgentSelect');
    var autonomyTaskInput = document.getElementById('autonomyTaskInput');
    var autonomyStartBtn = document.getElementById('autonomyStartBtn');
    var autonomyStatus = document.getElementById('autonomyStatus');
    var autonomyRunsList = document.getElementById('autonomyRunsList');
    var autonomyPollTimer = null;
    var autonomyChatState = window._autonomyChatState || (window._autonomyChatState = {});
    var autonomySkillsLibrary = null;

    function setAutonomyStatus(text) {
      if (autonomyStatus) autonomyStatus.textContent = text || '';
    }

    function autonomyAgentName(agentId) {
      var hex = window.hexList.find(function(h) { return h.id === agentId; });
      return window.getAgentDisplayName(agentId, hex ? hex.label : '', hex ? hex.name : '');
    }

    function fillAutonomyAgentSelect() {
      if (!autonomyAgentSelect) return;
      autonomyAgentSelect.innerHTML = '';
      window.hexList.forEach(function(h) {
        var option = document.createElement('option');
        option.value = h.id;
        option.textContent = autonomyAgentName(h.id);
        autonomyAgentSelect.appendChild(option);
      });
    }

    function buildAutonomyAgentOptions(selectedAgentId) {
      return window.hexList.map(function(h) {
        return '<option value="' + window.escapeHtml(h.id) + '"' + (h.id === selectedAgentId ? ' selected' : '') + '>' + window.escapeHtml(autonomyAgentName(h.id)) + '</option>';
      }).join('');
    }

    function formatAutonomyChatStatus(state) {
      var map = {
        running: '执行中',
        completed: '已完成',
        needs_yin: '等待主控仲裁',
        waiting_user: '等待用户补充',
        terminated: '已终止',
        failed: '失败',
        done: '已完成'
      };
      return map[state] || (state || '进行中');
    }

    function formatAutonomyProgressStage(stage) {
      var map = {
        queued: '已入队',
        attempt: '开始执行',
        connecting: '连接网关',
        challenge: '握手挑战',
        connected: '握手完成',
        history_snapshot: '读取会话',
        agent_dispatched: '已派发',
        waiting: '执行中',
        stream: '实时输出',
        history_reply: '获取回复',
        preview_fallback: '回复兜底',
        preview_reply: '预览回复',
        wait_error: '执行报错',
        retry_unsigned: '兼容重试',
        retry_wait: '等待重试',
        completed: '执行结束',
        done: '已完成',
        failed: '失败'
      };
      return map[stage] || (stage || '执行中');
    }

    function appendAutonomyChatSystem(message, isError) {
      if (!message || !window.appendHexChatMsg) return;
      window.appendHexChatMsg(window.t('systemLabel'), '∞ ' + message, !!isError, true, 'discuss');
    }

    function loadAutonomySkillsLibrary() {
      if (Array.isArray(autonomySkillsLibrary)) return Promise.resolve(autonomySkillsLibrary);
      return fetch('/api/skills')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          autonomySkillsLibrary = Array.isArray(data && data.skills) ? data.skills : [];
          return autonomySkillsLibrary;
        })
        .catch(function() {
          autonomySkillsLibrary = [];
          return autonomySkillsLibrary;
        });
    }

    function getAutonomySkillDisplayNames(agentId) {
      var projectSkillMap = window.project && (window.project.hexSkills || window.project.agentSkills);
      var ids = projectSkillMap && Array.isArray(projectSkillMap[agentId]) ? projectSkillMap[agentId] : [];
      if (!ids.length) return [];
      var library = Array.isArray(autonomySkillsLibrary) ? autonomySkillsLibrary : [];
      return ids.map(function(id) {
        var hit = library.find(function(skill) { return skill && skill.id === id; });
        return hit && hit.name ? hit.name : id;
      });
    }

    function buildAutonomySkillsLine(agentId) {
      var names = getAutonomySkillDisplayNames(agentId);
      if (!names.length) return '当前未挂载项目 skills';
      return '已挂载 skills：' + names.join('、');
    }

    function syncAutonomyRunsToChat(runs) {
      if (!Array.isArray(runs) || !runs.length) return;
      runs.forEach(function(run) {
        if (!run || !run.id) return;
        var state = autonomyChatState[run.id] || {
          eventCount: 0,
          stepCount: 0,
          lastProgressKey: '',
          lastStatus: ''
        };
        var events = Array.isArray(run.events) ? run.events : [];
        var steps = Array.isArray(run.steps) ? run.steps : [];

        for (var i = state.eventCount; i < events.length; i += 1) {
          var evt = events[i] || {};
          var agentName = evt.agentId ? autonomyAgentName(evt.agentId) : '';
          if (evt.type === 'run_started') {
            appendAutonomyChatSystem('已启动自治接力，首位员工：' + (agentName || '未知员工') + '，运行ID：' + run.id + '\n' + buildAutonomySkillsLine(evt.agentId || run.initialAgentId || '') + (evt.message ? ('\n任务目标：' + evt.message) : ''), false);
          } else if (evt.type === 'dispatch_requested') {
            var skillLine = '';
            if (Array.isArray(evt.skillIds) && evt.skillIds.length) skillLine = '已挂载 skills：' + evt.skillIds.join('、');
            appendAutonomyChatSystem('已派发下一棒给 ' + (agentName || '未知员工') + '\n' + (skillLine || buildAutonomySkillsLine(evt.agentId || '')) + (evt.message ? ('\n交接内容：' + evt.message) : ''), false);
          } else if (evt.type === 'step_progress') {
            var progressKey = [evt.agentId || '', evt.stage || '', evt.message || ''].join('|');
            if (progressKey && progressKey !== state.lastProgressKey) {
              state.lastProgressKey = progressKey;
              appendAutonomyChatSystem((agentName || '当前员工') + '：' + formatAutonomyProgressStage(evt.stage || 'running') + (evt.message ? ('\n' + evt.message) : ''), false);
            }
          } else if (evt.type === 'step_failed') {
            appendAutonomyChatSystem((agentName || '当前员工') + ' 执行失败' + (evt.error ? ('：' + evt.error) : ''), true);
          } else if (evt.type === 'yin_review_requested') {
            appendAutonomyChatSystem('当前接力已升级给主控仲裁。', false);
          } else if (evt.type === 'yin_review_completed') {
            appendAutonomyChatSystem('主控已完成仲裁。', false);
          } else if (evt.type === 'yin_review_continued') {
            appendAutonomyChatSystem('主控指定继续派工给 ' + (agentName || '下一位员工') + '。', false);
          } else if (evt.type === 'yin_review_waiting_user') {
            appendAutonomyChatSystem('主控要求用户补充信息后再继续。' + (evt.reason ? ('\n原因：' + evt.reason) : ''), false);
          } else if (evt.type === 'yin_review_terminated') {
            appendAutonomyChatSystem('主控已终止当前自治接力。' + (evt.reason ? ('\n原因：' + evt.reason) : ''), true);
          } else if (evt.type === 'promoted_from_discuss') {
            appendAutonomyChatSystem('已从群聊自动转入自治接力。', false);
          } else if (evt.type === 'continued_from_discuss') {
            appendAutonomyChatSystem('群聊分析完成，自治接力继续推进。', false);
          }
        }

        for (var j = state.stepCount; j < steps.length; j += 1) {
          var step = steps[j] || {};
          var stepAgentName = autonomyAgentName(step.agentId || '');
          if (step.reply && window.appendHexChatMsg) {
            window.appendHexChatMsg(stepAgentName, step.reply, !!step.error, true, 'discuss', step.agentId || '');
          }
          if (step.directive && Array.isArray(step.directive.artifacts) && step.directive.artifacts.length) {
            appendAutonomyChatSystem((stepAgentName || '当前员工') + ' 已产出文件：\n- ' + step.directive.artifacts.join('\n- '), false);
          }
          if (step.directive && step.directive.handoffTo) {
            appendAutonomyChatSystem('下一棒已交给 ' + autonomyAgentName(step.directive.handoffTo) + (step.directive.handoffMessage ? ('\n交接说明：' + step.directive.handoffMessage) : ''), false);
          }
        }

        if (run.status && run.status !== 'running' && run.status !== state.lastStatus) {
          appendAutonomyChatSystem('运行 ' + run.id + ' 当前状态：' + formatAutonomyChatStatus(run.status), run.status === 'failed' || run.status === 'terminated');
        }

        state.eventCount = events.length;
        state.stepCount = steps.length;
        state.lastStatus = run.status || '';
        autonomyChatState[run.id] = state;
      });
    }

    function renderAutonomyRuns(runs) {
      if (!autonomyRunsList) return;
      if (!runs || !runs.length) {
        autonomyRunsList.innerHTML = '<div style="color:var(--text-dim);font-size:0.76rem;">当前项目还没有自治接力运行记录。</div>';
        return;
      }
      function formatAutonomyStateLabel(state) {
        var map = {
          running: '运行中',
          completed: '已完成',
          needs_yin: '待主控仲裁',
          waiting_user: '等待用户',
          terminated: '已终止',
          failed: '失败',
          done: '已完成'
        };
        return map[state] || (state || 'unknown');
      }
      function formatAutonomyProgressStage(stage) {
        var map = {
          queued: '已入队',
          attempt: '开始执行',
          connecting: '连接网关',
          challenge: '握手挑战',
          connected: '握手完成',
          history_snapshot: '读取会话',
          agent_dispatched: '已派发',
          waiting: '执行中',
          stream: '实时输出',
          history_reply: '获取回复',
          preview_fallback: '回复兜底',
          preview_reply: '预览回复',
          wait_error: '执行报错',
          retry_unsigned: '兼容重试',
          retry_wait: '等待重试',
          completed: '执行结束',
          done: '已完成',
          failed: '失败'
        };
        return map[stage] || (stage || '运行中');
      }
      function formatAutonomyEvent(evt) {
        var agent = evt && evt.agentId ? autonomyAgentName(evt.agentId) : '';
        switch (evt.type) {
          case 'run_started':
            return { title: '任务启动', desc: (agent ? ('首位员工：' + agent + '\n') : '') + (evt.message || ''), expand: evt.message || '' };
          case 'dispatch_requested':
            return { title: '派发下一棒', desc: (agent ? ('执行员工：' + agent + '\n') : '') + (evt.message || ''), expand: evt.message || '' };
          case 'step_completed':
            return { title: '员工完成一棒', desc: (agent ? ('员工：' + agent + '\n') : '') + '状态：' + formatAutonomyStateLabel(evt.status || 'done') + (evt.handoffTo ? ('\n下一棒：' + autonomyAgentName(evt.handoffTo)) : '') };
          case 'step_progress':
            return { title: '执行中', desc: (agent ? ('员工：' + agent + '\n') : '') + formatAutonomyProgressStage(evt.stage) + (evt.message ? ('\n' + evt.message) : ''), expand: evt.message || '' };
          case 'step_failed':
            return { title: '员工执行失败', desc: (agent ? ('员工：' + agent + '\n') : '') + (evt.error || '未知错误'), expand: evt.error || '' };
          case 'promoted_from_discuss':
            return { title: '从群聊自动创建', desc: (agent ? ('触发员工：' + agent + '\n') : '') + (evt.message || ''), expand: evt.message || '' };
          case 'continued_from_discuss':
            return { title: '从群聊继续接力', desc: (agent ? ('触发员工：' + agent + '\n') : '') + (evt.message || ''), expand: evt.message || '' };
          case 'discuss_autonomy_ambiguous':
            return { title: '群聊自治意图冲突', desc: evt.message || '存在多个候选，未自动续派', expand: evt.candidates ? JSON.stringify(evt.candidates, null, 2) : '' };
          case 'yin_review_requested':
            return { title: '请求主控仲裁', desc: '当前接力已升级给主控处理' };
          case 'yin_review_completed':
            return { title: '主控完成仲裁', desc: '主控已给出处理意见' };
          case 'yin_review_continued':
            return { title: '主控指定继续派工', desc: agent ? ('指定员工：' + agent) : '主控已指定下一棒员工' };
          case 'yin_review_waiting_user':
            return { title: '等待用户澄清', desc: evt.reason || '主控要求用户补充信息后再继续' };
          case 'yin_review_terminated':
            return { title: '主控终止任务', desc: evt.reason || '主控判定任务结束或停止推进' };
          case 'yin_review_invalid_agent':
            return { title: '主控指定无效员工', desc: evt.raw || '主控未指定有效员工' };
          case 'yin_review_failed':
            return { title: '主控仲裁失败', desc: evt.error || '未知错误' };
          case 'yin_review_timeout':
            return { title: '主控仲裁超时', desc: '等待主控结果超时' };
          default:
            return { title: evt.type || '事件', desc: evt.message || evt.error || '' };
        }
      }

      autonomyRunsList.innerHTML = runs.map(function(run) {
        var steps = Array.isArray(run.steps) ? run.steps : [];
        var lastStep = steps.length ? steps[steps.length - 1] : null;
        var artifacts = Array.isArray(run.artifacts) ? run.artifacts : [];
        var yinReview = run.yinReview || null;
        var live = run.live || null;
        var events = Array.isArray(run.events) ? run.events.slice().sort(function(a, b) { return Number(a.at || 0) - Number(b.at || 0); }) : [];
        var summary = [];
        summary.push('发起员工：' + window.escapeHtml(autonomyAgentName(run.initialAgentId || '')));
        if (run.currentAgentId) summary.push('当前员工：' + window.escapeHtml(autonomyAgentName(run.currentAgentId)));
        summary.push('步数：' + steps.length);
        if (artifacts.length) summary.push('产出：' + artifacts.length + ' 个');
        if (run.lastError) summary.push('异常：' + window.escapeHtml(run.lastError));
        if (yinReview && yinReview.status) summary.push('主控仲裁：' + window.escapeHtml(formatAutonomyStateLabel(yinReview.status)));

        var detail = '';
        if (lastStep) {
          var directive = lastStep.directive || {};
          detail = [
            '最后一步员工: ' + autonomyAgentName(lastStep.agentId || ''),
            '状态: ' + formatAutonomyStateLabel(directive.status || 'unstructured'),
            directive.handoffTo ? ('下一棒: ' + autonomyAgentName(directive.handoffTo)) : '',
            directive.handoffMessage ? ('说明: ' + directive.handoffMessage) : '',
            artifacts.length ? ('产出:\n- ' + artifacts.join('\n- ')) : '',
            lastStep.reply ? ('回复摘录:\n' + String(lastStep.reply).slice(0, 600)) : '',
            yinReview && yinReview.reply ? ('主控仲裁:\n' + String(yinReview.reply).slice(0, 600)) : '',
            yinReview && yinReview.error ? ('主控仲裁错误: ' + yinReview.error) : ''
          ].filter(Boolean).join('\n');
        }

        var liveHtml = '';
        if (live && run.status === 'running') {
          liveHtml = '<div class="autonomy-run-live">当前进度：' + window.escapeHtml(formatAutonomyProgressStage(live.stage)) + (live.agentId ? ('\n员工：' + autonomyAgentName(live.agentId)) : '') + (live.message ? ('\n' + live.message) : '') + '</div>';
        }

        var stepCursor = 0;
        var timelineHtml = events.length ? (
          '<div class="autonomy-run-timeline">' + events.map(function(evt) {
            var view = formatAutonomyEvent(evt);
            var expand = view.expand || '';
            var actionHtml = '';
            if ((evt.type === 'step_completed' || evt.type === 'step_failed') && steps[stepCursor]) {
              var step = steps[stepCursor];
              var directive = step.directive || {};
              expand = [
                '员工：' + autonomyAgentName(step.agentId || ''),
                '状态：' + formatAutonomyStateLabel(directive.status || (evt.type === 'step_failed' ? 'failed' : 'done')),
                directive.handoffTo ? ('下一棒：' + autonomyAgentName(directive.handoffTo)) : '',
                directive.handoffMessage ? ('交接说明：' + directive.handoffMessage) : '',
                step.error ? ('错误：' + step.error) : '',
                step.reply ? ('完整回复：\n' + String(step.reply)) : ''
              ].filter(Boolean).join('\n');
              actionHtml = '<div class="autonomy-run-timeline-actions">'
                + '<button type="button" class="autonomy-run-timeline-btn" data-autonomy-action="retry" data-run-id="' + window.escapeHtml(run.id) + '" data-step-index="' + stepCursor + '">重试该步</button>'
                + '<select class="autonomy-run-timeline-select" data-autonomy-reassign-select data-run-id="' + window.escapeHtml(run.id) + '" data-step-index="' + stepCursor + '">' + buildAutonomyAgentOptions(step.agentId || '') + '</select>'
                + '<button type="button" class="autonomy-run-timeline-btn" data-autonomy-action="reassign" data-run-id="' + window.escapeHtml(run.id) + '" data-step-index="' + stepCursor + '">确认改派</button>'
                + '</div>';
              stepCursor += 1;
            } else if (evt.type === 'yin_review_completed' && yinReview && yinReview.reply) {
              expand = [
                '主控仲裁全文：',
                String(yinReview.reply),
                yinReview.decision ? ('\n解析结果：\n' + JSON.stringify(yinReview.decision, null, 2)) : ''
              ].filter(Boolean).join('\n');
            }
            return '<div class="autonomy-run-timeline-item">'
              + '<details' + (expand ? '' : ' open') + '>'
              + '<summary>'
              + '<div class="autonomy-run-timeline-time">' + window.escapeHtml(new Date(evt.at || Date.now()).toLocaleString()) + '</div>'
              + '<div class="autonomy-run-timeline-body">'
              + '<div class="autonomy-run-timeline-title">' + window.escapeHtml(view.title) + '</div>'
              + (view.desc ? ('<div class="autonomy-run-timeline-desc">' + window.escapeHtml(view.desc) + '</div>') : '')
              + '</div>'
              + '</summary>'
              + (expand ? ('<div class="autonomy-run-timeline-expand">' + window.escapeHtml(expand) + actionHtml + '</div>') : '')
              + '</details>'
              + '</div>';
          }).join('') + '</div>'
        ) : '';

        return '<div class="autonomy-run-item">'
          + '<div class="autonomy-run-meta">'
          + '<span class="autonomy-run-badge state-' + window.escapeHtml(run.status || 'running') + '">' + window.escapeHtml(formatAutonomyStateLabel(run.status || 'running')) + '</span>'
          + (yinReview && yinReview.status ? ('<span class="autonomy-run-badge state-' + window.escapeHtml(yinReview.status) + '">主控:' + window.escapeHtml(formatAutonomyStateLabel(yinReview.status)) + '</span>') : '')
          + '<span>' + window.escapeHtml(run.id) + '</span>'
          + '<span>' + new Date(run.updatedAt || run.createdAt || Date.now()).toLocaleString() + '</span>'
          + '</div>'
          + '<div class="autonomy-run-summary">' + summary.join(' · ') + '</div>'
          + liveHtml
          + (detail ? ('<pre>' + window.escapeHtml(detail) + '</pre>') : '')
          + timelineHtml
          + '</div>';
      }).join('');
    }

    if (autonomyRunsList) {
      autonomyRunsList.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-autonomy-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-autonomy-action');
        var runId = btn.getAttribute('data-run-id');
        var stepIndex = parseInt(btn.getAttribute('data-step-index'), 10);
        if (!runId || !Number.isInteger(stepIndex)) return;
        if (action === 'retry') {
          btn.disabled = true;
          setAutonomyStatus('正在重试该步…');
          fetch('/api/autonomy/task-runs/' + encodeURIComponent(runId) + '/retry-step', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stepIndex: stepIndex })
          })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              if (!data || !data.ok) throw new Error(data && data.error ? data.error : '重试失败');
              setAutonomyStatus('已重试该步');
              if (window.appendHexChatMsg) {
                window.appendHexChatMsg(window.t('systemLabel'), '∞ 已重试自治接力步骤：' + runId + ' / 第 ' + (stepIndex + 1) + ' 步', false, true, 'discuss');
              }
              loadAutonomyRuns(true);
            })
            .catch(function(err) {
              setAutonomyStatus('重试失败：' + (err && err.message ? err.message : '网络错误'));
            })
            .finally(function() {
              btn.disabled = false;
            });
          return;
        }
        if (action === 'reassign') {
          var container = btn.closest('.autonomy-run-timeline-actions');
          var select = container && container.querySelector('[data-autonomy-reassign-select]');
          var agentInput = select ? String(select.value || '').trim() : '';
          if (!agentInput) {
            setAutonomyStatus('请先选择要改派的员工');
            return;
          }
          btn.disabled = true;
          setAutonomyStatus('正在改派该步…');
          fetch('/api/autonomy/task-runs/' + encodeURIComponent(runId) + '/reassign-step', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stepIndex: stepIndex, agentId: agentInput.trim() })
          })
            .then(function(r) { return r.json(); })
            .then(function(data) {
              if (!data || !data.ok) throw new Error(data && data.error ? data.error : '改派失败');
              setAutonomyStatus('已改派给 ' + agentInput.trim());
              if (window.appendHexChatMsg) {
                window.appendHexChatMsg(window.t('systemLabel'), '∞ 已改派自治接力步骤：' + runId + ' / 第 ' + (stepIndex + 1) + ' 步 -> ' + autonomyAgentName(agentInput.trim()), false, true, 'discuss');
              }
              loadAutonomyRuns(true);
            })
            .catch(function(err) {
              setAutonomyStatus('改派失败：' + (err && err.message ? err.message : '网络错误'));
            })
            .finally(function() {
              btn.disabled = false;
            });
        }
      });
    }

    function loadAutonomyRuns(silent) {
      if (!window.projectId) return Promise.resolve();
      if (!silent) setAutonomyStatus('正在加载自治接力状态…');
      return fetch('/api/autonomy/task-runs?projectId=' + encodeURIComponent(window.projectId) + '&limit=10')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var runs = data && data.runs ? data.runs : [];
          syncAutonomyRunsToChat(runs);
          if (autonomyPanel && autonomyPanel.classList.contains('show')) renderAutonomyRuns(runs);
          if (!silent) setAutonomyStatus('');
          return runs;
        })
        .catch(function(err) {
          if (autonomyPanel && autonomyPanel.classList.contains('show')) renderAutonomyRuns([]);
          if (!silent) setAutonomyStatus('加载失败：' + (err && err.message ? err.message : '网络错误'));
        });
    }

    function startAutonomyPolling() {
      loadAutonomySkillsLibrary();
      if (autonomyPollTimer) clearInterval(autonomyPollTimer);
      autonomyPollTimer = setInterval(function() {
        loadAutonomyRuns(true);
      }, 1500);
    }

    function openAutonomyPanel() {
      if (!autonomyPanel) return;
      autonomyPanel.classList.add('show');
      autonomyPanel.setAttribute('aria-hidden', 'false');
      fillAutonomyAgentSelect();
      loadAutonomySkillsLibrary();
      loadAutonomyRuns();
      startAutonomyPolling();
      if (autonomyTaskInput) autonomyTaskInput.focus();
    }

    function closeAutonomyPanel() {
      if (autonomyPanel) {
        autonomyPanel.classList.remove('show');
        autonomyPanel.setAttribute('aria-hidden', 'true');
      }
    }

    if (btnAutonomyPanel) {
      btnAutonomyPanel.addEventListener('click', function() {
        if (autonomyPanel && autonomyPanel.classList.contains('show')) closeAutonomyPanel();
        else openAutonomyPanel();
      });
    }
    if (btnAutonomyRefresh) btnAutonomyRefresh.addEventListener('click', function() { loadAutonomyRuns(); });
    if (btnAutonomyClear) {
      btnAutonomyClear.addEventListener('click', function() {
        if (!window.projectId) return;
        btnAutonomyClear.disabled = true;
        setAutonomyStatus('正在清除当前项目自治记录…');
        fetch('/api/autonomy/task-runs?projectId=' + encodeURIComponent(window.projectId), {
          method: 'DELETE'
        })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (!data || !data.ok) throw new Error(data && data.error ? data.error : '清除失败');
            setAutonomyStatus('已清除 ' + Number(data.removed || 0) + ' 条自治记录');
            renderAutonomyRuns([]);
            if (window.appendHexChatMsg) {
              window.appendHexChatMsg(window.t('systemLabel'), '∞ 已清除当前项目自治接力记录：' + Number(data.removed || 0) + ' 条', false, true, 'discuss');
            }
          })
          .catch(function(err) {
            setAutonomyStatus('清除失败：' + (err && err.message ? err.message : '网络错误'));
          })
          .finally(function() {
            btnAutonomyClear.disabled = false;
          });
      });
    }
    if (btnAutonomyClose) btnAutonomyClose.addEventListener('click', closeAutonomyPanel);
    if (autonomyPanel) {
      autonomyPanel.addEventListener('click', function(e) {
        if (e.target === autonomyPanel) closeAutonomyPanel();
      });
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && autonomyPanel && autonomyPanel.classList.contains('show')) closeAutonomyPanel();
    });
    if (autonomyStartBtn) {
      autonomyStartBtn.addEventListener('click', function() {
        var agentId = autonomyAgentSelect ? autonomyAgentSelect.value : '';
        var message = autonomyTaskInput ? autonomyTaskInput.value.trim() : '';
        if (!agentId) { setAutonomyStatus('请先选择首位接力员工'); return; }
        if (!message) { setAutonomyStatus('请输入任务目标'); return; }
        autonomyStartBtn.disabled = true;
        setAutonomyStatus('正在启动自治接力…');
        fetch('/api/autonomy/task-runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: window.projectId, hexId: agentId, message: message, sessionKey: 'main' })
        })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (!data || !data.runId) throw new Error(data && data.error ? data.error : '未返回 runId');
            window.appendHexChatMsg(window.t('systemLabel'), '∞ 已启动自治接力：' + autonomyAgentName(agentId) + ' 开始执行。运行ID：' + data.runId, false, true, 'discuss');
            if (autonomyTaskInput) autonomyTaskInput.value = '';
            setAutonomyStatus('自治接力已启动：' + data.runId);
            loadAutonomyRuns(true);
            closeAutonomyPanel();
          })
          .catch(function(err) {
            setAutonomyStatus('启动失败：' + (err && err.message ? err.message : '网络错误'));
          })
          .finally(function() {
            autonomyStartBtn.disabled = false;
          });
      });
    }

    window.openAutonomyPanel = openAutonomyPanel;
    window.closeAutonomyPanel = closeAutonomyPanel;
    window.loadAutonomyRuns = loadAutonomyRuns;
    window.startAutonomyPolling = startAutonomyPolling;
    window.setAutonomyStatus = setAutonomyStatus;
    window.autonomyAgentName = autonomyAgentName;

    startAutonomyPolling();
  }

  window.initProjectAutonomy = initProjectAutonomy;
})();
