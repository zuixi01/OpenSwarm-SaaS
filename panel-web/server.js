#!/usr/bin/env node
/**
 * Yinova 面板：阴（平台总控网关）+ 易经 64 卦控制
 * - 阴：点启动 → 弹终端运行 start-yin.sh（网关 + TUI）。
 * - 乾～未济：点启动 → 若对应端口未占用会先自动起网关，再弹终端开 TUI（一键启动）。
 */
const express = require('express');
const cors = require('cors');
const { spawn, spawnSync, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 确保任何错误都返回 JSON，避免前端收到 HTML 报错页
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('[express error]', err.message || err);
  res.status(err.status || 500).json({ error: err.message || '服务器错误', replies: req.url.includes('hex/chat') ? [] : undefined });
});

const homedir = os.homedir();
const GATEWAY_MAIN = process.env.GATEWAY_MAIN || 'ws://127.0.0.1:18789';

// 易经 64 卦（对应 workers.conf 1～64）
const HEXAGRAM_ROBOTS = [
  { id: 'qian', name: '乾', workerId: 1 },
  { id: 'kun', name: '坤', workerId: 2 },
  { id: 'tai', name: '泰', workerId: 3 },
  { id: 'pi', name: '否', workerId: 4 },
  { id: 'xun', name: '谦', workerId: 5 },
  { id: 'yu', name: '豫', workerId: 6 },
  { id: 'sui', name: '随', workerId: 7 },
  { id: 'gu', name: '蛊', workerId: 8 },
  { id: 'lin', name: '临', workerId: 9 },
  { id: 'guan', name: '观', workerId: 10 },
  { id: 'h11', name: '屯', workerId: 11 },
  { id: 'h12', name: '蒙', workerId: 12 },
  { id: 'h13', name: '需', workerId: 13 },
  { id: 'h14', name: '讼', workerId: 14 },
  { id: 'h15', name: '师', workerId: 15 },
  { id: 'h16', name: '比', workerId: 16 },
  { id: 'h17', name: '小畜', workerId: 17 },
  { id: 'h18', name: '履', workerId: 18 },
  { id: 'h19', name: '同人', workerId: 19 },
  { id: 'h20', name: '大有', workerId: 20 },
  { id: 'h21', name: '噬嗑', workerId: 21 },
  { id: 'h22', name: '贲', workerId: 22 },
  { id: 'h23', name: '剥', workerId: 23 },
  { id: 'h24', name: '复', workerId: 24 },
  { id: 'h25', name: '无妄', workerId: 25 },
  { id: 'h26', name: '大畜', workerId: 26 },
  { id: 'h27', name: '颐', workerId: 27 },
  { id: 'h28', name: '大过', workerId: 28 },
  { id: 'h29', name: '坎', workerId: 29 },
  { id: 'h30', name: '离', workerId: 30 },
  { id: 'h31', name: '咸', workerId: 31 },
  { id: 'h32', name: '恒', workerId: 32 },
  { id: 'h33', name: '遯', workerId: 33 },
  { id: 'h34', name: '大壮', workerId: 34 },
  { id: 'h35', name: '晋', workerId: 35 },
  { id: 'h36', name: '明夷', workerId: 36 },
  { id: 'h37', name: '家人', workerId: 37 },
  { id: 'h38', name: '睽', workerId: 38 },
  { id: 'h39', name: '蹇', workerId: 39 },
  { id: 'h40', name: '解', workerId: 40 },
  { id: 'h41', name: '损', workerId: 41 },
  { id: 'h42', name: '益', workerId: 42 },
  { id: 'h43', name: '夬', workerId: 43 },
  { id: 'h44', name: '姤', workerId: 44 },
  { id: 'h45', name: '萃', workerId: 45 },
  { id: 'h46', name: '升', workerId: 46 },
  { id: 'h47', name: '困', workerId: 47 },
  { id: 'h48', name: '井', workerId: 48 },
  { id: 'h49', name: '革', workerId: 49 },
  { id: 'h50', name: '鼎', workerId: 50 },
  { id: 'h51', name: '震', workerId: 51 },
  { id: 'h52', name: '艮', workerId: 52 },
  { id: 'h53', name: '渐', workerId: 53 },
  { id: 'h54', name: '归妹', workerId: 54 },
  { id: 'h55', name: '丰', workerId: 55 },
  { id: 'h56', name: '旅', workerId: 56 },
  { id: 'h57', name: '巽', workerId: 57 },
  { id: 'h58', name: '兑', workerId: 58 },
  { id: 'h59', name: '涣', workerId: 59 },
  { id: 'h60', name: '节', workerId: 60 },
  { id: 'h61', name: '中孚', workerId: 61 },
  { id: 'h62', name: '小过', workerId: 62 },
  { id: 'h63', name: '既济', workerId: 63 },
  { id: 'h64', name: '未济', workerId: 64 },
];

const ROOT_DIR = path.join(__dirname, '..');  // Yinova项目根目录
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || path.join(ROOT_DIR, 'openclaw');
const CONFIG_FILE = path.join(ROOT_DIR, 'config.json');
const WORKERS_CONF = path.join(ROOT_DIR, 'workers.conf');
const START_WORKER_SH = path.join(ROOT_DIR, 'start-worker.sh');
const STOP_WORKER_SH = path.join(ROOT_DIR, 'stop-worker.sh');

function parseWorkersConf() {
  const out = [];
  try {
    const raw = fs.readFileSync(WORKERS_CONF, 'utf8');
    raw.split('\n').forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length >= 3) {
        let stateDir = parts[1];
        if (stateDir && stateDir[0] !== '/' && stateDir[0] !== '~') {
          stateDir = path.join(ROOT_DIR, stateDir);
        }
        out.push({ workerId: parts[0], stateDir, port: parts[2], token: parts[3] || '' });
      }
    });
  } catch (_) {}
  return out;
}

function getWorkerByHex(robotId) {
  const hex = HEXAGRAM_ROBOTS.find((h) => h.id === robotId);
  if (!hex) return null;
  const rows = parseWorkersConf();
  return rows.find((r) => String(r.workerId) === String(hex.workerId));
}

// 以 workers.conf 为唯一来源，把每卦的 gateway.port 写回该卦目录下的 moltbot.json，保证本地网关地址一致
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
        synced++;
      }
    } catch (_) {}
  });
  if (synced > 0) console.log('[panel] 已按 workers.conf 同步 %d 个卦的 gateway.port', synced);
}

// 全部卦禁用浏览器(CDP)：不占用 18860–18923，各卦 moltbot.json 中 browser.enabled = false
function syncDisableBrowserInMoltbot() {
  const rows = parseWorkersConf();
  let updated = 0;
  rows.forEach((r) => {
    const moltbPath = path.join(r.stateDir, 'moltbot.json');
    try {
      if (!fs.existsSync(moltbPath)) return;
      const raw = fs.readFileSync(moltbPath, 'utf8');
      const j = JSON.parse(raw);
      j.browser = j.browser || {};
      if (j.browser.enabled !== false) {
        j.browser.enabled = false;
        fs.writeFileSync(moltbPath, JSON.stringify(j, null, 2), 'utf8');
        updated++;
      }
    } catch (_) {}
  });
  if (updated > 0) console.log('[panel] 已禁用 %d 个卦的 browser(CDP)', updated);
}

const ID_FILE = (robot) => path.join(__dirname, '.panel-window-' + robot);

// 状态检测逻辑：只看「网关端口是否在监听」——某卦 running = 该卦在 workers.conf 中的端口有进程 LISTEN
// 数据来源：lsof -iTCP -sTCP:LISTEN -P -n，解析出 18789/18790/18791～18854 中哪些在监听
// 注意：未通过面板点击启动也可能显示 running（例如上次残留的 gateway 进程仍占端口），用户可点「停止」或「一键关闭所有终端」释放
const PANEL_PORTS = new Set([
  18789,
  ...Array.from({ length: 64 }, (_, i) => 18791 + i),
]);
let _portsCache = null;
let _portsCacheTime = 0;
function getPortsInUse() {
  const now = Date.now();
  if (_portsCache && now - _portsCacheTime < 500) return _portsCache;
  const inUse = new Set();
  try {
    const out = execSync('lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null', { encoding: 'utf8', maxBuffer: 256 * 1024 });
    const re = /:(\d+)\s*\(LISTEN\)/g;
    let m;
    while ((m = re.exec(out)) !== null) {
      const p = parseInt(m[1], 10);
      if (PANEL_PORTS.has(p)) inUse.add(p);
    }
  } catch (_) {}
  _portsCache = inUse;
  _portsCacheTime = now;
  return inUse;
}

function isPortInUse(port) {
  try {
    execSync('lsof -ti :' + port, { stdio: 'pipe' });
    return true;
  } catch (_) {
    return false;
  }
}

function findFreePort(start, exclude) {
  const excl = new Set(exclude || []);
  for (let p = start; p < 65536; p++) {
    if (excl.has(p)) continue;
    if (!isPortInUse(p)) return p;
  }
  return start;
}

function findFreePortBlock(start, count, exclude) {
  const excl = new Set(exclude || []);
  for (let s = start; s < 65536 - count; s++) {
    let ok = true;
    for (let i = 0; i < count; i++) {
      const p = s + i;
      if (excl.has(p) || isPortInUse(p)) { ok = false; break; }
    }
    if (ok) return s;
  }
  return start;
}

// 后台启动 moltbot gateway（乾～未济）：直接调用 start-worker.sh，与 panel-full.sh start <id> 一致
function startGatewayInBackground(worker) {
  if (!worker || !worker.workerId) return;
  const env = { ...getConfigEnv(), RUN_GATEWAY_BACKGROUND: '1' };
  // 清除代理，让 openclaw 直连智谱 API
  delete env.http_proxy; delete env.https_proxy;
  delete env.HTTP_PROXY; delete env.HTTPS_PROXY;
  delete env.ALL_PROXY; delete env.all_proxy;
  const child = spawn('bash', [START_WORKER_SH, String(worker.workerId)], {
    cwd: ROOT_DIR,
    env,
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
}

// 后台启动阴 gateway：端口 18789，使用项目内 openclaw
const MAIN_GATEWAY_PORT = parseInt((GATEWAY_MAIN || '').replace(/.*:(\d+)$/, '$1'), 10) || 18789;
const MAIN_GATEWAY_LOG = path.join(os.tmpdir(), 'yinova-main.log');
function startMainGatewayInBackground() {
  const yinDir = path.join(ROOT_DIR, 'yin');
  const cmd = `cd ${OPENCLAW_DIR} && OPENCLAW_STATE_DIR="${yinDir}" OPENCLAW_GATEWAY_PORT=${MAIN_GATEWAY_PORT} nohup node openclaw.mjs gateway </dev/null >> "${MAIN_GATEWAY_LOG}" 2>&1 &`;
  const env = getConfigEnv();
  delete env.http_proxy; delete env.https_proxy;
  delete env.HTTP_PROXY; delete env.HTTPS_PROXY;
  delete env.ALL_PROXY; delete env.all_proxy;
  const child = spawn('bash', ['-c', cmd], { stdio: 'ignore', detached: true, env });
  child.unref();
}

// 启动：do script 后取新窗口的 id 写入文件，便于停止时精确关闭
function runTerminalScript(robot, shellCmd) {
  const cmdStr = JSON.stringify(shellCmd);
  const script = [
    'tell application "Terminal" to do script ' + cmdStr,
    'delay 0.6',
    'tell application "Terminal" to return id of front window'
  ].join('\n');
  const r = spawnSync('osascript', ['-e', script], { encoding: 'utf8', maxBuffer: 1024 });
  const id = (r.stdout && r.stdout.trim()) || '';
  if (id) {
    try { fs.writeFileSync(ID_FILE(robot), id, 'utf8'); } catch (_) {}
  }
}

// 停止：置前窗口 → Control+C 让进程退出 → 等 2s → Control+D → 关窗；返回 Promise，便于一键关闭时逐个等待
function stopAndCloseTerminal(robot) {
  let winId = '';
  try {
    winId = fs.readFileSync(ID_FILE(robot), 'utf8').trim();
  } catch (_) {}
  // 无论终端窗口是否存在，都清理 ID 文件
  try { fs.unlinkSync(ID_FILE(robot)); } catch (_) {}
  if (!winId) return Promise.resolve();
  // 先在该终端窗口执行 exit 命令让 shell 退出，再关闭窗口
  // 使用 do script 在指定 tab 执行 exit，然后延迟关闭窗口
  // 不弹"终止进程"确认框
  const script = [
    'tell application "Terminal"',
    '  try',
    '    set w to window id ' + winId,
    '    set the_tab to tab 1 of w',
    '    do script "exit" in the_tab',
    '    delay 0.3',
    '    close w',
    '  end try',
    'end tell'
  ].join('\n');
  return new Promise((resolve) => {
    const child = spawn('osascript', ['-e', script], { stdio: 'ignore' });
    child.on('close', () => resolve());
    child.on('error', () => resolve());
  });
}

// 机器人列表（含网关、运行状态），供前端展示与呼吸光效；一次 lsof 查全量端口，避免 CPU/发热
function getRobotsList() {
  const inUse = getPortsInUse();
  const mainPort = parseInt((GATEWAY_MAIN || '').replace(/.*:(\d+)$/, '$1'), 10) || 18789;
  const list = [
    { id: 'main', name: '阴', desc: '阴 · 平台总控', gateway: GATEWAY_MAIN, running: inUse.has(mainPort) },
  ];
  HEXAGRAM_ROBOTS.forEach((h) => {
    const w = getWorkerByHex(h.id);
    const port = w ? w.port : (18790 + h.workerId);
    const portNum = parseInt(port, 10);
    const gw = process.env['GATEWAY_' + h.id.toUpperCase()] || ('ws://127.0.0.1:' + port);
    list.push({
      id: h.id,
      name: h.name,
      desc: 'Yinova 卦',
      gateway: gw,
      port: portNum,
      running: inUse.has(portNum),
      label: readHexLabel(h.id),
    });
  });
  return list;
}
app.get('/api/robots', (req, res) => {
  // ?nocache=1 时强制跳过缓存（如前端检测到状态变化时）
  if (req.query.nocache) {
    _portsCache = null;
    _portsCacheTime = 0;
  }
  res.json(getRobotsList());
});

// 配置：从 openclaw 的 pi-ai 模型目录加载，确保与 openclaw 支持的 provider/model 一致
const ENV_MAP = {
  zai: 'ZAI_API_KEY', openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', opencode: 'OPENCODE_API_KEY',
  google: 'GEMINI_API_KEY', openrouter: 'OPENROUTER_API_KEY', xai: 'XAI_API_KEY', mistral: 'MISTRAL_API_KEY',
  groq: 'GROQ_API_KEY', cerebras: 'CEREBRAS_API_KEY', huggingface: 'HUGGINGFACE_HUB_TOKEN',
  'github-copilot': 'COPILOT_GITHUB_TOKEN', 'kimi-coding': 'KIMI_API_KEY', minimax: 'MINIMAX_API_KEY',
  'minimax-cn': 'MINIMAX_API_KEY', 'vercel-ai-gateway': 'AI_GATEWAY_API_KEY',
  'google-vertex': '', 'google-antigravity': '', 'google-gemini-cli': '', 'openai-codex': '',
  'amazon-bedrock': 'AWS_ACCESS_KEY_ID', 'azure-openai-responses': 'AZURE_OPENAI_API_KEY',
};
const LABEL_MAP = {
  zai: '智谱 ZAI', openai: 'OpenAI', anthropic: 'Anthropic', opencode: 'OpenCode Zen', google: 'Google Gemini',
  openrouter: 'OpenRouter', xai: 'xAI', mistral: 'Mistral', groq: 'Groq', cerebras: 'Cerebras',
  huggingface: 'Hugging Face', 'github-copilot': 'GitHub Copilot', 'kimi-coding': 'Kimi Coding',
  minimax: 'MiniMax', 'minimax-cn': 'MiniMax 国内', 'vercel-ai-gateway': 'Vercel AI Gateway',
  'amazon-bedrock': 'Amazon Bedrock', 'azure-openai-responses': 'Azure OpenAI',
};
const URL_MAP = {
  zai: 'https://open.bigmodel.cn', openai: 'https://platform.openai.com', anthropic: 'https://console.anthropic.com',
  opencode: 'https://opencode.com', google: 'https://aistudio.google.com', openrouter: 'https://openrouter.ai',
  xai: 'https://x.ai', mistral: 'https://mistral.ai', groq: 'https://console.groq.com', cerebras: 'https://www.cerebras.net',
  huggingface: 'https://huggingface.co', 'kimi-coding': 'https://platform.moonshot.cn', minimax: 'https://api.minimax.chat',
  'vercel-ai-gateway': 'https://vercel.com',
};
// 自定义 provider（model-providers 文档，pi-ai 可能不包含）
const CUSTOM_PROVIDERS = {
  moonshot: { envKey: 'MOONSHOT_API_KEY', label: 'Moonshot Kimi', url: 'https://platform.moonshot.cn', models: [
    { id: 'moonshot/kimi-k2.5', name: 'Kimi K2.5' }, { id: 'moonshot/kimi-k2-0905-preview', name: 'Kimi K2 0905' },
    { id: 'moonshot/kimi-k2-turbo-preview', name: 'Kimi K2 Turbo' }, { id: 'moonshot/kimi-k2-thinking', name: 'Kimi K2 Thinking' },
    { id: 'moonshot/kimi-k2-thinking-turbo', name: 'Kimi K2 Thinking Turbo' }
  ]},
  volcengine: { envKey: 'VOLCANO_ENGINE_API_KEY', label: '火山引擎 Doubao', url: 'https://www.volcengine.com', models: [
    { id: 'volcengine/doubao-seed-1-8-251228', name: 'Doubao Seed 1.8' }, { id: 'volcengine/doubao-seed-code-preview-251028', name: 'Doubao Seed Code' },
    { id: 'volcengine/kimi-k2-5-260127', name: 'Kimi K2.5' }, { id: 'volcengine/glm-4-7-251222', name: 'GLM 4.7' },
    { id: 'volcengine/deepseek-v3-2-251201', name: 'DeepSeek V3.2' }
  ]},
  byteplus: { envKey: 'BYTEPLUS_API_KEY', label: 'BytePlus ARK', url: 'https://www.byteplus.com', models: [
    { id: 'byteplus/seed-1-8-251228', name: 'Seed 1.8' }, { id: 'byteplus/kimi-k2-5-260127', name: 'Kimi K2.5' },
    { id: 'byteplus/glm-4-7-251222', name: 'GLM 4.7' }
  ]},
  synthetic: { envKey: 'SYNTHETIC_API_KEY', label: 'Synthetic', url: 'https://synthetic.new', models: [
    { id: 'synthetic/hf:MiniMaxAI/MiniMax-M2.1', name: 'MiniMax M2.1' }
  ]},
  ollama: { envKey: '', label: 'Ollama 本地', url: 'https://ollama.ai', models: [
    { id: 'ollama/llama3.3', name: 'Llama 3.3' }, { id: 'ollama/qwen2.5', name: 'Qwen 2.5' }
  ]},
  vllm: { envKey: '', label: 'vLLM 本地', url: 'http://127.0.0.1:8000', models: [
    { id: 'vllm/default', name: '默认模型' }
  ]},
  litellm: { envKey: 'LITELLM_API_KEY', label: 'LiteLLM', url: 'https://docs.litellm.ai', models: [
    { id: 'litellm/anthropic/claude-sonnet-4-5', name: 'Claude Sonnet' }, { id: 'litellm/openai/gpt-4o', name: 'GPT-4o' }
  ]},
  qianfan: { envKey: 'QIANFAN_API_KEY', label: '百度千帆', url: 'https://cloud.baidu.com', models: [
    { id: 'qianfan/ernie-4-0', name: '文心大模型 4.0' }
  ]}
};

function loadProvidersFromPiAi() {
  try {
    const piPath = path.join(OPENCLAW_DIR, 'node_modules', '@mariozechner', 'pi-ai', 'dist', 'models.generated.js');
    if (!fs.existsSync(piPath)) return null;
    const content = fs.readFileSync(piPath, 'utf8');
    const m = content.match(/export const MODELS = (\{[\s\S]*?\});?\s*$/m);
    if (!m) return null;
    const mod = { exports: {} };
    eval('mod.exports.MODELS = ' + m[1]);
    const M = mod.exports.MODELS;
    const out = {};
    for (const [prov, models] of Object.entries(M)) {
      if (!models || typeof models !== 'object') continue;
      const list = [];
      for (const mid of Object.keys(models)) {
        const m2 = models[mid];
        if (m2 && m2.id && m2.name) list.push({ id: prov + '/' + m2.id, name: m2.name });
      }
      if (list.length > 0) {
        const maxModels = list.length > 30 ? 25 : list.length;
        out[prov] = {
          envKey: ENV_MAP[prov] != null ? ENV_MAP[prov] : (prov.includes('-') ? '' : (prov.toUpperCase().replace(/-/g, '_') + '_API_KEY')),
          label: LABEL_MAP[prov] || prov,
          url: URL_MAP[prov] || '#',
          models: list.slice(0, maxModels)
        };
      }
    }
    return out;
  } catch (_) {
    return null;
  }
}

let PROVIDERS = loadProvidersFromPiAi();
if (!PROVIDERS || Object.keys(PROVIDERS).length === 0) {
  PROVIDERS = { zai: { envKey: 'ZAI_API_KEY', label: '智谱 ZAI', url: 'https://open.bigmodel.cn', models: [
    { id: 'zai/glm-5', name: 'GLM-5' }, { id: 'zai/glm-4.7', name: 'GLM-4.7' }
  ]}, openai: { envKey: 'OPENAI_API_KEY', label: 'OpenAI', url: 'https://platform.openai.com', models: [
    { id: 'openai/gpt-4o', name: 'GPT-4o' }, { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' }
  ]}, anthropic: { envKey: 'ANTHROPIC_API_KEY', label: 'Anthropic', url: 'https://console.anthropic.com', models: [
    { id: 'anthropic/claude-opus-4-6', name: 'Claude Opus 4.6' }, { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5' }
  ]} };
}
Object.assign(PROVIDERS, CUSTOM_PROVIDERS);

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const o = JSON.parse(raw);
    const provider = o.provider || 'zai';
    return {
      apiKey: o.apiKey || '',
      provider,
      modelPrimary: o.modelPrimary || (PROVIDERS[provider] ? PROVIDERS[provider].models[0].id : 'zai/glm-5'),
      portMain: o.portMain || 18789,
      portHexStart: o.portHexStart || 18791,
      panelPort: o.panelPort || 3999
    };
  } catch (_) {
    return { apiKey: '', provider: 'zai', modelPrimary: 'zai/glm-5', portMain: 18789, portHexStart: 18791, panelPort: 3999 };
  }
}
function writeConfig(o) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(o, null, 2), 'utf8');
}
function getConfigEnv() {
  const c = readConfig();
  const env = { ...process.env };
  const p = PROVIDERS[c.provider || 'zai'];
  if (p && c.apiKey) env[p.envKey] = c.apiKey;
  return env;
}

