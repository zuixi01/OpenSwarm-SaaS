const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');

// This test process uses generated credentials and temporary files only.
const secret = randomBytes(32).toString('hex');
process.env.OPENSWARM_AUTH_JWT_SECRET = secret;
process.env.OPENSWARM_AUTH_REFRESH_SECRET = secret;
process.env.OPENSWARM_V1_JWT_SECRET = secret;
process.env.OPENSWARM_AUTH_ACCESS_EXPIRES = '15m';
process.env.OPENSWARM_AUTH_REFRESH_EXPIRES = '7d';
process.env.OPENSWARM_AUTH_ACCESS_COOKIE = 'openswarm_access_token';
process.env.OPENSWARM_AUTH_REFRESH_COOKIE = 'openswarm_refresh_token';
process.env.DATABASE_URL = '';

const {
  signAccessToken, signRefreshToken, requirePhase1Auth, requireTenantContext,
} = require('../middleware/phase1-auth');
const { signV1Token, requireV1Auth, requireTenantAccess } = require('../middleware/v1-auth');
const { createTenantPaths } = require('../lib/tenant-paths');
const { createTenantSecurityRepo } = require('../lib/tenant-security-repo');
const { createTenantAccessControl } = require('../lib/tenant-access-control');
const { resolveTenantId, ensureTenantAccess } = require('../lib/tenant-scope');

