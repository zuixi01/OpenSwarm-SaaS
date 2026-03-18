const fs = require('fs');
const os = require('os');
const path = require('path');

function createYinGatewayService(options) {
  const {
    rootDir,
    mainGatewayPort,
    mainGatewayHttp,
    isPortInUse,
  } = options;

  const STATUS_CACHE_MS = 1000;
  let gatewayStatusCache = { ok: false, at: 0 };

  function getMainGatewayToken() {
    const envToken =
      process.env.OPENSWARM_GATEWAY_TOKEN ||
      process.env.OPENCLAW_GATEWAY_TOKEN ||
      process.env.CLAWDBOT_MAIN_GATEWAY_TOKEN ||
      '';
    if (envToken) return envToken;

    const readTokenFromMoltbot = (filePath) => {
      try {
        if (!fs.existsSync(filePath)) return '';
        const doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const auth = doc.gateway && doc.gateway.auth ? doc.gateway.auth : {};
        return String(auth.token || auth.password || '');
      } catch (_) {
        return '';
      }
    };

    const fromYin = readTokenFromMoltbot(path.join(rootDir, 'yin', 'moltbot.json'));
    if (fromYin) return fromYin;
    return readTokenFromMoltbot(path.join(os.homedir(), '.moltbot', 'moltbot.json'));
  }

  function refreshGatewayStatus() {
    const ok = isPortInUse(mainGatewayPort);
    gatewayStatusCache = { ok, at: Date.now() };
    return ok;
  }

  function getStatusPayload() {
    return {
      configured: true,
      source: 'gateway',
      port: mainGatewayPort,
      command: { configured: true, source: 'gateway', port: mainGatewayPort },
    };
  }

  function getGatewayStatusPayload() {
    const now = Date.now();
    if (now - gatewayStatusCache.at > STATUS_CACHE_MS) refreshGatewayStatus();
    return { ok: gatewayStatusCache.ok, port: mainGatewayPort };
  }

  async function getGatewayHealthPayload() {
    const result = { port: mainGatewayPort, ok: false, error: null };
    try {
      if (!isPortInUse(mainGatewayPort)) {
        result.error = `主控网关未启动（端口 ${mainGatewayPort} 未监听）。请点击「主控·启动」。`;
        return result;
      }
      const headers = { 'Content-Type': 'application/json' };
      const token = getMainGatewayToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`${mainGatewayHttp}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: 'openclaw', messages: [{ role: 'user', content: 'ping' }] }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const body = await response.text();
      if (response.ok) {
        result.ok = true;
      } else {
        result.error = `HTTP ${response.status}: ${body.slice(0, 150) || ''}`;
      }
    } catch (error) {
      result.error = error.message || '连接失败';
    }
    return result;
  }

  setInterval(() => { refreshGatewayStatus(); }, 4000);
  refreshGatewayStatus();

  return {
    getMainGatewayToken,
    refreshGatewayStatus,
    getStatusPayload,
    getGatewayStatusPayload,
    getGatewayHealthPayload,
  };
}

module.exports = {
  createYinGatewayService,
};