app.get('/api/config', (_req, res) => {
  try {
    const c = readConfig();
    c.providers = Object.keys(PROVIDERS).map((k) => ({ id: k, ...PROVIDERS[k] }));
    res.json(c);
  } catch (err) {
    res.status(500).json({ error: err.message || '读取配置失败' });
  }
});
app.get('/api/config/check-ports', (req, res) => {
  try {
    const current = readConfig();
    let portMain = parseInt(req.query.portMain, 10) || current.portMain || 18789;
    let portHexStart = parseInt(req.query.portHexStart, 10) || current.portHexStart || 18791;
    let panelPort = parseInt(req.query.panelPort, 10) || current.panelPort || 3999;

    const mainInUse = isPortInUse(portMain);
    const hexInUse = isPortInUse(portHexStart);
    const panelInUse = isPortInUse(panelPort);
    let autoFixed = false;

    if (mainInUse || hexInUse || panelInUse) {
      const exclude = new Set([portMain, panelPort]);
      for (let i = 0; i < 64; i++) exclude.add(portHexStart + i);

      if (mainInUse) {
        portMain = findFreePort(portMain, exclude);
        exclude.add(portMain);
      }
      if (hexInUse) {
        portHexStart = findFreePortBlock(portHexStart, 64, exclude);
        for (let i = 0; i < 64; i++) exclude.add(portHexStart + i);
      }
      if (panelInUse) {
        panelPort = findFreePort(panelPort, exclude);
      }

      const config = { ...current, portMain, portHexStart, panelPort };
      writeConfig(config);

      const yinMolt = path.join(ROOT_DIR, 'yin', 'moltbot.json');
      if (fs.existsSync(yinMolt)) {
        try {
          const j = JSON.parse(fs.readFileSync(yinMolt, 'utf8'));
          j.gateway = j.gateway || {};
          j.gateway.port = portMain;
          fs.writeFileSync(yinMolt, JSON.stringify(j, null, 2), 'utf8');
        } catch (_) {}
      }

      if (fs.existsSync(WORKERS_CONF)) {
        const rows = parseWorkersConf();
        const hexNames = ['乾','坤','泰','否','谦','豫','随','蛊','临','观','屯','蒙','需','讼','师','比','小畜','履','同人','大有','噬嗑','贲','剥','复','无妄','大畜','颐','大过','坎','离','咸','恒','遯','大壮','晋','明夷','家人','睽','蹇','解','损','益','夬','姤','萃','升','困','井','革','鼎','震','艮','渐','归妹','丰','旅','巽','兑','涣','节','中孚','小过','既济','未济'];
        const lines = ['# 格式: worker_id|state_dir|port|token'];
        for (let i = 0; i < 64; i++) {
          const id = i + 1;
          const name = hexNames[i] || ('hex' + id);
          const port = portHexStart + i;
          const token = (rows[i] && rows[i].token) || '';
          lines.push(`${id}|hexes/${name}|${port}|${token}`);
        }
        fs.writeFileSync(WORKERS_CONF, lines.join('\n') + '\n', 'utf8');
        syncGatewayPortFromWorkersConf();
      }

      _portsCache = null;
      _portsCacheTime = 0;
      autoFixed = true;
    }

    res.json({
      portMain: { port: portMain, inUse: isPortInUse(portMain) },
      portHexStart: { port: portHexStart, inUse: isPortInUse(portHexStart) },
      panelPort: { port: panelPort, inUse: isPortInUse(panelPort) },
      autoFixed,
      config: autoFixed ? { portMain, portHexStart, panelPort } : undefined
    });
  } catch (err) {
    res.status(500).json({ error: err.message || '检测失败' });
  }
});
app.post('/api/config', (req, res) => {
  try {
    const body = req.body || {};
    const incomingKey = String(body.apiKey || '').trim();
    const current = readConfig();
    const provider = body.provider || current.provider || 'zai';
    const p = PROVIDERS[provider] || PROVIDERS.zai;
    const apiKey = incomingKey || current.apiKey || '';
    if (!apiKey && p.envKey) return res.status(400).json({ error: 'API Key 不能为空' });
    const modelPrimary = body.modelPrimary || current.modelPrimary || (PROVIDERS[provider] ? PROVIDERS[provider].models[0].id : 'zai/glm-5');
    const config = {
      apiKey,
      provider,
      modelPrimary,
      portMain: parseInt(body.portMain, 10) || current.portMain || 18789,
      portHexStart: parseInt(body.portHexStart, 10) || current.portHexStart || 18791,
      panelPort: parseInt(body.panelPort, 10) || current.panelPort || 3999
    };
    writeConfig(config);
    const envPath = path.join(ROOT_DIR, '.env');
    if (p.envKey) fs.writeFileSync(envPath, `${p.envKey}=${apiKey}\n`, 'utf8');
    // 写入 openclaw auth-profiles.json（阴 + 64 卦）；ollama 本地无需 auth，跳过
    if (p.envKey) {
      const profileKey = provider + ':default';
      const authProfiles = { version: 1, profiles: { [profileKey]: { type: 'api_key', provider, key: apiKey } }, lastGood: { [provider]: profileKey } };
      const authJson = JSON.stringify(authProfiles, null, 2);
      const writeAuthTo = (agentDir) => {
        try {
          fs.mkdirSync(agentDir, { recursive: true });
          fs.writeFileSync(path.join(agentDir, 'auth-profiles.json'), authJson, 'utf8');
        } catch (_) {}
      };
      writeAuthTo(path.join(ROOT_DIR, 'yin', 'agents', 'main', 'agent'));
      parseWorkersConf().forEach((r) => {
        writeAuthTo(path.join(r.stateDir, 'agents', 'main', 'agent'));
      });
    }
    // 更新阴和 64 卦的 agents.defaults.model.primary
    const updateModelInMoltbot = (moltPath) => {
      try {
        if (!fs.existsSync(moltPath)) return;
        const raw = fs.readFileSync(moltPath, 'utf8');
        const j = JSON.parse(raw);
        j.agents = j.agents || {};
        j.agents.defaults = j.agents.defaults || {};
        j.agents.defaults.model = j.agents.defaults.model || {};
        j.agents.defaults.model.primary = modelPrimary;
        fs.writeFileSync(moltPath, JSON.stringify(j, null, 2), 'utf8');
      } catch (_) {}
    };
    updateModelInMoltbot(path.join(ROOT_DIR, 'yin', 'moltbot.json'));
    parseWorkersConf().forEach((r) => {
      updateModelInMoltbot(path.join(r.stateDir, 'moltbot.json'));
    });
    res.json({ ok: true, config });
  } catch (err) {
    res.status(500).json({ error: err.message || '保存配置失败' });
  }
});

// 项目空间：本地 JSON 存储（路线图阶段 A）
const DATA_DIR = path.join(__dirname, 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const HEX_DEFINITION_PROJECT_ID = 'hex-definition';
const HEX_DEFINITION_FILE = path.join(DATA_DIR, 'hex-definition.json');
function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}
function readProjects() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(PROJECTS_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}
function writeProjects(list) {
  ensureDataDir();
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(list, null, 2), 'utf8');
}
function readHexDefinitionConfig() {
  try {
    if (fs.existsSync(HEX_DEFINITION_FILE)) {
      const j = JSON.parse(fs.readFileSync(HEX_DEFINITION_FILE, 'utf8'));
      return { hexIds: Array.isArray(j.hexIds) ? j.hexIds : [] };
    }
  } catch (_) {}
  return { hexIds: [] };
}
function writeHexDefinitionConfig(obj) {
  ensureDataDir();
  fs.writeFileSync(HEX_DEFINITION_FILE, JSON.stringify({ hexIds: obj.hexIds || [] }, null, 2), 'utf8');
}
function nextProjectId(list) {
  const max = list.reduce((m, p) => Math.max(m, parseInt(String(p.id).replace(/\D/g, '') || '0', 10)), 0);
  return 'p' + (max + 1);
}

app.get('/api/projects', (_req, res) => {
  try {
    const list = readProjects().filter((p) => p.id !== HEX_DEFINITION_PROJECT_ID);
    const hexDef = readHexDefinitionConfig();
    const virtual = {
      id: HEX_DEFINITION_PROJECT_ID,
      name: '卦的自定义',
      hexIds: hexDef.hexIds,
      noDelete: true
    };
    res.json([virtual, ...list]);
  } catch (err) {
    res.status(500).json({ error: err.message || '读取项目列表失败' });
  }
});
app.post('/api/projects', (req, res) => {
  try {
    const name = (req.body && req.body.name) ? String(req.body.name).trim() : '';
    if (!name) return res.status(400).json({ error: '项目名称不能为空' });
    const list = readProjects();
    const id = nextProjectId(list);
    const project = {
      id, name, hexIds: [],
      type: 'other', description: '', status: 'planning', budget: 0, revenue: 0,
      startDate: new Date().toISOString().slice(0, 10), tasks: []
    };
    list.push(project);
    writeProjects(list);
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message || '创建项目失败' });
  }
});
app.get('/api/projects/:id', (req, res) => {
  try {
    if (req.params.id === HEX_DEFINITION_PROJECT_ID) {
      const hexDef = readHexDefinitionConfig();
      return res.json({
        id: HEX_DEFINITION_PROJECT_ID,
        name: '卦的自定义',
        hexIds: hexDef.hexIds,
        noDelete: true
      });
    }
    const list = readProjects();
    const project = list.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message || '读取项目失败' });
  }
});
app.put('/api/projects/:id', (req, res) => {
  try {
    if (req.params.id === HEX_DEFINITION_PROJECT_ID) {
      const body = req.body || {};
      if (!Array.isArray(body.hexIds)) return res.status(400).json({ error: '仅允许更新 hexIds' });
      const hexDef = readHexDefinitionConfig();
      hexDef.hexIds = body.hexIds;
      writeHexDefinitionConfig(hexDef);
      return res.json({ id: HEX_DEFINITION_PROJECT_ID, name: '卦的自定义', hexIds: hexDef.hexIds, noDelete: true });
    }
    const list = readProjects();
    const idx = list.findIndex(p => p.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: '项目不存在' });
    const body = req.body || {};
    const p = list[idx];
    if (!p.tasks) p.tasks = [];
    if (body.name != null) p.name = String(body.name).trim() || p.name;
    if (Array.isArray(body.hexIds)) p.hexIds = body.hexIds;
    if (body.type != null) p.type = String(body.type);
    if (body.description != null) p.description = String(body.description);
    if (body.status != null) p.status = String(body.status);
    if (body.budget != null) p.budget = Number(body.budget) || 0;
    if (body.revenue != null) p.revenue = Number(body.revenue) || 0;
    if (body.startDate != null) p.startDate = body.startDate == null ? '' : String(body.startDate);
    if (body.endDate !== undefined) p.endDate = body.endDate == null ? undefined : String(body.endDate);
    if (Array.isArray(body.tasks)) p.tasks = body.tasks;
    writeProjects(list);
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message || '更新项目失败' });
  }
});
function nextTaskId(tasks) {
  const max = (tasks || []).reduce((m, t) => Math.max(m, parseInt(String(t.id).replace(/\D/g, '') || '0', 10)), 0);
  return 't' + (max + 1);
}
app.post('/api/projects/:id/tasks', (req, res) => {
  try {
    const list = readProjects();
    const idx = list.findIndex(p => p.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: '项目不存在' });
    const body = req.body || {};
    const project = list[idx];
    if (!project.tasks) project.tasks = [];
    const taskId = nextTaskId(project.tasks);
    const task = {
      id: taskId,
      title: String(body.title || ''),
      assignedTo: String(body.assignedTo || ''),
      status: ['pending', 'in-progress', 'completed'].includes(body.status) ? body.status : 'pending',
      deadline: String(body.deadline || ''),
      dependencies: Array.isArray(body.dependencies) ? body.dependencies : []
    };
    project.tasks.push(task);
    writeProjects(list);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message || '添加任务失败' });
  }
});
app.put('/api/projects/:id/tasks/:taskId', (req, res) => {
  try {
    const list = readProjects();
    const idx = list.findIndex(p => p.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: '项目不存在' });
    const project = list[idx];
    if (!project.tasks) project.tasks = [];
    const ti = project.tasks.findIndex(t => t.id === req.params.taskId);
    if (ti < 0) return res.status(404).json({ error: '任务不存在' });
    const body = req.body || {};
    if (body.title !== undefined) project.tasks[ti].title = String(body.title);
    if (body.assignedTo !== undefined) project.tasks[ti].assignedTo = String(body.assignedTo);
    if (['pending', 'in-progress', 'completed'].includes(body.status)) project.tasks[ti].status = body.status;
    if (body.deadline !== undefined) project.tasks[ti].deadline = String(body.deadline);
    if (Array.isArray(body.dependencies)) project.tasks[ti].dependencies = body.dependencies;
    writeProjects(list);
    res.json(project.tasks[ti]);
  } catch (err) {
    res.status(500).json({ error: err.message || '更新任务失败' });
  }
});
app.delete('/api/projects/:id', (req, res) => {
  try {
    if (req.params.id === HEX_DEFINITION_PROJECT_ID) return res.status(403).json({ error: '卦的自定义不可删除' });
    let list = readProjects();
    const len = list.length;
    list = list.filter(p => p.id !== req.params.id);
    if (list.length === len) return res.status(404).json({ error: '项目不存在' });
    writeProjects(list);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || '删除项目失败' });
  }
});

