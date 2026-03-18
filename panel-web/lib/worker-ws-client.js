const WebSocket = require('ws');
const nodeCrypto = require('crypto');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

function base64UrlEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toLowerAscii(input) {
  return String(input || '').replace(/[A-Z]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 32));
}

function normalizeDeviceMetadataForAuth(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return toLowerAscii(trimmed);
}

function buildDeviceAuthPayloadV3({ deviceId, clientId, clientMode, role, scopes, signedAtMs, token, nonce, platform, deviceFamily }) {
  const scopesStr = scopes.join(',');
  const tokenStr = token || '';
  const normalizedPlatform = normalizeDeviceMetadataForAuth(platform);
  const normalizedDeviceFamily = normalizeDeviceMetadataForAuth(deviceFamily);
  return [
    'v3',
    deviceId,
    clientId,
    clientMode,
    role,
    scopesStr,
    String(signedAtMs),
    tokenStr,
    nonce,
    normalizedPlatform,
    normalizedDeviceFamily,
  ].join('|');
}

function loadHexDeviceIdentity(stateDir) {
  try {
    const identityPath = path.join(stateDir, 'identity', 'device.json');
    const data = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
    return { deviceId: data.deviceId, publicKeyPem: data.publicKeyPem, privateKeyPem: data.privateKeyPem };
  } catch (_) {
    return null;
  }
}

function deriveDeviceId(publicKeyPem) {
  try {
    const key = nodeCrypto.createPublicKey(publicKeyPem);
    const spki = key.export({ type: 'spki', format: 'der' });
    const prefix = Buffer.from('302a300506032b6570032100', 'hex');
    const raw = (spki.length === prefix.length + 32 && spki.subarray(0, prefix.length).equals(prefix))
      ? spki.subarray(prefix.length)
      : spki;
    return nodeCrypto.createHash('sha256').update(raw).digest('hex');
  } catch (_) {
    return null;
  }
}

