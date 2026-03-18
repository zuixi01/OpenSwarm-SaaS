#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '..', '..');
const SPEC = path.join(ROOT, 'docs', 'cloud-mvp', 'week1', 'openapi.yaml');

function fail(msg) {
  console.error('[openapi:check] ' + msg);
  process.exit(1);
}

if (!fs.existsSync(SPEC)) {
  fail('spec not found: ' + SPEC);
}

const raw = fs.readFileSync(SPEC, 'utf8');
let doc;
try {
  doc = YAML.parse(raw);
} catch (err) {
  fail('yaml parse failed: ' + (err.message || err));
}

if (!doc || typeof doc !== 'object') {
  fail('spec is empty');
}
if (!String(doc.openapi || '').startsWith('3.')) {
  fail('openapi version must be 3.x');
}
const requiredPaths = [
  '/v1/auth/login',
  '/v1/tenants',
  '/v1/projects',
  '/v1/tasks/{taskId}',
];
for (const p of requiredPaths) {
  if (!doc.paths || !doc.paths[p]) fail('missing path: ' + p);
}
console.log('[openapi:check] ok');