app.post('/api/hex-definition/:hexId', (req, res) => {
  try {
    const hexId = req.params.hexId;
    if (!HEXAGRAM_ROBOTS.some((h) => h.id === hexId)) return res.status(404).json({ error: '卦不存在' });
    const worker = getWorkerByHex(hexId);
    if (!worker || !worker.stateDir) return res.status(404).json({ error: '该卦未配置 stateDir' });
    const content = (req.body && req.body.content != null) ? String(req.body.content) : '';
    const workspaceDir = path.join(worker.stateDir, 'workspace');
    const filePath = path.join(workspaceDir, '我的定义.md');
    if (!path.resolve(filePath).startsWith(path.resolve(worker.stateDir))) return res.status(400).json({ error: '路径非法' });
    try {
      if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true });
      fs.writeFileSync(filePath, content, 'utf8');
    } catch (e) {
      return res.status(500).json({ error: '写入失败: ' + e.message });
    }
    res.json({ ok: true, path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message || '写入卦定义失败' });
  }
});

// ---------- 卦标签：每卦一个可编辑标签，卦可自改、主人可改，仅展示用不改记忆；卦与卦互见 ----------
const LABEL_FILENAME = 'LABEL.txt';
function readHexLabel(hexId) {
  const worker = getWorkerByHex(hexId);
  if (!worker || !worker.stateDir) return '';
  const filePath = path.join(worker.stateDir, 'workspace', LABEL_FILENAME);
  try {
    if (!fs.existsSync(filePath)) return '';
    const raw = fs.readFileSync(filePath, 'utf8');
    return (raw.split('\n')[0] || '').trim();
  } catch (_) {
    return '';
  }
}
function writeHexLabel(hexId, label) {
  const worker = getWorkerByHex(hexId);
  if (!worker || !worker.stateDir) return false;
  const workspaceDir = path.join(worker.stateDir, 'workspace');
  const filePath = path.join(workspaceDir, LABEL_FILENAME);
  if (!path.resolve(filePath).startsWith(path.resolve(worker.stateDir))) return false;
  try {
    if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true });
    fs.writeFileSync(filePath, String(label == null ? '' : label).trim() + '\n', 'utf8');
    return true;
  } catch (_) {
    return false;
  }
}
/** 返回「卦名(标签)」或「卦名」，用于注入上下文让卦与卦互见 */
function formatHexNameWithLabel(hexId) {
  const hex = HEXAGRAM_ROBOTS.find((h) => h.id === hexId);
  const name = hex ? hex.name : hexId;
  const label = readHexLabel(hexId);
  return label ? `${name}(${label})` : name;
}

app.get('/api/hex/:id/label', (req, res) => {
  const hexId = req.params.id;
  if (!HEXAGRAM_ROBOTS.some((h) => h.id === hexId)) return res.status(404).json({ error: '卦不存在' });
  res.json({ id: hexId, label: readHexLabel(hexId) });
});
app.put('/api/hex/:id/label', (req, res) => {
  const hexId = req.params.id;
  if (!HEXAGRAM_ROBOTS.some((h) => h.id === hexId)) return res.status(404).json({ error: '卦不存在' });
  const label = (req.body && req.body.label != null) ? String(req.body.label) : '';
  if (!writeHexLabel(hexId, label)) return res.status(500).json({ error: '写入标签失败' });
  res.json({ id: hexId, label: readHexLabel(hexId) });
});

// ---------- 阴升级 Phase 1：卦能力画像（64卦总控系统需求清单） ----------
const HEXAGRAMS_FILE = path.join(DATA_DIR, 'hexagrams.json');
const DEFAULT_CAPABILITIES = { coding: 5, writing: 5, trading: 5, marketing: 5, design: 5, analysis: 5 };
function defaultHexagramProfile(hex) {
  return {
    id: hex.id,
    name: hex.name,
    workerId: hex.workerId,
    capabilities: { ...DEFAULT_CAPABILITIES },
    expertise: [],
    currentProject: null,
    status: 'idle',
    performance: { revenue: 0, tasksCompleted: 0, avgRating: 0 }
  };
}
function readHexagramProfiles() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(HEXAGRAMS_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return HEXAGRAM_ROBOTS.map((h) => defaultHexagramProfile(h));
  }
}
function writeHexagramProfiles(profiles) {
  ensureDataDir();
  fs.writeFileSync(HEXAGRAMS_FILE, JSON.stringify(profiles, null, 2), 'utf8');
}
function getHexagramProfilesMerged() {
  const stored = readHexagramProfiles();
  const byId = {};
  stored.forEach((p) => { byId[p.id] = p; });
  return HEXAGRAM_ROBOTS.map((h) => {
    const p = byId[h.id] || defaultHexagramProfile(h);
    return { ...defaultHexagramProfile(h), ...p, id: h.id, name: h.name, workerId: h.workerId };
  });
}
app.get('/api/hexagrams', (_req, res) => {
  try {
    res.json(getHexagramProfilesMerged());
  } catch (err) {
    res.status(500).json({ error: err.message || '读取卦画像失败' });
  }
});
app.get('/api/hexagrams/:id', (req, res) => {
  try {
    const profiles = getHexagramProfilesMerged();
    const p = profiles.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: '卦不存在' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message || '读取卦画像失败' });
  }
});
app.put('/api/hexagrams/:id', (req, res) => {
  try {
    const hex = HEXAGRAM_ROBOTS.find((h) => h.id === req.params.id);
    if (!hex) return res.status(404).json({ error: '卦不存在' });
    const profiles = readHexagramProfiles();
    const byId = {};
    profiles.forEach((p) => { byId[p.id] = p; });
    const base = byId[hex.id] || defaultHexagramProfile(hex);
    const body = req.body || {};
    const next = { ...base, id: hex.id, name: hex.name, workerId: hex.workerId };
    if (body.capabilities && typeof body.capabilities === 'object') {
      next.capabilities = { ...DEFAULT_CAPABILITIES, ...base.capabilities, ...body.capabilities };
    }
    if (body.expertise !== undefined) next.expertise = Array.isArray(body.expertise) ? body.expertise : [];
    if (body.currentProject !== undefined) next.currentProject = body.currentProject == null ? null : String(body.currentProject);
    if (body.status !== undefined) next.status = ['idle', 'working', 'learning', 'upgrading'].includes(body.status) ? body.status : base.status;
    if (body.performance && typeof body.performance === 'object') {
      next.performance = { revenue: 0, tasksCompleted: 0, avgRating: 0, ...base.performance, ...body.performance };
    }
    byId[hex.id] = next;
    const fullList = HEXAGRAM_ROBOTS.map((h) => byId[h.id] || defaultHexagramProfile(h));
    writeHexagramProfiles(fullList);
    res.json(next);
  } catch (err) {
    res.status(500).json({ error: err.message || '更新卦画像失败' });
  }
});
// ---------- 阴升级 Phase 1 卦画像结束 ----------

// ---------- 阴升级 Phase 1：收益与升级池（64卦总控系统需求清单） ----------
const REVENUE_FILE = path.join(DATA_DIR, 'revenue.json');
function defaultRevenueState() {
  return { totalRevenue: 0, upgradePool: 0, availableFunds: 0, transactions: [] };
}
function readRevenueState() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(REVENUE_FILE, 'utf8');
    const j = JSON.parse(raw);
    return {
      totalRevenue: Number(j.totalRevenue) || 0,
      upgradePool: Number(j.upgradePool) || 0,
      availableFunds: Number(j.availableFunds) || 0,
      transactions: Array.isArray(j.transactions) ? j.transactions : []
    };
  } catch (_) {
    return defaultRevenueState();
  }
}
function writeRevenueState(state) {
  ensureDataDir();
  fs.writeFileSync(REVENUE_FILE, JSON.stringify(state, null, 2), 'utf8');
}
function nextTransactionId(txs) {
  const max = txs.reduce((m, t) => Math.max(m, parseInt(String(t.id).replace(/\D/g, '') || '0', 10)), 0);
  return 'tx' + (max + 1);
}
app.get('/api/revenue', (_req, res) => {
  try {
    const s = readRevenueState();
    res.json({ totalRevenue: s.totalRevenue, upgradePool: s.upgradePool, availableFunds: s.availableFunds, transactionCount: s.transactions.length });
  } catch (err) {
    res.status(500).json({ error: err.message || '读取收益失败' });
  }
});
app.post('/api/revenue/transactions', (req, res) => {
  try {
    const body = req.body || {};
    const type = body.type === 'income' || body.type === 'expense' || body.type === 'upgrade' ? body.type : 'income';
    const amount = Number(body.amount);
    if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'amount 须为正数' });
    const state = readRevenueState();
    const id = nextTransactionId(state.transactions);
    const tx = {
      id,
      type,
      amount: type === 'expense' || type === 'upgrade' ? -amount : amount,
      source: String(body.source || ''),
      timestamp: body.timestamp || new Date().toISOString(),
      description: String(body.description || '')
    };
    state.transactions.push(tx);
    if (type === 'income') {
      state.totalRevenue += amount;
      state.upgradePool += Math.floor(amount * 0.2 * 100) / 100;
      state.availableFunds += amount;
    } else if (type === 'expense' || type === 'upgrade') {
      state.availableFunds -= amount;
      if (type === 'upgrade') state.upgradePool = Math.max(0, state.upgradePool - amount);
    }
    writeRevenueState(state);
    res.status(201).json(tx);
  } catch (err) {
    res.status(500).json({ error: err.message || '记录交易失败' });
  }
});
app.get('/api/revenue/transactions', (req, res) => {
  try {
    const s = readRevenueState();
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const list = s.transactions.slice(-limit).reverse();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message || '读取交易失败' });
  }
});
app.get('/api/revenue/pool', (_req, res) => {
  try {
    const s = readRevenueState();
    res.json({ upgradePool: s.upgradePool, totalRevenue: s.totalRevenue });
  } catch (err) {
    res.status(500).json({ error: err.message || '读取升级池失败' });
  }
});
app.post('/api/revenue/pool/upgrade', (req, res) => {
  try {
    const body = req.body || {};
    const amount = Number(body.amount);
    const description = String(body.description || body.use || '');
    if (isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'amount 须为正数' });
    const state = readRevenueState();
    if (amount > state.upgradePool) return res.status(400).json({ error: '升级池余额不足' });
    const id = nextTransactionId(state.transactions);
    state.transactions.push({
      id,
      type: 'upgrade',
      amount: -amount,
      source: body.source || 'pool',
      timestamp: new Date().toISOString(),
      description: description || '升级支出'
    });
    state.upgradePool -= amount;
    state.availableFunds -= amount;
    writeRevenueState(state);
    res.json({ ok: true, upgradePool: state.upgradePool, transactionId: id });
  } catch (err) {
    res.status(500).json({ error: err.message || '升级支出失败' });
  }
});
// ---------- 阴升级 Phase 1 收益结束 ----------

// ---------- 阴升级 Phase 1：汇报（64卦总控系统需求清单） ----------
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
function readReports() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(REPORTS_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}
function writeReports(list) {
  ensureDataDir();
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(list, null, 2), 'utf8');
}
app.get('/api/reports', (_req, res) => {
  try {
    const list = readReports();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message || '读取汇报失败' });
  }
});
app.post('/api/reports', (req, res) => {
  try {
    const body = req.body || {};
    const list = readReports();
    const id = 'r' + (list.length + 1);
    const report = {
      id,
      type: body.type || 'daily',
      title: String(body.title || ''),
      content: String(body.content || ''),
      createdAt: body.createdAt || new Date().toISOString()
    };
    list.push(report);
    writeReports(list);
    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ error: err.message || '生成汇报失败' });
  }
});
app.get('/api/reports/latest', (_req, res) => {
  try {
    const list = readReports();
    if (list.length === 0) return res.status(404).json({ error: '暂无汇报' });
    res.json(list[list.length - 1]);
  } catch (err) {
    res.status(500).json({ error: err.message || '读取汇报失败' });
  }
});
// ---------- 阴升级 Phase 1 汇报结束 ----------

// ---------- 阴升级 Phase 2：能力匹配、决策日志、任务分配 ----------
const CAPABILITY_KEYS = ['coding', 'writing', 'trading', 'marketing', 'design', 'analysis'];
function scoreHexagramForNeeds(profile, needs) {
  if (!needs || needs.length === 0) return (profile.capabilities && profile.capabilities.coding) ? profile.capabilities.coding : 5;
  const cap = profile.capabilities || {};
  let sum = 0, n = 0;
  needs.forEach((k) => {
    if (CAPABILITY_KEYS.includes(k)) { sum += Number(cap[k]) || 0; n++; }
  });
  return n ? sum / n : 0;
}
app.get('/api/match-hexagrams', (req, res) => {
  try {
    const needStr = req.query.need || req.query.needs || '';
    const needs = needStr ? needStr.split(/[,，\s]/).map((s) => s.trim()).filter(Boolean) : [];
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 64);
    const preferIdle = (req.query.preferIdle !== 'false');
    const profiles = getHexagramProfilesMerged();
    const scored = profiles.map((p) => ({
      ...p,
      _score: scoreHexagramForNeeds(p, needs),
      _idle: p.status === 'idle'
    }));
    scored.sort((a, b) => {
      if (preferIdle && a._idle !== b._idle) return a._idle ? -1 : 1;
      return b._score - a._score;
    });
    const out = scored.slice(0, limit).map(({ _score, _idle, ...p }) => ({ ...p, matchScore: _score }));
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message || '卦能力匹配失败' });
  }
});

const DECISIONS_FILE = path.join(DATA_DIR, 'decisions.json');
function readDecisions() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(DECISIONS_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}
function writeDecisions(list) {
  ensureDataDir();
  fs.writeFileSync(DECISIONS_FILE, JSON.stringify(list, null, 2), 'utf8');
}
app.get('/api/decisions', (req, res) => {
  try {
    const list = readDecisions();
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    res.json(list.slice(-limit).reverse());
  } catch (err) {
    res.status(500).json({ error: err.message || '读取决策日志失败' });
  }
});
app.post('/api/decisions', (req, res) => {
  try {
    const body = req.body || {};
    const list = readDecisions();
    const id = 'd' + (list.length + 1);
    const decision = {
      id,
      type: String(body.type || ''),
      payload: body.payload != null ? body.payload : {},
      createdAt: body.createdAt || new Date().toISOString()
    };
    list.push(decision);
    writeDecisions(list);
    res.status(201).json(decision);
  } catch (err) {
    res.status(500).json({ error: err.message || '记录决策失败' });
  }
});

