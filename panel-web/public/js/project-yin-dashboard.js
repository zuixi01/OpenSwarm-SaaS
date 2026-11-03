(function() {
  function initProjectYinDashboard() {
    var skillsLibraryCache = null;
    var skillsDraft = {};

    function cloneSkillMap(map) {
      var result = {};
      Object.keys(map || {}).forEach(function(agentId) {
        if (Array.isArray(map[agentId])) result[agentId] = map[agentId].slice();
      });
      return result;
    }

    function getProjectSkillMap() {
      return cloneSkillMap((window.project && (window.project.hexSkills || window.project.agentSkills)) || {});
    }

    function loadSkillsLibrary() {
      if (skillsLibraryCache) return Promise.resolve(skillsLibraryCache);
      return fetch('/api/skills')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          skillsLibraryCache = (data && data.skills) || [];
          return skillsLibraryCache;
        });
    }

    function syncSkillChipState(container) {
      if (!container) return;
      container.querySelectorAll('.skills-chip').forEach(function(chip) {
        var input = chip.querySelector('input');
        chip.classList.toggle('is-checked', !!(input && input.checked));
      });
    }

    function renderSkillsModal() {
      var grid = document.getElementById('skillsModalGrid');
      var empty = document.getElementById('skillsModalEmpty');
      if (!grid || !empty) return;
      var projectHexIds = (window.project && window.project.hexIds) ? window.project.hexIds.slice() : [];
      if (!projectHexIds.length) {
        grid.innerHTML = '';
        empty.style.display = '';
        empty.textContent = '当前项目还没有员工，请先在右侧添加员工。';
        return;
      }
      if (!skillsLibraryCache || !skillsLibraryCache.length) {
        grid.innerHTML = '';
        empty.style.display = '';
        empty.textContent = '当前没有可用技能。';
        return;
      }
      empty.style.display = 'none';
      grid.innerHTML = projectHexIds.map(function(hexId) {
        var robot = (window.hexList || []).find(function(item) { return item.id === hexId; }) || { id: hexId };
        var displayName = window.getAgentDisplayName(hexId, robot.label, robot.name);
        var selected = Array.isArray(skillsDraft[hexId]) ? skillsDraft[hexId] : [];
        var chips = skillsLibraryCache.map(function(skill) {
          var checked = selected.indexOf(skill.id) !== -1;
          return '<label class="skills-chip' + (checked ? ' is-checked' : '') + '">'
            + '<input type="checkbox" data-hex-id="' + window.escapeHtml(hexId) + '" data-skill-id="' + window.escapeHtml(skill.id) + '"' + (checked ? ' checked' : '') + '>'
            + '<span>' + window.escapeHtml(skill.name || skill.id) + '</span>'
            + '</label>';
        }).join('');
        return '<div class="skills-agent-row">'
          + '<div class="skills-agent-name">' + window.escapeHtml(displayName) + '</div>'
          + '<div class="skills-agent-options">' + chips + '</div>'
          + '</div>';
      }).join('');
      syncSkillChipState(grid);
      grid.querySelectorAll('input[type="checkbox"]').forEach(function(input) {
        input.addEventListener('change', function() {
          var hexId = input.getAttribute('data-hex-id');
          var skillId = input.getAttribute('data-skill-id');
          if (!hexId || !skillId) return;
          var list = Array.isArray(skillsDraft[hexId]) ? skillsDraft[hexId].slice() : [];
          var idx = list.indexOf(skillId);
          if (input.checked && idx === -1) list.push(skillId);
          if (!input.checked && idx !== -1) list.splice(idx, 1);
          skillsDraft[hexId] = list;
          syncSkillChipState(grid);
        });
      });
    }

    function openSkillsModal() {
      var modal = document.getElementById('modalSkills');
      if (!modal || !window.projectId || window.projectId === 'hex-definition') return;
      skillsDraft = getProjectSkillMap();
      loadSkillsLibrary()
        .then(function() {
          renderSkillsModal();
          modal.classList.add('show');
          modal.setAttribute('aria-hidden', 'false');
        })
        .catch(function() { window.show('加载技能库失败'); });
    }

    function closeSkillsModal() {
      var modal = document.getElementById('modalSkills');
      if (!modal) return;
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
    }

    function saveSkillsModal() {
      if (!window.projectId || window.projectId === 'hex-definition') return;
      fetch('/api/projects/' + encodeURIComponent(window.projectId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hexSkills: skillsDraft })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.error) {
          window.show(data.error);
          return;
        }
        window.project = data;
        closeSkillsModal();
        loadYinDashboard();
        window.show('技能配置已保存');
      }).catch(function() { window.show('保存技能配置失败'); });
    }

    function addConfigRow(k, v) {
      var list = document.getElementById('configKvList');
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center;';
      row.innerHTML =
        '<input type="text" class="config-k" placeholder="key" value="' + window.escapeHtml(k) + '" style="flex:0 0 100px;padding:6px;background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:4px;color:var(--text);" />'
        + '<input type="text" class="config-v" placeholder="value" value="' + window.escapeHtml(v) + '" style="flex:1;padding:6px;background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:4px;color:var(--text);" />'
        + '<button type="button" class="yin-btn-add config-del" style="flex:0 0 28px;padding:4px;">×</button>';
      row.querySelector('.config-del').addEventListener('click', function() { row.remove(); });
      list.appendChild(row);
    }

    function openConfigModal() {
      var list = document.getElementById('configKvList');
      list.innerHTML = '';
      var config = window.project.config || {};
      Object.keys(config).forEach(function(key) {
        addConfigRow(key, config[key]);
      });
      if (list.children.length === 0) addConfigRow('', '');
      document.getElementById('modalConfig').classList.add('show');
    }

    function closeConfigModal() {
      document.getElementById('modalConfig').classList.remove('show');
    }

    function saveConfig() {
      var rows = document.querySelectorAll('#configKvList > div');
      var config = {};
      rows.forEach(function(row) {
        var key = (row.querySelector('.config-k') || {}).value.trim();
        if (key) config[key] = (row.querySelector('.config-v') || {}).value || '';
      });
      fetch('/api/projects/' + encodeURIComponent(window.projectId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: config })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.error) {
          window.show(data.error);
          return;
        }
        window.project = data;
        closeConfigModal();
        loadYinDashboard();
        window.show('已保存');
      }).catch(function() { window.show('保存失败'); });
    }

    function nextScheduleId(schedules) {
      var max = 0;
      (schedules || []).forEach(function(schedule) {
        var match = parseInt(String(schedule.id || '').replace(/\D/g, ''), 10);
        if (match > max) max = match;
      });
      return 's' + (max + 1);
    }

    function renderYinSchedules(container, schedules, hexList) {
      if (!container) return;
      var getHexName = function(id) {
        var hex = hexList.find(function(item) { return item.id === id; });
        return window.getAgentDisplayName(id, hex ? hex.label : '', hex ? hex.name : '');
      };
      if (!schedules || schedules.length === 0) {
        container.innerHTML = '<span class="yin-placeholder">暂无定时任务</span>';
        return;
      }
      container.innerHTML = schedules.map(function(schedule) {
        var name = window.escapeHtml(schedule.name || schedule.id || '');
        var cron = window.escapeHtml(schedule.cron || '');
        var hexName = window.escapeHtml(getHexName(schedule.hexId));
        var msg = window.escapeHtml((schedule.message || '').slice(0, 40));
        if ((schedule.message || '').length > 40) msg += '…';
        var actions = '<span class="yin-schedule-actions">'
          + '<button type="button" class="yin-schedule-trigger" data-id="' + window.escapeHtml(schedule.id) + '" title="立即触发">▶</button>'
          + '<button type="button" class="yin-schedule-edit" data-id="' + window.escapeHtml(schedule.id) + '">编辑</button>'
          + '<button type="button" class="yin-schedule-del" data-id="' + window.escapeHtml(schedule.id) + '">删除</button>'
          + '</span>';
        return '<div class="yin-schedule-item" data-id="' + window.escapeHtml(schedule.id) + '">'
          + '<span class="yin-schedule-name">' + name + '</span>'
          + '<span class="yin-schedule-cron" title="' + cron + '">' + cron + '</span>'
          + '<span class="yin-schedule-msg" title="' + window.escapeHtml(schedule.message || '') + '">' + msg + '</span>'
          + '<span class="yin-schedule-hex">' + hexName + '</span>'
          + actions + '</div>';
      }).join('');
      container.querySelectorAll('.yin-schedule-trigger').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var id = btn.dataset.id;
          if (!id || !window.projectId) return;
          fetch('/api/projects/' + encodeURIComponent(window.projectId) + '/schedules/' + encodeURIComponent(id) + '/trigger', { method: 'POST' })
            .then(function(r) { return r.json(); })
            .then(function(data) { window.show(data.error || '已触发'); })
            .catch(function() { window.show('触发失败'); });
        });
      });
      container.querySelectorAll('.yin-schedule-edit').forEach(function(btn) {
        btn.addEventListener('click', function() { openScheduleModal(btn.dataset.id); });
      });
      container.querySelectorAll('.yin-schedule-del').forEach(function(btn) {
        btn.addEventListener('click', function() { deleteSchedule(btn.dataset.id); });
      });
    }

    function openScheduleModal(editId) {
      if (!(window.project.hexIds && window.project.hexIds.length)) {
        window.show('请先选员工');
        return;
      }
      var modal = document.getElementById('modalSchedule');
      var titleEl = document.getElementById('modalScheduleTitle');
      var preset = document.getElementById('scheduleCronPreset');
      var cronInput = document.getElementById('scheduleCron');
      var hexSelect = document.getElementById('scheduleHexId');
      hexSelect.innerHTML = '';
      (window.project.hexIds || []).forEach(function(hexId) {
        var robot = window.robots.find(function(item) { return item.id === hexId; });
        var option = document.createElement('option');
        option.value = hexId;
        option.textContent = window.getAgentDisplayName(hexId, robot ? robot.label : '', robot ? robot.name : '');
        hexSelect.appendChild(option);
      });
      if (editId) {
        var schedule = (window.project.schedules || []).find(function(item) { return item.id === editId; });
        if (schedule) {
          titleEl.textContent = '编辑定时';
          document.getElementById('scheduleName').value = schedule.name || '';
          document.getElementById('scheduleHexId').value = schedule.hexId || '';
          preset.value = ['0 9 * * *', '0 0 * * *', '0 * * * *', '*/15 * * * *', '0 0 * * 0'].indexOf(schedule.cron) >= 0 ? schedule.cron : 'custom';
          cronInput.style.display = preset.value === 'custom' ? 'block' : 'none';
          cronInput.value = schedule.cron || '';
          document.getElementById('scheduleMessage').value = schedule.message || '';
          document.getElementById('scheduleEnabled').checked = schedule.enabled !== false;
          modal.dataset.editId = editId;
        }
      } else {
        titleEl.textContent = '新增定时';
        document.getElementById('scheduleName').value = '';
        document.getElementById('scheduleHexId').value = (window.project.hexIds || [])[0] || '';
        preset.value = '';
        cronInput.value = '';
        cronInput.style.display = 'none';
        document.getElementById('scheduleMessage').value = '';
        document.getElementById('scheduleEnabled').checked = true;
        delete modal.dataset.editId;
      }
      if (preset.value === 'custom') {
        cronInput.style.display = 'block';
      } else {
        cronInput.style.display = 'none';
        cronInput.value = preset.value || '';
      }
      modal.classList.add('show');
    }

    function closeScheduleModal() {
      document.getElementById('modalSchedule').classList.remove('show');
    }

    function saveSchedule() {
      var name = document.getElementById('scheduleName').value.trim();
      var hexId = document.getElementById('scheduleHexId').value;
      var preset = document.getElementById('scheduleCronPreset').value;
      var cron = preset === 'custom' ? document.getElementById('scheduleCron').value.trim() : preset;
      var message = document.getElementById('scheduleMessage').value.trim();
      var enabled = document.getElementById('scheduleEnabled').checked;
      if (!name || !hexId || !cron || !message) {
        window.show('请填写完整');
        return;
      }
      var schedules = (window.project.schedules || []).slice();
      var editId = document.getElementById('modalSchedule').dataset.editId;
      var item = { id: editId || nextScheduleId(schedules), name: name, hexId: hexId, cron: cron, message: message, enabled: enabled };
      if (editId) {
        var idx = schedules.findIndex(function(schedule) { return schedule.id === editId; });
        if (idx >= 0) schedules[idx] = item;
        else schedules.push(item);
      } else {
        schedules.push(item);
      }
      fetch('/api/projects/' + encodeURIComponent(window.projectId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules: schedules })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.error) {
          window.show(data.error);
          return;
        }
        window.project = data;
        closeScheduleModal();
        loadYinDashboard();
        window.show('已保存');
      }).catch(function() { window.show('保存失败'); });
    }

    function deleteSchedule(id) {
      var schedules = (window.project.schedules || []).filter(function(schedule) { return schedule.id !== id; });
      fetch('/api/projects/' + encodeURIComponent(window.projectId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules: schedules })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.error) {
          window.show(data.error);
          return;
        }
        window.project = data;
        loadYinDashboard();
        window.show('已删除');
      }).catch(function() { window.show('删除失败'); });
    }

    function nextTriggerId(triggers) {
      var max = 0;
      (triggers || []).forEach(function(trigger) {
        var match = parseInt(String(trigger.id || '').replace(/\D/g, ''), 10);
        if (match > max) max = match;
      });
      return 't' + (max + 1);
    }

    function renderYinTriggers(container, triggers, hexList) {
      if (!container) return;
      var getHexName = function(id) {
        var hex = hexList.find(function(item) { return item.id === id; });
        return window.getAgentDisplayName(id, hex ? hex.label : '', hex ? hex.name : '');
      };
      var baseUrl = location.origin + '/api/webhooks/' + encodeURIComponent(window.projectId) + '/';
      if (!triggers || triggers.length === 0) {
        container.innerHTML = '<span class="yin-placeholder">暂无触发规则</span>';
        return;
      }
      container.innerHTML = triggers.map(function(trigger) {
        var name = window.escapeHtml(trigger.name || trigger.id || '');
        var hexName = window.escapeHtml(getHexName(trigger.hexId));
        var url = baseUrl + encodeURIComponent(trigger.id);
        var actions = '<span class="yin-trigger-actions">'
          + '<button type="button" class="yin-trigger-copy" data-url="' + window.escapeHtml(url) + '" title="复制 URL">复制</button>'
          + '<button type="button" class="yin-trigger-test" data-id="' + window.escapeHtml(trigger.id) + '" title="测试触发">▶</button>'
          + '<button type="button" class="yin-trigger-edit" data-id="' + window.escapeHtml(trigger.id) + '">编辑</button>'
          + '<button type="button" class="yin-trigger-del" data-id="' + window.escapeHtml(trigger.id) + '">删除</button>'
          + '</span>';
        return '<div class="yin-trigger-item" data-id="' + window.escapeHtml(trigger.id) + '">'
          + '<span class="yin-trigger-name">' + name + '</span>'
          + '<span class="yin-trigger-url" title="' + window.escapeHtml(url) + '">' + window.escapeHtml(url) + '</span>'
          + '<span class="yin-trigger-hex">' + hexName + '</span>'
          + actions + '</div>';
      }).join('');
      container.querySelectorAll('.yin-trigger-copy').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var url = btn.dataset.url;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function() { window.show('已复制'); }).catch(function() { window.show('复制失败'); });
          } else {
            var input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            window.show('已复制');
          }
        });
      });
      container.querySelectorAll('.yin-trigger-test').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var id = btn.dataset.id;
          if (!id || !window.projectId) return;
          fetch('/api/webhooks/' + encodeURIComponent(window.projectId) + '/' + encodeURIComponent(id), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
          })
            .then(function(r) { return r.json(); })
            .then(function(data) { window.show(data.error || '已触发'); })
            .catch(function() { window.show('触发失败'); });
        });
      });
      container.querySelectorAll('.yin-trigger-edit').forEach(function(btn) {
        btn.addEventListener('click', function() { openTriggerModal(btn.dataset.id); });
      });
      container.querySelectorAll('.yin-trigger-del').forEach(function(btn) {
        btn.addEventListener('click', function() { deleteTrigger(btn.dataset.id); });
      });
    }

    function openTriggerModal(editId) {
      if (!(window.project.hexIds && window.project.hexIds.length)) {
        window.show('请先选员工');
        return;
      }
      var modal = document.getElementById('modalTrigger');
      var titleEl = document.getElementById('modalTriggerTitle');
      var hexSelect = document.getElementById('triggerHexId');
      hexSelect.innerHTML = '';
      (window.project.hexIds || []).forEach(function(hexId) {
        var robot = window.robots.find(function(item) { return item.id === hexId; });
        var option = document.createElement('option');
        option.value = hexId;
        option.textContent = window.getAgentDisplayName(hexId, robot ? robot.label : '', robot ? robot.name : '');
        hexSelect.appendChild(option);
      });
      if (editId) {
        var trigger = (window.project.triggers || []).find(function(item) { return item.id === editId; });
        if (trigger) {
          titleEl.textContent = '编辑 Webhook';
          document.getElementById('triggerName').value = trigger.name || '';
          document.getElementById('triggerHexId').value = trigger.hexId || '';
          document.getElementById('triggerMessage').value = trigger.message || '';
          document.getElementById('triggerEnabled').checked = trigger.enabled !== false;
          modal.dataset.editId = editId;
        }
      } else {
        titleEl.textContent = '新增 Webhook';
        document.getElementById('triggerName').value = '';
        document.getElementById('triggerHexId').value = (window.project.hexIds || [])[0] || '';
        document.getElementById('triggerMessage').value = '';
        document.getElementById('triggerEnabled').checked = true;
        delete modal.dataset.editId;
      }
      modal.classList.add('show');
    }

    function closeTriggerModal() {
      document.getElementById('modalTrigger').classList.remove('show');
    }

    function saveTrigger() {
      var name = document.getElementById('triggerName').value.trim();
      var hexId = document.getElementById('triggerHexId').value;
      var message = document.getElementById('triggerMessage').value.trim();
      var enabled = document.getElementById('triggerEnabled').checked;
      if (!name || !hexId || !message) {
        window.show('请填写完整');
        return;
      }
      var triggers = (window.project.triggers || []).slice();
      var editId = document.getElementById('modalTrigger').dataset.editId;
      var item = { id: editId || nextTriggerId(triggers), type: 'webhook', name: name, hexId: hexId, message: message, enabled: enabled };
      if (editId) {
        var idx = triggers.findIndex(function(trigger) { return trigger.id === editId; });
        if (idx >= 0) triggers[idx] = item;
        else triggers.push(item);
      } else {
        triggers.push(item);
      }
      fetch('/api/projects/' + encodeURIComponent(window.projectId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggers: triggers })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.error) {
          window.show(data.error);
          return;
        }
        window.project = data;
        closeTriggerModal();
        loadYinDashboard();
        window.show('已保存');
      }).catch(function() { window.show('保存失败'); });
    }

    function deleteTrigger(id) {
      var triggers = (window.project.triggers || []).filter(function(trigger) { return trigger.id !== id; });
      fetch('/api/projects/' + encodeURIComponent(window.projectId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggers: triggers })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.error) {
          window.show(data.error);
          return;
        }
        window.project = data;
        loadYinDashboard();
        window.show('已删除');
      }).catch(function() { window.show('删除失败'); });
    }

    function nextWorkflowId(workflows) {
      var max = 0;
      (workflows || []).forEach(function(workflow) {
        var match = parseInt(String(workflow.id || '').replace(/\D/g, ''), 10);
        if (match > max) max = match;
      });
      return 'w' + (max + 1);
    }

    function renderYinWorkflows(container, workflows, hexList) {
      if (!container) return;
      var getHexName = function(id) {
        var hex = hexList.find(function(item) { return item.id === id; });
        return window.getAgentDisplayName(id, hex ? hex.label : '', hex ? hex.name : '');
      };
      if (!workflows || workflows.length === 0) {
        container.innerHTML = '<span class="yin-placeholder">暂无流程</span>';
        return;
      }
      container.innerHTML = workflows.map(function(workflow) {
        var stepsStr = (workflow.steps || []).map(function(step) { return getHexName(step.hexId); }).join(' → ');
        var actions = '<span class="yin-workflow-actions">'
          + '<button type="button" class="yin-workflow-trigger" data-id="' + window.escapeHtml(workflow.id) + '" title="从第一步开始执行">▶</button>'
          + '<button type="button" class="yin-workflow-edit" data-id="' + window.escapeHtml(workflow.id) + '">编辑</button>'
          + '<button type="button" class="yin-workflow-del" data-id="' + window.escapeHtml(workflow.id) + '">删除</button>'
          + '</span>';
        return '<div class="yin-workflow-item" data-id="' + window.escapeHtml(workflow.id) + '">'
          + '<span class="yin-workflow-name">' + window.escapeHtml(workflow.name || workflow.id || '') + '</span>'
          + '<span class="yin-workflow-steps">' + window.escapeHtml(stepsStr || '空') + '</span>'
          + actions + '</div>';
      }).join('');
      container.querySelectorAll('.yin-workflow-trigger').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var id = btn.dataset.id;
          if (!id || !window.projectId) return;
          fetch('/api/projects/' + encodeURIComponent(window.projectId) + '/workflows/' + encodeURIComponent(id) + '/trigger', { method: 'POST' })
            .then(function(r) { return r.json(); })
            .then(function(data) { window.show(data.error || '已触发'); })
            .catch(function() { window.show('触发失败'); });
        });
      });
      container.querySelectorAll('.yin-workflow-edit').forEach(function(btn) {
        btn.addEventListener('click', function() { openWorkflowModal(btn.dataset.id); });
      });
      container.querySelectorAll('.yin-workflow-del').forEach(function(btn) {
        btn.addEventListener('click', function() { deleteWorkflow(btn.dataset.id); });
      });
    }

    function openWorkflowModal(editId) {
      if (!(window.project.hexIds && window.project.hexIds.length)) {
        window.show('请先选员工');
        return;
      }
      var modal = document.getElementById('modalWorkflow');
      var titleEl = document.getElementById('modalWorkflowTitle');
      var stepsList = document.getElementById('workflowStepsList');
      stepsList.innerHTML = '';

      function addStepRow(step) {
        var row = document.createElement('div');
        row.className = 'workflow-step-row';
        row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center;';
        var hexSelect = document.createElement('select');
        hexSelect.style.cssText = 'flex:0 0 80px;padding:6px;background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:4px;color:var(--text);';
        (window.project.hexIds || []).forEach(function(hexId) {
          var robot = window.robots.find(function(item) { return item.id === hexId; });
          var option = document.createElement('option');
          option.value = hexId;
          option.textContent = window.getAgentDisplayName(hexId, robot ? robot.label : '', robot ? robot.name : '');
          if (step && step.hexId === hexId) option.selected = true;
          hexSelect.appendChild(option);
        });
        var msgInput = document.createElement('input');
        msgInput.type = 'text';
        msgInput.placeholder = '执行指令';
        msgInput.value = step ? (step.message || '') : '';
        msgInput.style.cssText = 'flex:1;padding:6px;background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:4px;color:var(--text);';
        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.textContent = '×';
        delBtn.className = 'yin-btn-add';
        delBtn.style.cssText = 'flex:0 0 28px;padding:4px;';
        delBtn.addEventListener('click', function() { row.remove(); });
        row.appendChild(hexSelect);
        row.appendChild(msgInput);
        row.appendChild(delBtn);
        stepsList.appendChild(row);
      }

      if (editId) {
        var workflow = (window.project.workflows || []).find(function(item) { return item.id === editId; });
        if (workflow) {
          titleEl.textContent = '编辑流程';
          document.getElementById('workflowName').value = workflow.name || '';
          (workflow.steps || []).forEach(addStepRow);
          modal.dataset.editId = editId;
        }
      } else {
        titleEl.textContent = '新增流程';
        document.getElementById('workflowName').value = '';
        addStepRow(null);
        delete modal.dataset.editId;
      }
      if (stepsList.children.length === 0) addStepRow(null);
      modal.classList.add('show');
    }

    function closeWorkflowModal() {
      document.getElementById('modalWorkflow').classList.remove('show');
    }

    function appendWorkflowStepRow() {
      var stepsList = document.getElementById('workflowStepsList');
      var row = document.createElement('div');
      row.className = 'workflow-step-row';
      row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center;';
      var hexSelect = document.createElement('select');
      hexSelect.style.cssText = 'flex:0 0 80px;padding:6px;background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:4px;color:var(--text);';
      (window.project.hexIds || []).forEach(function(hexId) {
        var robot = window.robots.find(function(item) { return item.id === hexId; });
        var option = document.createElement('option');
        option.value = hexId;
        option.textContent = window.getAgentDisplayName(hexId, robot ? robot.label : '', robot ? robot.name : '');
        hexSelect.appendChild(option);
      });
      var msgInput = document.createElement('input');
      msgInput.type = 'text';
      msgInput.placeholder = '执行指令';
      msgInput.style.cssText = 'flex:1;padding:6px;background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:4px;color:var(--text);';
      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = '×';
      delBtn.className = 'yin-btn-add';
      delBtn.style.cssText = 'flex:0 0 28px;padding:4px;';
      delBtn.addEventListener('click', function() { row.remove(); });
      row.appendChild(hexSelect);
      row.appendChild(msgInput);
      row.appendChild(delBtn);
      stepsList.appendChild(row);
    }

    function saveWorkflow() {
      var name = document.getElementById('workflowName').value.trim();
      if (!name) {
        window.show('请填写流程名称');
        return;
      }
      var rows = document.querySelectorAll('#workflowStepsList .workflow-step-row');
      var steps = [];
      rows.forEach(function(row) {
        var sel = row.querySelector('select');
        var inp = row.querySelector('input');
        if (sel && inp && sel.value && inp.value.trim()) {
          steps.push({ hexId: sel.value, message: inp.value.trim() });
        }
      });
      if (steps.length === 0) {
        window.show('请添加至少一个有效步骤');
        return;
      }
      var workflows = (window.project.workflows || []).slice();
      var editId = document.getElementById('modalWorkflow').dataset.editId;
      var item = { id: editId || nextWorkflowId(workflows), name: name, steps: steps };
      if (editId) {
        var idx = workflows.findIndex(function(workflow) { return workflow.id === editId; });
        if (idx >= 0) workflows[idx] = item;
        else workflows.push(item);
      } else {
        workflows.push(item);
      }
      fetch('/api/projects/' + encodeURIComponent(window.projectId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflows: workflows })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.error) {
          window.show(data.error);
          return;
        }
        window.project = data;
        closeWorkflowModal();
        loadYinDashboard();
        window.show('已保存');
      }).catch(function() { window.show('保存失败'); });
    }

    function deleteWorkflow(id) {
      var workflows = (window.project.workflows || []).filter(function(workflow) { return workflow.id !== id; });
      fetch('/api/projects/' + encodeURIComponent(window.projectId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflows: workflows })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.error) {
          window.show(data.error);
          return;
        }
        window.project = data;
        loadYinDashboard();
        window.show('已删除');
      }).catch(function() { window.show('删除失败'); });
    }

    function renderYinApi(container, data) {
      if (!container) return;
      var base = location.origin;
      var url = base + '/api/projects/' + encodeURIComponent(window.projectId) + '/run';
      var hasToken = !!data.hasApiToken;
      var tokenHint = data.apiToken || '';
      var html = '<div style="font-size:0.82rem;">'
        + '<p style="margin:0 0 8px 0;"><strong>POST</strong> ' + window.escapeHtml(url) + '</p>'
        + '<p style="margin:0 0 8px 0;color:var(--text-dim);">Token: ' + (hasToken ? '<span style="color:var(--gold);">已设置</span> ' + window.escapeHtml(tokenHint) : '<span style="color:var(--text-dim);">未设置</span>') + '</p>'
        + '<p style="margin:8px 0;font-size:0.75rem;">先在终端设置 OPENSWARM_RUN_TOKEN，再运行下面的示例。</p>'
        + '<pre style="margin:8px 0 0 0;padding:10px;background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:4px;font-size:0.75rem;overflow-x:auto;">curl -X POST "' + window.escapeHtml(url) + '" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer $OPENSWARM_RUN_TOKEN" \\\n  -d \'{"hexId":"' + (data.hexList && data.hexList[0] ? data.hexList[0].id : 'h11') + '","message":"执行指令"}\'</pre>'
        + '<p style="margin:8px 0 0 0;font-size:0.75rem;color:var(--text-dim);">支持: hexId+message | workflowId | triggerId</p>'
        + '</div>';
      container.innerHTML = html;
    }

    function renderYinDashboard(data) {
      var configEl = document.getElementById('yinConfigContent');
      var hexEl = document.getElementById('yinHexContent');
      var scheduleEl = document.getElementById('yinScheduleContent');
      var triggerEl = document.getElementById('yinTriggerContent');
      var apiEl = document.getElementById('yinApiContent');
      if (configEl) {
        var config = data.config || {};
        var keys = Object.keys(config);
        configEl.textContent = keys.length ? keys.map(function(key) { return key + '=' + (config[key] ? '***' : ''); }).join(', ') : '暂无项目级配置';
      }
      if (hexEl) {
        var hexList = data.hexList || [];
        if (hexList.length === 0) {
          hexEl.innerHTML = '<span class="yin-placeholder">暂无员工，请先选员工</span>';
        } else {
          hexEl.innerHTML = hexList.map(function(hex) {
            var skills = (hex.skills || []).filter(function(skill) { return skill !== 'skills增加'; });
            var skillsHtml = skills.length
              ? skills.map(function(skill) { return '<span class="yin-skill-tag">' + window.escapeHtml(skill) + '</span>'; }).join('')
              : '<span class="yin-placeholder">无技能</span>';
            return '<div class="yin-hex-row"><span class="yin-hex-name">' + window.escapeHtml(window.getAgentDisplayName(hex.id, hex.label, hex.name)) + '</span><span class="yin-hex-skills">' + skillsHtml + '</span></div>';
          }).join('');
        }
      }
      if (scheduleEl) renderYinSchedules(scheduleEl, data.schedules || [], data.hexList || []);
      if (triggerEl) renderYinTriggers(triggerEl, data.triggers || [], data.hexList || []);
      var workflowEl = document.getElementById('yinWorkflowContent');
      if (workflowEl) renderYinWorkflows(workflowEl, data.workflows || [], data.hexList || []);
      if (apiEl) renderYinApi(apiEl, data);
    }

    function loadYinDashboard() {
      if (!window.projectId || window.projectId === 'hex-definition') return;
      var errHint = '请确认面板已启动（http://localhost:3999）';
      fetch('/api/projects/' + encodeURIComponent(window.projectId) + '/yin-status')
        .then(function(r) {
          if (!r.ok) {
            return r.text().then(function(text) { throw new Error(r.status + (text ? ': ' + text.slice(0, 60) : '')); });
          }
          return r.json();
        })
        .then(function(data) { renderYinDashboard(data); })
        .catch(function(e) {
          var msg = (e && e.message) ? String(e.message) : errHint;
          var html = '<span class="yin-placeholder">加载失败：' + window.escapeHtml(msg) + '。 <button type="button" class="yin-btn-add" id="yinRetryBtn" style="margin-left:6px;">重试</button></span>';
          var hexEl = document.getElementById('yinHexContent');
          if (hexEl) hexEl.innerHTML = html;
          var configEl = document.getElementById('yinConfigContent');
          if (configEl) configEl.innerHTML = html;
          var apiEl = document.getElementById('yinApiContent');
          if (apiEl) apiEl.innerHTML = html;
          setTimeout(function() {
            var btn = document.getElementById('yinRetryBtn');
            if (btn) btn.addEventListener('click', loadYinDashboard);
          }, 0);
        });
    }

    var yinScheduleAdd = document.getElementById('yinScheduleAdd');
    if (yinScheduleAdd) yinScheduleAdd.addEventListener('click', function() { openScheduleModal(); });
    var scheduleCancelBtn = document.getElementById('scheduleCancel');
    if (scheduleCancelBtn) scheduleCancelBtn.addEventListener('click', closeScheduleModal);
    var scheduleSaveBtn = document.getElementById('scheduleSave');
    if (scheduleSaveBtn) scheduleSaveBtn.addEventListener('click', saveSchedule);
    var scheduleCronPresetEl = document.getElementById('scheduleCronPreset');
    var scheduleCronInputEl = document.getElementById('scheduleCron');
    if (scheduleCronPresetEl && scheduleCronInputEl) {
      scheduleCronPresetEl.addEventListener('change', function() {
        if (scheduleCronPresetEl.value === 'custom') {
          scheduleCronInputEl.style.display = 'block';
          scheduleCronInputEl.focus();
        } else {
          scheduleCronInputEl.style.display = 'none';
          scheduleCronInputEl.value = scheduleCronPresetEl.value || '';
        }
      });
    }
    var modalScheduleEl = document.getElementById('modalSchedule');
    if (modalScheduleEl) modalScheduleEl.addEventListener('click', function(e) { if (e.target === modalScheduleEl) closeScheduleModal(); });

    var yinTriggerAdd = document.getElementById('yinTriggerAdd');
    if (yinTriggerAdd) yinTriggerAdd.addEventListener('click', function() { openTriggerModal(); });
    var triggerCancelBtn = document.getElementById('triggerCancel');
    if (triggerCancelBtn) triggerCancelBtn.addEventListener('click', closeTriggerModal);
    var triggerSaveBtn = document.getElementById('triggerSave');
    if (triggerSaveBtn) triggerSaveBtn.addEventListener('click', saveTrigger);
    var modalTriggerEl = document.getElementById('modalTrigger');
    if (modalTriggerEl) modalTriggerEl.addEventListener('click', function(e) { if (e.target === modalTriggerEl) closeTriggerModal(); });

    var yinWorkflowAdd = document.getElementById('yinWorkflowAdd');
    if (yinWorkflowAdd) yinWorkflowAdd.addEventListener('click', function() { openWorkflowModal(); });
    var workflowCancelBtn = document.getElementById('workflowCancel');
    if (workflowCancelBtn) workflowCancelBtn.addEventListener('click', closeWorkflowModal);
    var workflowSaveBtn = document.getElementById('workflowSave');
    if (workflowSaveBtn) workflowSaveBtn.addEventListener('click', saveWorkflow);
    var modalWorkflowEl = document.getElementById('modalWorkflow');
    if (modalWorkflowEl) modalWorkflowEl.addEventListener('click', function(e) { if (e.target === modalWorkflowEl) closeWorkflowModal(); });
    var workflowAddStepBtn = document.getElementById('workflowAddStep');
    if (workflowAddStepBtn) workflowAddStepBtn.addEventListener('click', appendWorkflowStepRow);

    var yinConfigEdit = document.getElementById('yinConfigEdit');
    if (yinConfigEdit) yinConfigEdit.addEventListener('click', openConfigModal);
    var yinLinkYang = document.getElementById('yinLinkYang');
    if (yinLinkYang) {
      yinLinkYang.addEventListener('click', function(e) {
        e.preventDefault();
        openSkillsModal();
      });
    }
    var skillsModalCancelBtn = document.getElementById('skillsModalCancel');
    if (skillsModalCancelBtn) skillsModalCancelBtn.addEventListener('click', closeSkillsModal);
    var skillsModalSaveBtn = document.getElementById('skillsModalSave');
    if (skillsModalSaveBtn) skillsModalSaveBtn.addEventListener('click', saveSkillsModal);
    var modalSkillsEl = document.getElementById('modalSkills');
    if (modalSkillsEl) modalSkillsEl.addEventListener('click', function(e) { if (e.target === modalSkillsEl) closeSkillsModal(); });
    var configCancelBtn = document.getElementById('configCancel');
    if (configCancelBtn) configCancelBtn.addEventListener('click', closeConfigModal);
    var configSaveBtn = document.getElementById('configSave');
    if (configSaveBtn) configSaveBtn.addEventListener('click', saveConfig);
    var modalConfigEl = document.getElementById('modalConfig');
    if (modalConfigEl) modalConfigEl.addEventListener('click', function(e) { if (e.target === modalConfigEl) closeConfigModal(); });
    var configAddKvBtn = document.getElementById('configAddKv');
    if (configAddKvBtn) configAddKvBtn.addEventListener('click', function() { addConfigRow('', ''); });

    var yinApiGenToken = document.getElementById('yinApiGenToken');
    if (yinApiGenToken) {
      yinApiGenToken.addEventListener('click', function() {
        if (!window.projectId) return;
        var token = 'yin_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        fetch('/api/projects/' + encodeURIComponent(window.projectId), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiToken: token })
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (data.error) {
            window.show(data.error);
            return;
          }
          window.project = data;
          loadYinDashboard();
          window.show('Token 已生成（请立即复制保存）：' + token);
          window.toast.style.whiteSpace = 'pre-wrap';
          window.toast.style.maxWidth = '90%';
          setTimeout(function() {
            window.toast.style.whiteSpace = '';
            window.toast.style.maxWidth = '';
          }, 8000);
        }).catch(function() { window.show('生成失败'); });
      });
    }

    window.loadYinDashboard = loadYinDashboard;
    window.openScheduleModal = openScheduleModal;
    window.closeScheduleModal = closeScheduleModal;
    window.openTriggerModal = openTriggerModal;
    window.closeTriggerModal = closeTriggerModal;
    window.openWorkflowModal = openWorkflowModal;
    window.closeWorkflowModal = closeWorkflowModal;
    window.openConfigModal = openConfigModal;
    window.closeConfigModal = closeConfigModal;
    window.openSkillsModal = openSkillsModal;
    window.closeSkillsModal = closeSkillsModal;
  }

  window.initProjectYinDashboard = initProjectYinDashboard;
})();
