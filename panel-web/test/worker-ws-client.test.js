const { test } = require('node:test');
const assert = require('node:assert/strict');
const { WebSocketServer } = require('ws');
const { callHexAgentWS } = require('../lib/worker-ws-client');

async function gateway(t, { rejectConnect = false } = {}) {
  const requests = [];
  const headers = [];
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  t.after(async () => {
    for (const client of server.clients) client.terminate();
    await new Promise((resolve) => server.close(resolve));
  });
  server.on('connection', (socket, req) => {
    headers.push(req.headers.authorization);
    // A non-RPC frame must not prevent the subsequent valid handshake.
    socket.send('not-json');
    socket.send(JSON.stringify({ type: 'event', event: 'connect.challenge', payload: { nonce: 'test-challenge' } }));
    let historyReads = 0;
    socket.on('message', (raw) => {
      const request = JSON.parse(raw.toString());
      requests.push(request);
      if (request.method === 'connect' && rejectConnect) {
        socket.send(JSON.stringify({ type: 'res', id: request.id, ok: false, error: { message: 'gateway authentication denied' } }));
        return;
      }
      let payload = {};
      if (request.method === 'chat.history') {
        historyReads += 1;
        payload.messages = [{ role: 'assistant', timestamp: 1, content: 'previous task' }];
        if (historyReads > 1) payload.messages.push({ role: 'assistant', timestamp: 2, content: [{ type: 'text', text: 'current task result' }] });
      } else if (request.method === 'agent') {
        payload = { runId: 'test-run' };
        socket.send(JSON.stringify({ type: 'event', event: 'agent', payload: { text: 'working' } }));
      } else if (request.method === 'agent.wait') payload = { status: 'ok' };
      socket.send(JSON.stringify({ type: 'res', id: request.id, ok: true, payload }));
    });
  });
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return { port: server.address().port, requests, headers };
}

test('worker WebSocket handshake dispatches a task and returns only its new reply', { timeout: 10000 }, async (t) => {
  const fixture = await gateway(t);
  const progress = [];
  const result = await callHexAgentWS({
    port: fixture.port, token: 'test-only-token', message: 'prepare report', sessionKey: 'test-session', timeoutMs: 8000,
    onProgress: (event) => progress.push(event.stage),
  });
  assert.deepEqual(result, { reply: 'current task result', error: null });
  assert.deepEqual(fixture.headers, ['Bearer test-only-token']);
  assert.deepEqual(fixture.requests.map((request) => request.method), ['connect', 'chat.history', 'agent', 'agent.wait', 'chat.history']);
  assert.equal(fixture.requests[0].params.auth.token, 'test-only-token');
  assert.equal(fixture.requests[2].params.message, 'prepare report');
  assert.equal(fixture.requests[2].params.sessionKey, 'test-session');
  assert.equal(progress.includes('stream'), true);
  assert.equal(progress.at(-1), 'completed');
});

test('a rejected worker handshake never dispatches an agent task', { timeout: 10000 }, async (t) => {
  const fixture = await gateway(t, { rejectConnect: true });
  const result = await callHexAgentWS({ port: fixture.port, token: 'test-only-token', message: 'must not run', timeoutMs: 8000 });
  assert.equal(result.reply, null);
  assert.equal(result.error, 'gateway authentication denied');
  assert.deepEqual(fixture.requests.map((request) => request.method), ['connect']);
});