app.post('/api/projects/:id/assign-tasks', (req, res) => {
  try {
    const list = readProjects();
    const idx = list.findIndex(p => p.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: '项目不存在' });
    const project = list[idx];
    if (!project.tasks) project.tasks = [];
    const pending = project.tasks.filter((t) => t.status === 'pending');
    if (pending.length === 0) return res.json({ assigned: 0, message: '无待分配任务' });
    const profiles = getHexagramProfilesMerged();
    const idle = profiles.filter((p) => p.status === 'idle');
    const needStr = (req.query.need || '').trim() || 'coding';
    const needs = needStr.split(/[,，\s]/).map((s) => s.trim()).filter(Boolean);
    const scored = idle.map((p) => ({ ...p, _score: scoreHexagramForNeeds(p, needs) }));
    scored.sort((a, b) => b._score - a._score);
    let assigned = 0;
    pending.forEach((task, i) => {
      const hex = scored[i % scored.length];
      if (!hex) return;
      const ti = project.tasks.findIndex((t) => t.id === task.id);
      if (ti >= 0) {
        project.tasks[ti].assignedTo = hex.id;
        project.tasks[ti].status = 'in-progress';
        assigned++;
      }
    });
    const hexProfiles = readHexagramProfiles();
    const byId = {};
    hexProfiles.forEach((p) => { byId[p.id] = p; });
    pending.slice(0, scored.length).forEach((task, i) => {
      const hex = scored[i];
      if (hex && byId[hex.id]) {
        byId[hex.id].currentProject = project.id;
        byId[hex.id].status = 'working';
      }
    });
    const fullList = HEXAGRAM_ROBOTS.map((h) => byId[h.id] || defaultHexagramProfile(h));
    writeHexagramProfiles(fullList);
    writeProjects(list);
    res.json({ assigned, totalPending: pending.length });
  } catch (err) {
    res.status(500).json({ error: err.message || '任务分配失败' });
  }
});
// ---------- 阴升级 Phase 2：Cursor 集成 ----------
function getHexWorkspaceDir(hexId) {
  const hex = HEXAGRAM_ROBOTS.find((h) => h.id === hexId);
  return hex ? path.join(ROOT_DIR, hexId) : ROOT_DIR;
}
app.post('/api/cursor/install', (req, res) => {
  try {
    const body = req.body || {};
    const target = body.target === 'host' || !body.target ? ROOT_DIR : getHexWorkspaceDir(body.target);
    const pm = body.packageManager || 'npm';
    const packages = Array.isArray(body.packages) ? body.packages : (body.packages ? [body.packages] : []);
    let cmd = '';
    if (pm === 'npm') cmd = packages.length ? 'npm install ' + packages.join(' ') : 'npm install';
    else if (pm === 'pip') cmd = packages.length ? 'pip install ' + packages.join(' ') : 'pip install';
    else if (pm === 'brew') cmd = packages.length ? 'brew install ' + packages.join(' ') : '';
    else if (body.command) cmd = body.command;
    if (!cmd) return res.status(400).json({ error: '需提供 packages 或 command' });
    execSync(cmd, { cwd: target, stdio: 'pipe', shell: true });
    res.json({ ok: true, target: body.target || 'host', command: cmd });
  } catch (err) {
    res.status(500).json({ error: err.message || '安装执行失败' });
  }
});
app.post('/api/cursor/code', (req, res) => {
  try {
    const body = req.body || {};
    const content = body.content != null ? String(body.content) : '// ' + String(body.prompt || '');
    const targetPath = body.path ? path.resolve(ROOT_DIR, body.path) : null;
    if (targetPath) {
      if (!targetPath.startsWith(ROOT_DIR)) return res.status(400).json({ error: 'path 须在项目目录下' });
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, content, 'utf8');
    }
    res.json({ ok: true, path: body.path || null, length: content.length });
  } catch (err) {
    res.status(500).json({ error: err.message || '写入代码失败' });
  }
});
const CURSOR_ENV_FILE = path.join(DATA_DIR, 'cursor-env.json');
function readCursorEnv() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(CURSOR_ENV_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}
function writeCursorEnv(obj) {
  ensureDataDir();
  fs.writeFileSync(CURSOR_ENV_FILE, JSON.stringify(obj, null, 2), 'utf8');
}
app.get('/api/cursor/configure', (req, res) => {
  try {
    const hexId = req.query.hexId;
    const env = readCursorEnv();
    if (hexId) res.json(env[hexId] || {});
    else res.json(env);
  } catch (err) {
    res.status(500).json({ error: err.message || '读取配置失败' });
  }
});
app.post('/api/cursor/configure', (req, res) => {
  try {
    const body = req.body || {};
    const hexId = body.hexId || body.hex;
    if (!hexId) return res.status(400).json({ error: '需提供 hexId' });
    const env = readCursorEnv();
    env[hexId] = { ...(env[hexId] || {}), ...(body.config || body) };
    delete env[hexId].hexId;
    delete env[hexId].hex;
    writeCursorEnv(env);
    res.json(env[hexId]);
  } catch (err) {
    res.status(500).json({ error: err.message || '写入配置失败' });
  }
});
// ---------- 阴升级 Phase 2 Cursor 结束 ----------

// ---------- 阴升级 Phase 2：GitHub 集成 ----------
app.post('/api/github/pull', (req, res) => {
  try {
    const body = req.body || {};
    const repoPath = body.repo ? path.resolve(ROOT_DIR, body.repo) : ROOT_DIR;
    if (!repoPath.startsWith(ROOT_DIR)) return res.status(400).json({ error: 'repo 须在项目目录下' });
    if (!fs.existsSync(path.join(repoPath, '.git'))) return res.status(400).json({ error: '非 git 仓库' });
    execSync('git pull', { cwd: repoPath, stdio: 'pipe', shell: true });
    res.json({ ok: true, repo: body.repo || '.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'git pull 失败' });
  }
});
app.post('/api/github/sync', (req, res) => {
  try {
    const body = req.body || {};
    const repoPath = body.repo ? path.resolve(ROOT_DIR, body.repo) : ROOT_DIR;
    if (!repoPath.startsWith(ROOT_DIR)) return res.status(400).json({ error: 'repo 须在项目目录下' });
    if (!fs.existsSync(path.join(repoPath, '.git'))) return res.status(400).json({ error: '非 git 仓库' });
    execSync('git fetch --all', { cwd: repoPath, stdio: 'pipe', shell: true });
    execSync('git pull', { cwd: repoPath, stdio: 'pipe', shell: true });
    res.json({ ok: true, repo: body.repo || '.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'git sync 失败' });
  }
});
app.post('/api/github/commit', (req, res) => {
  try {
    const body = req.body || {};
    const repoPath = body.repo ? path.resolve(ROOT_DIR, body.repo) : ROOT_DIR;
    if (!repoPath.startsWith(ROOT_DIR)) return res.status(400).json({ error: 'repo 须在项目目录下' });
    if (!fs.existsSync(path.join(repoPath, '.git'))) return res.status(400).json({ error: '非 git 仓库' });
    const message = String(body.message || 'update');
    const files = Array.isArray(body.files) ? body.files : (body.files ? [body.files] : ['.']);
    execSync('git add ' + files.map((f) => `"${f}"`).join(' '), { cwd: repoPath, stdio: 'pipe', shell: true });
    execSync('git commit -m "' + message.replace(/"/g, '\\"') + '"', { cwd: repoPath, stdio: 'pipe', shell: true });
    res.json({ ok: true, repo: body.repo || '.', message });
  } catch (err) {
    res.status(500).json({ error: err.message || 'git commit 失败' });
  }
});
// ---------- 阴升级 Phase 2 GitHub 结束 ----------

// ---------- 阴升级 Phase 3：外部平台（先 1 个平台，演示/本地任务） ----------
const PLATFORMS_FILE = path.join(DATA_DIR, 'platforms.json');
function readPlatforms() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(PLATFORMS_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}
function writePlatforms(list) {
  ensureDataDir();
  fs.writeFileSync(PLATFORMS_FILE, JSON.stringify(list, null, 2), 'utf8');
}
function platformTasksFile(platformId) {
  return path.join(DATA_DIR, 'platform-' + platformId + '-tasks.json');
}
function readPlatformTasks(platformId) {
  try {
    const raw = fs.readFileSync(platformTasksFile(platformId), 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}
function writePlatformTasks(platformId, tasks) {
  ensureDataDir();
  fs.writeFileSync(platformTasksFile(platformId), JSON.stringify(tasks, null, 2), 'utf8');
}
app.get('/api/platforms', (_req, res) => {
  try {
    const list = readPlatforms().map((p) => ({ id: p.id, type: p.type, name: p.name, status: p.status || 'connected', createdAt: p.createdAt }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message || '读取平台列表失败' });
  }
});
app.post('/api/platforms/connect', (req, res) => {
  try {
    const body = req.body || {};
    const type = String(body.type || 'demo').toLowerCase();
    const name = String(body.name || type);
    const list = readPlatforms();
    const id = 'plat' + (list.length + 1);
    const platform = {
      id,
      type,
      name,
      status: 'connected',
      credentials: body.credentials != null ? body.credentials : {},
      createdAt: new Date().toISOString()
    };
    list.push(platform);
    writePlatforms(list);
    if (type === 'demo') writePlatformTasks(id, [
      { id: 'pt1', title: '演示任务1', description: '示例接单任务', reward: 100, status: 'available' },
      { id: 'pt2', title: '演示任务2', description: '示例写作任务', reward: 200, status: 'available' }
    ]);
    res.status(201).json({ id: platform.id, type: platform.type, name: platform.name, status: platform.status });
  } catch (err) {
    res.status(500).json({ error: err.message || '连接平台失败' });
  }
});
app.delete('/api/platforms/:id', (req, res) => {
  try {
    let list = readPlatforms();
    const len = list.length;
    list = list.filter((p) => p.id !== req.params.id);
    if (list.length === len) return res.status(404).json({ error: '平台不存在' });
    writePlatforms(list);
    try { fs.unlinkSync(platformTasksFile(req.params.id)); } catch (_) {}
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || '断开平台失败' });
  }
});
app.get('/api/platforms/:id/tasks', (req, res) => {
  try {
    const list = readPlatforms();
    const platform = list.find((p) => p.id === req.params.id);
    if (!platform) return res.status(404).json({ error: '平台不存在' });
    const tasks = readPlatformTasks(req.params.id);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message || '拉取任务失败' });
  }
});
app.post('/api/platforms/:id/tasks/fetch', (req, res) => {
  try {
    const list = readPlatforms();
    const platform = list.find((p) => p.id === req.params.id);
    if (!platform) return res.status(404).json({ error: '平台不存在' });
    const tasks = readPlatformTasks(req.params.id);
    res.json({ fetched: tasks.length, tasks });
  } catch (err) {
    res.status(500).json({ error: err.message || '拉取任务失败' });
  }
});
app.post('/api/platforms/:id/tasks/:taskId/accept', (req, res) => {
  try {
    const list = readPlatforms();
    const platform = list.find((p) => p.id === req.params.id);
    if (!platform) return res.status(404).json({ error: '平台不存在' });
    const tasks = readPlatformTasks(req.params.id);
    const ti = tasks.findIndex((t) => t.id === req.params.taskId);
    if (ti < 0) return res.status(404).json({ error: '任务不存在' });
    tasks[ti].status = 'accepted';
    if (req.body && req.body.assignedTo) tasks[ti].assignedTo = req.body.assignedTo;
    writePlatformTasks(req.params.id, tasks);
    res.json(tasks[ti]);
  } catch (err) {
    res.status(500).json({ error: err.message || '接受任务失败' });
  }
});
app.post('/api/pipeline/platform-to-project', (req, res) => {
  try {
    const body = req.body || {};
    const platformId = body.platformId || body.platform;
    const projectId = body.projectId || body.project;
    if (!platformId || !projectId) return res.status(400).json({ error: '需提供 platformId 与 projectId' });
    const platforms = readPlatforms();
    const platform = platforms.find((p) => p.id === platformId);
    if (!platform) return res.status(404).json({ error: '平台不存在' });
    const projList = readProjects();
    const pIdx = projList.findIndex((p) => p.id === projectId);
    if (pIdx < 0) return res.status(404).json({ error: '项目不存在' });
    const project = projList[pIdx];
    if (!project.tasks) project.tasks = [];
    const platformTasks = readPlatformTasks(platformId).filter((t) => t.status === 'available');
    const needStr = body.need || 'coding';
    const needs = needStr.split(/[,，\s]/).map((s) => s.trim()).filter(Boolean);
    const profiles = getHexagramProfilesMerged();
    const idle = profiles.filter((p) => p.status === 'idle');
    const scored = idle.map((p) => ({ ...p, _score: scoreHexagramForNeeds(p, needs) }));
    scored.sort((a, b) => b._score - a._score);
    let created = 0;
    platformTasks.slice(0, scored.length).forEach((pt, i) => {
      const hex = scored[i];
      if (!hex) return;
      const taskId = nextTaskId(project.tasks);
      project.tasks.push({
        id: taskId,
        title: pt.title || pt.id,
        assignedTo: hex.id,
        status: 'in-progress',
        deadline: '',
        dependencies: [],
        _platformTaskId: pt.id
      });
      const tasks = readPlatformTasks(platformId);
      const tti = tasks.findIndex((t) => t.id === pt.id);
      if (tti >= 0) { tasks[tti].status = 'accepted'; tasks[tti].assignedTo = hex.id; writePlatformTasks(platformId, tasks); }
      created++;
    });
    writeProjects(projList);
    res.json({ created, projectId, platformId });
  } catch (err) {
    res.status(500).json({ error: err.message || 'pipeline 执行失败' });
  }
});
// ---------- 阴升级 Phase 3 结束 ----------

// ---------- 阴升级 Phase 4：健康、告警、自愈、分级、汇报模板 ----------
app.get('/api/health/hexagrams', (_req, res) => {
  try {
    const list = getRobotsList();
    const hexList = list.filter((r) => r.id !== 'main');
    res.json(hexList.map((r) => ({ id: r.id, name: r.name, running: !!r.running, port: r.port })));
  } catch (err) {
    res.status(500).json({ error: err.message || '健康检查失败' });
  }
});

const ALERT_RULES_FILE = path.join(DATA_DIR, 'alert-rules.json');
const ALERT_EVENTS_FILE = path.join(DATA_DIR, 'alert-events.json');
function readAlertRules() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(ALERT_RULES_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}
function writeAlertRules(list) {
  ensureDataDir();
  fs.writeFileSync(ALERT_RULES_FILE, JSON.stringify(list, null, 2), 'utf8');
}
function readAlertEvents() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(ALERT_EVENTS_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}
function appendAlertEvent(ev) {
  ensureDataDir();
  const list = readAlertEvents();
  list.push({ ...ev, id: 'ae' + (list.length + 1), at: new Date().toISOString() });
  fs.writeFileSync(ALERT_EVENTS_FILE, JSON.stringify(list.slice(-500), null, 2), 'utf8');
}
app.get('/api/alerts/rules', (_req, res) => {
  try {
    res.json(readAlertRules());
  } catch (err) {
    res.status(500).json({ error: err.message || '读取告警规则失败' });
  }
});
app.post('/api/alerts/rules', (req, res) => {
  try {
    const body = req.body || {};
    const list = readAlertRules();
    list.push({ id: 'ar' + (list.length + 1), name: body.name || '', condition: body.condition || '', severity: body.severity || 'warning', action: body.action || 'notify', createdAt: new Date().toISOString() });
    writeAlertRules(list);
    res.status(201).json(list[list.length - 1]);
  } catch (err) {
    res.status(500).json({ error: err.message || '添加规则失败' });
  }
});
app.get('/api/alerts/events', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    res.json(readAlertEvents().slice(-limit).reverse());
  } catch (err) {
    res.status(500).json({ error: err.message || '读取告警事件失败' });
  }
});
app.post('/api/alerts/check', (_req, res) => {
  try {
    const events = [];
    const hexList = getRobotsList().filter((r) => r.id !== 'main');
    hexList.filter((r) => !r.running).forEach((r) => {
      events.push({ type: 'hexagram_crashed', hexId: r.id, severity: 'critical' });
      appendAlertEvent({ type: 'hexagram_crashed', hexId: r.id, severity: 'critical' });
    });
    const rev = readRevenueState();
    if (rev.transactions.length >= 2) {
      const lastTwo = rev.transactions.slice(-2);
      const a = lastTwo[1].amount;
      const b = lastTwo[0].amount;
      if (a > 0 && b < a * 0.7) {
        events.push({ type: 'revenue_drop', severity: 'warning' });
        appendAlertEvent({ type: 'revenue_drop', severity: 'warning' });
      }
    }
    res.json({ checked: true, events });
  } catch (err) {
    res.status(500).json({ error: err.message || '告警检查失败' });
  }
});

app.post('/api/self-heal/hexagrams', async (req, res) => {
  try {
    const list = getRobotsList().filter((r) => r.id !== 'main' && !r.running);
    const restarted = [];
    for (const r of list) {
      const worker = getWorkerByHex(r.id);
      if (worker) {
        try {
          startGatewayInBackground({ workerId: worker.workerId });
          restarted.push(r.id);
          const dec = readDecisions();
          dec.push({ id: 'd' + (dec.length + 1), type: 'self_heal', payload: { hexId: r.id }, createdAt: new Date().toISOString() });
          writeDecisions(dec);
        } catch (_) {}
      }
    }
    res.json({ restarted, count: restarted.length });
  } catch (err) {
    res.status(500).json({ error: err.message || '自愈执行失败' });
  }
});

const HIERARCHY_FILE = path.join(DATA_DIR, 'hierarchy.json');
const DEFAULT_HIERARCHY = { supervisors: { qian: ['h11','h12','h13','h14','h15','h16','h17'], kun: ['h18','h19','h20','h21','h22','h23','h24'], tai: ['h25','h26','h27','h28','h29','h30','h31'], pi: ['h32','h33','h34','h35','h36','h37','h38'], xun: ['h39','h40','h41','h42','h43','h44','h45'], yu: ['h46','h47','h48','h49','h50','h51','h52'], sui: ['h53','h54','h55','h56','h57','h58','h59'], gu: ['h60','h61','h62','h63','h64'] } };
function readHierarchy() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(HIERARCHY_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return DEFAULT_HIERARCHY;
  }
}
function writeHierarchy(obj) {
  ensureDataDir();
  fs.writeFileSync(HIERARCHY_FILE, JSON.stringify(obj, null, 2), 'utf8');
}
app.get('/api/hierarchy', (_req, res) => {
  try {
    res.json(readHierarchy());
  } catch (err) {
    res.status(500).json({ error: err.message || '读取分级失败' });
  }
});
app.get('/api/hexagrams/:id/supervisor', (req, res) => {
  try {
    const h = readHierarchy();
    const sub = (h.supervisors || {});
    for (const [sup, ids] of Object.entries(sub)) {
      if (ids.includes(req.params.id)) return res.json({ supervisor: sup });
    }
    res.json({ supervisor: null });
  } catch (err) {
    res.status(500).json({ error: err.message || '查询失败' });
  }
});
app.get('/api/hexagrams/:id/subordinates', (req, res) => {
  try {
    const h = readHierarchy();
    const ids = (h.supervisors || {})[req.params.id];
    res.json(ids ? { subordinates: ids } : { subordinates: [] });
  } catch (err) {
    res.status(500).json({ error: err.message || '查询失败' });
  }
});

app.post('/api/reports/generate', (req, res) => {
  try {
    const body = req.body || {};
    const type = body.type || 'daily';
    const rev = readRevenueState();
    const profiles = getHexagramProfilesMerged();
    const decisions = readDecisions().slice(-10).reverse();
    const projects = readProjects();
    const lines = [
      '# ' + (type === 'daily' ? '日报' : type === 'weekly' ? '周报' : '月报') + ' - ' + new Date().toISOString().slice(0, 10),
      '',
      '## 收益概览',
      '- 总收益: ' + rev.totalRevenue,
      '- 升级资金池: ' + rev.upgradePool + ' (20%)',
      '',
      '## 各卦表现',
      ...profiles.slice(0, 10).map((p) => '- ' + p.name + ' (' + p.id + '): ' + (p.performance && p.performance.revenue) + ' 收益, 状态 ' + p.status),
      '',
      '## 近期决策',
      ...decisions.slice(0, 5).map((d) => '- [' + d.type + '] ' + JSON.stringify(d.payload).slice(0, 80)),
      '',
      '## 项目与待办',
      ...projects.slice(0, 5).map((p) => '- ' + p.name + ': ' + (p.tasks && p.tasks.filter((t) => t.status !== 'completed').length) + ' 待办')
    ];
    const content = lines.join('\n');
    const reports = readReports();
    const id = 'r' + (reports.length + 1);
    reports.push({ id, type, title: type + '-' + new Date().toISOString().slice(0, 10), content, createdAt: new Date().toISOString() });
    writeReports(reports);
    res.status(201).json({ id, type, title: reports[reports.length - 1].title, contentLength: content.length });
  } catch (err) {
    res.status(500).json({ error: err.message || '生成汇报失败' });
  }
});
// ---------- 阴升级 Phase 4 结束 ----------

// 与阴对话：走阴网关 18789（与终端 moltbot TUI 同一 Claw），不再用 Bala。网关需启用 HTTP chatCompletions。
const MAIN_GATEWAY_HTTP = `http://127.0.0.1:${MAIN_GATEWAY_PORT}`;
function getMainGatewayToken() {
  const envToken = process.env.YINOVA_GATEWAY_TOKEN || process.env.OPENCLAW_GATEWAY_TOKEN || process.env.CLAWDBOT_MAIN_GATEWAY_TOKEN || '';
  if (envToken) return envToken;
  // 优先从项目内 yin/moltbot.json 读取（install.sh 生成，含随机 token）
  const readTokenFromMoltbot = (p) => {
    try {
      if (!fs.existsSync(p)) return '';
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      const auth = (j.gateway && j.gateway.auth) ? j.gateway.auth : {};
      return String(auth.token || auth.password || '');
    } catch (_) { return ''; }
  };
  const fromYin = readTokenFromMoltbot(path.join(ROOT_DIR, 'yin', 'moltbot.json'));
  if (fromYin) return fromYin;
  // 兜底：全局 ~/.moltbot/moltbot.json
  return readTokenFromMoltbot(path.join(os.homedir(), '.moltbot', 'moltbot.json'));
}
// 聊天历史持久化存储（本地文件，不依赖浏览器缓存）
const CHAT_DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(CHAT_DATA_DIR)) fs.mkdirSync(CHAT_DATA_DIR, { recursive: true });

