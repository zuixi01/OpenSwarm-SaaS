#!/usr/bin/env node
'use strict';

// A fast guard for the current source tree. This does not scan Git history or
// replace a dedicated secret scanner; diagnostics never print matched values.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const files = [...new Set(execFileSync('git', [
  'ls-files', '--cached', '--others', '--exclude-standard', '-z',
], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))];
const failures = [];
const generated = /^(?:yin\/(?:tenants|agents|claws|\.openswarm-shims)\/|panel-web\/data\/|panel-web\/projects\.db(?:-.+)?$|runtime\/|hexes\/|openclaw(?:\.backup-[^/]+)?\/|test-results\/|playwright-report\/|coverage\/|yin\/workspace\/MEMORY\.md$|yin\/(?:moltbot\.json|update-check\.json)$|(?:config\.json|workers\.conf)$)/;
const credentialFile = /(?:^|\/)(?:\.env(?:\..+)?|id_rsa|id_ed25519|[^/]+\.(?:key|p12|pfx))$/;
const exampleFile = /(?:^|\/)\.env\.(?:example|sample|template)$/;
const signatures = [
  ['private-key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['provider-token', /\bsk-(?:(?:proj|ant-api\d+|or-v1)-)?[A-Za-z0-9_-]{32,}\b/],
];

for (const file of files) {
  const target = path.join(root, file);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) continue;
  if (generated.test(file)) failures.push(`${file}: generated runtime state`);
  if (credentialFile.test(file) && !exampleFile.test(file)) {
    failures.push(`${file}: private configuration/key file`);
  }
  const bytes = fs.readFileSync(target);
  if (bytes.includes(0)) continue;
  const content = bytes.toString('utf8');
  for (const [rule, expression] of signatures) {
    if (expression.test(content)) failures.push(`${file}: possible ${rule} (value redacted)`);
  }
}

// Check the entry-point documentation, not vendored upstream documentation.
const entryDocs = [
  'README.md', 'README.zh.md', 'CONTRIBUTING.md', 'CONTRIBUTING.en.md',
  'SECURITY.md', 'SECURITY.en.md', 'panel-web/README.md',
  '.github/REPO_SETTINGS.md', 'docs/RELEASE_CHECKLIST.md',
];
for (const file of entryDocs) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of content.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)) {
    const link = match[1];
    if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(link)) continue;
    let relative;
    try { relative = decodeURIComponent(link.split(/[?#]/, 1)[0]); }
    catch { failures.push(`${file}: malformed local link`); continue; }
    const target = relative.startsWith('/')
      ? path.join(root, relative.slice(1))
      : path.resolve(root, path.dirname(file), relative);
    if (!fs.existsSync(target)) failures.push(`${file}: broken local link ${link}`);
  }
}

if (failures.length) {
  console.error('[repository:check] failed:\n' + failures.map(f => `- ${f}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`[repository:check] ${files.length} source paths checked; runtime/credential guard and entry-point links passed`);
}
