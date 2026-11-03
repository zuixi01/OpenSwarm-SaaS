#!/usr/bin/env node
'use strict';

// Start the real panel only in a disposable checkout with no user data or services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');

const panelDir = path.resolve(__dirname, '..');
const tempPrefix = 'openswarm-panel-smoke-';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function allocatePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  return port;
}

function request(port, pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.setTimeout(1500, () => req.destroy(new Error('HTTP request timed out')));
    req.on('error', reject);
  });
}

function assertJson(response, status) {
  assert.equal(response.status, status);
  assert.match(response.headers['content-type'] || '', /application\/json/);
  return JSON.parse(response.body);
}

function isolatedEnvironment(tempRoot, port, token) {
  // Keep only OS essentials. Never inherit DB URLs, JWT/API keys, gateway settings,
  // NODE_OPTIONS, NODE_PATH, or the user's home directory into the panel process.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|LANG|LC_ALL)$/i.test(key)));
  const home = path.join(tempRoot, 'home');
  const tmp = path.join(tempRoot, 'tmp');
  fs.mkdirSync(home);
  fs.mkdirSync(tmp);
  return {
    ...env,
    HOME: home,
    USERPROFILE: home,
    TMPDIR: tmp,
    TEMP: tmp,
    TMP: tmp,
    NODE_ENV: 'test',
    PANEL_WEB_PORT: String(port),
    OPENCLAW_DIR: path.join(tempRoot, 'missing-openclaw'),
    ...(token ? { PANEL_WEB_HOST: '127.0.0.1', OPENSWARM_PANEL_TOKEN: token } : {}),
  };
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const closed = new Promise((resolve) => child.once('close', resolve));
  child.kill('SIGTERM');
  await Promise.race([closed, wait(2000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await Promise.race([closed, wait(2000)]);
  }
  assert.ok(child.exitCode !== null || child.signalCode !== null, 'smoke child did not stop');
}

function removeFixture(tempRoot) {
  const resolved = path.resolve(tempRoot);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()), 'refusing to remove a directory outside the temporary root');
  assert.ok(path.basename(resolved).startsWith(tempPrefix), 'refusing to remove an unrelated directory');
  // Unlink dependencies first so recursive cleanup cannot touch the real checkout.
  const modulesLink = path.join(resolved, 'panel-web', 'node_modules');
  if (fs.existsSync(modulesLink)) {
    assert.ok(fs.lstatSync(modulesLink).isSymbolicLink(), 'expected a dependency link');
    fs.unlinkSync(modulesLink);
  }
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

async function runSmoke(tokenMode) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), tempPrefix));
  let child;
  let output = '';
  try {
    const fixturePanel = path.join(tempRoot, 'panel-web');
    fs.mkdirSync(fixturePanel);
    for (const name of ['server.js', 'lib', 'routes', 'middleware', 'public']) {
      fs.cpSync(path.join(panelDir, name), path.join(fixturePanel, name), { recursive: true });
    }
    const sourceModules = path.join(panelDir, 'node_modules');
    assert.ok(fs.existsSync(sourceModules), 'run npm ci in panel-web before test:smoke');
    fs.symlinkSync(sourceModules, path.join(fixturePanel, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');

    // Observe the native listening socket over IPC; do not replace HTTP handlers.
    const observerFile = path.join(tempRoot, 'observe-listener.cjs');
    fs.writeFileSync(observerFile, `const net = require('node:net');
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  this.once('listening', () => {
    if (process.send) process.send({ type: 'listening', address: this.address() });
  });
  return listen.apply(this, args);
};
`);
    const port = await allocatePort();
    const token = tokenMode ? randomBytes(24).toString('hex') : '';
    let listenerAddress;
    let childError;
    child = spawn(process.execPath, ['--require', observerFile, path.join(fixturePanel, 'server.js')], {
      cwd: fixturePanel,
      env: isolatedEnvironment(tempRoot, port, token),
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      windowsHide: true,
    });
    const capture = (chunk) => { output = (output + chunk.toString()).slice(-8000); };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('error', (err) => { childError = err; });
    child.on('message', (message) => {
      if (message && message.type === 'listening') listenerAddress = message.address;
    });

    let health;
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      if (childError) throw childError;
      assert.equal(child.exitCode, null, `panel exited before readiness (${child.exitCode})`);
      try {
        health = await request(port, '/api/health');
        if (listenerAddress) break;
      } catch (_) {
        // A connection refusal is expected while the child loads modules.
      }
      await wait(100);
    }
    assert.ok(health && listenerAddress, 'panel did not become ready within 12 seconds');
    assert.equal(listenerAddress.address, '127.0.0.1', 'panel must listen only on loopback by default');
    assert.equal(listenerAddress.port, port);
    assert.equal(assertJson(health, 200).ok, true);

    if (tokenMode) {
      const denied = await request(port, '/api/projects');
      assert.ok(assertJson(denied, 401).error);
      const wrongToken = await request(port, '/api/projects', { 'x-panel-token': 'invalid-smoke-token' });
      assert.ok(assertJson(wrongToken, 401).error);
      const pageRedirect = await request(port, '/');
      assert.equal(pageRedirect.status, 302);
      assert.equal(pageRedirect.headers.location, '/login.html');
    }

    const headers = tokenMode ? { 'x-panel-token': token } : {};
    const page = await request(port, '/', headers);
    assert.equal(page.status, 200);
    assert.match(page.headers['content-type'] || '', /text\/html/);
    assert.match(page.body, /<title>OpenSwarm/);
    const missing = await request(port, '/api/__smoke_missing', headers);
    assert.equal(assertJson(missing, 404).error, 'Not found');
    console.log(`[smoke] ${tokenMode ? 'panel-token auth' : 'fresh checkout'}: loopback, health, homepage, JSON 404 passed`);
  } catch (err) {
    if (output.trim()) console.error(output.trim());
    throw err;
  } finally {
    try { await stopChild(child); } finally { removeFixture(tempRoot); }
  }
}

async function main() {
  await runSmoke(false);
  await runSmoke(true);
}

main().catch((err) => {
  console.error(`[smoke] failed: ${err.message}`);
  process.exitCode = 1;
});