function getChatHistoryPath(projectId, mode) {
  // mode: 'discuss' | 'single' | 'yin'
  const safeId = String(projectId || 'default').replace(/[^a-zA-Z0-9_\-]/g, '_');
  return path.join(CHAT_DATA_DIR, `chat_${mode}_${safeId}.json`);
}

// 文件写入队列：同一路径的写入串行化，防止并发覆盖
const _writeQueues = new Map(); // filePath -> Promise
function queuedWriteFile(filePath, data) {
  const prev = _writeQueues.get(filePath) || Promise.resolve();
  const next = prev.then(() => {
    fs.writeFileSync(filePath, data, 'utf8');
  }).catch(e => { console.warn('[writeQueue]', filePath, e.message); });
  _writeQueues.set(filePath, next);
  // 队列完成后清理，防内存泄漏
  next.then(() => { if (_writeQueues.get(filePath) === next) _writeQueues.delete(filePath); });
  return next;
}

// GET /api/chat-history/:projectId/:mode — 读取聊天记录（projectId 不能为空，避免落成 default 串项目）
app.get('/api/chat-history/:projectId/:mode', (req, res) => {
  const projectId = String(req.params.projectId || '').trim();
  let mode = req.params.mode;
  if (!projectId) return res.status(400).json({ error: 'projectId 不能为空' });
  // 兼容前端 agent 视图：agent 历史复用 discuss 通道
  if (mode === 'agent') mode = 'discuss';
  if (!['discuss', 'single', 'yin'].includes(mode)) return res.status(400).json({ error: '无效的 mode' });
  const filePath = getChatHistoryPath(projectId, mode);
  try {
    if (!fs.existsSync(filePath)) return res.json({ messages: [] });
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const list = Array.isArray(data) ? data : (data && Array.isArray(data.messages) ? data.messages : []);
    res.json({ messages: list });
  } catch (e) {
    res.json({ messages: [] });
  }
});

// POST /api/chat-history/:projectId/:mode — 保存聊天记录（队列写入，防并发覆盖）
app.post('/api/chat-history/:projectId/:mode', (req, res) => {
  const projectId = String(req.params.projectId || '').trim();
  let mode = req.params.mode;
  if (!projectId) return res.status(400).json({ error: 'projectId 不能为空' });
  if (mode === 'agent') mode = 'discuss';
  if (!['discuss', 'single', 'yin'].includes(mode)) return res.status(400).json({ error: '无效的 mode' });
  const { messages } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages 必须是数组' });
  const filePath = getChatHistoryPath(projectId, mode);
  queuedWriteFile(filePath, JSON.stringify(messages, null, 2))
    .then(() => res.json({ ok: true, count: messages.length }))
    .catch(e => res.status(500).json({ error: '写入失败: ' + e.message }));
});

// ─── 项目记忆 ─────────────────────────────────────────────────────────────────
// 格式：{ projectId, entries: [{ date, type, content }] }
function getProjectMemoryPath(projectId) {
  const safeId = String(projectId || 'default').replace(/[^a-zA-Z0-9_\-]/g, '_');
  return path.join(CHAT_DATA_DIR, `project_memory_${safeId}.json`);
}
function readProjectMemory(projectId) {
  try {
    const p = getProjectMemoryPath(projectId);
    if (!fs.existsSync(p)) return { projectId, entries: [] };
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) { return { projectId, entries: [] }; }
}

// GET /api/project-memory/:id
app.get('/api/project-memory/:id', (req, res) => {
  res.json(readProjectMemory(req.params.id));
});