test('HTTP authentication, parsing and tenant authorization', { timeout: 20000 }, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openswarm-test-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const tenantPaths = createTenantPaths({ dataDir });
  const repo = createTenantSecurityRepo({ tenantPaths });
  await repo.upsertMember('tenant-a', { userId: 'alice', email: 'alice@example.test', role: 'member' });
  await repo.upsertMember('tenant-a', { userId: 'carol', role: 'owner' });
  await repo.upsertMember('tenant-b', { userId: 'bob', role: 'owner' });
  fs.writeFileSync(tenantPaths.projectMemoryPath('tenant-a', 'project'), JSON.stringify({ text: 'tenant-a document' }));
  fs.writeFileSync(tenantPaths.projectMemoryPath('tenant-b', 'project'), JSON.stringify({ text: 'tenant-b document' }));
  const access = createTenantAccessControl({ tenantSecurityRepo: repo });
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.post('/echo', requirePhase1Auth, (req, res) => {
    res.json({ body: req.body, query: req.query, clientIp: req.ip });
  });
  app.get('/session', requirePhase1Auth, requireTenantContext, (req, res) => {
    res.json({ userId: req.authCtx.userId, tenantId: req.tenantId });
  });
  app.get('/v1/tenants/:tenantId', requireV1Auth, requireTenantAccess(), (req, res) => {
    res.json({ tenantId: req.params.tenantId });
  });
  app.get('/tenants/:tenantId/document', ...access.requireTenantRead((req) => req.params.tenantId), (req, res) => {
    res.json(JSON.parse(fs.readFileSync(tenantPaths.projectMemoryPath(req.tenantId, 'project'), 'utf8')));
  });
  app.post('/tenants/:tenantId/document', ...access.requireTenantWrite((req) => req.params.tenantId), async (req, res, next) => {
    try {
      fs.writeFileSync(tenantPaths.projectMemoryPath(req.tenantId, 'project'), JSON.stringify(req.body));
      await access.audit(req, 'document.update', 'project', 'project', { test: true });
      res.status(201).json({ ok: true });
    } catch (err) { next(err); }
  });
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.type || 'request failed' }));
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const alice = signAccessToken({ sub: 'alice', email: 'alice@example.test', tenantId: 'tenant-a', role: 'owner' });
  const owner = signAccessToken({ sub: 'carol', tenantId: 'tenant-a', role: 'owner' });
  async function request(route, { token = alice, headers = {}, ...options } = {}) {
    const response = await fetch(base + route, {
      ...options,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, body: await response.json() };
  }
  function craftedToken(options = {}, payload = {}) {
    return jwt.sign({ sub: 'alice', tenantId: 'tenant-a', ...payload }, secret, {
      algorithm: 'HS256', issuer: 'openswarm-panel', audience: 'openswarm-access', expiresIn: '15m', ...options,
    });
  }

  await t.test('a signed session reaches its own tenant via bearer and cookie authentication', async () => {
    const expected = { status: 200, body: { userId: 'alice', tenantId: 'tenant-a' } };
    assert.deepEqual(await request('/session'), expected);
    assert.deepEqual(await request('/session', {
      token: null, headers: { Cookie: `openswarm_access_token=${encodeURIComponent(alice)}` },
    }), expected);
  });

  await t.test('missing, altered, expired, wrong-issuer and wrong-algorithm tokens cannot authenticate', async () => {
    const invalidTokens = [null, `${alice.slice(0, -8)}invalid!`, craftedToken({ expiresIn: -1 }),
      craftedToken({ issuer: 'another-service' }), craftedToken({ algorithm: 'HS384' })];
    for (const token of invalidTokens) assert.equal((await request('/session', { token })).status, 401);
  });

  await t.test('access, refresh and v1 tokens remain separate even when their signing keys match', async () => {
    const refresh = signRefreshToken({ sub: 'alice', tenantId: 'tenant-a' });
    const v1 = signV1Token({ sub: 'alice', tenantIds: ['tenant-a'], roles: ['member'] });
    assert.equal((await request('/session', { token: refresh })).status, 401);
    assert.equal((await request('/session', { token: v1 })).status, 401);
    assert.equal((await request('/v1/tenants/tenant-a', { token: alice })).status, 401);
    assert.equal((await request('/v1/tenants/tenant-a', { token: refresh })).status, 401);
    assert.equal((await request('/v1/tenants/tenant-a', { token: v1 })).status, 200);
  });

  await t.test('a user cannot change tenant context using a request header', async () => {
    assert.equal((await request('/session', { headers: { 'x-tenant-id': 'tenant-b' } })).status, 403);
    const admin = signAccessToken({ sub: 'operator', tenantId: 'tenant-a', role: 'platform_admin' });
    assert.deepEqual(await request('/session', { token: admin, headers: { 'x-tenant-id': 'tenant-b' } }), {
      status: 200, body: { userId: 'operator', tenantId: 'tenant-b' },
    });
  });

  await t.test('v1 tenant membership rejects other tenants and reserves global access for platform admins', async () => {
    const member = signV1Token({ sub: 'alice', tenantIds: ['tenant-a'], roles: ['owner'] });
    assert.equal((await request('/v1/tenants/tenant-b', { token: member })).status, 403);
    const admin = signV1Token({ sub: 'operator', roles: ['platform_admin'] });
    assert.equal((await request('/v1/tenants/tenant-b', { token: admin })).status, 200);
  });

  await t.test('tenant membership isolates stored documents and prevents forged tenant selection', async () => {
    assert.deepEqual(await request('/tenants/tenant-a/document'), {
      status: 200, body: { text: 'tenant-a document' },
    });
    const crossTenant = await request('/tenants/tenant-b/document?tenantId=tenant-a', {
      headers: { 'x-tenant-id': 'tenant-a' },
    });
    assert.equal(crossTenant.status, 403);
    assert.equal(JSON.stringify(crossTenant.body).includes('tenant-b document'), false);
    assert.equal(await repo.getMember('tenant-b', { userId: 'alice' }), null);
  });

  await t.test('persisted membership overrides stale owner claims and rejected writes leave data unchanged', async () => {
    const denied = await request('/tenants/tenant-a/document', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'unauthorized' }),
    });
    assert.equal(denied.status, 403);
    assert.equal(JSON.parse(fs.readFileSync(tenantPaths.projectMemoryPath('tenant-a', 'project'), 'utf8')).text, 'tenant-a document');
    assert.equal((await repo.listAuditLogs('tenant-a')).length, 0);
  });

  await t.test('an authorized owner can write and the audit entry stays in the affected tenant', async () => {
    const result = await request('/tenants/tenant-a/document', {
      token: owner, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'updated' }),
    });
    assert.equal(result.status, 201);
    assert.equal((await request('/tenants/tenant-a/document')).body.text, 'updated');
    assert.equal(JSON.parse(fs.readFileSync(tenantPaths.projectMemoryPath('tenant-b', 'project'), 'utf8')).text, 'tenant-b document');
    const audit = await repo.listAuditLogs('tenant-a');
    assert.equal(audit.length, 1);
    assert.equal(audit[0].tenantId, 'tenant-a');
    assert.equal(audit[0].userId, 'carol');
    assert.equal((await repo.listAuditLogs('tenant-b')).length, 0);
  });

  await t.test('normal nested query parameters and JSON bodies survive dependency upgrades', async () => {
    const body = { message: '你好 OpenSwarm', steps: [{ agentId: 'h01', enabled: true }], metadata: { priority: 2 } };
    const result = await request('/echo?filter[status]=active&tags[]=one&tags[]=two', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.9' }, body: JSON.stringify(body),
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.body, body);
    assert.deepEqual(result.body.query, { filter: { status: 'active' }, tags: ['one', 'two'] });
    assert.equal(result.body.clientIp, '127.0.0.1');
  });

  await t.test('malformed and oversized JSON requests are rejected instead of reaching handlers', async () => {
    const headers = { 'Content-Type': 'application/json' };
    assert.equal((await request('/echo', { method: 'POST', headers, body: '{broken' })).status, 400);
    assert.equal((await request('/echo', { method: 'POST', headers, body: JSON.stringify({ text: 'x'.repeat(2 * 1024 * 1024) }) })).status, 413);
  });

  await t.test('authenticated scope takes precedence over conflicting user-supplied tenant values', () => {
    assert.equal(resolveTenantId({ authCtx: { tenantId: 'tenant-a' }, headers: { 'x-tenant-id': 'tenant-b' }, body: { tenantId: 'tenant-b' } }), 'tenant-a');
    assert.equal(ensureTenantAccess({ tenantId: 'tenant-b' }, 'tenant-a').status, 403);
    assert.equal(ensureTenantAccess(null, 'tenant-a').status, 404);
    assert.deepEqual(ensureTenantAccess({ tenantId: 'tenant-a' }, 'tenant-a'), { ok: true });
  });
});