async function callHexAgentWS({ port, token, message, sessionKey, stateDir, timeoutMs = 180000, disableDeviceSignature = false, onProgress = null }) {
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

    const reportProgress = (stage, msg) => {
      if (typeof onProgress !== 'function') return;
      try { onProgress({ stage, message: String(msg || '') }); } catch (_) {}
    };

    try {
      ws = new WebSocket(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      reportProgress('connecting', `正在连接员工网关 ${port}`);
    } catch (e) {
      clearTimeout(timer);
      return resolve({ reply: null, error: `WS 建连失败: ${e.message}` });
    }

    const pending = new Map();
    const send = (method, params) => {
      const id = randomUUID();
      ws.send(JSON.stringify({ type: 'req', id, method, params }));
      return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }));
    };

    let challengeNonceResolve = null;
    const challengePromise = new Promise((resolveChallenge) => {
      challengeNonceResolve = resolveChallenge;
      setTimeout(() => {
        if (challengeNonceResolve) {
          const pendingResolve = challengeNonceResolve;
          challengeNonceResolve = null;
          pendingResolve(null);
        }
      }, 8000);
    });

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (_) { return; }
      if (msg.type === 'event' && msg.event === 'connect.challenge' && msg.payload && msg.payload.nonce != null) {
        reportProgress('challenge', '已收到网关握手挑战');
        if (challengeNonceResolve) {
          challengeNonceResolve(msg.payload.nonce);
          challengeNonceResolve = null;
        }
        return;
      }
      if (msg.type === 'event' && (msg.event === 'agent' || msg.event === 'chat')) {
        const payloadText = typeof msg.payload?.text === 'string'
          ? msg.payload.text
          : typeof msg.payload?.message === 'string'
            ? msg.payload.message
            : '';
        if (payloadText) reportProgress('stream', payloadText.slice(0, 240));
      }
      if (msg.type === 'res' && msg.id && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.ok) res(msg.payload);
        else rej(new Error(msg.error?.message || 'rpc error'));
      }
    });

    ws.on('error', (e) => {
      clearTimeout(timer);
      done({ reply: null, error: `WS 错误: ${e.message}` });
    });
    ws.on('close', () => {
      if (!settled) {
        clearTimeout(timer);
        done({ reply: null, error: 'WS 连接意外关闭' });
      }
    });

    ws.on('open', async () => {
      try {
        const CLIENT_ID = 'gateway-client';
        const CLIENT_MODE = 'ui';
        const ROLE = 'operator';
        const SCOPES = ['operator.admin'];
        const CLIENT_PLATFORM = process.platform;
        const CLIENT_DEVICE_FAMILY = 'panel-web';
        const serverNonce = await challengePromise;
        if (!serverNonce) throw new Error('等待 connect.challenge 超时');

        let deviceParam;
        const identity = !disableDeviceSignature && stateDir ? loadHexDeviceIdentity(stateDir) : null;
        if (identity) {
          const signedAtMs = Date.now();
          const derivedId = deriveDeviceId(identity.publicKeyPem) || identity.deviceId;
          const keyObj = nodeCrypto.createPublicKey(identity.publicKeyPem);
          const spkiDer = keyObj.export({ type: 'spki', format: 'der' });
          const prefix = Buffer.from('302a300506032b6570032100', 'hex');
          const rawPubKey = (spkiDer.length === prefix.length + 32 && spkiDer.subarray(0, prefix.length).equals(prefix))
            ? base64UrlEncode(spkiDer.subarray(prefix.length))
            : base64UrlEncode(spkiDer);
          const payload = buildDeviceAuthPayloadV3({
            deviceId: derivedId,
            clientId: CLIENT_ID,
            clientMode: CLIENT_MODE,
            role: ROLE,
            scopes: SCOPES,
            signedAtMs,
            token,
            nonce: serverNonce,
            platform: CLIENT_PLATFORM,
            deviceFamily: CLIENT_DEVICE_FAMILY,
          });
          const privKey = nodeCrypto.createPrivateKey(identity.privateKeyPem);
          const signature = base64UrlEncode(nodeCrypto.sign(null, Buffer.from(payload, 'utf8'), privKey));
          deviceParam = { id: derivedId, publicKey: rawPubKey, signedAt: signedAtMs, signature, nonce: serverNonce };
        }

        const connectParams = {
          minProtocol: 1,
          maxProtocol: 99,
          client: { id: CLIENT_ID, version: '1.0.0', platform: CLIENT_PLATFORM, deviceFamily: CLIENT_DEVICE_FAMILY, mode: CLIENT_MODE },
          role: ROLE,
          scopes: SCOPES,
          auth: token ? { token } : undefined,
          caps: [],
          commands: [],
        };
        if (deviceParam) connectParams.device = deviceParam;
        await send('connect', connectParams);
        reportProgress('connected', '网关连接成功，正在读取会话上下文');

        const beforeHistRes = await send('chat.history', {
          sessionKey: sessionKey || 'main',
          limit: 200,
        });
        reportProgress('history_snapshot', '已读取执行前会话快照');
        const beforeMessages = beforeHistRes?.messages || [];
        const beforeCount = beforeMessages.length;
        const beforeLastAssistant = [...beforeMessages].reverse().find((m) => m.role === 'assistant');
        const beforeLastTs = beforeLastAssistant?.timestamp ?? 0;

        const agentRes = await send('agent', {
          message,
          idempotencyKey: `panel-${Date.now()}-${randomUUID().slice(0, 8)}`,
          sessionKey: sessionKey || 'main',
        });
        const runId = agentRes?.runId;
        if (!runId) throw new Error('agent 没有返回 runId');
        reportProgress('agent_dispatched', `任务已派发，runId=${runId}`);

        const waitDeadline = Date.now() + timeoutMs - 4000;
        let agentDone = false;
        let lastWaitRes = null;
        while (!agentDone && Date.now() < waitDeadline) {
          const remainMs = Math.min(15000, waitDeadline - Date.now());
          if (remainMs <= 0) break;
          const waitRes = await send('agent.wait', { runId, timeoutMs: remainMs });
          lastWaitRes = waitRes || null;
          reportProgress('waiting', waitRes?.status === 'timeout' ? '员工仍在执行中…' : `执行状态：${waitRes?.status || 'unknown'}`);
          if (waitRes?.status === 'ok' || waitRes?.status === 'error') agentDone = true;
        }

        const extractReply = (msgs) => {
          const newByTs = msgs.filter((m) => m.role === 'assistant' && typeof m.timestamp === 'number' && m.timestamp > beforeLastTs);
          let target = newByTs.length > 0 ? newByTs[newByTs.length - 1] : null;
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
        for (let attempt = 0; attempt < 3 && !reply; attempt++) {
          const afterHistRes = await send('chat.history', { sessionKey: sessionKey || 'main', limit: 200 });
          reply = extractReply(afterHistRes?.messages || []);
          if (reply) reportProgress('history_reply', '已从会话历史取回员工回复');
          if (!reply && attempt < 2) await new Promise((r) => setTimeout(r, 750));
        }
        if (!reply) {
          reportProgress('preview_fallback', 'chat.history 未取到回复，正在尝试 session 预览兜底');
          try {
            const previewRes = await send('sessions.preview', {
              keys: [sessionKey || 'main'],
              limit: 24,
              maxChars: 1200,
            });
            const previews = Array.isArray(previewRes?.previews) ? previewRes.previews : [];
            const preview = previews.find((item) => item && item.key === (sessionKey || 'main')) || previews[0];
            const items = Array.isArray(preview?.items) ? preview.items : [];
            const lastAssistantItem = [...items].reverse().find((item) => item && item.role === 'assistant' && String(item.text || '').trim());
            if (lastAssistantItem) {
              reply = String(lastAssistantItem.text || '').trim();
              reportProgress('preview_reply', '已从 session 预览取回员工回复摘要');
            }
          } catch (_) {}
        }
        if (!reply && lastWaitRes?.status === 'error' && lastWaitRes?.error) {
          reply = `执行异常：${String(lastWaitRes.error)}`;
          reportProgress('wait_error', '执行返回错误结果');
        }
        clearTimeout(timer);
        reportProgress('completed', reply ? '已取回最终回复' : '执行完成，但未取到最终文本回复');
        done({ reply: reply || '（员工已执行，无文字回复）', error: null });
      } catch (e) {
        clearTimeout(timer);
        const msg = String(e && e.message || '');
        if (!disableDeviceSignature && msg.includes('device signature invalid')) {
          done({ reply: null, error: '__RETRY_WITHOUT_DEVICE_SIGNATURE__' });
          return;
        }
        done({ reply: null, error: e.message || 'agent 执行失败' });
      }
    });
  });
}

module.exports = {
  callHexAgentWS,
};