// POST /api/project-memory/:id — 追加一条记忆
app.post('/api/project-memory/:id', (req, res) => {
  const { type, content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content 必填' });
  try {
    const mem = readProjectMemory(req.params.id);
    const date = new Date().toISOString().slice(0, 10);
    mem.entries.push({ date, type: type || '备注', content: String(content) });
    fs.writeFileSync(getProjectMemoryPath(req.params.id), JSON.stringify(mem, null, 2), 'utf8');
    res.json({ ok: true, count: mem.entries.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/project-memory/:id — 整体覆盖（前端批量更新用）
app.put('/api/project-memory/:id', (req, res) => {
  const { entries } = req.body || {};
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries 必须是数组' });
  try {
    const mem = { projectId: req.params.id, entries };
    fs.writeFileSync(getProjectMemoryPath(req.params.id), JSON.stringify(mem, null, 2), 'utf8');
    res.json({ ok: true, count: entries.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/project-memory/:id — 清空记忆
app.delete('/api/project-memory/:id', (req, res) => {
  try {
    const p = getProjectMemoryPath(req.params.id);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ─────────────────────────────────────────────────────────────────────────────

// DELETE /api/chat-history/:projectId/:mode — 清空聊天记录
app.delete('/api/chat-history/:projectId/:mode', (req, res) => {
  const projectId = String(req.params.projectId || '').trim();
  let mode = req.params.mode;
  if (!projectId) return res.status(400).json({ error: 'projectId 不能为空' });
  if (mode === 'agent') mode = 'discuss';
  if (!['discuss', 'single', 'yin', 'all'].includes(mode)) return res.status(400).json({ error: '无效的 mode' });
  try {
    if (mode === 'all') {
      ['discuss', 'single', 'yin'].forEach(m => {
        const p = getChatHistoryPath(projectId, m);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
    } else {
      const p = getChatHistoryPath(projectId, mode);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: '删除失败: ' + e.message });
  }
});

app.get('/api/yin/status', (_req, res) => {
  res.json({ configured: true, source: 'gateway', port: MAIN_GATEWAY_PORT });
});

// 检测阴网关 API 是否正常（返回 JSON 而非 HTML）
app.get('/api/yin/gateway/health', async (_req, res) => {
  const result = { port: MAIN_GATEWAY_PORT, ok: false, error: null };
  try {
    if (!isPortInUse(MAIN_GATEWAY_PORT)) {
      result.error = '阴网关未启动（端口 ' + MAIN_GATEWAY_PORT + ' 未监听）。请点击「阴·启动」。';
      return res.json(result);
    }
    const headers = { 'Content-Type': 'application/json' };
    const token = getMainGatewayToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(`${MAIN_GATEWAY_HTTP}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: 'openclaw', messages: [{ role: 'user', content: 'ping' }] }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const body = await r.text();
    if (body.trim().startsWith('<') || body.includes('<!DOCTYPE') || body.includes('<html')) {
      result.error = '阴网关返回了网页而非 JSON。请确认 gateway.http.endpoints.chatCompletions.enabled = true，并重启阴网关。';
    } else if (r.ok) {
      result.ok = true;
    } else {
      result.error = 'HTTP ' + r.status + ': ' + (body.slice(0, 150) || '');
    }
  } catch (e) {
    result.error = e.message || '连接失败';
  }
  res.json(result);
});

// 与阴对话改为「先返回 taskId + 后台请求」，换页不中断，前端轮询取结果
const yinTaskStore = new Map();
app.get('/api/yin/task/:taskId', (req, res) => {
  const task = yinTaskStore.get(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'task not found' });
  res.json(task);
});

// 读取项目卦群讨论记录，供阴监控群聊
function readHexDiscussForYin(projectId, maxMessages = 30, maxContentLen = 800) {
  try {
    const filePath = getChatHistoryPath(projectId, 'discuss');
    if (!fs.existsSync(filePath)) return '';
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const list = Array.isArray(data) ? data : (data && Array.isArray(data.messages) ? data.messages : []);
    const recent = list.slice(-maxMessages);
    if (recent.length === 0) return '';
    const lines = recent.map((m) => {
      const name = m.type === 'user' ? '用户' : (m.name || '卦');
      const content = String(m.message || '').slice(0, maxContentLen);
      return content ? `${name}：${content}` : null;
    }).filter(Boolean);
    return lines.length > 0 ? `【项目卦群最近讨论（供你监控决策）】\n${lines.join('\n\n')}` : '';
  } catch (e) { return ''; }
}

function buildYinMessages(projectId, history, text) {
  const messages = [];
  if (projectId) {
    try {
      const projectList = readProjects();
      const project = projectList.find(p => p.id === projectId);
      if (project) {
        const hexNamesWithLabels = project.hexIds && project.hexIds.length > 0
          ? project.hexIds.map(id => formatHexNameWithLabel(id)).join('、')
          : '无';
        let systemContent = `当前项目上下文：
- 项目ID: ${project.id}
- 项目名称: ${project.name}
- 已选卦: ${hexNamesWithLabels}

重要：用户正在项目"${project.name}"中与你对话。如果用户要求选卦、启动卦等操作，应该在这个项目中操作，而不是新建项目。只有在用户明确要求新建项目时，才创建新项目。`;
        const mem = readProjectMemory(projectId);
        if (Array.isArray(mem.entries) && mem.entries.length > 0) {
          const recent = mem.entries.slice(-20);
          const memLines = recent.map(e => `- ${e.date} [${e.type || '备注'}] ${String(e.content || '').slice(0, 200)}`).filter(Boolean);
          if (memLines.length > 0) systemContent += `\n\n项目记忆（最近${memLines.length}条）：\n` + memLines.join('\n');
        }
        const discussContent = readHexDiscussForYin(projectId);
        if (discussContent) {
          systemContent += `\n\n${discussContent}\n\n你可以基于以上卦群讨论内容回答用户关于「群里在聊什么」「讨论进展如何」等问题，并在用户请求时给出结构化决策意见。`;
        }
        messages.push({ role: 'system', content: systemContent });
      }
    } catch (e) { console.warn('[yin/chat] 获取项目信息失败:', e.message); }
  }
  if (Array.isArray(history) && history.length > 0) {
    const YIN_COMPRESS = 25, YIN_KEEP = 10;
    if (history.length > YIN_COMPRESS) {
      const oldPart = history.slice(0, history.length - YIN_KEEP);
      const recentPart = history.slice(-YIN_KEEP);
      const summaryLines = oldPart.map((h) => {
        const role = h.role === 'yin' ? '阴' : '用户';
        const content = String(h.text || h.message || '').slice(0, 120);
        return content ? `${role}: ${content}` : null;
      }).filter(Boolean);
      if (summaryLines.length > 0) {
        messages.push({ role: 'system', content: `【历史对话摘要（共${oldPart.length}条，已压缩）】\n${summaryLines.join('\n')}\n\n以下是最近的对话：` });
      }
      for (const h of recentPart) {
        const role = h.role === 'yin' ? 'assistant' : 'user';
        const content = String(h.text || h.message || '');
        if (content) messages.push({ role, content });
      }
    } else {
      const recentHistory = history.slice(-15);
      for (const h of recentHistory) {
        const role = h.role === 'yin' ? 'assistant' : 'user';
        const content = String(h.text || h.message || '');
        if (content) messages.push({ role, content });
      }
    }
  }
  messages.push({ role: 'user', content: text });
  return messages;
}

app.post('/api/yin/chat', (req, res) => {
  const { message, projectId, history } = req.body || {};
  const text = (message != null ? String(message) : '').trim();
  if (!text) return res.json({ taskId: null, reply: '', error: null });
  const taskId = `yintask_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const task = { status: 'running', reply: null, error: null, createdAt: Date.now() };
  yinTaskStore.set(taskId, task);
  res.json({ taskId });
  (async () => {
    // 若阴网关未启动，则在后台自动拉起，再尝试调用 HTTP chat 接口，避免每次都要求用户手动点「阴·启动」
    try {
      if (!isPortInUse(MAIN_GATEWAY_PORT)) {
        startMainGatewayInBackground();
        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          if (isPortInUse(MAIN_GATEWAY_PORT)) break;
        }
      }
    } catch (_) {}
    const headers = { 'Content-Type': 'application/json' };
    const token = getMainGatewayToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const messages = buildYinMessages(projectId, history || [], text);
      const response = await fetch(`${MAIN_GATEWAY_HTTP}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: 'openclaw', messages }),
      });
      const rawBody = await response.text();
      let data = {};
      try {
        if (rawBody.trim().startsWith('<') || rawBody.includes('<!DOCTYPE') || rawBody.includes('<html')) {
          task.error = '阴网关返回了网页而非 JSON。可能原因：1) 访问了错误路径（正确为 POST /v1/chat/completions）；2) 阴网关未启用 HTTP chatCompletions；3) 阴网关未正确启动。请确认 yin/moltbot.json 中 gateway.http.endpoints.chatCompletions.enabled = true，并先点击「阴·启动」。';
          task.status = 'error';
          return;
        }
        data = JSON.parse(rawBody);
      } catch (_) {
        if (rawBody.length > 200) {
          task.error = '阴网关返回了非 JSON 格式。请确认阴网关已正确启动（点击阴·启动），且 yin/moltbot.json 中 gateway.http.endpoints.chatCompletions.enabled = true。';
        } else {
          task.error = '阴网关响应异常：' + (rawBody.slice(0, 100) || '空响应');
        }
        task.status = 'error';
        return;
      }
      if (!response.ok) {
        const errMsg = data.error?.message || data.message || `HTTP ${response.status}`;
        if (response.status === 404 || response.status === 405) {
          task.error = '阴网关未开启或不允许 HTTP Chat 接口。请在阴的配置（yin/moltbot.json）中设置 gateway.http.endpoints.chatCompletions.enabled = true 后重启阴网关。';
        } else if (response.status === 401) {
          task.error = '阴网关鉴权失败(Unauthorized)。请检查 yin/moltbot.json 或环境变量 YINOVA_GATEWAY_TOKEN。';
        } else {
          task.error = errMsg;
        }
        task.status = 'error';
      } else {
        task.reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ? String(data.choices[0].message.content) : '';
        task.status = 'done';
      }
    } catch (err) {
      const detail = err.cause ? (err.cause.message || String(err.cause)) : '';
      task.error = (detail ? `${err.message} (${detail})` : (err.message || '阴网关不可达')) + '。请先启动阴网关（点阴·启动），或查看运行面板的终端里的报错。';
      task.status = 'error';
      console.error('[yin/chat] 请求阴网关失败:', err.message, detail || '');
    }
    setTimeout(() => { yinTaskStore.delete(taskId); }, 300000);
  })();
});

// 解析消息中的 @卦名，返回被 @ 的卦的 id 列表（去重）；若无 @ 则返回空数组（表示不限制，用项目已选卦）
function parseMentionedHexIds(message) {
  const msg = String(message || '');
  const mentioned = [];
  for (const h of HEXAGRAM_ROBOTS) {
    if (msg.includes('@' + h.name)) mentioned.push(h.id);
  }
  return [...new Set(mentioned)];
}

// 与卦对话（E）：向本项目所选卦发消息，各卦网关需启用 chatCompletions（同阴网关）
// 支持 @ 触发：消息中含 @坤、@随 @否 等时，只向被 @ 且在本项目中的卦发请求；不含 @ 则群发
// 超时控制：给单个卦的 fetch 加 AbortSignal，防止卦进程卡住导致整个请求挂死
const HEX_FETCH_TIMEOUT_MS = 120000; // 120s
function hexFetchSignal() {
  return AbortSignal.timeout ? AbortSignal.timeout(HEX_FETCH_TIMEOUT_MS) : undefined;
}

// 异步任务存储：taskId -> { status: 'running'|'done'|'error'|'expired', replies, error, createdAt }
const hexTaskStore = new Map();
const HEX_TASKS_FILE = path.join(CHAT_DATA_DIR, 'hex-tasks.json');

// 启动时从磁盘加载已有任务（10分钟内未完成的标为 expired）
(function loadHexTasks() {
  try {
    if (!fs.existsSync(HEX_TASKS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(HEX_TASKS_FILE, 'utf8'));
    const cutoff = Date.now() - 600000; // 10分钟
    for (const [id, task] of Object.entries(raw)) {
      if (task.status === 'running' && task.createdAt < cutoff) {
        task.status = 'expired';
        task.error = '服务重启后任务超时';
      }
      hexTaskStore.set(id, task);
    }
    console.log(`[hex-tasks] 加载 ${hexTaskStore.size} 个历史任务`);
  } catch (e) { console.warn('[hex-tasks] 加载失败:', e.message); }
})();

function saveHexTasksToDisk() {
  try {
    const obj = {};
    for (const [id, task] of hexTaskStore) obj[id] = task;
    fs.writeFileSync(HEX_TASKS_FILE, JSON.stringify(obj), 'utf8');
  } catch (e) { console.warn('[hex-tasks] 保存失败:', e.message); }
}

// 定期清理超过1小时的旧任务并持久化
setInterval(() => {
  const cutoff = Date.now() - 3600000;
  let changed = false;
  for (const [id, task] of hexTaskStore) {
    if (task.createdAt < cutoff) { hexTaskStore.delete(id); changed = true; }
  }
  if (changed) saveHexTasksToDisk();
}, 600000);

// 轮询接口：前端用 taskId 查询任务状态
app.get('/api/hex/task/:taskId', (req, res) => {
  const task = hexTaskStore.get(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'task not found' });
  res.json(task);
});

// 支持对话历史：history 格式为 [{ type: 'user'|'hex', name?: string, message: string }]
// 支持真正的群聊：卦回复后，广播给其他卦
// 立即返回 taskId，后台异步处理，前端通过 /api/hex/task/:taskId 轮询结果
app.post('/api/hex/chat', (req, res) => {
  const taskId = `hextask_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const task = { status: 'running', replies: null, error: null, createdAt: Date.now() };
  hexTaskStore.set(taskId, task);
  saveHexTasksToDisk();
  res.json({ taskId });
  // 后台异步处理
  (async () => {
  try {
  const { message, hexIds, history, enableBroadcast, maxRounds, projectId: reqProjectId } = req.body || {};
  const text = (message != null ? String(message) : '').trim();
  const ids = Array.isArray(hexIds) ? hexIds : [];
  const hist = Array.isArray(history) ? history : [];
  const broadcast = enableBroadcast === true;
  const rounds = Math.min(Math.max(parseInt(maxRounds, 10) || 2, 1), 5);
  if (!text) return res.json({ replies: [] });
  const projectHexIds = ids.length ? ids : HEXAGRAM_ROBOTS.map((h) => h.id);
  const mentioned = parseMentionedHexIds(text);
  const hexList = mentioned.length > 0 ? projectHexIds.filter((id) => mentioned.includes(id)) : projectHexIds;

  // 项目上下文 system message（让卦知道自己在哪个项目里，并注入项目记忆）
  let projectSystemMsg = null;
  if (reqProjectId) {
    try {
      if (reqProjectId === HEX_DEFINITION_PROJECT_ID) {
        const hexDef = readHexDefinitionConfig();
        const hexNamesWithLabels = (hexDef.hexIds || []).map((id) => formatHexNameWithLabel(id)).join('、');
        projectSystemMsg = {
          role: 'system',
          content: `当前是「卦的自定义」场景，参与卦：${hexNamesWithLabels || '无'}。你可通过写入 workspace/我的定义.md 来更新自己的人设（角色、擅长、边界等）。与用户或其它卦讨论后，若达成共识即可写入该文件。`
        };
      } else {
        const projectList = readProjects();
        const proj = projectList.find((p) => p.id === reqProjectId);
        if (proj) {
          const hexNamesWithLabels = (proj.hexIds || []).map((id) => formatHexNameWithLabel(id)).join('、');
          // 读取项目记忆，最多注入最近20条
          let memoryText = '';
          try {
            const mem = readProjectMemory(reqProjectId);
            if (mem.entries && mem.entries.length > 0) {
              const recent = mem.entries.slice(-20);
              memoryText = '\n\n项目记忆（按时间）：\n' + recent.map(e => `- ${e.date} [${e.type}] ${e.content}`).join('\n') + '\n\n此处为面板对话，项目记忆优先于你本地工作区记忆，若有冲突以项目记忆为准。';
            }
          } catch (e) { /* 记忆读取失败不影响主流程 */ }
          projectSystemMsg = {
            role: 'system',
            content: `当前项目上下文：项目名称"${proj.name}"，参与卦：${hexNamesWithLabels || '无'}。你是该项目的参与者，请围绕项目背景作答。${memoryText}`
          };
        }
      }
    } catch (e) { /* 获取项目信息失败时忽略，不影响主流程 */ }
  }

  // 构建消息历史：将历史转换为 OpenAI 格式的 messages
  // 按字符数估算 token（中文约1.5字/token，英文约4字/token，保守取2字/token）
  // 超过 MAX_CHARS 时从最旧的消息开始压缩，保留最近 KEEP_RECENT 条原始消息
  const MAX_CHARS = 60000;   // 约3万token，留充足余量给模型回复（GLM-5上下文128k）
  const KEEP_RECENT = 10;    // 压缩时保留最近10条完整原文
  const COMPRESS_THRESHOLD = 30; // 条数阈值（次要条件，字符数是主要条件）
  const buildMessages = (baseHistory) => {
    const msgs = [];
    if (projectSystemMsg) msgs.push(projectSystemMsg);

    // 计算历史总字符数
    const totalChars = baseHistory.reduce((sum, h) => sum + String(h.message || '').length, 0);
    const needCompress = baseHistory.length > COMPRESS_THRESHOLD || totalChars > MAX_CHARS;

    if (needCompress) {
      // 从最旧的消息开始裁减，直到剩余部分字符数在限制内
      let recentPart = baseHistory.slice(-KEEP_RECENT);
      let recentChars = recentPart.reduce((sum, h) => sum + String(h.message || '').length, 0);
      // 在字符限制内尽量多保留最近的消息
      let extra = baseHistory.slice(0, baseHistory.length - KEEP_RECENT);
      while (extra.length > 0 && recentChars + String(extra[extra.length - 1].message || '').length < MAX_CHARS * 0.7) {
        const item = extra.pop();
        recentPart = [item, ...recentPart];
        recentChars += String(item.message || '').length;
      }
      // 把剩余旧消息压缩成摘要（每条截取前80字）
      const oldPart = extra;
      const summaryLines = oldPart.map((h) => {
        const type = h.type || 'user';
        const msg = String(h.message || '').slice(0, 80);
        if (type === 'user') return `用户: ${msg}`;
        if (type === 'hex' && h.name) return `${h.name}: ${msg}`;
        return null;
      }).filter(Boolean);
      if (summaryLines.length > 0) {
        msgs.push({
          role: 'system',
          content: `【历史对话摘要（共${oldPart.length}条，已压缩）】\n${summaryLines.join('\n')}\n\n以下是最近的对话：`
        });
      }
      for (const h of recentPart) {
        const type = h.type || 'user';
        const msg = String(h.message || '');
        if (!msg) continue;
        if (type === 'user') msgs.push({ role: 'user', content: msg });
        else if (type === 'hex' && h.name) msgs.push({ role: 'assistant', content: `${h.name}: ${msg}` });
      }
    } else {
      // 正常：最多保留20条
      const recentHistory = baseHistory.slice(-20);
      for (const h of recentHistory) {
        const type = h.type || 'user';
        const msg = String(h.message || '');
        if (!msg) continue;
        if (type === 'user') msgs.push({ role: 'user', content: msg });
        else if (type === 'hex' && h.name) msgs.push({ role: 'assistant', content: `${h.name}: ${msg}` });
      }
    }
    return msgs;
  };
  
  // 第一轮：向所有卦并行发送用户消息（并行可显著缩短总耗时）
  // 群发单聊：只传用户消息作为历史，卦看不到任何卦的回复（包括上一轮）
  const firstRoundHistory = broadcast ? hist : hist.filter((h) => String(h && h.type) === 'user');
  const baseMessages = buildMessages(firstRoundHistory);
  baseMessages.push({ role: 'user', content: text });
  
  const results = [];
  const hexReplies = new Map(); // 存储卦的回复，用于广播
  
  const firstRoundPromises = hexList.map(async (hexId) => {
    const hex = HEXAGRAM_ROBOTS.find((h) => h.id === hexId);
    const worker = hex ? getWorkerByHex(hexId) : null;
    const name = hex ? hex.name : hexId;
    const port = worker ? parseInt(worker.port, 10) : null;
    const token = worker && worker.token ? worker.token : '';
    if (!port) return { hexId, name, reply: null, error: '无此卦或未配置端口' };
    const url = `http://127.0.0.1:${port}/v1/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: 'openclaw', messages: baseMessages }),
        signal: hexFetchSignal(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errMsg = data.error?.message || data.message || `HTTP ${response.status}`;
        return { hexId, name, reply: null, error: errMsg };
      }
      const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ? String(data.choices[0].message.content) : '';
      if (reply && broadcast) hexReplies.set(hexId, { name, reply });
      return { hexId, name, reply, error: null };
    } catch (err) {
      const code = err.cause?.code || err.code;
      const msg = err.message || '';
      let hint = msg;
      if (err.name === 'TimeoutError' || code === 'ABORT_ERR') {
        hint = `响应超时（>${HEX_FETCH_TIMEOUT_MS / 1000}s）：卦进程可能卡住，建议重启该卦。`;
      } else if (code === 'ECONNREFUSED' || msg === 'fetch failed') {
        hint = '连接被拒绝：请确认该卦 Gateway 已启动（面板中对该卦点击「启动」），且 moltbot.json 中 gateway.http.endpoints.chatCompletions.enabled 为 true；修改配置后需重启该卦。';
      }
      return { hexId, name, reply: null, error: hint };
    }
  });
  const firstRoundResults = await Promise.all(firstRoundPromises);
  firstRoundResults.forEach((r) => results.push(r));
  
  // 第二轮：仅当启用广播且轮数>=2 时，将每个卦的回复并行发给其他卦
  if (broadcast && rounds >= 2 && hexReplies.size > 1) {
    const broadcastHistoryBase = [...hist];
    broadcastHistoryBase.push({ type: 'user', message: text });
    for (const [hexId, reply] of hexReplies) {
      const hex = HEXAGRAM_ROBOTS.find((h) => h.id === hexId);
      const name = hex ? hex.name : hexId;
      broadcastHistoryBase.push({ type: 'hex', name, message: reply.reply });
    }
    const broadcastTasks = [];
    for (const [senderHexId, senderReply] of hexReplies) {
      const broadcastMessages = buildMessages(broadcastHistoryBase);
      broadcastMessages.push({
        role: 'user',
        content: `以上是群聊中的对话。${senderReply.name}说："${senderReply.reply}"。你可以基于这些对话继续讨论。`
      });
      for (const hexId of hexList) {
        if (hexId === senderHexId) continue;
        const worker = (HEXAGRAM_ROBOTS.find((h) => h.id === hexId)) ? getWorkerByHex(hexId) : null;
        const port = worker ? parseInt(worker.port, 10) : null;
        const token = worker && worker.token ? worker.token : '';
        if (!port) continue;
        const url = `http://127.0.0.1:${port}/v1/chat/completions`;
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        broadcastTasks.push({ hexId, url, headers, broadcastMessages });
      }
    }
    const broadcastResults = await Promise.all(
      broadcastTasks.map(async ({ hexId, url, headers, broadcastMessages }) => {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ model: 'openclaw', messages: broadcastMessages }),
            signal: hexFetchSignal(),
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok) {
            const followUpReply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ? String(data.choices[0].message.content) : '';
            return { hexId, followUpReply };
          }
        } catch (err) {
          const isTimeout = err.name === 'TimeoutError' || (err.cause?.code === 'ABORT_ERR');
          console.warn(`[hex/chat] 广播给 ${hexId} 失败${isTimeout ? '（超时）' : ''}:`, err.message);
        }
        return { hexId, followUpReply: '' };
      })
    );
    for (const { hexId, followUpReply } of broadcastResults) {
      if (!followUpReply) continue;
      const resultIndex = results.findIndex(r => r.hexId === hexId);
      if (resultIndex >= 0 && results[resultIndex].reply) {
        results[resultIndex].reply += '\n\n[看到其他卦的回复后] ' + followUpReply;
      }
    }
  }

  // 第3轮起的额外迭代轮次（broadcast 模式）：每轮让有实际回复的卦看到当前讨论全文并补充
  // 第3轮：收口补充；第4-5轮：深度迭代讨论
  if (broadcast && rounds >= 3) {
    const extraRoundCount = rounds - 2; // 需要额外执行的轮次数（3轮=1次，4轮=2次，5轮=3次）
    for (let extraRound = 1; extraRound <= extraRoundCount; extraRound++) {
      const roundNum = 2 + extraRound;
      const activeHexIds = results.filter((r) => r.reply).map((r) => r.hexId);
      if (activeHexIds.length === 0) break;
      const roundBase = buildMessages(hist);
      roundBase.push({ role: 'user', content: text });
      for (const r of results) {
        if (r.reply) roundBase.push({ role: 'assistant', content: `${r.name}: ${r.reply}` });
      }
      const isLastRound = extraRound === extraRoundCount;
      const roundPrompt = isLastRound
        ? '以上是当前讨论。请再简短补充一句收口（可选，无则说「无」）。'
        : `以上是当前讨论（第${roundNum}轮）。请基于上面所有观点，补充你的新看法或进一步论证（如无新观点可说「无」）。`;
      roundBase.push({ role: 'user', content: roundPrompt });
      const roundPromises = activeHexIds.map(async (hexId) => {
        const hex = HEXAGRAM_ROBOTS.find((h) => h.id === hexId);
        const worker = hex ? getWorkerByHex(hexId) : null;
        const port = worker ? parseInt(worker.port, 10) : null;
        const token = worker && worker.token ? worker.token : '';
        if (!port) return { hexId, extra: '' };
        const url = `http://127.0.0.1:${port}/v1/chat/completions`;
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        try {
          const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ model: 'openclaw', messages: roundBase }), signal: hexFetchSignal() });
          const data = await response.json().catch(() => ({}));
          if (response.ok) {
            const extra = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ? String(data.choices[0].message.content).trim() : '';
            return { hexId, extra };
          }
        } catch (err) {
          const isTimeout = err.name === 'TimeoutError' || (err.cause?.code === 'ABORT_ERR');
          console.warn(`[hex/chat] 第${roundNum}轮 ${hexId}${isTimeout ? ' 超时' : ''}:`, err.message);
        }
        return { hexId, extra: '' };
      });
      const roundResults = await Promise.all(roundPromises);
      for (const { hexId, extra } of roundResults) {
        if (!extra || extra === '无') continue;
        const idx = results.findIndex(r => r.hexId === hexId);
        if (idx >= 0 && results[idx].reply) results[idx].reply += `\n\n[第${roundNum}轮补充] ` + extra;
      }
    }
  }
  
  task.replies = results;
  task.status = 'done';
  saveHexTasksToDisk();

  // 任务完成后自动把本轮对话（用户消息 + 卦回复）追加保存到服务端历史文件
  // 这样切换页面/刷新后，历史加载时就能看到完整记录，不依赖前端及时保存
  if (reqProjectId && text) {
    try {
      const mode = broadcast ? 'discuss' : 'single';
      const histPath = getChatHistoryPath(reqProjectId, mode);
      let stored = [];
      try { stored = JSON.parse(fs.readFileSync(histPath, 'utf8')); } catch(e) { stored = []; }
      if (!Array.isArray(stored)) stored = [];
      // 追加用户消息
      stored.push({ type: 'user', message: text, ts: Date.now() });
      for (const r of results) {
        if (r.reply) stored.push({ type: 'hex', name: r.name, message: r.reply, ts: Date.now() });
        else if (r.error) stored.push({ type: 'hex', name: r.name, message: r.error, isError: true, ts: Date.now() });
      }
      await queuedWriteFile(histPath, JSON.stringify(stored, null, 2));
    } catch(e) {
      console.warn('[hex/chat] 自动保存历史失败:', e.message);
    }
  }

  } catch (err) {
    console.error('[api/hex/chat]', err);
    task.status = 'error';
    task.error = String(err && err.message || err);
    saveHexTasksToDisk();
  }
  })();
});

// ─── 卦 Agent 任务：通过 WebSocket 让卦用工具执行真实任务 ──────────────────────
// 与 /api/hex/chat 的区别：
//   hex/chat  → HTTP /v1/chat/completions → 卦只回复文字，不用工具
//   hex/agent-task → WebSocket "agent" 方法 → 卦完整执行（可 exec、fs_write 等工具），
//                    结果通过 chat.history 读取最新 assistant 消息
//
// 协议（与 openclaw tui 相同）：
//   1. WS 建连
//   2. 发 { type:"req", id, method:"connect", params:{ auth:{token}, client:{id,version,...}, ... } }
//   3. 收到 { type:"res", id, ok:true, payload:{type:"hello-ok"} }
//   4. 发 { type:"req", id2, method:"agent", params:{ message, idempotencyKey, sessionKey? } }
//   5. 收到 { type:"res", id2, ok:true, payload:{runId, status:"accepted"} }
//   6. 发 { type:"req", id3, method:"agent.wait", params:{ runId, timeoutMs } }
//   7. 收到 { type:"res", id3, ok:true, payload:{runId, status:"ok"|"timeout"|"error"} }
//   8. 发 { type:"req", id4, method:"chat.history", params:{ sessionKey, limit:1 } }
//   9. 收到最新 assistant 消息

const WebSocket = require('ws');
const { randomUUID } = require('crypto');
const nodeCrypto = require('crypto');

const AGENT_TASK_TIMEOUT_MS = 180000; // 3 分钟
const AGENT_STORE = new Map(); // agentTaskId -> task

// 帮助函数：base64url 编码
function base64UrlEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 构造 device auth payload 字符串（v1 格式）
function buildDeviceAuthPayload({ deviceId, clientId, clientMode, role, scopes, signedAtMs, token }) {
  const scopesStr = scopes.join(',');
  const tokenStr = token || '';
  return ['v1', deviceId, clientId, clientMode, role, scopesStr, String(signedAtMs), tokenStr].join('|');
}

// 读取卦的 device identity
function loadHexDeviceIdentity(stateDir) {
  try {
    const identityPath = path.join(stateDir, 'identity', 'device.json');
    const data = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
    return { deviceId: data.deviceId, publicKeyPem: data.publicKeyPem, privateKeyPem: data.privateKeyPem };
  } catch (_) { return null; }
}

// 推导 deviceId（publicKey 原始 bytes 的 sha256 hex 字符串）
function deriveDeviceId(publicKeyPem) {
  try {
    const key = nodeCrypto.createPublicKey(publicKeyPem);
    const spki = key.export({ type: 'spki', format: 'der' });
    // ED25519 SPKI prefix: 302a300506032b6570032100
    const prefix = Buffer.from('302a300506032b6570032100', 'hex');
    let raw;
    if (spki.length === prefix.length + 32 && spki.subarray(0, prefix.length).equals(prefix)) {
      raw = spki.subarray(prefix.length);
    } else {
      raw = spki;
    }
    return nodeCrypto.createHash('sha256').update(raw).digest('hex');
  } catch (_) { return null; }
}

/**
 * 通过 WebSocket 向卦发 agent 任务，等卦执行完后拿回最新 assistant 消息。
 * @returns {Promise<{reply:string|null, error:string|null}>}
 */
async function callHexAgentWS({ port, token, message, sessionKey, stateDir, timeoutMs = AGENT_TASK_TIMEOUT_MS }) {
  return new Promise((resolve) => {
    const url = `ws://127.0.0.1:${port}`;
    let settled = false;
    let ws;
    const done = (result) => {
      if (settled) return;
      settled = true;
      try { if (ws && ws.readyState <= 1) ws.close(); } catch (_) {}
      resolve(result);
    };
    const timer = setTimeout(() => done({ reply: null, error: `agent 任务超时（>${timeoutMs / 1000}s）` }), timeoutMs);

    try {
      ws = new WebSocket(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch (e) {
      clearTimeout(timer);
      return resolve({ reply: null, error: `WS 建连失败: ${e.message}` });
    }

    // 消息队列：等待特定 id 的回复
    const pending = new Map(); // id -> { resolve, reject }
    const send = (method, params) => {
      const id = randomUUID();
      ws.send(JSON.stringify({ type: 'req', id, method, params }));
      return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }));
    };

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (_) { return; }
      if (msg.type === 'res' && msg.id && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.ok) res(msg.payload);
        else rej(new Error(msg.error?.message || 'rpc error'));
      }
    });

    ws.on('error', (e) => { clearTimeout(timer); done({ reply: null, error: `WS 错误: ${e.message}` }); });
    ws.on('close', () => { if (!settled) { clearTimeout(timer); done({ reply: null, error: 'WS 连接意外关闭' }); } });

    ws.on('open', async () => {
      try {
        const CLIENT_ID = 'gateway-client';
        const CLIENT_MODE = 'ui';
        const ROLE = 'operator';
        const SCOPES = ['operator.admin'];

        // 构建 device identity 参数（需要签名才能保留 scopes；新版要求必须带 device.nonce）
        let deviceParam = undefined;
        const identity = stateDir ? loadHexDeviceIdentity(stateDir) : null;
        if (identity) {
          const signedAtMs = Date.now();
          const derivedId = deriveDeviceId(identity.publicKeyPem) || identity.deviceId;
          // 把公钥转为 base64url raw 格式
          const keyObj = nodeCrypto.createPublicKey(identity.publicKeyPem);
          const spkiDer = keyObj.export({ type: 'spki', format: 'der' });
          const prefix = Buffer.from('302a300506032b6570032100', 'hex');
          let rawPubKey;
          if (spkiDer.length === prefix.length + 32 && spkiDer.subarray(0, prefix.length).equals(prefix)) {
            rawPubKey = base64UrlEncode(spkiDer.subarray(prefix.length));
          } else {
            rawPubKey = base64UrlEncode(spkiDer);
          }
          // 构建并签名 payload
          const payload = buildDeviceAuthPayload({ deviceId: derivedId, clientId: CLIENT_ID, clientMode: CLIENT_MODE, role: ROLE, scopes: SCOPES, signedAtMs, token });
          const privKey = nodeCrypto.createPrivateKey(identity.privateKeyPem);
          const sigBuf = nodeCrypto.sign(null, Buffer.from(payload, 'utf8'), privKey);
          const signature = base64UrlEncode(sigBuf);
          const nonce = base64UrlEncode(nodeCrypto.randomBytes(16));
          deviceParam = { id: derivedId, publicKey: rawPubKey, signedAt: signedAtMs, signature, nonce };
        } else {
          // 即使没有 identity（老环境），也要提供一个带 nonce 的 device，否则会报缺少 nonce
          const fallbackNonce = base64UrlEncode(nodeCrypto.randomBytes(16));
          deviceParam = { id: 'panel-device', nonce: fallbackNonce };
        }

        // 1. connect 握手（带 device identity 和 scopes）
        await send('connect', {
          minProtocol: 1,
          maxProtocol: 99,
          client: { id: CLIENT_ID, version: '1.0.0', platform: 'nodejs', mode: CLIENT_MODE },
          role: ROLE,
          scopes: SCOPES,
          auth: token ? { token } : undefined,
          device: deviceParam,
          caps: [],
          commands: [],
        });

        // 2. 先快照 chat.history，记录发消息前的历史长度（用于事后找新回复）
        const beforeHistRes = await send('chat.history', {
          sessionKey: sessionKey || 'main',
          limit: 200,
        });
        const beforeMessages = beforeHistRes?.messages || [];
        const beforeCount = beforeMessages.length;
        // 记录最后一条 assistant 消息的时间戳（用于筛选新回复）
        const beforeLastAssistant = [...beforeMessages].reverse().find((m) => m.role === 'assistant');
        const beforeLastTs = beforeLastAssistant?.timestamp ?? 0;

        // 3. 发 agent 任务（必须指定 sessionKey，否则 gateway 不知道发给哪个 session）
        const idemKey = `panel-${Date.now()}-${randomUUID().slice(0, 8)}`;
        const agentRes = await send('agent', {
          message,
          idempotencyKey: idemKey,
          sessionKey: sessionKey || 'main',
        });
        const runId = agentRes?.runId;
        if (!runId) throw new Error('agent 没有返回 runId');

        // 4. 等待执行完成（分段等待，每次最多 30s，减少 WS 超时风险）
        const waitDeadline = Date.now() + timeoutMs - 8000;
        let agentDone = false;
        while (!agentDone && Date.now() < waitDeadline) {
          const remainMs = Math.min(30000, waitDeadline - Date.now());
          if (remainMs <= 0) break;
          const waitRes = await send('agent.wait', { runId, timeoutMs: remainMs });
          if (waitRes?.status === 'ok' || waitRes?.status === 'error') {
            agentDone = true;
          }
          // status=timeout 意味着还没完成，继续循环等待
        }
        // 等 2s 让 session 写入完成
        await new Promise((r) => setTimeout(r, 2000));

        // 5. 轮询 chat.history，直到出现比 beforeLastTs 更新的 assistant 消息（最多等 30s）
        const extractReply = (msgs) => {
          // 优先找时间戳更新的
          const newByTs = msgs.filter((m) => m.role === 'assistant' && typeof m.timestamp === 'number' && m.timestamp > beforeLastTs);
          let target = newByTs.length > 0 ? newByTs[newByTs.length - 1] : null;
          // fallback：找索引比 beforeCount 更靠后的
          if (!target && msgs.length > beforeCount) {
            const newByIdx = msgs.slice(beforeCount).filter((m) => m.role === 'assistant');
            target = newByIdx.length > 0 ? newByIdx[newByIdx.length - 1] : null;
          }
          if (!target) return null;
          if (typeof target.content === 'string') return target.content;
          if (Array.isArray(target.content)) {
            return target.content.filter((c) => c.type === 'text').map((c) => c.text || '').join('\n');
          }
          return null;
        };

        let reply = null;
        for (let attempt = 0; attempt < 6 && !reply; attempt++) {
          const afterHistRes = await send('chat.history', { sessionKey: sessionKey || 'main', limit: 200 });
          reply = extractReply(afterHistRes?.messages || []);
          if (!reply && attempt < 5) await new Promise((r) => setTimeout(r, 5000));
        }
        clearTimeout(timer);
        done({ reply: reply || '（卦已执行，无文字回复）', error: null });
      } catch (e) {
        clearTimeout(timer);
        done({ reply: null, error: e.message || 'agent 执行失败' });
      }
    });
  });
}

// 异步 agent 任务接口：立即返回 taskId，后台让卦执行任务
// POST /api/hex/agent-task
// body: { hexId, message, projectId?, sessionKey? }
app.post('/api/hex/agent-task', (req, res) => {
  const taskId = `agttask_${Date.now()}_${randomUUID().slice(0, 6)}`;
  const task = { status: 'running', reply: null, hexName: null, error: null, createdAt: Date.now() };
  AGENT_STORE.set(taskId, task);
  res.json({ taskId });

  (async () => {
    try {
      const { hexId, message, projectId, sessionKey } = req.body || {};
      if (!hexId || !message) { task.status = 'error'; task.error = '缺少 hexId 或 message'; return; }
      const hex = HEXAGRAM_ROBOTS.find((h) => h.id === hexId);
      const worker = hex ? getWorkerByHex(hexId) : null;
      if (!hex || !worker) { task.status = 'error'; task.error = '未找到该卦'; return; }
      const port = parseInt(worker.port, 10);
      const token = worker.token || '';
      const stateDir = worker.stateDir || '';
      task.hexName = hex.name;

      const { reply, error } = await callHexAgentWS({ port, token, message, sessionKey, stateDir, timeoutMs: AGENT_TASK_TIMEOUT_MS });
      task.reply = reply;
      task.error = error;
      task.status = error ? 'error' : 'done';

      // 自动保存到项目历史
      if (projectId && message && reply && !error) {
        try {
          const histPath = getChatHistoryPath(projectId, 'single');
          let stored = [];
          try { stored = JSON.parse(fs.readFileSync(histPath, 'utf8')); } catch(_) {}
          if (!Array.isArray(stored)) stored = [];
          stored.push({ type: 'user', message: `[任务] ${message}`, ts: Date.now() });
          stored.push({ type: 'hex', name: hex.name, message: reply, ts: Date.now() });
          await queuedWriteFile(histPath, JSON.stringify(stored, null, 2));
        } catch(e) { console.warn('[agent-task] 保存历史失败:', e.message); }
      }
    } catch (e) {
      task.status = 'error';
      task.error = e.message || '执行失败';
    }
  })();
});

// 查询 agent 任务状态
app.get('/api/hex/agent-task/:taskId', (req, res) => {
  const task = AGENT_STORE.get(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'task not found' });
  res.json(task);
});

// 获取项目产出文件列表：扫描各卦 workspace/output/<projectId>/ 目录
// GET /api/project-files/:projectId
app.get('/api/project-files/:projectId', (req, res) => {
  const { projectId } = req.params;
  const rows = parseWorkersConf();
  const files = [];
  for (const row of rows) {
    // 每卦的产出目录：<stateDir>/workspace/output/<projectId>/
    const outputDir = path.join(row.stateDir, 'workspace', 'output', projectId);
    if (!fs.existsSync(outputDir)) continue;
    const hex = HEXAGRAM_ROBOTS.find((h) => String(h.workerId) === String(row.workerId));
    const hexName = hex ? hex.name : `worker${row.workerId}`;
    try {
      const walk = (dir, base = '') => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const rel = base ? `${base}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            walk(path.join(dir, entry.name), rel);
          } else {
            const abs = path.join(dir, entry.name);
            const stat = fs.statSync(abs);
            files.push({
              hexId: hex?.id || row.workerId,
              hexName,
              name: entry.name,
              path: rel,
              absPath: abs,
              size: stat.size,
              mtime: stat.mtimeMs,
            });
          }
        }
      };
      walk(outputDir);
    } catch(_) {}
  }
  // 按修改时间倒序
  files.sort((a, b) => b.mtime - a.mtime);
  res.json({ files });
});

// 下载项目产出文件
// GET /api/project-files/:projectId/download?hexId=xxx&path=xxx
app.get('/api/project-files/:projectId/download', (req, res) => {
  const { projectId } = req.params;
  const { hexId, path: relPath } = req.query;
  if (!hexId || !relPath) return res.status(400).json({ error: '缺少 hexId 或 path' });
  // 安全：防止目录穿越
  const safe = path.normalize(relPath).replace(/^(\.\.[/\\])+/, '');
  const hex = HEXAGRAM_ROBOTS.find((h) => h.id === hexId);
  const worker = hex ? getWorkerByHex(hexId) : null;
  if (!worker) return res.status(404).json({ error: '未找到该卦' });
  const absPath = path.join(worker.stateDir, 'workspace', 'output', projectId, safe);
  if (!absPath.startsWith(path.join(worker.stateDir, 'workspace', 'output', projectId))) {
    return res.status(403).json({ error: '非法路径' });
  }
  if (!fs.existsSync(absPath)) return res.status(404).json({ error: '文件不存在' });
  res.download(absPath, path.basename(absPath));
});

// macOS：用 vm_stat 算「已用」，与活动监视器一致（不含可回收的 inactive/speculative）
function getMacOSUsedMemory() {
  try {
    const out = execSync('vm_stat', { encoding: 'utf8', maxBuffer: 8192 });
    const pageSizeMatch = out.match(/page size of (\d+) bytes/);
    const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 4096;
    const num = (name) => {
      const m = out.match(new RegExp(name + ':\\s*(\\d+)'));
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

// macOS 交换用量（与活动监视器「已使用的交换」一致）
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

// macOS 负载（当 os.loadavg() 全为 0 时用 sysctl vm.loadavg）
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

// macOS 逻辑 CPU 数（当 os.cpus() 为空时用 sysctl 回退）
function getCpuCount() {
  const list = os.cpus();
  if (list && list.length > 0) return list.length;
  if (process.platform === 'darwin') {
    try {
      const n = parseInt(execSync('sysctl -n hw.ncpu', { encoding: 'utf8', maxBuffer: 32 }).trim(), 10);
      return isNaN(n) ? 1 : Math.max(1, n);
    } catch (_) {}
  }
  return 1;
}

// 实时 CPU 使用率（与活动监视器同源：读 os.cpus() 两次采样取差值）
let _lastCpuTotal = null;
let _lastCpuIdle = null;
function getCpuUsagePercent() {
  const cpus = os.cpus();
  if (!cpus || cpus.length === 0) return null;
  let total = 0;
  let idle = 0;
  for (const c of cpus) {
    const t = c.times;
    total += t.user + t.nice + t.sys + t.idle + (t.irq || 0);
    idle += t.idle;
  }
  if (_lastCpuTotal !== null && _lastCpuIdle !== null && total > _lastCpuTotal) {
    const deltaTotal = total - _lastCpuTotal;
    const deltaIdle = idle - _lastCpuIdle;
    const pct = Math.round((1 - deltaIdle / deltaTotal) * 100);
    _lastCpuTotal = total;
    _lastCpuIdle = idle;
    return Math.min(100, Math.max(0, pct));
  }
  _lastCpuTotal = total;
  _lastCpuIdle = idle;
  return null; // 首次请求无上次采样，下次再给
}

// 系统负载（数据与 Mac 活动监视器同源：vm_stat / sysctl / os.cpus）
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
  // 检查是否有卦在运行（用于告警逻辑）
  const hexRunning = getRobotsList().filter(r => r.id !== 'main' && r.running).length;
  const warnings = [];
  if (memoryUsedPercent >= 90) warnings.push({ level: 'danger', text: '内存占用 ' + memoryUsedPercent + '%，建议少开或关闭部分机器人' });
  else if (memoryUsedPercent >= 80) warnings.push({ level: 'warn', text: '内存占用 ' + memoryUsedPercent + '%，注意负载' });
  const load1 = loadAvg[0];
  if (cpus > 0 && load1 >= cpus * 2) warnings.push({ level: 'danger', text: 'CPU 负载过高 (1min=' + load1.toFixed(1) + ')，建议减少并发' });
  else if (cpus > 0 && load1 >= cpus * 1.2) warnings.push({ level: 'warn', text: 'CPU 负载偏高 (1min=' + load1.toFixed(1) + ')' });
  // 交换内存告警：如果卦都关闭了，提高阈值（可能是其他应用占用）；如果卦在运行，保持原阈值
  if (swapUsedMB != null) {
    const swapThreshold = hexRunning > 0 ? 2048 : 4096; // 卦运行时 2GB，卦关闭时 4GB
    if (swapUsedMB >= swapThreshold) {
      const level = hexRunning > 0 ? 'danger' : 'warn'; // 卦关闭时降级为警告
      warnings.push({ level: level, text: '交换已用 ' + swapUsedMB + ' MB' + (hexRunning > 0 ? '，内存吃紧' : '（卦已关闭，可能由其他应用占用）') });
    }
  }
  const hasDanger = warnings.some(w => w.level === 'danger');
  return {
    memoryUsedPercent,
    memoryUsedMB: Math.round(usedMem / 1024 / 1024),
    memoryTotalMB: Math.round(totalMem / 1024 / 1024),
    loadAvg1: Math.round(loadAvg[0] * 10) / 10,
    loadAvg5: Math.round(loadAvg[1] * 10) / 10,
    cpus,
    cpuUsagePercent: cpuUsagePercent,
    swapUsedMB,
    warnings,
    alert: hasDanger,
  };
}
app.get('/api/system', (_req, res) => {
  res.json(getSystemStats());
});

// 统一启动：main / lan / 卦 id
app.post('/api/open-tui/:robot', (req, res) => {
  try {
    const robot = req.params.robot;
    if (robot === 'main') {
      // 阴：使用项目内的启动脚本
      const yinStartScript = path.join(ROOT_DIR, 'yin', 'start-yin.sh');
      runTerminalScript('main', `bash "${yinStartScript}"`);
      return res.json({ ok: true });
    }
    const worker = getWorkerByHex(robot);
    if (worker) {
      const hex = HEXAGRAM_ROBOTS.find((h) => h.id === robot);
      const titlePrefix = hex ? `printf '\\033]0;${hex.name} - openclaw\\007'; ` : '';
      const stateDir = worker.stateDir;
      const port = worker.port;
      const token = worker.token ? `OPENCLAW_GATEWAY_TOKEN=${worker.token} ` : '';
      // 先清空该端口（避免一进程多端口残留），再启动，保证本卦独立进程
      spawnSync('bash', [STOP_WORKER_SH, '--port', String(port)], { cwd: ROOT_DIR, encoding: 'utf8', stdio: 'pipe' });
      try { execSync('sleep 1', { stdio: 'pipe' }); } catch (_) {}
      if (!isPortInUse(port)) {
        startGatewayInBackground(worker);
        try { execSync('sleep 2', { stdio: 'pipe' }); } catch (_) {}
        for (let i = 0; i < 10; i++) {
          if (isPortInUse(port)) break;
          try { execSync('sleep 1', { stdio: 'pipe' }); } catch (_) {}
        }
      }
      const cmd = titlePrefix + `cd ${OPENCLAW_DIR} && OPENCLAW_STATE_DIR="${stateDir}" OPENCLAW_GATEWAY_PORT=${port} ${token}node openclaw.mjs tui`;
      runTerminalScript(robot, cmd);
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: 'unknown robot' });
  } catch (err) {
    console.error('open-tui error:', err);
    return res.status(500).json({ error: err.message || '启动失败' });
  }
});

// 一键启动前 10 卦（乾～观）
const FIRST_10_IDS = ['qian', 'kun', 'tai', 'pi', 'xun', 'yu', 'sui', 'gu', 'lin', 'guan'];
app.post('/api/start-first-10', (req, res) => {
  try {
    const results = { started: [], failed: [] };
    for (let i = 0; i < FIRST_10_IDS.length; i++) {
      const robot = FIRST_10_IDS[i];
      try {
        const worker = getWorkerByHex(robot);
        if (!worker) {
          results.failed.push({ robot, error: 'unknown' });
          continue;
        }
        const hex = HEXAGRAM_ROBOTS.find((h) => h.id === robot);
        const titlePrefix = hex ? `printf '\\033]0;${hex.name} - openclaw\\007'; ` : '';
        const stateDir = worker.stateDir;
        const port = worker.port;
        const token = worker.token ? `OPENCLAW_GATEWAY_TOKEN=${worker.token} ` : '';
        // 先清空该端口再启动，保证每卦独立进程
        spawnSync('bash', [STOP_WORKER_SH, '--port', String(port)], { cwd: ROOT_DIR, encoding: 'utf8', stdio: 'pipe' });
        try { execSync('sleep 1', { stdio: 'pipe' }); } catch (_) {}
        if (!isPortInUse(port)) {
          startGatewayInBackground(worker);
          try { execSync('sleep 2', { stdio: 'pipe' }); } catch (_) {}
          for (let j = 0; j < 10; j++) {
            if (isPortInUse(port)) break;
            try { execSync('sleep 1', { stdio: 'pipe' }); } catch (_) {}
          }
        }
        const cmd = titlePrefix + `cd ${OPENCLAW_DIR} && OPENCLAW_STATE_DIR="${stateDir}" OPENCLAW_GATEWAY_PORT=${port} ${token}node openclaw.mjs tui`;
        runTerminalScript(robot, cmd);
        results.started.push(hex ? hex.name : robot);
      } catch (err) {
        results.failed.push({ robot, error: err.message || String(err) });
      }
      if (i < FIRST_10_IDS.length - 1) {
        try { execSync('sleep 1.5', { stdio: 'pipe' }); } catch (_) {}
      }
    }
    res.json({ ok: true, started: results.started, failed: results.failed });
  } catch (err) {
    console.error('start-first-10 error:', err);
    res.status(500).json({ error: err.message || '一键启动失败' });
  }
});

// 一键关闭：先关所有终端窗口，再按端口停止所有卦网关，保证界面「运行中」与真实状态一致
app.post('/api/close-all-hex-terminals', async (req, res) => {
  try {
    const toClose = [];
    HEXAGRAM_ROBOTS.forEach((h) => {
      try {
        if (fs.existsSync(ID_FILE(h.id))) toClose.push(h.id);
      } catch (_) {}
    });

    // 步骤1：按端口逐个 kill 卦网关（macOS 上 lsof 端口范围语法不可靠，逐端口更稳）
    try {
      const hexPorts = Array.from({ length: 64 }, (_, i) => 18791 + i);
      for (const port of hexPorts) {
        try {
          const pids = execSync(
            'lsof -iTCP:' + port + ' -sTCP:LISTEN -P -n -t 2>/dev/null || true',
            { encoding: 'utf8', stdio: 'pipe' }
          ).trim();
          if (pids) {
            pids.split(/\s+/).forEach((pid) => {
              const p = parseInt(pid.trim(), 10);
              if (p > 0) try { process.kill(p, 'SIGKILL'); } catch (_) {}
            });
          }
        } catch (_) {}
      }
    } catch (_) {}

    // 步骤2：kill 所有 openclaw-tui 进程（这样 Terminal 窗口内无活跃进程，关窗不弹确认框）
    try {
      execSync('pkill -9 -x openclaw 2>/dev/null || true', { encoding: 'utf8', stdio: 'pipe' });
    } catch (_) {}

    // 步骤3：清理 ID 文件，并行关闭所有终端窗口（此时进程已死，不会弹确认框）
    toClose.forEach((robot) => {
      try { stopAndCloseTerminal(robot); } catch (_) {}
    });

    // 步骤4：清缓存，前端立即获得最新状态
    _portsCache = null;
    _portsCacheTime = 0;

    return res.json({ ok: true, closed: toClose.length });
  } catch (err) {
    console.error('close-all-hex-terminals error:', err);
    return res.status(500).json({ error: err.message || '关闭失败' });
  }
});

// 精准停止：阴 / 指定卦（先杀网关和该窗口内 TUI，再关窗，避免弹「是否终止进程」）
const PORT_MAIN = 18789;
app.post('/api/stop/:robot', async (req, res) => {
  try {
    const robot = req.params.robot;
    if (robot === 'main') {
      // 1. 先查出占用 18789 的所有 PID（网关 + 连到该端口的 TUI），一并 kill，再关窗，避免弹「是否终止进程」
      try {
        const pids = execSync(
          'lsof -iTCP:' + PORT_MAIN + ' -t 2>/dev/null || true',
          { encoding: 'utf8', stdio: 'pipe' }
        ).trim();
        if (pids) pids.split(/\s+/).forEach((pid) => {
          const p = parseInt(pid.trim(), 10);
          if (p > 0) try { process.kill(p, 'SIGKILL'); } catch (_) {}
        });
      } catch (_) {}
      spawnSync('bash', [STOP_WORKER_SH, '--port', String(PORT_MAIN)], { cwd: ROOT_DIR, encoding: 'utf8' });
      stopAndCloseTerminal('main');
      _portsCache = null; _portsCacheTime = 0;
      return res.json({ ok: true });
    }
    const worker = getWorkerByHex(robot);
    if (worker) {
      const bodyPort = req.body && req.body.port != null ? parseInt(req.body.port, 10) : NaN;
      const port = Number.isFinite(bodyPort) ? bodyPort : parseInt(worker.port, 10);
      if (!Number.isFinite(port)) return res.status(500).json({ error: 'invalid port' });
      console.log('[stop] robot=%s port=%s', robot, port);
      // 1. kill gateway 进程（端口）
      spawnSync('bash', [STOP_WORKER_SH, '--port', String(port)], { cwd: ROOT_DIR, encoding: 'utf8', maxBuffer: 1024 * 1024 });
      // 2. kill 所有关联到该端口的 openclaw 进程（网关 + TUI 客户端），保证终端内无活跃进程
      try {
        const pids = execSync(
          'lsof -iTCP:' + port + ' -t 2>/dev/null || true',
          { encoding: 'utf8', stdio: 'pipe' }
        ).trim();
        if (pids) pids.split(/\s+/).forEach((pid) => {
          const p = parseInt(pid.trim(), 10);
          if (p > 0) try { process.kill(p, 'SIGKILL'); } catch (_) {}
        });
      } catch (_) {}
      // 3. 关闭终端窗口（非阻塞，此时进程已死不弹框）
      stopAndCloseTerminal(robot);
      // 4. 清缓存
      _portsCache = null;
      _portsCacheTime = 0;
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: 'unknown robot' });
  } catch (err) {
    console.error('stop error:', err);
    return res.status(500).json({ error: err.message || '停止失败' });
  }
});

// 未匹配的请求统一返回 JSON，避免浏览器收到 HTML 404 页
app.use((_req, res) => {
  if (!res.headersSent) res.status(404).json({ error: 'Not found' });
});

const PORT = Number(process.env.PANEL_WEB_PORT) || 3999;

// 启动前检查：workers.conf 缺失时提示运行 install.sh
if (!fs.existsSync(WORKERS_CONF)) {
  console.warn('\n  [提示] workers.conf 不存在，卦启动功能将不可用。请先执行: ./install.sh\n');
} else {
  try { syncGatewayPortFromWorkersConf(); } catch (_) {}
  try { syncDisableBrowserInMoltbot(); } catch (_) {}
}

const server = app.listen(PORT, () => {
  console.log(`\n  Yinova 面板已启动 → http://localhost:${PORT}\n`);
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n端口 ${PORT} 已被占用。可先执行: kill -9 $(lsof -ti :${PORT}) 再重新启动面板。\n`);
    process.exit(1);
  }
  throw err;
});
