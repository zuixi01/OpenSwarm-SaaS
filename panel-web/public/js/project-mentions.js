(function() {
  function buildMentionController(input, popover) {
    var mentionWrap = input && input.closest('.mention-input-wrap');
    if (!input || !popover || !mentionWrap) return;

    function getTeamMembers() {
      var hexIds = window.project && window.project.hexIds ? window.project.hexIds : [];
      return hexIds.map(function(hexId) {
        var hex = window.hexList.find(function(item) { return item.id === hexId; });
        return {
          hexId: hexId,
          displayName: window.getAgentDisplayName(hexId, hex ? hex.label : '', hex ? hex.name : '')
        };
      });
    }

    function hideMention() {
      popover.setAttribute('aria-hidden', 'true');
      popover.innerHTML = '';
      popover.dataset.mentionStart = '';
    }

    function showMentionList(query) {
      var list = getTeamMembers();
      var q = String(query || '').trim().toLowerCase();
      var filtered = q ? list.filter(function(member) {
        return String(member.displayName || '').toLowerCase().indexOf(q) !== -1;
      }) : list;
      popover.innerHTML = '';
      if (filtered.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'mention-popover-empty';
        empty.textContent = list.length === 0 ? '请先在「选员工」中为本项目添加成员' : '无匹配成员';
        popover.appendChild(empty);
      } else {
        filtered.forEach(function(member, index) {
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'mention-popover-item' + (index === 0 ? ' mention-highlight' : '');
          button.textContent = member.displayName || member.hexId;
          button.dataset.hexId = member.hexId;
          button.dataset.displayName = member.displayName || member.hexId;
          button.setAttribute('role', 'option');
          popover.appendChild(button);
        });
      }
      popover.setAttribute('aria-hidden', 'false');
    }

    function applyMention(displayName) {
      var start = parseInt(popover.dataset.mentionStart, 10);
      if (isNaN(start)) return;
      var value = input.value;
      var before = value.slice(0, start);
      var after = value.slice(input.selectionStart || value.length);
      input.value = before + '@' + displayName + ' ' + after;
      input.focus();
      var newPos = start + displayName.length + 2;
      input.setSelectionRange(newPos, newPos);
      hideMention();
    }

    input.addEventListener('input', function() {
      var value = input.value;
      var pos = input.selectionStart != null ? input.selectionStart : value.length;
      var before = value.slice(0, pos);
      var atIdx = before.lastIndexOf('@');
      if (atIdx === -1) {
        hideMention();
        return;
      }
      var afterAt = before.slice(atIdx + 1);
      if (/[\s\u200b]/.test(afterAt)) {
        hideMention();
        return;
      }
      popover.dataset.mentionStart = String(atIdx);
      showMentionList(afterAt);
      var items = popover.querySelectorAll('.mention-popover-item');
      items.forEach(function(el) { el.classList.remove('mention-highlight'); });
      if (items[0]) items[0].classList.add('mention-highlight');
    });

    input.addEventListener('keydown', function(e) {
      if (popover.getAttribute('aria-hidden') !== 'false') return;
      var items = popover.querySelectorAll('.mention-popover-item');
      var current = popover.querySelector('.mention-popover-item.mention-highlight');
      var index = current ? Array.prototype.indexOf.call(items, current) : 0;
      if (e.key === 'Escape') {
        e.preventDefault();
        hideMention();
        return;
      }
      if (e.key === 'Enter' && items.length > 0) {
        e.preventDefault();
        applyMention((current || items[0]).dataset.displayName);
        return;
      }
      if (e.key === 'ArrowDown' && items.length > 0) {
        e.preventDefault();
        index = (index + 1) % items.length;
        items.forEach(function(el) { el.classList.remove('mention-highlight'); });
        items[index].classList.add('mention-highlight');
        items[index].scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'ArrowUp' && items.length > 0) {
        e.preventDefault();
        index = index <= 0 ? items.length - 1 : index - 1;
        items.forEach(function(el) { el.classList.remove('mention-highlight'); });
        items[index].classList.add('mention-highlight');
        items[index].scrollIntoView({ block: 'nearest' });
      }
    });

    popover.addEventListener('click', function(e) {
      var button = e.target && e.target.closest('.mention-popover-item');
      if (button && button.dataset.displayName) applyMention(button.dataset.displayName);
    });

    document.addEventListener('click', function(e) {
      if (popover.getAttribute('aria-hidden') === 'false' && !mentionWrap.contains(e.target)) {
        hideMention();
      }
    });
  }

  function initProjectMentions() {
    buildMentionController(window.hexChatInput, document.getElementById('hexMentionPopover'));
    buildMentionController(window.yinChatInput, document.getElementById('yinMentionPopover'));

    if (window.hexChatInput && window.hexChatSend) {
      window.hexChatInput.addEventListener('keydown', function(e) {
        if (e.key !== 'Enter') return;
        var pop = document.getElementById('hexMentionPopover');
        if (pop && pop.getAttribute('aria-hidden') === 'false') return;
        window.hexChatSend.click();
      });
    }

    if (window.yinChatInput && window.yinChatSend) {
      window.yinChatInput.addEventListener('keydown', function(e) {
        if (e.key !== 'Enter') return;
        var pop = document.getElementById('yinMentionPopover');
        if (pop && pop.getAttribute('aria-hidden') === 'false') return;
        window.yinChatSend.click();
      });
    }
  }

  window.initProjectMentions = initProjectMentions;
})();
