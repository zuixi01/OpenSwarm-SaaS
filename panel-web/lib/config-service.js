const fs = require('fs');
const path = require('path');
const { getDefaultAgentRoleNames } = require('./agent-role-catalog');

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

const FALLBACK_PROVIDERS = {
  zai: { envKey: 'ZAI_API_KEY', label: '智谱 ZAI', url: 'https://open.bigmodel.cn', models: [
    { id: 'zai/glm-5', name: 'GLM-5' }, { id: 'zai/glm-4.7', name: 'GLM-4.7' }
  ]},
  openai: { envKey: 'OPENAI_API_KEY', label: 'OpenAI', url: 'https://platform.openai.com', models: [
    { id: 'openai/gpt-4o', name: 'GPT-4o' }, { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' }
  ]},
  anthropic: { envKey: 'ANTHROPIC_API_KEY', label: 'Anthropic', url: 'https://console.anthropic.com', models: [
    { id: 'anthropic/claude-opus-4-6', name: 'Claude Opus 4.6' }, { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5' }
  ]},
};

const DEFAULT_HEX_NAMES = getDefaultAgentRoleNames();

const MOONSHOT_DEFAULT_MODEL_DEF = {
  id: 'kimi-k2.5',
  name: 'Kimi K2.5',
  reasoning: false,
  input: ['text', 'image'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 256000,
  maxTokens: 8192,
};

function safeReadJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function safeWriteJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function mergeUniqueHosts(...lists) {
  const merged = new Set();
  lists.flat().forEach((value) => {
    const host = String(value || '').trim();
    if (host) merged.add(host);
  });
  return Array.from(merged);
}

function createConfigService(options) {
  const {
    rootDir,
    openclawDir,
    configFile,
    workersConf,
    runtimeControlService,
    tenantRuntimeResolver,
    parseWorkersConf,
    isPortInUse,
    findFreePort,
    findFreePortBlock,
  } = options;

  function patchMoltbotProviderConfig(doc, provider, modelPrimary) {
    const next = doc && typeof doc === 'object' ? doc : {};
    next.agents = next.agents || {};
    next.agents.defaults = next.agents.defaults || {};
    next.agents.defaults.model = next.agents.defaults.model || {};
    next.agents.defaults.model.primary = modelPrimary;

    if (provider === 'moonshot') {
      next.auth = next.auth || {};
      next.auth.profiles = next.auth.profiles || {};
      if (!next.auth.profiles['moonshot:default']) {
        next.auth.profiles['moonshot:default'] = { provider: 'moonshot', mode: 'api_key' };
      }
      next.agents.defaults.models = next.agents.defaults.models || {};
      if (!next.agents.defaults.models['moonshot/kimi-k2.5']) {
        next.agents.defaults.models['moonshot/kimi-k2.5'] = { alias: 'Kimi' };
      }
      next.models = next.models || {};
      next.models.mode = next.models.mode || 'merge';
      next.models.providers = next.models.providers || {};
      const existing = next.models.providers.moonshot || {};
      const existingModels = Array.isArray(existing.models) ? existing.models : [];
      const hasDefault = existingModels.some((model) => model && model.id === 'kimi-k2.5');
      const models = hasDefault ? existingModels : [...existingModels, MOONSHOT_DEFAULT_MODEL_DEF];
      next.models.providers.moonshot = {
        ...existing,
        baseUrl: 'https://api.moonshot.cn/v1',
        api: 'openai-completions',
        models: models.length > 0 ? models : [MOONSHOT_DEFAULT_MODEL_DEF],
      };
    }
    return next;
  }

  function loadProvidersFromPiAi() {
    try {
      const piPath = path.join(openclawDir, 'node_modules', '@mariozechner', 'pi-ai', 'dist', 'models.generated.js');
      if (!fs.existsSync(piPath)) return null;
      const content = fs.readFileSync(piPath, 'utf8');
      const match = content.match(/export const MODELS = (\{[\s\S]*?\});?\s*$/m);
      if (!match) return null;
      const mod = { exports: {} };
      eval('mod.exports.MODELS = ' + match[1]);
      const modelsMap = mod.exports.MODELS;
      const providers = {};
      for (const [provider, models] of Object.entries(modelsMap)) {
        if (!models || typeof models !== 'object') continue;
        const list = [];
        for (const modelId of Object.keys(models)) {
          const model = models[modelId];
          if (model && model.id && model.name) list.push({ id: `${provider}/${model.id}`, name: model.name });
        }
        if (list.length === 0) continue;
        const maxModels = list.length > 30 ? 25 : list.length;
        providers[provider] = {
          envKey: ENV_MAP[provider] != null ? ENV_MAP[provider] : (provider.includes('-') ? '' : `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`),
          label: LABEL_MAP[provider] || provider,
          url: URL_MAP[provider] || '#',
          models: list.slice(0, maxModels),
        };
      }
      return providers;
    } catch (_) {
      return null;
    }
  }

  let providers = loadProvidersFromPiAi();
  if (!providers || Object.keys(providers).length === 0) providers = { ...FALLBACK_PROVIDERS };
  Object.assign(providers, CUSTOM_PROVIDERS);

  function getProviders() {
    return providers;
  }

  function readConfig() {
    try {
      const raw = fs.readFileSync(configFile, 'utf8');
      const parsed = JSON.parse(raw);
      const provider = parsed.provider || 'zai';
      return {
        apiKey: parsed.apiKey || '',
        provider,
        modelPrimary: parsed.modelPrimary || (providers[provider] ? providers[provider].models[0].id : 'zai/glm-5'),
        portMain: parsed.portMain || 18789,
        portHexStart: parsed.portHexStart || 18791,
        panelPort: parsed.panelPort || 3999,
        openclaw: {
          fullToolsAccess: parsed.openclaw && parsed.openclaw.fullToolsAccess !== false,
          browserEnabled: !parsed.openclaw || parsed.openclaw.browserEnabled !== false,
          webFetchEnabled: !parsed.openclaw || parsed.openclaw.webFetchEnabled !== false,
          webSearchEnabled: !parsed.openclaw || parsed.openclaw.webSearchEnabled !== false,
          webSearchProvider: parsed.openclaw && parsed.openclaw.webSearchProvider ? parsed.openclaw.webSearchProvider : 'brave',
          webSearchApiKey: parsed.openclaw && parsed.openclaw.webSearchApiKey ? parsed.openclaw.webSearchApiKey : '',
          firecrawlApiKey: parsed.openclaw && parsed.openclaw.firecrawlApiKey ? parsed.openclaw.firecrawlApiKey : '',
          autoAllowSkills: !parsed.openclaw || parsed.openclaw.autoAllowSkills !== false,
        },
      };
    } catch (_) {
      return {
        apiKey: '',
        provider: 'zai',
        modelPrimary: 'zai/glm-5',
        portMain: 18789,
        portHexStart: 18791,
        panelPort: 3999,
        openclaw: {
          fullToolsAccess: true,
          browserEnabled: true,
          webFetchEnabled: true,
          webSearchEnabled: true,
          webSearchProvider: 'brave',
          webSearchApiKey: '',
          firecrawlApiKey: '',
          autoAllowSkills: true,
        },
      };
    }
  }

  function writeConfig(config) {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
  }

  function getConfigEnv() {
    const config = readConfig();
    const env = { ...process.env };
    const provider = providers[config.provider || 'zai'];
    if (provider && config.apiKey) env[provider.envKey] = config.apiKey;
    return env;
  }

  function resolveAvailableProviderSecrets() {
    const env = getConfigEnv();
    const secrets = {};
    Object.entries(providers).forEach(([providerId, provider]) => {
      const envKey = String(provider && provider.envKey || '').trim();
      if (!envKey) return;
      const value = String(env[envKey] || '').trim();
      if (!value) return;
      secrets[providerId] = { envKey, value };
    });
    return secrets;
  }

  function syncModelsJsonApiKeys(modelsPath, providerSecrets) {
    try {
      if (!fs.existsSync(modelsPath)) return false;
      const raw = fs.readFileSync(modelsPath, 'utf8');
      const doc = JSON.parse(raw);
      if (!doc || typeof doc !== 'object' || !doc.providers || typeof doc.providers !== 'object') return false;
      let changed = false;
      Object.entries(doc.providers).forEach(([providerId, providerDoc]) => {
        if (!providerDoc || typeof providerDoc !== 'object') return;
        const secret = providerSecrets[providerId];
        if (!secret) return;
        if (providerId === 'moonshot' && providerDoc.baseUrl !== 'https://api.moonshot.cn/v1') {
          providerDoc.baseUrl = 'https://api.moonshot.cn/v1';
          changed = true;
        }
        const current = typeof providerDoc.apiKey === 'string' ? providerDoc.apiKey.trim() : '';
        if (!current || current === secret.envKey) {
          if (providerDoc.apiKey !== secret.value) {
            providerDoc.apiKey = secret.value;
            changed = true;
          }
        }
      });
      if (changed) fs.writeFileSync(modelsPath, JSON.stringify(doc, null, 2), 'utf8');
      return changed;
    } catch (_) {
      return false;
    }
  }

  function syncAgentModelsApiKeys() {
    const providerSecrets = resolveAvailableProviderSecrets();
    const targets = [
      path.join(rootDir, 'yin', 'agents', 'main', 'agent', 'models.json'),
      ...parseWorkersConf().map((row) => path.join(row.stateDir, 'agents', 'main', 'agent', 'models.json')),
    ];
    let updated = 0;
    targets.forEach((modelsPath) => {
      if (syncModelsJsonApiKeys(modelsPath, providerSecrets)) updated += 1;
    });
    return { ok: true, updated };
  }

  function listConfig() {
    const config = readConfig();
    return {
      ...config,
      openclawStatus: getOpenClawStatus(config),
      providers: Object.keys(providers).map((id) => ({ id, ...providers[id] })),
    };
  }

  function getOpenClawStatus(config = readConfig()) {
    const openclaw = config && config.openclaw && typeof config.openclaw === 'object' ? config.openclaw : {};
    const searchProvider = String(openclaw.webSearchProvider || 'brave').trim() || 'brave';
    const searchKeyFromConfig = String(openclaw.webSearchApiKey || '').trim();
    const firecrawlKeyFromConfig = String(openclaw.firecrawlApiKey || '').trim();
    const envSearchKeys = {
      brave: String(process.env.BRAVE_API_KEY || '').trim(),
      perplexity: String(process.env.PERPLEXITY_API_KEY || process.env.OPENROUTER_API_KEY || '').trim(),
      kimi: String(process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || '').trim(),
      firecrawl: String(process.env.FIRECRAWL_API_KEY || '').trim(),
    };
    const searchKeyConfigured = searchProvider === 'firecrawl'
      ? Boolean(firecrawlKeyFromConfig || envSearchKeys.firecrawl)
      : Boolean(searchKeyFromConfig || envSearchKeys[searchProvider]);
    const firecrawlConfigured = Boolean(firecrawlKeyFromConfig || envSearchKeys.firecrawl);
    const webSearchEnabled = openclaw.webSearchEnabled !== false;
    const browserEnabled = openclaw.browserEnabled !== false;
    const webFetchEnabled = openclaw.webFetchEnabled !== false;
    const fullToolsAccess = openclaw.fullToolsAccess !== false;
    const autoAllowSkills = openclaw.autoAllowSkills !== false;
    const missingKeys = [];
    if (webSearchEnabled && !searchKeyConfigured) {
      missingKeys.push(searchProvider === 'firecrawl' ? 'Firecrawl 搜索 Key' : `${searchProvider} 搜索 Key`);
    }
    if (webFetchEnabled && !firecrawlConfigured) {
      missingKeys.push('Firecrawl 抓取 Key（可选增强）');
    }
    return {
      summary: webSearchEnabled && !searchKeyConfigured
        ? '网页搜索已开启，但缺少 Provider Key；抓取/执行权限已可用。'
        : 'OpenClaw 权限已生效，可直接执行浏览器、抓取、技能与命令动作。',
      browser: {
        enabled: browserEnabled,
        ready: browserEnabled,
        message: browserEnabled ? '浏览器能力可用' : '浏览器能力已关闭',
      },
      webFetch: {
        enabled: webFetchEnabled,
        firecrawlConfigured,
        ready: webFetchEnabled,
        message: webFetchEnabled
          ? (firecrawlConfigured ? '网页抓取已开启，Firecrawl 已配置' : '网页抓取已开启，当前走默认抓取通道')
          : '网页抓取已关闭',
      },
      webSearch: {
        enabled: webSearchEnabled,
        provider: searchProvider,
        keyConfigured: searchKeyConfigured,
        ready: webSearchEnabled ? searchKeyConfigured : false,
        message: webSearchEnabled
          ? (searchKeyConfigured ? `网页搜索已就绪（${searchProvider}）` : `网页搜索已开启，但缺少 ${searchProvider} Key`)
          : '网页搜索已关闭',
      },
      exec: {
        fullToolsAccess,
        autoAllowSkills,
        ready: fullToolsAccess,
        message: fullToolsAccess ? '命令执行与工具组已放开' : '命令执行仍受限',
      },
      missingKeys,
    };
  }

  function checkPorts(query = {}) {
    const current = readConfig();
    let portMain = parseInt(query.portMain, 10) || current.portMain || 18789;
    let portHexStart = parseInt(query.portHexStart, 10) || current.portHexStart || 18791;
    let panelPort = parseInt(query.panelPort, 10) || current.panelPort || 3999;

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

      const nextConfig = { ...current, portMain, portHexStart, panelPort };
      writeConfig(nextConfig);

      const yinMolt = path.join(rootDir, 'yin', 'moltbot.json');
      if (fs.existsSync(yinMolt)) {
        try {
          const doc = JSON.parse(fs.readFileSync(yinMolt, 'utf8'));
          doc.gateway = doc.gateway || {};
          doc.gateway.port = portMain;
          fs.writeFileSync(yinMolt, JSON.stringify(doc, null, 2), 'utf8');
        } catch (_) {}
      }

      if (fs.existsSync(workersConf)) {
        const rows = parseWorkersConf();
        const lines = ['# 格式: worker_id|state_dir|port|token'];
        for (let i = 0; i < 64; i++) {
          const id = i + 1;
          const name = DEFAULT_HEX_NAMES[i] || (`hex${id}`);
          const port = portHexStart + i;
          const token = (rows[i] && rows[i].token) || '';
          lines.push(`${id}|hexes/${name}|${port}|${token}`);
        }
        fs.writeFileSync(workersConf, `${lines.join('\n')}\n`, 'utf8');
        if (runtimeControlService && typeof runtimeControlService.syncGatewayPortFromWorkersConf === 'function') {
          runtimeControlService.syncGatewayPortFromWorkersConf();
        }
      }

      if (runtimeControlService && typeof runtimeControlService.clearPortsCache === 'function') {
        runtimeControlService.clearPortsCache();
      }
      autoFixed = true;
    }

    return {
      portMain: { port: portMain, inUse: isPortInUse(portMain) },
      portHexStart: { port: portHexStart, inUse: isPortInUse(portHexStart) },
      panelPort: { port: panelPort, inUse: isPortInUse(panelPort) },
      autoFixed,
      config: autoFixed ? { portMain, portHexStart, panelPort } : undefined,
    };
  }

  function resolveOpenClawSettings(body = {}, current = readConfig()) {
    const openclawBody = body.openclaw && typeof body.openclaw === 'object' ? body.openclaw : {};
    const currentOpenclaw = current.openclaw || {};
    return {
      fullToolsAccess: openclawBody.fullToolsAccess !== undefined
        ? !!openclawBody.fullToolsAccess
        : currentOpenclaw.fullToolsAccess !== false,
      browserEnabled: openclawBody.browserEnabled !== undefined
        ? !!openclawBody.browserEnabled
        : currentOpenclaw.browserEnabled !== false,
      webFetchEnabled: openclawBody.webFetchEnabled !== undefined
        ? !!openclawBody.webFetchEnabled
        : currentOpenclaw.webFetchEnabled !== false,
      webSearchEnabled: openclawBody.webSearchEnabled !== undefined
        ? !!openclawBody.webSearchEnabled
        : currentOpenclaw.webSearchEnabled !== false,
      webSearchProvider: String(openclawBody.webSearchProvider || currentOpenclaw.webSearchProvider || 'brave').trim() || 'brave',
      webSearchApiKey: String(openclawBody.webSearchApiKey !== undefined ? openclawBody.webSearchApiKey : (currentOpenclaw.webSearchApiKey || '')).trim(),
      firecrawlApiKey: String(openclawBody.firecrawlApiKey !== undefined ? openclawBody.firecrawlApiKey : (currentOpenclaw.firecrawlApiKey || '')).trim(),
      autoAllowSkills: openclawBody.autoAllowSkills !== undefined
        ? !!openclawBody.autoAllowSkills
        : currentOpenclaw.autoAllowSkills !== false,
    };
  }

  function patchOpenClawRuntimeConfig(moltPath, settings) {
    try {
      if (!fs.existsSync(moltPath)) return false;
      const doc = safeReadJson(moltPath, {});
      if (!doc || typeof doc !== 'object') return false;
      doc.browser = doc.browser && typeof doc.browser === 'object' ? doc.browser : {};
      doc.browser.enabled = settings.browserEnabled;
      doc.browser.ssrfPolicy = doc.browser.ssrfPolicy && typeof doc.browser.ssrfPolicy === 'object'
        ? doc.browser.ssrfPolicy
        : {};
      doc.browser.ssrfPolicy.dangerouslyAllowPrivateNetwork = settings.browserEnabled;
      doc.browser.ssrfPolicy.allowedHostnames = mergeUniqueHosts(
        doc.browser.ssrfPolicy.allowedHostnames,
        settings.browserEnabled ? ['localhost', '127.0.0.1', '::1'] : []
      );

      doc.tools = doc.tools && typeof doc.tools === 'object' ? doc.tools : {};
      doc.tools.profile = settings.fullToolsAccess ? 'full' : (doc.tools.profile || 'coding');
      const additiveTools = [
        'group:fs',
        'group:runtime',
        'group:web',
        'group:ui',
        'group:memory',
        'group:sessions',
        'group:automation',
        'group:nodes',
        'group:messaging',
        'group:openclaw',
      ];
      const alsoAllow = Array.isArray(doc.tools.alsoAllow) ? doc.tools.alsoAllow : [];
      doc.tools.alsoAllow = settings.fullToolsAccess
        ? Array.from(new Set([...alsoAllow, ...additiveTools]))
        : alsoAllow;

      doc.tools.exec = doc.tools.exec && typeof doc.tools.exec === 'object' ? doc.tools.exec : {};
      doc.tools.exec.security = settings.fullToolsAccess ? 'full' : (doc.tools.exec.security || 'allowlist');
      doc.tools.exec.ask = settings.fullToolsAccess ? 'off' : (doc.tools.exec.ask || 'on-miss');
      if ('askFallback' in doc.tools.exec) delete doc.tools.exec.askFallback;
      if ('autoAllowSkills' in doc.tools.exec) delete doc.tools.exec.autoAllowSkills;

      doc.tools.web = doc.tools.web && typeof doc.tools.web === 'object' ? doc.tools.web : {};
      doc.tools.web.fetch = doc.tools.web.fetch && typeof doc.tools.web.fetch === 'object' ? doc.tools.web.fetch : {};
      doc.tools.web.fetch.enabled = settings.webFetchEnabled;
      if ('ssrfPolicy' in doc.tools.web.fetch) delete doc.tools.web.fetch.ssrfPolicy;
      doc.tools.web.fetch.firecrawl = doc.tools.web.fetch.firecrawl && typeof doc.tools.web.fetch.firecrawl === 'object'
        ? doc.tools.web.fetch.firecrawl
        : {};
      if (settings.firecrawlApiKey) {
        doc.tools.web.fetch.firecrawl.apiKey = settings.firecrawlApiKey;
        doc.tools.web.fetch.firecrawl.enabled = true;
      }

      doc.tools.web.search = doc.tools.web.search && typeof doc.tools.web.search === 'object' ? doc.tools.web.search : {};
      doc.tools.web.search.enabled = settings.webSearchEnabled;
      doc.tools.web.search.provider = settings.webSearchProvider;
      if (settings.webSearchApiKey) {
        doc.tools.web.search.apiKey = settings.webSearchApiKey;
      } else if ('apiKey' in doc.tools.web.search) {
        delete doc.tools.web.search.apiKey;
      }
      if ('_credentialReady' in doc.tools.web.search) delete doc.tools.web.search._credentialReady;

      safeWriteJson(moltPath, doc);
      return true;
    } catch (_) {
      return false;
    }
  }

  function patchGlobalOpenClawConfig(settings) {
    try {
      const configPath = path.join(process.env.HOME || rootDir, '.openclaw', 'openclaw.json');
      const doc = safeReadJson(configPath, {}) || {};
      doc.browser = doc.browser && typeof doc.browser === 'object' ? doc.browser : {};
      doc.browser.enabled = settings.browserEnabled;
      doc.browser.ssrfPolicy = doc.browser.ssrfPolicy && typeof doc.browser.ssrfPolicy === 'object'
        ? doc.browser.ssrfPolicy
        : {};
      doc.browser.ssrfPolicy.dangerouslyAllowPrivateNetwork = settings.browserEnabled;
      doc.browser.ssrfPolicy.allowedHostnames = mergeUniqueHosts(
        doc.browser.ssrfPolicy.allowedHostnames,
        settings.browserEnabled ? ['localhost', '127.0.0.1', '::1'] : []
      );

      doc.tools = doc.tools && typeof doc.tools === 'object' ? doc.tools : {};
      doc.tools.profile = settings.fullToolsAccess ? 'full' : (doc.tools.profile || 'coding');
      doc.tools.exec = doc.tools.exec && typeof doc.tools.exec === 'object' ? doc.tools.exec : {};
      doc.tools.exec.security = settings.fullToolsAccess ? 'full' : (doc.tools.exec.security || 'allowlist');
      doc.tools.exec.ask = settings.fullToolsAccess ? 'off' : (doc.tools.exec.ask || 'on-miss');
      if ('askFallback' in doc.tools.exec) delete doc.tools.exec.askFallback;
      if ('autoAllowSkills' in doc.tools.exec) delete doc.tools.exec.autoAllowSkills;

      doc.tools.web = doc.tools.web && typeof doc.tools.web === 'object' ? doc.tools.web : {};
      doc.tools.web.fetch = doc.tools.web.fetch && typeof doc.tools.web.fetch === 'object' ? doc.tools.web.fetch : {};
      doc.tools.web.fetch.enabled = settings.webFetchEnabled;
      if ('ssrfPolicy' in doc.tools.web.fetch) delete doc.tools.web.fetch.ssrfPolicy;
      safeWriteJson(configPath, doc);
      return true;
    } catch (_) {
      return false;
    }
  }

  function patchExecApprovals(settings) {
    try {
      const approvalsPath = path.join(process.env.HOME || rootDir, '.openclaw', 'exec-approvals.json');
      const doc = safeReadJson(approvalsPath, { version: 1, agents: {} }) || { version: 1, agents: {} };
      doc.defaults = doc.defaults && typeof doc.defaults === 'object' ? doc.defaults : {};
      doc.defaults.security = settings.fullToolsAccess ? 'full' : (doc.defaults.security || 'allowlist');
      doc.defaults.ask = settings.fullToolsAccess ? 'off' : (doc.defaults.ask || 'on-miss');
      doc.defaults.askFallback = settings.fullToolsAccess ? 'full' : (doc.defaults.askFallback || 'deny');
      doc.defaults.autoAllowSkills = settings.autoAllowSkills;
      safeWriteJson(approvalsPath, doc);
      return true;
    } catch (_) {
      return false;
    }
  }

  function syncOpenClawSettings(settings) {
    const targets = [
      path.join(rootDir, 'yin', 'moltbot.json'),
      ...parseWorkersConf().map((row) => path.join(row.stateDir, 'moltbot.json')),
    ];
    let updated = 0;
    targets.forEach((target) => {
      if (patchOpenClawRuntimeConfig(target, settings)) updated += 1;
    });

    const runtimeTenantsRoot = path.join(rootDir, 'runtime', 'tenants');
    try {
      if (fs.existsSync(runtimeTenantsRoot)) {
        fs.readdirSync(runtimeTenantsRoot).forEach((tenantId) => {
          const tenantRoot = path.join(runtimeTenantsRoot, tenantId);
          const yinPath = path.join(tenantRoot, 'yin', 'moltbot.json');
          if (patchOpenClawRuntimeConfig(yinPath, settings)) updated += 1;
          const agentsDir = path.join(tenantRoot, 'agents');
          if (fs.existsSync(agentsDir)) {
            fs.readdirSync(agentsDir).forEach((agentId) => {
              const agentMolt = path.join(agentsDir, agentId, 'moltbot.json');
              if (patchOpenClawRuntimeConfig(agentMolt, settings)) updated += 1;
            });
          }
        });
      }
    } catch (_) {}

    patchExecApprovals(settings);
    patchGlobalOpenClawConfig(settings);
    return { ok: true, updated };
  }

  async function restartOpenClawRuntimes() {
    if (!tenantRuntimeResolver || typeof tenantRuntimeResolver.listKnownTenantIds !== 'function') {
      return { ok: false, restarted: [], skipped: [], error: 'tenantRuntimeResolver unavailable' };
    }
    const restarted = [];
    const skipped = [];
    const tenantIds = tenantRuntimeResolver.listKnownTenantIds();
    for (const tenantId of tenantIds) {
      const overview = tenantRuntimeResolver.getTenantOverview(tenantId);
      const shouldRestartMain = overview && overview.main && overview.main.status === 'running';
      const runningAgents = Array.isArray(overview && overview.agents)
        ? overview.agents.filter((agent) => agent && agent.status && agent.status !== 'stopped').map((agent) => agent.agentId)
        : [];
      if (!shouldRestartMain && runningAgents.length === 0) {
        skipped.push({ tenantId, reason: 'no-active-runtime' });
        continue;
      }
      if (shouldRestartMain) {
        await tenantRuntimeResolver.stopRuntime(tenantId, { target: 'main' });
      }
      for (const agentId of runningAgents) {
        // eslint-disable-next-line no-await-in-loop
        await tenantRuntimeResolver.stopRuntime(tenantId, { agentId });
      }
      if (shouldRestartMain) {
        await tenantRuntimeResolver.startRuntime(tenantId, { target: 'main' });
      }
      for (const agentId of runningAgents) {
        // eslint-disable-next-line no-await-in-loop
        await tenantRuntimeResolver.startRuntime(tenantId, { agentId });
      }
      restarted.push({ tenantId, main: shouldRestartMain, agents: runningAgents });
    }
    return { ok: true, restarted, skipped };
  }

  function saveConfig(body = {}) {
    const current = readConfig();
    const provider = body.provider || current.provider || 'zai';
    const providerConfig = providers[provider] || providers.zai;
    const apiKey = String(body.apiKey || '').trim() || current.apiKey || '';
    if (!apiKey && providerConfig.envKey) throw new Error('API Key 不能为空');
    const modelPrimary = body.modelPrimary || current.modelPrimary || (providers[provider] ? providers[provider].models[0].id : 'zai/glm-5');
    const config = {
      apiKey,
      provider,
      modelPrimary,
      portMain: parseInt(body.portMain, 10) || current.portMain || 18789,
      portHexStart: parseInt(body.portHexStart, 10) || current.portHexStart || 18791,
      panelPort: parseInt(body.panelPort, 10) || current.panelPort || 3999,
      openclaw: resolveOpenClawSettings(body, current),
    };
    writeConfig(config);

    const envPath = path.join(rootDir, '.env');
    if (providerConfig.envKey) fs.writeFileSync(envPath, `${providerConfig.envKey}=${apiKey}\n`, 'utf8');

    if (providerConfig.envKey) {
      const profileKey = `${provider}:default`;
      const authProfiles = {
        version: 1,
        profiles: { [profileKey]: { type: 'api_key', provider, key: apiKey } },
        lastGood: { [provider]: profileKey },
      };
      const authJson = JSON.stringify(authProfiles, null, 2);
      const writeAuthTo = (agentDir) => {
        try {
          fs.mkdirSync(agentDir, { recursive: true });
          fs.writeFileSync(path.join(agentDir, 'auth-profiles.json'), authJson, 'utf8');
        } catch (_) {}
      };
      writeAuthTo(path.join(rootDir, 'yin', 'agents', 'main', 'agent'));
      parseWorkersConf().forEach((row) => {
        writeAuthTo(path.join(row.stateDir, 'agents', 'main', 'agent'));
      });
    }

    const updateModelInMoltbot = (moltPath) => {
      try {
        if (!fs.existsSync(moltPath)) return;
        const raw = fs.readFileSync(moltPath, 'utf8');
        const doc = JSON.parse(raw);
        fs.writeFileSync(moltPath, JSON.stringify(patchMoltbotProviderConfig(doc, provider, modelPrimary), null, 2), 'utf8');
      } catch (_) {}
    };
    updateModelInMoltbot(path.join(rootDir, 'yin', 'moltbot.json'));
    parseWorkersConf().forEach((row) => updateModelInMoltbot(path.join(row.stateDir, 'moltbot.json')));
    syncAgentModelsApiKeys();
    syncOpenClawSettings(config.openclaw);
    return {
      ok: true,
      config: {
        ...config,
        openclawStatus: getOpenClawStatus(config),
      },
    };
  }

  return {
    getProviders,
    readConfig,
    writeConfig,
    getConfigEnv,
    syncAgentModelsApiKeys,
    listConfig,
    checkPorts,
    saveConfig,
    restartOpenClawRuntimes,
  };
}

module.exports = {
  createConfigService,
};
