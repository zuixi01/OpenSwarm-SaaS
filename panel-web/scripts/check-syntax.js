#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const files = [path.join(root, 'server.js')];

function collect(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (entry.isFile() && /\.(?:c|m)?js$/.test(entry.name)) files.push(file);
  }
}

// Only source directories: do not execute code or traverse runtime data/dependencies.
for (const directory of ['lib', 'middleware', 'routes', 'public', 'scripts', 'test']) {
  collect(path.join(root, directory));
}

let failed = 0;
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    failed += 1;
    console.error(`[syntax] ${path.relative(root, file)}`);
    console.error(result.error?.message || result.stderr || `exit ${result.status}`);
  }
}

console.log(`[syntax] checked ${files.length} JavaScript files; failures: ${failed}`);
process.exitCode = failed ? 1 : 0;
