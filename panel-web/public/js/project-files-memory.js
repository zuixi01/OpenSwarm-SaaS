(function() {
  function initProjectFilesMemory() {
    var btnUpdateMemory = document.getElementById('btnUpdateMemory');
    var projectFilesPanel = document.getElementById('projectFilesPanel');
    var projectFilesList = document.getElementById('projectFilesList');
    var btnShowFiles = document.getElementById('btnShowFiles');
    var btnRefreshFiles = document.getElementById('btnRefreshFiles');
    var btnCloseFiles = document.getElementById('btnCloseFiles');

    function escapeHtml(value) {
      if (window.escapeHtml) return window.escapeHtml(value);
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function openFilesModal() {
      if (!projectFilesPanel) return;
      projectFilesPanel.classList.add('show');
      projectFilesPanel.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeFilesModal() {
      if (!projectFilesPanel) return;
      projectFilesPanel.classList.remove('show');
      projectFilesPanel.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    if (btnUpdateMemory) {
      btnUpdateMemory.addEventListener('click', function() {
        if (!window.projectId) return;
        var summaryTexts = [];
        if (window.hexChatMessages) {
          window.hexChatMessages.querySelectorAll('.hex-chat-summary-block').forEach(function(block) {
            var summary = block.getAttribute('data-summary') || (block.querySelector('.hex-chat-summary-content') || {}).textContent || '';
            if (summary) summaryTexts.push('【摘要】' + summary.trim());
            var decision = block.querySelector('.hex-chat-yin-decision');
            if (decision) {
              var decisionText = decision.getAttribute('data-decision') || (decision.querySelector('.hex-chat-summary-content') || {}).textContent || '';
              if (decisionText) summaryTexts.push('【决策】' + decisionText.trim());
            }
          });
        }
        if (summaryTexts.length === 0) {
          alert('没有找到摘要或决策内容，请先进行群讨论并生成摘要。');
          return;
        }
        var prompt = '以下是本项目最近的讨论摘要和决策记录：\n\n' + summaryTexts.join('\n\n')
          + '\n\n请提炼出2-5条关键信息，每条格式为："类型|内容"，类型只能是：决策/进展/风险/待办 之一。'
          + '内容不超过50字。只输出列表，不要多余的话。例如：\n决策|采用Python+Whisper方案做字幕\n进展|DG-01完成字幕生成模块';
        btnUpdateMemory.disabled = true;
        btnUpdateMemory.textContent = window.t('extractingMemory');
        fetch('/api/yin/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: prompt, projectId: window.projectId, history: [] })
        })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            var reply = data.reply || '';
            var lines = reply.split('\n').map(function(line) { return line.trim(); }).filter(function(line) { return line.includes('|'); });
            if (lines.length === 0) {
              alert('主控未能提炼出有效记忆，原始回复：\n' + reply);
              return;
            }
            var promises = lines.map(function(line) {
              var parts = line.split('|');
              var type = parts[0].trim();
              var content = parts.slice(1).join('|').trim();
              if (!content) return Promise.resolve();
              return fetch('/api/project-memory/' + encodeURIComponent(window.projectId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: type, content: content })
              });
            });
            return Promise.all(promises).then(function() {
              btnUpdateMemory.textContent = window.t('memoryUpdatedCount', lines.length);
              setTimeout(function() { btnUpdateMemory.textContent = window.t('updateMemory'); }, 3000);
            });
          })
          .catch(function() {
            alert('记忆更新失败，请检查主控是否在线');
            btnUpdateMemory.textContent = window.t('updateMemory');
          })
          .then(function() {
            btnUpdateMemory.disabled = false;
            if (btnUpdateMemory.textContent === window.t('extractingMemory')) btnUpdateMemory.textContent = window.t('updateMemory');
          });
      });
    }

    function loadProjectFiles() {
      if (!window.projectId || !projectFilesList) return;
      projectFilesList.innerHTML = '<div class="project-files-empty">正在加载产出文件…</div>';
      fetch('/api/project-files/' + encodeURIComponent(window.projectId))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var files = data.files || [];
          if (files.length === 0) {
            projectFilesList.innerHTML = '<div class="project-files-empty">暂无产出文件。<br>员工执行任务后，文件会出现在各自的 workspace/output/' + escapeHtml(window.projectId) + '/ 目录。</div>';
            return;
          }
          files.sort(function(a, b) {
            return new Date(b.mtime).getTime() - new Date(a.mtime).getTime();
          });
          projectFilesList.innerHTML = files.map(function(file) {
            var size = file.size < 1024 ? file.size + 'B' : file.size < 1048576 ? (file.size / 1024).toFixed(1) + 'KB' : (file.size / 1048576).toFixed(1) + 'MB';
            var mtime = new Date(file.mtime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            var dlUrl = '/api/project-files/' + encodeURIComponent(window.projectId) + '/download?hexId=' + encodeURIComponent(file.hexId) + '&path=' + encodeURIComponent(file.path);
            return '<div class="project-file-item">'
              + '<div class="project-file-agent">' + escapeHtml(window.getAgentDisplayName(file.hexId, '', file.hexName)) + '</div>'
              + '<div class="project-file-name-wrap">'
              + '<div class="project-file-name" title="' + escapeHtml(file.name) + '">' + escapeHtml(file.name) + '</div>'
              + '<div class="project-file-path" title="' + escapeHtml(file.path) + '">' + escapeHtml(file.path) + '</div>'
              + '</div>'
              + '<div class="project-file-meta">' + size + '</div>'
              + '<div class="project-file-meta">' + mtime + '</div>'
              + '<a class="project-file-download" href="' + dlUrl + '" download="' + escapeHtml(file.name) + '" title="下载文件">下载</a>'
              + '</div>';
          }).join('');
        })
        .catch(function() {
          if (projectFilesList) projectFilesList.innerHTML = '<div class="project-files-empty">加载失败，请稍后重试。</div>';
        });
    }

    if (btnShowFiles) {
      btnShowFiles.addEventListener('click', function() {
        if (!projectFilesPanel) return;
        openFilesModal();
        loadProjectFiles();
      });
    }
    if (btnRefreshFiles) btnRefreshFiles.addEventListener('click', loadProjectFiles);
    if (btnCloseFiles) {
      btnCloseFiles.addEventListener('click', function() {
        closeFilesModal();
      });
    }
    if (projectFilesPanel) {
      projectFilesPanel.addEventListener('click', function(event) {
        if (event.target === projectFilesPanel) closeFilesModal();
      });
    }
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && projectFilesPanel && projectFilesPanel.classList.contains('show')) {
        closeFilesModal();
      }
    });

    window.loadProjectFiles = loadProjectFiles;
  }

  window.initProjectFilesMemory = initProjectFilesMemory;
})();
