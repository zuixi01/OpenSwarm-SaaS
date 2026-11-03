const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openswarm-hygiene-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: root });
  const docs = [
    'README.md', 'README.zh.md', 'CONTRIBUTING.md', 'CONTRIBUTING.en.md',
    'SECURITY.md', 'SECURITY.en.md', 'panel-web/README.md',
    '.github/REPO_SETTINGS.md', 'docs/RELEASE_CHECKLIST.md',
  ];
  for (const file of [...docs, 'scripts/check-repository.js']) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), '# Fixture\n');
  }
  fs.copyFileSync(path.join(__dirname, 'check-repository.js'), path.join(root, 'scripts/check-repository.js'));
  const run = () => spawnSync(process.execPath, ['scripts/check-repository.js'], { cwd: root, encoding: 'utf8' });
  return { root, run };
}

test('source and environment example pass; broken onboarding link fails', t => {
  const { root, run } = fixture(t);
  fs.writeFileSync(path.join(root, '.env.example'), '# Configuration template\n');
  assert.equal(run().status, 0);
  fs.writeFileSync(path.join(root, 'README.md'), '[guide](missing-guide.md)\n');
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /broken local link/);
});

test('tracked local environment and generated tenant state fail', t => {
  const { root, run } = fixture(t);
  fs.mkdirSync(path.join(root, 'yin/tenants/example'), { recursive: true });
  fs.writeFileSync(path.join(root, 'yin/tenants/example/state.json'), '{}');
  fs.writeFileSync(path.join(root, '.env.local'), '# Not for source control\n');
  fs.writeFileSync(path.join(root, 'config.json'), '{}');
  fs.writeFileSync(path.join(root, 'workers.conf'), '# Synthetic runtime configuration\n');
  fs.writeFileSync(path.join(root, 'yin/moltbot.json'), '{}');
  execFileSync('git', ['add', '.'], { cwd: root });
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /generated runtime state/);
  assert.match(result.stderr, /private configuration\/key file/);
  for (const file of ['config.json', 'workers.conf', 'yin/moltbot.json']) {
    assert.ok(result.stderr.includes(`${file}: generated runtime state`));
  }
});

test('credential-like value fails without appearing in diagnostics', t => {
  const { root, run } = fixture(t);
  const synthetic = ['gh', 'p_', 'A'.repeat(36)].join('');
  fs.writeFileSync(path.join(root, 'accidental.txt'), synthetic);
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /possible github-token/);
  assert.ok(!`${result.stdout}${result.stderr}`.includes(synthetic));
});
