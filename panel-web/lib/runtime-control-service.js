const fs = require('fs');
const os = require('os');
const path = require('path');

function createRuntimeControlService(options) {
  const {
    rootDir,
    panelDir,
    openclawDir,
    openclawNodeCmd,
    mainGatewayPort,
    gatewayMain,
    runtimeAdapter,
    agentRobots,
    parseWorkersConf,
    getWorkerByAgent,
    readAgentLabel,
    isPortInUse,
    execSync,
    spawn,
    spawnSync,
  } = options;

  const panelPorts = new Set([
    mainGatewayPort,
    ...Array.from({ length: 64 }, (_, i) => 18791 + i),
  ]);
  const idFile = (robot) => path.join(panelDir, `.panel-window-${robot}`);
  const first10Ids = ['qian', 'kun', 'tai', 'pi', 'xun', 'yu', 'sui', 'gu', 'lin', 'guan'];

  let portsCache = null;
  let portsCacheTime = 0;
  let lastCpuTotal = null;
  let lastCpuIdle = null;

  function clearPortsCache() {
    portsCache = null;
    portsCacheTime = 0;
  }

  function syncGatewayPortFromWorkersConf() {
    const rows = parseWorkersConf();
    let synced = 0;
    rows.forEach((r) => {
      const moltbPath = path.join(r.stateDir, 'moltbot.json');
      try {
        if (!fs.existsSync(moltbPath)) return;
        const raw = fs.readFileSync(moltbPath, 'utf8');
        const j = JSON.parse(raw);
        j.gateway = j.gateway || {};
        const portNum = parseInt(r.port, 10);
        if (j.gateway.port !== portNum) {
          j.gateway.port = portNum;
          fs.writeFileSync(moltbPath, JSON.stringify(j, null, 2), 'utf8');
          synced += 1;
        }
      } catch (_) {}
    });
    if (synced > 0) console.log('[panel] 已按 workers.conf 同步 %d 个员工的 gateway.port', synced);
  }

  function syncBrowserConfigInMoltbot() {
    const rows = parseWorkersConf();
    let updated = 0;
    rows.forEach((r) => {
      const moltbPath = path.join(r.stateDir, 'moltbot.json');
      try {
        if (!fs.existsSync(moltbPath)) return;
        const raw = fs.readFileSync(moltbPath, 'utf8');
        const j = JSON.parse(raw);
        j.browser = j.browser || {};
        j.browser.ssrfPolicy = j.browser.ssrfPolicy || {};
        const nextAllowed = new Set(Array.isArray(j.browser.ssrfPolicy.allowedHostnames) ? j.browser.ssrfPolicy.allowedHostnames : []);
        nextAllowed.add('localhost');
        nextAllowed.add('127.0.0.1');
        nextAllowed.add('::1');
        if (
          j.browser.enabled !== true ||
          j.browser.ssrfPolicy.dangerouslyAllowPrivateNetwork !== true ||
          nextAllowed.size !== (Array.isArray(j.browser.ssrfPolicy.allowedHostnames) ? j.browser.ssrfPolicy.allowedHostnames.length : 0)
        ) {
          j.browser.enabled = true;
          j.browser.ssrfPolicy.dangerouslyAllowPrivateNetwork = true;
          j.browser.ssrfPolicy.allowedHostnames = Array.from(nextAllowed);
          fs.writeFileSync(moltbPath, JSON.stringify(j, null, 2), 'utf8');
          updated += 1;
        }
      } catch (_) {}
    });
    if (updated > 0) console.log('[panel] 已同步 %d 个员工的 browser/SSRF 配置', updated);
  }

  function getPortsInUse() {
    const now = Date.now();
    if (portsCache && now - portsCacheTime < 500) return portsCache;
    const inUse = new Set();
    try {
      if (process.platform === 'win32') {
        const out = execSync('netstat -an', { encoding: 'utf8', maxBuffer: 256 * 1024 });
        const re = /:(\d+)\s+.*LISTENING/gi;
        let m;
        while ((m = re.exec(out)) !== null) {
          const p = parseInt(m[1], 10);
          if (panelPorts.has(p)) inUse.add(p);
        }
      } else {
        const out = execSync('lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null', { encoding: 'utf8', maxBuffer: 256 * 1024 });
        const re = /:(\d+)\s*\(LISTEN\)/g;
        let m;
        while ((m = re.exec(out)) !== null) {
          const p = parseInt(m[1], 10);
          if (panelPorts.has(p)) inUse.add(p);
        }
      }
    } catch (_) {}
    portsCache = inUse;
    portsCacheTime = now;
    return inUse;
  }

  function tryFocusExistingTerminal(robot) {
    if (process.platform !== 'darwin') return false;
    let winId = '';
    try {
      winId = fs.readFileSync(idFile(robot), 'utf8').trim();
    } catch (_) {}
    if (!winId) return false;
    const script = [
      'tell application "Terminal"',
      `  try`,
      `    set w to window id ${winId}`,
      '    set index of w to 1',
      '    activate',
      '    return true',
      '  on error',
      '    return false',
      '  end try',
      'end tell',
    ].join('\n');
    try {
      const r = spawnSync('osascript', ['-e', script], { encoding: 'utf8', maxBuffer: 64 });
      const ok = (r.stdout && r.stdout.trim()) === 'true';
      if (!ok && winId) {
        try { fs.unlinkSync(idFile(robot)); } catch (_) {}
      }
      return ok;
    } catch (_) {
      if (winId) {
        try { fs.unlinkSync(idFile(robot)); } catch (_) {}
      }
      return false;
    }
  }

  function runTerminalScript(robot, shellCmd) {
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    if (isMac) {
      const cmdStr = JSON.stringify(shellCmd);
      const script = [
        `tell application "Terminal" to do script ${cmdStr}`,
        'delay 0.6',
        'tell application "Terminal" to return id of front window',
      ].join('\n');
      const r = spawnSync('osascript', ['-e', script], { encoding: 'utf8', maxBuffer: 1024 });
      const winId = (r.stdout && r.stdout.trim()) || '';
      if (winId) {
        try { fs.writeFileSync(idFile(robot), winId, 'utf8'); } catch (_) {}
      }
      return;
    }

    if (isWin) {
      const rootForBash = rootDir.replace(/\\/g, '/');
      const innerCmd = `cd "${rootForBash}" && ${shellCmd}`;
      const gitBashPaths = [
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Git', 'bin', 'bash.exe'),
      ];
      const bashExe = gitBashPaths.find((p) => fs.existsSync(p)) || 'bash';
      const child = spawn('cmd.exe', ['/c', 'start', '', bashExe, '-c', innerCmd], {
        cwd: rootDir,
        windowsHide: false,
        stdio: 'ignore',
        detached: true,
      });
      child.unref();
      return;
    }

    const bashCmd = `${shellCmd}; exec bash`;
    const termOpts = [
      ['gnome-terminal', '--', 'bash', '-c', bashCmd],
      ['xterm', '-e', 'bash', '-c', bashCmd],
      ['x-terminal-emulator', '-e', 'bash', '-c', bashCmd],
      ['konsole', '-e', 'bash', '-c', bashCmd],
    ];
    for (const [exe, ...args] of termOpts) {
      const r = spawnSync(exe, args, { cwd: rootDir, stdio: 'ignore', shell: false });
      if (!r.error) break;
    }
  }

  function stopAndCloseTerminal(robot) {
    let winId = '';
    try {
      winId = fs.readFileSync(idFile(robot), 'utf8').trim();
    } catch (_) {}
    try { fs.unlinkSync(idFile(robot)); } catch (_) {}
    if (!winId) return Promise.resolve();
    const script = [
      'tell application "Terminal"',
      '  try',
      `    set w to window id ${winId}`,
      '    set the_tab to tab 1 of w',
      '    do script "exit" in the_tab',
      '    delay 0.3',
      '    close w',
      '  end try',
      'end tell',
    ].join('\n');
    return new Promise((resolve) => {
      const child = spawn('osascript', ['-e', script], { stdio: 'ignore' });
      child.on('close', () => resolve());
      child.on('error', () => resolve());
    });
  }

  function listRobots(options = {}) {
    if (options.nocache) clearPortsCache();
    const inUse = getPortsInUse();
    const list = [
      { id: 'main', name: '主控', desc: 'Command · 控制中枢', gateway: gatewayMain, running: inUse.has(mainGatewayPort) },
    ];
    agentRobots.forEach((agent) => {
      const worker = getWorkerByAgent(agent.id);
      const port = worker ? worker.port : (18790 + agent.workerId);
      const portNum = parseInt(port, 10);
      list.push({
        id: agent.id,
        name: agent.name,
        desc: 'OpenSwarm Agent',
        gateway: process.env[`GATEWAY_${agent.id.toUpperCase()}`] || `ws://127.0.0.1:${port}`,
        port: portNum,
        running: inUse.has(portNum),
        label: readAgentLabel(agent.id),
      });
    });
    return list;
  }

  function getMacOSUsedMemory() {
    try {
      const out = execSync('vm_stat', { encoding: 'utf8', maxBuffer: 8192 });
      const pageSizeMatch = out.match(/page size of (\d+) bytes/);
      const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 4096;
      const num = (name) => {
        const m = out.match(new RegExp(`${name}:\\s*(\\d+)`));
        return m ? parseInt(m[1], 10) : 0;
      };
      const free = num('Pages free');
      const inactive = num('Pages inactive');
      const speculative = num('Pages speculative');
      const availableBytes = (free + inactive + speculative) * pageSize;
      const totalMem = os.totalmem();
      const usedMem = Math.max(0, totalMem - availableBytes);
      return { usedMem, totalMem };
    } catch (_) {
      return null;
    }
  }

  function getMacOSSwapUsed() {
    if (process.platform !== 'darwin') return null;
    try {
      const out = execSync('sysctl vm.swapusage', { encoding: 'utf8', maxBuffer: 1024 });
      const m = out.match(/used\s*=\s*([\d.]+)\s*([KMGT]?)/i);
      if (!m) return null;
      let bytes = parseFloat(m[1]);
      const unit = (m[2] || 'B').toUpperCase();
      if (unit === 'K') bytes *= 1024;
      else if (unit === 'M') bytes *= 1024 * 1024;
      else if (unit === 'G') bytes *= 1024 * 1024 * 1024;
      return Math.round(bytes);
    } catch (_) {
      return null;
    }
  }

  function getLoadAvg() {
    const nativeLoad = os.loadavg();
    const allZero = nativeLoad[0] === 0 && nativeLoad[1] === 0 && nativeLoad[2] === 0;
    if (!allZero) return nativeLoad;
    if (process.platform === 'darwin') {
      try {
        const out = execSync('sysctl -n vm.loadavg', { encoding: 'utf8', maxBuffer: 128 });
        const m = out.match(/\{\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\}/);
        if (m) return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
      } catch (_) {}
    }
    return nativeLoad;
  }

  function getCpuCount() {
    const list = os.cpus();
    if (list && list.length > 0) return list.length;
    if (process.platform === 'darwin') {
      try {
        const n = parseInt(execSync('sysctl -n hw.ncpu', { encoding: 'utf8', maxBuffer: 32 }).trim(), 10);
        return Number.isNaN(n) ? 1 : Math.max(1, n);
      } catch (_) {}
    }
    return 1;
  }

  function getCpuUsagePercent() {
    const cpus = os.cpus();
    if (!cpus || cpus.length === 0) return null;
    let total = 0;
    let idle = 0;
    for (const cpu of cpus) {
      const t = cpu.times;
      total += t.user + t.nice + t.sys + t.idle + (t.irq || 0);
      idle += t.idle;
    }
    if (lastCpuTotal !== null && lastCpuIdle !== null && total > lastCpuTotal) {
      const deltaTotal = total - lastCpuTotal;
      const deltaIdle = idle - lastCpuIdle;
      const pct = Math.round((1 - deltaIdle / deltaTotal) * 100);
      lastCpuTotal = total;
      lastCpuIdle = idle;
      return Math.min(100, Math.max(0, pct));
    }
    lastCpuTotal = total;
    lastCpuIdle = idle;
    return null;
  }

  function getSystemStats() {
    const totalMem = os.totalmem();
    let usedMem;
    if (process.platform === 'darwin') {
      const mac = getMacOSUsedMemory();
      usedMem = mac ? mac.usedMem : totalMem - os.freemem();
    } else {
      usedMem = totalMem - os.freemem();
    }
    const memoryUsedPercent = Math.round((usedMem / totalMem) * 100);
    const loadAvg = getLoadAvg();
    const cpus = getCpuCount();
    const cpuUsagePercent = getCpuUsagePercent();
    const swapUsedBytes = getMacOSSwapUsed();
    const swapUsedMB = swapUsedBytes != null ? Math.round(swapUsedBytes / 1024 / 1024) : null;
    const hexRunning = listRobots().filter((r) => r.id !== 'main' && r.running).length;
    const warnings = [];
    if (memoryUsedPercent >= 90) warnings.push({ level: 'danger', text: `内存占用 ${memoryUsedPercent}%，建议少开或关闭部分机器人` });
    else if (memoryUsedPercent >= 80) warnings.push({ level: 'warn', text: `内存占用 ${memoryUsedPercent}%，注意负载` });
    const load1 = loadAvg[0];
    if (cpus > 0 && load1 >= cpus * 2) warnings.push({ level: 'danger', text: `CPU 负载过高 (1min=${load1.toFixed(1)})，建议减少并发` });
    else if (cpus > 0 && load1 >= cpus * 1.2) warnings.push({ level: 'warn', text: `CPU 负载偏高 (1min=${load1.toFixed(1)})` });
    if (swapUsedMB != null) {
      const swapThreshold = hexRunning > 0 ? 2048 : 4096;
      if (swapUsedMB >= swapThreshold) {
        warnings.push({
          level: hexRunning > 0 ? 'danger' : 'warn',
          text: `交换已用 ${swapUsedMB} MB${hexRunning > 0 ? '，内存吃紧' : '（员工已关闭，可能由其他应用占用）'}`,
        });
      }
    }
    return {
      memoryUsedPercent,
      memoryUsedMB: Math.round(usedMem / 1024 / 1024),
      memoryTotalMB: Math.round(totalMem / 1024 / 1024),
      loadAvg1: Math.round(loadAvg[0] * 10) / 10,
      loadAvg5: Math.round(loadAvg[1] * 10) / 10,
      cpus,
      cpuUsagePercent,
      swapUsedMB,
      warnings,
      alert: warnings.some((w) => w.level === 'danger'),
    };
  }

  function openRobotTui(robot) {
    if (robot === 'main') {
      if (tryFocusExistingTerminal('main')) return { ok: true, reused: true };
      const yinStartScript = path.join(rootDir, 'yin', 'start-yin.sh');
      runTerminalScript('main', `bash "${yinStartScript}"`);
      return { ok: true };
    }
    const worker = getWorkerByAgent(robot);
    if (worker) {
      const agent = agentRobots.find((h) => h.id === robot);
      const titlePrefix = agent ? `printf '\\033]0;${agent.name} - openclaw\\007'; ` : '';
      const token = worker.token ? `OPENCLAW_GATEWAY_TOKEN=${worker.token} ` : '';
      runtimeAdapter.ensureWorkerGateway(worker, { restart: true, waitSeconds: 12 });
      if (tryFocusExistingTerminal(robot)) return { ok: true, reused: true };
      const cmd = `${titlePrefix}cd ${openclawDir} && OPENCLAW_STATE_DIR="${worker.stateDir}" OPENCLAW_GATEWAY_PORT=${worker.port} ${token}${openclawNodeCmd} openclaw.mjs tui`;
      runTerminalScript(robot, cmd);
      clearPortsCache();
      return { ok: true };
    }
    if (robot === 'yang') return { error: { status: 400, message: '敬请期待2.0版本' } };
    return { error: { status: 400, message: 'unknown robot' } };
  }

  function startFirstTen() {
    const results = { started: [], failed: [] };
    for (let i = 0; i < first10Ids.length; i += 1) {
      const robot = first10Ids[i];
      try {
        const worker = getWorkerByAgent(robot);
        if (!worker) {
          results.failed.push({ robot, error: 'unknown' });
          continue;
        }
        const agent = agentRobots.find((h) => h.id === robot);
        const titlePrefix = agent ? `printf '\\033]0;${agent.name} - openclaw\\007'; ` : '';
        const token = worker.token ? `OPENCLAW_GATEWAY_TOKEN=${worker.token} ` : '';
        runtimeAdapter.ensureWorkerGateway(worker, { restart: true, waitSeconds: 12 });
        const cmd = `${titlePrefix}cd ${openclawDir} && OPENCLAW_STATE_DIR="${worker.stateDir}" OPENCLAW_GATEWAY_PORT=${worker.port} ${token}${openclawNodeCmd} openclaw.mjs tui`;
        runTerminalScript(robot, cmd);
        results.started.push(agent ? agent.name : robot);
      } catch (err) {
        results.failed.push({ robot, error: err.message || String(err) });
      }
      if (i < first10Ids.length - 1) {
        try { execSync('sleep 1.5', { stdio: 'pipe' }); } catch (_) {}
      }
    }
    clearPortsCache();
    return { ok: true, started: results.started, failed: results.failed };
  }

  async function closeAllAgentTerminals() {
    const toClose = [];
    agentRobots.forEach((agent) => {
      try {
        if (fs.existsSync(idFile(agent.id))) toClose.push(agent.id);
      } catch (_) {}
    });

    try {
      const hexPorts = Array.from({ length: 64 }, (_, i) => 18791 + i);
      for (const port of hexPorts) {
        try {
          const pids = execSync(`lsof -iTCP:${port} -sTCP:LISTEN -P -n -t 2>/dev/null || true`, {
            encoding: 'utf8',
            stdio: 'pipe',
          }).trim();
          if (pids) {
            pids.split(/\s+/).forEach((pid) => {
              const p = parseInt(pid.trim(), 10);
              if (p > 0) {
                try { process.kill(p, 'SIGKILL'); } catch (_) {}
              }
            });
          }
        } catch (_) {}
      }
    } catch (_) {}

    try {
      execSync('pkill -9 -x openclaw 2>/dev/null || true', { encoding: 'utf8', stdio: 'pipe' });
    } catch (_) {}

    toClose.forEach((robot) => {
      try { stopAndCloseTerminal(robot); } catch (_) {}
    });
    clearPortsCache();
    return { ok: true, closed: toClose.length };
  }

  async function stopRobot(robot, body = {}) {
    if (robot === 'main') {
      try {
        const pids = execSync(`lsof -iTCP:${mainGatewayPort} -t 2>/dev/null || true`, {
          encoding: 'utf8',
          stdio: 'pipe',
        }).trim();
        if (pids) {
          pids.split(/\s+/).forEach((pid) => {
            const p = parseInt(pid.trim(), 10);
            if (p > 0) {
              try { process.kill(p, 'SIGKILL'); } catch (_) {}
            }
          });
        }
      } catch (_) {}
      runtimeAdapter.stopMainGateway();
      stopAndCloseTerminal('main');
      clearPortsCache();
      return { ok: true };
    }

    const worker = getWorkerByAgent(robot);
    if (!worker) return { error: { status: 400, message: 'unknown robot' } };
    const bodyPort = body && body.port != null ? parseInt(body.port, 10) : Number.NaN;
    const port = Number.isFinite(bodyPort) ? bodyPort : parseInt(worker.port, 10);
    if (!Number.isFinite(port)) return { error: { status: 500, message: 'invalid port' } };
    runtimeAdapter.stopGatewayByPort(port);
    try {
      const pids = execSync(`lsof -iTCP:${port} -t 2>/dev/null || true`, {
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim();
      if (pids) {
        pids.split(/\s+/).forEach((pid) => {
          const p = parseInt(pid.trim(), 10);
          if (p > 0) {
            try { process.kill(p, 'SIGKILL'); } catch (_) {}
          }
        });
      }
    } catch (_) {}
    stopAndCloseTerminal(robot);
    clearPortsCache();
    return { ok: true };
  }

  return {
    clearPortsCache,
    syncGatewayPortFromWorkersConf,
    syncBrowserConfigInMoltbot,
    listRobots,
    getSystemStats,
    openRobotTui,
    startFirstTen,
    closeAllAgentTerminals,
    stopRobot,
  };
}

module.exports = {
  createRuntimeControlService,
};
