(function () {
  if (window.__openswarmAuthShellLoaded) return;
  window.__openswarmAuthShellLoaded = true;

  var LOGIN_PATH = '/login.html';
  var SESSION_API = '/api/auth/session';
  var MEMBERSHIPS_API = '/api/auth/memberships';
  var SWITCH_TENANT_API = '/api/auth/web-switch-tenant';
  var REFRESH_API = '/api/auth/web-refresh';
  var LOGOUT_API = '/api/auth/web-logout';
  var AUTH_SKIP_PREFIX = [
    '/api/auth/web-login',
    '/api/auth/web-refresh',
    '/api/auth/web-logout',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/auth/logout'
  ];

  var rawFetch = window.fetch.bind(window);
  var refreshPromise = null;

  function extractPath(input) {
    var url = '';
    if (typeof input === 'string') url = input;
    else if (input && typeof input.url === 'string') url = input.url;
    if (!url) return '';
    try {
      var u = new URL(url, window.location.origin);
      if (u.origin !== window.location.origin) return '';
      return u.pathname;
    } catch (_e) {
      return '';
    }
  }

  function isApiPath(pathname) {
    return pathname.indexOf('/api/') === 0 || pathname.indexOf('/v1/') === 0;
  }

  function isAuthSkipPath(pathname) {
    for (var i = 0; i < AUTH_SKIP_PREFIX.length; i += 1) {
      if (pathname.indexOf(AUTH_SKIP_PREFIX[i]) === 0) return true;
    }
    return false;
  }

  function toLogin(withNext) {
    if (window.location.pathname === LOGIN_PATH) return;
    if (!withNext) {
      window.location.href = LOGIN_PATH;
      return;
    }
    var next = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
    window.location.href = LOGIN_PATH + '?next=' + next;
  }

  function doRefresh() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = rawFetch(REFRESH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    }).then(function (res) {
      return !!res && res.ok;
    }).catch(function () {
      return false;
    }).finally(function () {
      refreshPromise = null;
    });
    return refreshPromise;
  }

  window.fetch = async function wrappedFetch(input, init) {
    var path = extractPath(input);
    var allowRetry = isApiPath(path) && !isAuthSkipPath(path);

    var firstInput = input;
    var retryInputFactory = function () { return input; };
    if (typeof Request !== 'undefined' && input instanceof Request) {
      firstInput = input.clone();
      retryInputFactory = function () { return input.clone(); };
    }

    var res = await rawFetch(firstInput, init);
    if (!allowRetry || !res || res.status !== 401) return res;

    var ok = await doRefresh();
    if (!ok) {
      toLogin(true);
      return res;
    }

    return rawFetch(retryInputFactory(), init);
  };

  var SHELL_STYLES = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    border: '1px solid rgba(57,208,255,0.35)',
    background: 'rgba(5, 10, 26, 0.78)',
    borderRadius: '6px',
    backdropFilter: 'blur(4px)',
    color: '#9ed8ff',
    fontSize: '12px'
  };

  function applyStyles(el, styles) {
    for (var k in styles) {
      if (styles.hasOwnProperty(k)) el.style[k] = styles[k];
    }
  }

  function addLogoutButton() {
    if (window.location.pathname === LOGIN_PATH) return;
    if (document.getElementById('openswarm-auth-shell')) return;

    var slot = document.getElementById('openswarm-auth-slot');
    var shell = document.createElement('div');
    shell.id = 'openswarm-auth-shell';
    applyStyles(shell, SHELL_STYLES);
    if (!slot) {
      shell.style.position = 'fixed';
      shell.style.top = '14px';
      shell.style.right = '16px';
      shell.style.zIndex = '9999';
    }

    var user = document.createElement('span');
    user.id = 'openswarm-auth-user';
    user.style.maxWidth = '220px';
    user.style.overflow = 'hidden';
    user.style.whiteSpace = 'nowrap';
    user.style.textOverflow = 'ellipsis';
    user.textContent = '...';

    var loginLink = document.createElement('a');
    loginLink.id = 'openswarm-auth-login';
    loginLink.href = LOGIN_PATH + '?next=' + encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
    loginLink.textContent = '登录';
    loginLink.style.color = '#9ed8ff';
    loginLink.style.fontSize = '12px';
    loginLink.style.textDecoration = 'none';
    loginLink.style.padding = '6px 10px';
    loginLink.style.borderRadius = '4px';
    loginLink.style.border = '1px solid rgba(57,208,255,0.4)';
    loginLink.style.background = 'rgba(15, 39, 70, 0.6)';
    loginLink.style.cursor = 'pointer';
    loginLink.style.display = 'none';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'openswarm-auth-logout';
    btn.textContent = '退出登录';
    btn.style.border = '1px solid rgba(255,255,255,0.24)';
    btn.style.background = '#0f2746';
    btn.style.color = '#e9f3ff';
    btn.style.cursor = 'pointer';
    btn.style.padding = '6px 10px';
    btn.style.borderRadius = '4px';
    btn.style.fontSize = '12px';
    btn.style.display = 'none';

    var tenantSelect = document.createElement('select');
    tenantSelect.id = 'openswarm-auth-tenant-select';
    tenantSelect.style.display = 'none';
    tenantSelect.style.maxWidth = '180px';
    tenantSelect.style.padding = '6px 8px';
    tenantSelect.style.borderRadius = '4px';
    tenantSelect.style.border = '1px solid rgba(57,208,255,0.35)';
    tenantSelect.style.background = 'rgba(15, 39, 70, 0.6)';
    tenantSelect.style.color = '#e9f3ff';
    tenantSelect.style.fontSize = '12px';

    var tenantSwitchBtn = document.createElement('button');
    tenantSwitchBtn.type = 'button';
    tenantSwitchBtn.id = 'openswarm-auth-tenant-switch';
    tenantSwitchBtn.textContent = '切换';
    tenantSwitchBtn.style.border = '1px solid rgba(57,208,255,0.4)';
    tenantSwitchBtn.style.background = 'rgba(15, 39, 70, 0.6)';
    tenantSwitchBtn.style.color = '#9ed8ff';
    tenantSwitchBtn.style.cursor = 'pointer';
    tenantSwitchBtn.style.padding = '6px 10px';
    tenantSwitchBtn.style.borderRadius = '4px';
    tenantSwitchBtn.style.fontSize = '12px';
    tenantSwitchBtn.style.display = 'none';

    function emitSession(data) {
      try {
        window.__openswarmSession = data || null;
        window.dispatchEvent(new CustomEvent('openswarm-auth-session', { detail: data || null }));
      } catch (_e) {}
    }

    function renderMemberships(payload) {
      var items = payload && Array.isArray(payload.items) ? payload.items : [];
      tenantSelect.innerHTML = '';
      if (items.length <= 1) {
        tenantSelect.style.display = 'none';
        tenantSwitchBtn.style.display = 'none';
        return;
      }
      items.forEach(function (item) {
        var op = document.createElement('option');
        op.value = item.tenantId;
        op.textContent = (item.tenantName || item.tenantId || 'tenant') + ' · ' + (item.role || 'member');
        if (item.current) op.selected = true;
        tenantSelect.appendChild(op);
      });
      tenantSelect.style.display = '';
      tenantSwitchBtn.style.display = '';
    }

    btn.addEventListener('click', function () {
      btn.disabled = true;
      rawFetch(LOGOUT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      }).finally(function () {
        toLogin(false);
      });
    });

    shell.appendChild(user);
    shell.appendChild(loginLink);
    shell.appendChild(tenantSelect);
    shell.appendChild(tenantSwitchBtn);
    shell.appendChild(btn);

    if (slot) {
      slot.appendChild(shell);
    } else {
      document.body.appendChild(shell);
    }

    function setLoggedIn(data) {
      var tenant = (data.tenant && data.tenant.id) ? data.tenant.id : 'no-tenant';
      user.textContent = data.user.email + ' @ ' + tenant;
      user.style.display = '';
      loginLink.style.display = 'none';
      btn.style.display = '';
      emitSession(data);
      rawFetch(MEMBERSHIPS_API)
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (payload) { renderMemberships(payload); })
        .catch(function () { renderMemberships(null); });
    }

    function setLoggedOut() {
      user.style.display = 'none';
      loginLink.style.display = '';
      btn.style.display = 'none';
      tenantSelect.style.display = 'none';
      tenantSwitchBtn.style.display = 'none';
      emitSession(null);
    }

    tenantSwitchBtn.addEventListener('click', function () {
      var tenantId = String(tenantSelect.value || '').trim();
      if (!tenantId) return;
      tenantSwitchBtn.disabled = true;
      rawFetch(SWITCH_TENANT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenantId })
      }).then(function (res) {
        return res.ok ? res.json() : res.json().catch(function () { return {}; }).then(function (data) {
          throw new Error(data.error || ('HTTP ' + res.status));
        });
      }).then(function () {
        window.location.reload();
      }).catch(function () {
        tenantSwitchBtn.disabled = false;
      });
    });

    rawFetch(SESSION_API)
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !data.user) {
          setLoggedOut();
          return;
        }
        setLoggedIn(data);
      })
      .catch(function () {
        setLoggedOut();
      });
  }

  window.openswarmAuth = {
    logout: function () {
      return rawFetch(LOGOUT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      }).finally(function () {
        toLogin(false);
      });
    },
    refresh: doRefresh
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addLogoutButton);
  } else {
    addLogoutButton();
  }
})();
