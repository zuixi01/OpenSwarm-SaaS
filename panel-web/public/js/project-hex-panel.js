(function() {
  function initProjectHexPanel() {
    var batchStateTimer = null;
    var batchStateFadeTimer = null;

    function runtimeAgentMap() {
      var map = {};
      (window.tenantRuntimeAgents || []).forEach(function(item) {
        if (item && item.agentId) map[item.agentId] = item;
      });
      return map;
    }

    function clearBatchStateTimers() {
      if (batchStateTimer) {
        clearInterval(batchStateTimer);
        batchStateTimer = null;
      }
      if (batchStateFadeTimer) {
        clearTimeout(batchStateFadeTimer);
        batchStateFadeTimer = null;
      }
    }

    function hideBatchState(immediate) {
      if (!window.hexRuntimeBatchState) return;
      clearBatchStateTimers();
      if (immediate) {
        window.hexRuntimeBatchState.classList.add('hidden');
        window.hexRuntimeBatchState.classList.remove('success', 'error', 'fading');
        return;
      }
      window.hexRuntimeBatchState.classList.add('fading');
      batchStateFadeTimer = setTimeout(function() {
        if (!window.hexRuntimeBatchState) return;
        window.hexRuntimeBatchState.classList.add('hidden');
        window.hexRuntimeBatchState.classList.remove('success', 'error', 'fading');
      }, 320);
    }

    function setBatchState(options) {
      if (!window.hexRuntimeBatchState) return;
      clearBatchStateTimers();
      var opts = options || {};
      var state = String(opts.state || 'pending');
      var total = Math.max(1, Number(opts.total || 1));
      var done = Math.max(0, Math.min(total, Number(opts.done || 0)));
      var percent = Math.max(8, Math.min(100, Number(opts.percent || Math.round((done / total) * 100))));
      var startedAt = Number(opts.startedAt || Date.now());
      window.hexRuntimeBatchState.classList.remove('hidden', 'success', 'error', 'fading');
      if (state === 'success') window.hexRuntimeBatchState.classList.add('success');
      if (state === 'error') window.hexRuntimeBatchState.classList.add('error');
      if (window.hexRuntimeBatchStateTitle) {
        window.hexRuntimeBatchStateTitle.textContent = opts.title || '正在处理批量动作…';
      }
      if (window.hexRuntimeBatchStateDesc) {
        window.hexRuntimeBatchStateDesc.textContent = opts.desc || '请求已发送，正在确认员工状态。';
      }
      if (window.hexRuntimeBatchStateBar) {
        window.hexRuntimeBatchStateBar.style.width = percent + '%';
      }
      function updateElapsed() {
        if (!window.hexRuntimeBatchStateElapsed) return;
        var elapsed = Math.max(0, Date.now() - startedAt);
        window.hexRuntimeBatchStateElapsed.textContent = (elapsed / 1000).toFixed(1) + 's';
      }
      updateElapsed();
      if (state === 'pending') {
        batchStateTimer = setInterval(updateElapsed, 120);
      } else {
        batchStateFadeTimer = setTimeout(function() { hideBatchState(false); }, state === 'error' ? 2600 : 1800);
      }
    }

    function isAgentRunning(agentId) {
      var runtimeMap = runtimeAgentMap();
      return !!(runtimeMap[agentId] && runtimeMap[agentId].running);
    }

    function waitForAgentState(agentId, running, timeoutMs) {
      var timeout = Number(timeoutMs || 18000);
      var started = Date.now();
      function poll() {
        return refreshRuntimeSnapshot().then(function() {
          if (isAgentRunning(agentId) === running) return true;
          if (Date.now() - started >= timeout) return false;
          return new Promise(function(resolve) {
            setTimeout(function() { resolve(poll()); }, 700);
          });
        });
      }
      return poll();
    }

    function renderRuntimeSummary() {
      if (!window.hexRuntimeSummary || !window.hexRuntimeSummaryText) return;
      var runtime = window.tenantRuntime && window.tenantRuntime.runtime ? window.tenantRuntime.runtime : null;
      var projectHexIds = (window.project && window.project.hexIds) ? window.project.hexIds : [];
      var runtimeMap = runtimeAgentMap();
      var projectRunning = projectHexIds.filter(function(hexId) {
        return !!(runtimeMap[hexId] && runtimeMap[hexId].running);
      }).length;
      var runtimeStatus = runtime && runtime.status ? String(runtime.status) : 'stopped';
      var degradedAgents = runtime && Number.isFinite(Number(runtime.degradedAgents)) ? Number(runtime.degradedAgents) : 0;
      window.hexRuntimeSummary.classList.remove('running', 'partial', 'stopped');
      window.hexRuntimeSummary.classList.add(runtimeStatus === 'running' ? 'running' : (runtimeStatus === 'partial' ? 'partial' : 'stopped'));
      var mainPort = runtime && runtime.gatewayPort ? ('main:' + runtime.gatewayPort) : 'main:-';
      window.hexRuntimeSummaryText.textContent = projectHexIds.length
        ? (projectRunning + '/' + projectHexIds.length + ' 在线' + (degradedAgents > 0 ? (' · 异常 ' + degradedAgents) : '') + ' · ' + mainPort)
        : ('未分配员工 · ' + mainPort);
      if (window.hexRuntimeAlertText) {
        var summary = window.tenantRuntimeAlerts && window.tenantRuntimeAlerts.summary ? window.tenantRuntimeAlerts.summary : null;
        if (!summary || !summary.total) {
          window.hexRuntimeAlertText.textContent = '无活跃告警';
          window.hexRuntimeAlertText.style.color = '#8ea5c4';
        } else {
          window.hexRuntimeAlertText.textContent = '告警 ' + summary.total + ' · Critical ' + (summary.critical || 0) + ' · Warn ' + (summary.warn || 0);
          window.hexRuntimeAlertText.style.color = summary.critical > 0 ? '#ff6b7f' : '#ffce56';
        }
      }
    }

    function callTenantRuntime(action, body) {
      if (action === 'restart') {
        return callTenantRuntime('stop', body).then(function() {
          return callTenantRuntime('start', body);
        });
      }
      return fetch('/api/tenant-runtime/runtime/' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      }).then(function(r) {
        return r.json().then(function(d) { return { ok: r.ok, data: d }; });
      });
    }

    function refreshRuntimeSnapshot() {
      return Promise.all([
        fetch('/api/tenant-runtime/overview').then(function(r) {
          return r.json().then(function(d) { return { ok: r.ok, data: d }; });
        }).catch(function() { return { ok: false, data: null }; }),
        fetch('/api/tenant-runtime/runtime/agents').then(function(r) {
          return r.json().then(function(d) { return { ok: r.ok, data: d }; });
        }).catch(function() { return { ok: false, data: null }; }),
        fetch('/api/robots?nocache=1').then(function(r) { return r.json(); }).catch(function() { return window.robots || []; })
      ]).then(function(results) {
        var overviewResult = results[0];
        var agentsResult = results[1];
        window.tenantRuntime = overviewResult.ok && overviewResult.data ? overviewResult.data : null;
        window.tenantRuntimeAgents = agentsResult.ok && agentsResult.data && Array.isArray(agentsResult.data.items) ? agentsResult.data.items : [];
        window.robots = results[2] || [];
        window.hexList = window.robots.filter(function(r) { return r.id !== 'main' && r.id !== 'yang'; });
        renderHexSwitches();
        renderRing();
      });
    }

    function displayChar(name) {
      return name && name.length > 1 ? name.charAt(0) : (name || '');
    }

    var fixedBadgeAvatarPool = (function() {
      var list = [];
      for (var i = 1; i <= 9; i++) list.push('assets/avatar/avatar-' + String(i).padStart(2, '0') + '.svg');
      ['female', 'professor', 'researcher'].forEach(function(kind) {
        for (var j = 1; j <= 3; j++) list.push('assets/avatar/' + kind + '-' + String(j).padStart(2, '0') + '.svg');
      });
      for (var k = 19; k <= 64; k++) list.push('assets/avatar/employee-' + String(k).padStart(2, '0') + '.svg');
      return list;
    })();

    function hashTextToIndex(text, mod) {
      var h = 0;
      var s = String(text || '');
      for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
      return Math.abs(h) % mod;
    }

    function resolveBadgeAvatarIndex(robot, fallbackId) {
      var p = Number(robot && robot.port);
      if (Number.isFinite(p) && p >= 18791 && p <= 18854) return p - 18791;
      var id = String((robot && robot.id) || fallbackId || '');
      var fixedTop = ['qian', 'kun', 'tai', 'pi', 'xun', 'yu', 'sui', 'gu', 'lin', 'guan'];
      var topIdx = fixedTop.indexOf(id);
      if (topIdx >= 0) return topIdx;
      var match = id.match(/^h(\d{2})$/i);
      if (match) {
        var num = parseInt(match[1], 10);
        if (num >= 11 && num <= 64) return num - 1;
      }
      return hashTextToIndex(id, fixedBadgeAvatarPool.length);
    }

    function resolveBadgeAvatarSrc(robot, fallbackId) {
      return fixedBadgeAvatarPool[resolveBadgeAvatarIndex(robot, fallbackId)];
    }

    var outerRingRadiusPct = 48;

    function renderRing() {
      var hexIds = (window.project && window.project.hexIds) ? window.project.hexIds : [];
      var isEmpty = hexIds.length === 0;
      if (window.emptyHint) window.emptyHint.style.display = isEmpty ? 'block' : 'none';
      if (window.taijiActions) window.taijiActions.classList.toggle('empty', isEmpty);
      window.ringEl.innerHTML = '';
      if (hexIds.length === 0) return;
      var n = hexIds.length;
      for (var i = 0; i < n; i++) {
        var hexId = hexIds[i];
        var hex = window.hexList.find(function(h) { return h.id === hexId; });
        var name = window.getAgentDisplayName(hexId, hex ? hex.label : '', hex ? hex.name : '');
        var angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        var x = 50 + outerRingRadiusPct * Math.cos(angle);
        var y = 50 + outerRingRadiusPct * Math.sin(angle);
        var div = document.createElement('div');
        div.className = 'ring-hex';
        div.style.left = x + '%';
        div.style.top = y + '%';
        div.textContent = displayChar(name);
        window.ringEl.appendChild(div);
      }
    }

    function closeSelectHexModal() {
      window.modalSelectHex.classList.remove('show');
      window.modalSelectHex.setAttribute('aria-hidden', 'true');
    }

    function renderSelectHexGrid() {
      var hexIds = (window.project && window.project.hexIds) ? window.project.hexIds : [];
      window.selectHexGrid.innerHTML = '';
      window.hexList.forEach(function(hex) {
        var added = hexIds.indexOf(hex.id) !== -1;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'select-hex-btn' + (added ? ' added' : '');
        var displayName = window.getAgentDisplayName(hex.id, hex.label, hex.name);
        if (displayName && displayName.indexOf(' · ') !== -1) {
          var parts = displayName.split(' · ');
          if (parts.length === 2 && parts[0].trim() === parts[1].trim()) displayName = parts[0].trim();
        }
        var avatarSrc = resolveBadgeAvatarSrc(hex, hex.id);
        btn.innerHTML =
          '<span class="select-hex-btn-avatar"><img src="' + window.escapeHtml(avatarSrc) + '" alt="" /></span>'
          + '<span class="select-hex-btn-name">' + window.escapeHtml(displayName) + '</span>';
        btn.dataset.hexId = hex.id;
        btn.title = displayName;
        btn.addEventListener('click', function() { toggleHexInProject(hex.id); });
        window.selectHexGrid.appendChild(btn);
      });
    }

    function openSelectHexModal() {
      renderSelectHexGrid();
      window.modalSelectHex.classList.add('show');
      window.modalSelectHex.setAttribute('aria-hidden', 'false');
    }

    function updateProjectHexIds(hexIds) {
      fetch('/api/projects/' + encodeURIComponent(window.projectId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hexIds: hexIds })
      })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
        .then(function(result) {
          if (!result.ok) {
            window.show(result.data.error || window.t('toastUpdateFailed'));
            return;
          }
          window.project = result.data;
          renderRing();
          renderHexSwitches();
          var hasHex = window.project.hexIds && window.project.hexIds.length > 0;
          if (window.hexChatEmpty) window.hexChatEmpty.style.display = hasHex ? 'none' : 'block';
          if (window.hexChatModeRow) window.hexChatModeRow.style.display = hasHex ? 'flex' : 'none';
          if (window.hexChatRow) window.hexChatRow.style.display = hasHex ? 'flex' : 'none';
          var toolbar = document.getElementById('hexChatToolbar');
          if (toolbar) toolbar.style.display = hasHex ? 'flex' : 'none';
          window.setHexChatFormEnabled(hasHex);
          window.updateHexChatState();
          if (window.modalSelectHex.classList.contains('show')) renderSelectHexGrid();
          window.updateHexChatModeUI();
          window.updateHexChatRoundsUI();
          if (window.sectionYinDashboard && window.sectionYinDashboard.style.display !== 'none') window.loadYinDashboard();
          window.show(window.t('toastUpdated'));
        })
        .catch(function() { window.show(window.t('toastRequestFailedShort')); });
    }

    function toggleHexInProject(hexId) {
      if (!window.project) return;
      var hexIds = (window.project.hexIds || []).slice();
      var idx = hexIds.indexOf(hexId);
      if (idx !== -1) hexIds.splice(idx, 1);
      else hexIds.push(hexId);
      updateProjectHexIds(hexIds);
    }

    function renderHexSwitches() {
      if (!window.hexSwitchesEl || !window.sectionHexSwitches) return;
      var hexIds = (window.project && window.project.hexIds) ? window.project.hexIds : [];
      var runtimeMap = runtimeAgentMap();
      if (hexIds.length === 0) {
        window.sectionHexSwitches.style.display = 'none';
        renderRuntimeSummary();
        return;
      }
      window.sectionHexSwitches.style.display = 'block';
      renderRuntimeSummary();
      window.hexSwitchesEl.innerHTML = '';
      hexIds.forEach(function(hexId) {
        var robot = window.robots.find(function(r) { return r.id === hexId; });
        var runtimeAgent = runtimeMap[hexId] || null;
        var label = (robot && robot.label) ? String(robot.label).trim() : '';
        var name = window.getAgentDisplayName(hexId, label, (robot && robot.name) ? robot.name : '');
        var running = runtimeAgent ? !!runtimeAgent.running : !!(robot && robot.running);
        var healthStatus = runtimeAgent && runtimeAgent.healthStatus ? String(runtimeAgent.healthStatus) : (running ? 'healthy' : 'offline');
        var readinessStatus = runtimeAgent && runtimeAgent.readinessStatus ? String(runtimeAgent.readinessStatus) : (running ? 'warming' : 'offline');
        var healthText = !running
          ? '未启动'
          : (readinessStatus === 'warming' ? '预热中'
            : (healthStatus === 'healthy' ? '运行中'
            : (healthStatus === 'recovering' ? '恢复中'
              : (healthStatus === 'degraded' ? '响应异常' : '网关异常'))));
        var portValue = runtimeAgent && runtimeAgent.port ? runtimeAgent.port : (robot && robot.port);
        var portText = portValue ? ('127.0.0.1:' + String(portValue)) : window.t('badgePortUnknown');
        var roleText = label || name || window.t('badgeRoleFallback');
        var avatarSrc = resolveBadgeAvatarSrc(robot, hexId);
        var item = document.createElement('div');
        item.className = 'hex-switch-item' + (running ? ' running' : '') + (running && healthStatus !== 'healthy' ? ' runtime-alert' : '');
        item.innerHTML =
          '<div class="hex-badge-body">'
            + '<div class="hex-avatar-row">'
            + '<div class="hex-avatar" aria-hidden="true"><img class="hex-avatar-img" src="' + window.escapeHtml(avatarSrc) + '" alt=""></div>'
            + '<span class="hex-role" data-robot="' + window.escapeHtml(hexId) + '" title="' + (window.t('hexLabelEdit') || '点击编辑') + '">' + window.escapeHtml(roleText) + '</span>'
            + '</div>'
            + '<div class="hex-motto">' + window.escapeHtml(window.t('badgeMotto')) + '</div>'
          + '</div>'
          + '<div class="hex-badge-footer">'
            + '<span class="hex-status">' + healthText + '</span>'
            + '<span class="hex-port">' + window.escapeHtml(portText) + '</span>'
            + (running
              ? '<button type="button" class="btn-hex-action ' + (healthStatus !== 'healthy' ? 'restart' : 'stop') + '" data-robot="' + window.escapeHtml(hexId) + '">' + (healthStatus !== 'healthy' ? '重启' : window.t('btnStop')) + '</button>'
              : '<button type="button" class="btn-hex-action start" data-robot="' + window.escapeHtml(hexId) + '">' + window.t('btnStart') + '</button>')
          + '</div>';

        var btn = item.querySelector('.btn-hex-action');
        if (btn) {
          btn.addEventListener('click', function() {
            var rid = btn.dataset.robot;
            if (!rid) return;
            btn.disabled = true;
            var action = btn.classList.contains('restart') ? 'restart' : (btn.classList.contains('stop') ? 'stop' : 'start');
            callTenantRuntime(action, { agentId: rid })
              .then(function(result) {
                if (!result.ok) {
                  throw new Error((result.data && result.data.error) || window.t('toastRequestFailedShort'));
                }
                return refreshRuntimeSnapshot();
              })
              .then(function() {
                window.show(action === 'stop' ? window.t('toastSendStop') : (action === 'restart' ? '已发送重启' : window.t('toastSendStart')));
              })
              .catch(function() { window.show(window.t('toastRequestFailedShort')); })
              .then(function() { btn.disabled = false; });
          });
        }

        var editLabelEl = item.querySelector('.hex-role');
        if (editLabelEl) {
          editLabelEl.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var rid = editLabelEl.dataset.robot;
            var rob = window.robots.find(function(r) { return r.id === rid; });
            var current = (rob && rob.label) ? String(rob.label).trim() : '';
            var wrap = editLabelEl.parentElement;
            var input = document.createElement('input');
            input.type = 'text';
            input.className = 'hex-role-input';
            input.value = current;
            input.setAttribute('maxlength', '32');
            editLabelEl.style.display = 'none';
            wrap.appendChild(input);
            input.focus();
            input.select();
            function commit() {
              var newLabel = (input.value || '').trim();
              input.remove();
              editLabelEl.style.display = '';
              if (newLabel === current) return;
              fetch('/api/agent/' + encodeURIComponent(rid) + '/label', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: newLabel })
              })
                .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
                .then(function(result) {
                  if (!result.ok) {
                    window.show(result.data.error || '保存失败');
                    return null;
                  }
                  window.show(window.t('hexLabelSaved') || '标签已保存');
                  return fetch('/api/robots?nocache=1').then(function(r) { return r.json(); });
                })
                .then(function(list) {
                  if (list) {
                    window.robots = list;
                    renderHexSwitches();
                  }
                })
                .catch(function() { window.show(window.t('toastRequestFailedShort')); });
            }
            input.addEventListener('blur', function() { commit(); });
            input.addEventListener('keydown', function(ev) {
              if (ev.key === 'Enter') {
                ev.preventDefault();
                input.blur();
              }
              if (ev.key === 'Escape') {
                input.value = current;
                input.blur();
              }
            });
          });
        }

        window.hexSwitchesEl.appendChild(item);
      });
    }

    function batchHexAction(action) {
      if (!window.project || !window.project.hexIds || window.project.hexIds.length === 0) return;
      var hexIds = window.project.hexIds.slice();
      var btn = action === 'start' ? document.getElementById('btnStartAllHex') : document.getElementById('btnStopAllHex');
      var otherBtn = action === 'start' ? document.getElementById('btnStopAllHex') : document.getElementById('btnStartAllHex');
      if (btn) btn.disabled = true;
      if (otherBtn) otherBtn.disabled = true;
      var startedAt = Date.now();
      var successCount = 0;
      var failureCount = 0;
      var verb = action === 'start' ? '启动' : '停止';
      setBatchState({
        state: 'pending',
        title: '正在' + verb + '本项目员工…',
        desc: '请求已发送，正在逐个确认员工状态（0/' + hexIds.length + '）。',
        total: hexIds.length,
        done: 0,
        percent: 8,
        startedAt: startedAt
      });
      hexIds.reduce(function(chain, hexId, index) {
        return chain.then(function() {
          var displayName = window.getAgentDisplayName(hexId, '', '');
          setBatchState({
            state: 'pending',
            title: '正在' + verb + '本项目员工…',
            desc: '正在处理 ' + displayName + '（' + (index + 1) + '/' + hexIds.length + '）。',
            total: hexIds.length,
            done: successCount + failureCount,
            percent: Math.max(8, Math.round(((successCount + failureCount) / hexIds.length) * 100)),
            startedAt: startedAt
          });
          return callTenantRuntime(action, { agentId: hexId })
            .then(function(result) {
              if (!result.ok) throw new Error((result.data && result.data.error) || window.t('toastRequestFailedShort'));
              return waitForAgentState(hexId, action === 'start', action === 'start' ? 22000 : 16000);
            })
            .then(function(ready) {
              if (ready) successCount += 1;
              else failureCount += 1;
              setBatchState({
                state: 'pending',
                title: '正在' + verb + '本项目员工…',
                desc: ready
                  ? ('已确认 ' + displayName + '，当前进度 ' + (successCount + failureCount) + '/' + hexIds.length + '。')
                  : (displayName + ' 状态确认超时，继续处理后续员工。'),
                total: hexIds.length,
                done: successCount + failureCount,
                percent: Math.max(8, Math.round(((successCount + failureCount) / hexIds.length) * 100)),
                startedAt: startedAt
              });
            })
            .catch(function() {
              failureCount += 1;
              setBatchState({
                state: 'pending',
                title: '正在' + verb + '本项目员工…',
                desc: displayName + ' 请求失败，继续处理后续员工。',
                total: hexIds.length,
                done: successCount + failureCount,
                percent: Math.max(8, Math.round(((successCount + failureCount) / hexIds.length) * 100)),
                startedAt: startedAt
              });
            });
        });
      }, Promise.resolve())
        .then(function() { return refreshRuntimeSnapshot(); })
        .then(function() {
          var allOk = failureCount === 0;
          setBatchState({
            state: allOk ? 'success' : 'error',
            title: allOk ? ('已完成一键' + verb) : ('一键' + verb + '部分完成'),
            desc: allOk
              ? ('已确认 ' + successCount + '/' + hexIds.length + ' 个员工完成' + verb + '。')
              : ('成功 ' + successCount + ' 个，异常 ' + failureCount + ' 个。'),
            total: hexIds.length,
            done: successCount + failureCount,
            percent: 100,
            startedAt: startedAt
          });
          window.show(action === 'start' ? window.t('toastSendBatchStart') : window.t('toastSendBatchStop'));
        })
        .catch(function() {
          setBatchState({
            state: 'error',
            title: '批量' + verb + '失败',
            desc: '批量请求未完成，请稍后重试。',
            total: hexIds.length,
            done: successCount + failureCount,
            percent: Math.max(10, Math.round(((successCount + failureCount) / hexIds.length) * 100)),
            startedAt: startedAt
          });
          window.show(window.t('toastRequestFailedShort'));
        })
        .then(function() {
          if (btn) btn.disabled = false;
          if (otherBtn) otherBtn.disabled = false;
        });
    }

    if (window.btnOpenSelectHex) window.btnOpenSelectHex.addEventListener('click', openSelectHexModal);
    if (window.modalBtnDone) window.modalBtnDone.addEventListener('click', closeSelectHexModal);
    if (window.modalSelectHex) {
      window.modalSelectHex.addEventListener('click', function(e) {
        if (e.target === window.modalSelectHex) closeSelectHexModal();
      });
    }
    var btnStartAllHex = document.getElementById('btnStartAllHex');
    var btnStopAllHex = document.getElementById('btnStopAllHex');
    if (btnStartAllHex) btnStartAllHex.addEventListener('click', function() { batchHexAction('start'); });
    if (btnStopAllHex) btnStopAllHex.addEventListener('click', function() { batchHexAction('stop'); });

    window.resolveBadgeAvatarSrc = resolveBadgeAvatarSrc;
    window.renderRing = renderRing;
    window.renderSelectHexGrid = renderSelectHexGrid;
    window.openSelectHexModal = openSelectHexModal;
    window.closeSelectHexModal = closeSelectHexModal;
    window.updateProjectHexIds = updateProjectHexIds;
    window.renderHexSwitches = renderHexSwitches;
    window.refreshRuntimeSnapshot = refreshRuntimeSnapshot;
  }

  window.initProjectHexPanel = initProjectHexPanel;
})();
