(function() {
  function fetchTenantRuntimeOverview() {
    return fetch('/api/tenant-runtime/overview')
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
      .then(function(result) {
        if (!result.ok || (result.data && result.data.error)) throw new Error((result.data && result.data.error) || 'runtime overview failed');
        return result.data || {};
      });
  }

  function fetchTenantRuntimeAgents() {
    return fetch('/api/tenant-runtime/runtime/agents')
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
      .then(function(result) {
        if (!result.ok || (result.data && result.data.error)) throw new Error((result.data && result.data.error) || 'runtime agents failed');
        return Array.isArray(result.data && result.data.items) ? result.data.items : [];
      });
  }

  function fetchRuntimeAlertsForCurrentTenant() {
    if (!window.__openswarmSession || !window.__openswarmSession.tenant || !window.__openswarmSession.tenant.id) {
      return Promise.resolve(null);
    }
    return fetch('/api/runtime-admin/alerts?tenantId=' + encodeURIComponent(window.__openswarmSession.tenant.id))
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
      .then(function(result) {
        if (!result.ok || (result.data && result.data.error)) return null;
        return result.data || null;
      })
      .catch(function() { return null; });
  }

  function updateTenantRuntimeState(overview, agents, alerts) {
    window.tenantRuntime = overview || null;
    window.tenantRuntimeAgents = Array.isArray(agents) ? agents : [];
    window.tenantRuntimeAlerts = alerts || null;
  }

  function updateYinyangState(robots) {
    var byId = {};
    (robots || []).forEach(function(robot) { byId[robot.id] = robot; });
    document.querySelectorAll('.taiji-dot').forEach(function(button) {
      var robotId = button.dataset.robot;
      if (robotId === 'yang') {
        button.title = window.t('yangDisplayOnly');
        button.classList.remove('running', 'starting');
        return;
      }
      var robot = byId[robotId];
      var isRunning = !!robot && !!robot.running;
      button.classList.toggle('running', isRunning);
      if (isRunning) {
        button.classList.remove('starting');
        button.title = robotId === 'main' ? window.t('yinClickMainStop') : window.t('yangClickStop');
      } else {
        button.title = robotId === 'main' ? window.t('yinClickMainStart') : window.t('yangClickStart');
      }
    });
  }

  function bindYinyangButtons() {
    document.querySelectorAll('.taiji-dot').forEach(function(button) {
      var robotId = button.dataset.robot;
      var nextButton = button.cloneNode(true);
      button.parentNode.replaceChild(nextButton, button);
      nextButton.addEventListener('click', async function() {
        if (robotId === 'yang') {
          location.href = 'yang.html' + (typeof window.projectId === 'string' && window.projectId ? '?id=' + encodeURIComponent(window.projectId) : '');
          return;
        }
        var robots = await fetch('/api/robots').then(function(r) { return r.json(); }).catch(function() { return []; });
        var robot = robots.find(function(item) { return item.id === robotId; });
        var isRunning = !!(robot && robot.running);
        if (isRunning) {
          nextButton.disabled = true;
          try {
            var stopResp = await fetch('/api/stop/' + robotId, { method: 'POST' });
            var stopData = await stopResp.json().catch(function() { return {}; });
            if (stopResp.ok && !stopData.error) {
              window.show(window.t('toastStopped'));
              var next = await fetch('/api/robots').then(function(r) { return r.json(); }).catch(function() { return []; });
              updateYinyangState(next);
            } else {
              window.show(stopData.error || window.t('toastStopFailed'));
            }
          } catch (e) {
            var msg = e && e.message ? String(e.message) : '';
            if (/Failed to fetch/i.test(msg)) {
              window.show('请求失败：无法连接面板服务。请确认 panel 已启动（http://localhost:3999），并且当前页面不是 file:// 打开的。');
            } else {
              window.show(window.t('toastRequestFailedShort') + ': ' + msg);
            }
          }
          nextButton.disabled = false;
        } else {
          nextButton.classList.add('starting');
          try {
            var startResp = await fetch('/api/open-tui/' + robotId, { method: 'POST' });
            var startData = await startResp.json().catch(function() { return {}; });
            if (startResp.ok && !startData.error) {
              window.show(startData.reused ? window.t('toastTerminalReused') : window.t('toastTerminalOpened'));
            } else {
              window.show(startData.error || window.t('toastStartFailed') + ' (HTTP ' + startResp.status + ')');
              nextButton.classList.remove('starting');
            }
          } catch (e) {
            var msg = e && e.message ? String(e.message) : '';
            if (/Failed to fetch/i.test(msg)) {
              window.show('请求失败：无法连接面板服务。请确认 panel 已启动（http://localhost:3999），并且当前页面不是 file:// 打开的。');
            } else {
              window.show(window.t('toastRequestFailedShort') + ': ' + msg);
            }
            nextButton.classList.remove('starting');
          }
        }
      });
    });
  }

  function startProjectRobotPolling() {
    if (window._projectRobotRefresh) return;
    var prevRunningState = {};

    function scheduleProjectPoll() {
      var hasStarting = !!document.querySelector('.btn-hex-action[disabled]');
      var interval = hasStarting ? 1000 : 5000;
      setTimeout(function() {
        if (!window.projectId || !window.project) {
          scheduleProjectPoll();
          return;
        }
        fetch('/api/robots').then(function(r) { return r.json(); }).then(function(list) {
          var changed = false;
          (list || []).forEach(function(robot) {
            if (prevRunningState[robot.id] !== undefined && prevRunningState[robot.id] !== robot.running) changed = true;
            prevRunningState[robot.id] = robot.running;
          });

          function updateFn(source, runtimeOverview, runtimeAgents, runtimeAlerts) {
            window.robots = source || [];
            window.hexList = window.robots.filter(function(robot) { return robot.id !== 'main' && robot.id !== 'yang'; });
            updateTenantRuntimeState(runtimeOverview, runtimeAgents, runtimeAlerts);
            window.renderRing();
            window.renderHexSwitches();
            updateYinyangState(window.robots);
            scheduleProjectPoll();
          }

          if (changed) {
            Promise.all([
              fetch('/api/robots?nocache=1').then(function(r) { return r.json(); }),
              fetchTenantRuntimeOverview().catch(function() { return null; }),
              fetchTenantRuntimeAgents().catch(function() { return []; }),
              fetchRuntimeAlertsForCurrentTenant().catch(function() { return null; }),
            ]).then(function(values) {
              updateFn(values[0], values[1], values[2], values[3]);
            }).catch(function() { scheduleProjectPoll(); });
          } else {
            Promise.all([
              Promise.resolve(list),
              fetchTenantRuntimeOverview().catch(function() { return null; }),
              fetchTenantRuntimeAgents().catch(function() { return []; }),
              fetchRuntimeAlertsForCurrentTenant().catch(function() { return null; }),
            ]).then(function(values) {
              updateFn(values[0], values[1], values[2], values[3]);
            }).catch(function() { updateFn(list, null, []); });
          }
        }).catch(function() {
          scheduleProjectPoll();
        });
      }, interval);
    }

    window._projectRobotRefresh = true;
    scheduleProjectPoll();
  }

  function loadProjectPage() {
    if (window.location.protocol === 'file:') {
      var redirectUrl = 'http://localhost:3999/project.html' + window.location.search + window.location.hash;
      alert('请通过 http://localhost:3999 打开项目页面，不要直接双击 HTML 文件。即将自动跳转。');
      window.location.href = redirectUrl;
      return;
    }
    if (!window.projectId) {
      window.nameEl.textContent = '未指定项目';
      if (window.flowTeamNameEl) window.flowTeamNameEl.textContent = '未指定项目';
      window.show(window.t('pleaseEnterFromProjects'));
      return;
    }
    Promise.all([
      fetch('/api/projects/' + encodeURIComponent(window.projectId)).then(function(r) {
        if (!r.ok) throw new Error(r.status === 404 ? '项目不存在' : '加载失败');
        return r.json();
      }),
      fetch('/api/robots').then(function(r) { return r.json(); }),
      fetchTenantRuntimeOverview().catch(function() { return null; }),
      fetchTenantRuntimeAgents().catch(function() { return []; }),
      fetchRuntimeAlertsForCurrentTenant().catch(function() { return null; })
    ]).then(function(results) {
      window.project = results[0];
      window.robots = results[1] || [];
      updateTenantRuntimeState(results[2], results[3], results[4]);
      window.hexList = window.robots.filter(function(robot) { return robot.id !== 'main' && robot.id !== 'yang'; });
      var displayName = (window.project.id === 'hex-definition') ? window.t('hexDefinitionName') : window.project.name;
      document.title = displayName + ' · ' + (document.body.getAttribute('data-i18n-title') ? (window.OPENSWARM_I18N ? window.OPENSWARM_I18N.t('projectTitle') : '项目') : '项目');
      window.nameEl.textContent = displayName;
      if (window.flowTeamNameEl) window.flowTeamNameEl.textContent = '当前团队：' + displayName;
      window.breadcrumbSep.style.display = 'inline';
      window.breadcrumbProject.textContent = displayName;
      window.renderRing();
      window.renderHexSwitches();
      window.sectionYinDashboard.style.display = 'block';
      if (window.project.id !== 'hex-definition') {
        var linkYang = document.getElementById('yinLinkYang');
        if (linkYang) linkYang.href = 'yang.html?id=' + encodeURIComponent(window.projectId);
        window.loadYinDashboard();
      }
      var hasHex = window.project.hexIds && window.project.hexIds.length > 0;
      if (window.hexChatEmpty) window.hexChatEmpty.style.display = hasHex ? 'none' : 'block';
      if (window.hexChatModeRow) window.hexChatModeRow.style.display = hasHex ? 'flex' : 'none';
      if (window.hexChatRow) window.hexChatRow.style.display = hasHex ? 'flex' : 'none';
      var toolbar = document.getElementById('hexChatToolbar');
      if (toolbar) toolbar.style.display = hasHex ? 'flex' : 'none';
      window.setHexChatFormEnabled(hasHex);
      window.updateHexChatModeUI();
      window.updateHexChatRoundsUI();
      window.updateHexChatState();
      window.loadHexChatHistory();
      window.loadYinChatHistory();
      if (/[?&]openSelect=1/.test(window.location.search)) {
        window.openSelectHexModal();
        history.replaceState(null, '', window.location.pathname + '?id=' + encodeURIComponent(window.projectId));
      }
      startProjectRobotPolling();
      bindYinyangButtons();
    }).catch(function(e) {
      window.nameEl.textContent = '加载失败';
      if (window.flowTeamNameEl) window.flowTeamNameEl.textContent = '加载失败';
      var msg = e && e.message ? String(e.message) : '';
      if (/Failed to fetch/i.test(msg)) {
        window.show('请求失败：无法连接面板服务。请确认 panel 已启动（http://localhost:3999），并且当前页面不是 file:// 打开的。');
      } else {
        window.show(msg || '请求失败');
      }
    });
  }

  window.addEventListener('openswarm-auth-session', function() {
    Promise.all([
      fetchTenantRuntimeOverview().catch(function() { return null; }),
      fetchTenantRuntimeAgents().catch(function() { return []; }),
      fetchRuntimeAlertsForCurrentTenant().catch(function() { return null; })
    ]).then(function(results) {
      updateTenantRuntimeState(results[0], results[1], results[2]);
      if (typeof window.renderHexSwitches === 'function') window.renderHexSwitches();
      if (typeof window.renderRing === 'function') window.renderRing();
    }).catch(function() {});
  });

  function applyI18nExtras() {
    fetch('/api/robots').then(function(r) { return r.json(); }).then(updateYinyangState).catch(function() {});
    if (typeof window.renderHexSwitches === 'function' && window.hexSwitchesEl) window.renderHexSwitches();
    if (typeof window.renderRing === 'function' && window.ringEl) window.renderRing();
    if (typeof window.renderSelectHexGrid === 'function' && window.selectHexGrid) window.renderSelectHexGrid();
    if (typeof window.updateHexChatStateLabel === 'function') window.updateHexChatStateLabel();
    if (window.nameEl && window.project) {
      var displayName = (window.project.id === 'hex-definition') ? window.t('hexDefinitionName') : (window.project.name || window.t('loading'));
      window.nameEl.textContent = displayName;
      if (window.flowTeamNameEl) window.flowTeamNameEl.textContent = '当前团队：' + displayName;
    }
    document.querySelectorAll('.yin-chat-msg').forEach(function(msg) {
      var who = msg.querySelector('.who');
      if (who) who.textContent = msg.classList.contains('user') ? window.t('me') : window.t('yinLabel');
    });
  }

  window.updateYinyangState = updateYinyangState;
  window.bindYinyangButtons = bindYinyangButtons;
  window.loadProjectPage = loadProjectPage;
  window.OPENSWARM_APPLY_I18N_EXTRAS = applyI18nExtras;
})();
