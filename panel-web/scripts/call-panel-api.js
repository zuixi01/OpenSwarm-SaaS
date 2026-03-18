#!/usr/bin/env node
/**
 * 命令行调用面板 API，供主控（或用户）执行启停、项目与选员工。
 * 用法（在OpenSwarm项目根目录下）：
 *   node panel-web/scripts/call-panel-api.js robots
 *   node panel-web/scripts/call-panel-api.js projects
 *   node panel-web/scripts/call-panel-api.js start <robot>     # robot: main | lan | qian | tai | ...
 *   node panel-web/scripts/call-panel-api.js stop <robot>
 *   node panel-web/scripts/call-panel-api.js project-create <项目名>
 *   node panel-web/scripts/call-panel-api.js project-set-hex <projectId> <hexId1> [hexId2 ...]
 *
 * 环境变量：PANEL_BASE_URL，默认 http://localhost:3999
 */

const BASE = process.env.PANEL_BASE_URL || 'http://localhost:3999';

function req(method, path, body) {
  const url = path.startsWith('http') ? path : BASE.replace(/\/$/, '') + path;
  const opt = { method, headers: { 'Content-Type': 'application/json' } };
  if (body != null) opt.body = JSON.stringify(body);
  return fetch(url, opt).then((r) => r.json().catch(() => ({ error: 'parse error', status: r.status })).then((d) => ({ ok: r.ok, status: r.status, data: d })));
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  if (!cmd) {
    console.log('用法: node call-panel-api.js <command> [args...]');
    console.log('  robots                 GET /api/robots');
    console.log('  projects              GET /api/projects');
    console.log('  start <robot>         POST /api/open-tui/:robot');
    console.log('  stop <robot>          POST /api/stop/:robot');
    console.log('  project-create <name> POST /api/projects');
    console.log('  project-set-hex <id> <hex1> [hex2...]  PUT /api/projects/:id  { hexIds }');
    process.exit(1);
  }

  (async () => {
    try {
      if (cmd === 'robots') {
        const res = await req('GET', '/api/robots');
        if (!res.ok) { console.error(JSON.stringify(res.data)); process.exit(2); }
        console.log(JSON.stringify(res.data, null, 2));
        return;
      }
      if (cmd === 'projects') {
        const res = await req('GET', '/api/projects');
        if (!res.ok) { console.error(JSON.stringify(res.data)); process.exit(2); }
        console.log(JSON.stringify(res.data, null, 2));
        return;
      }
      if (cmd === 'start') {
        const robot = args[1];
        if (!robot) { console.error('缺少 robot，如 main、lan、qian、tai'); process.exit(1); }
        const res = await req('POST', '/api/open-tui/' + encodeURIComponent(robot));
        if (!res.ok) { console.error(res.data.error || res.data); process.exit(2); }
        console.log(JSON.stringify(res.data, null, 2));
        return;
      }
      if (cmd === 'stop') {
        const robot = args[1];
        if (!robot) { console.error('缺少 robot'); process.exit(1); }
        const res = await req('POST', '/api/stop/' + encodeURIComponent(robot));
        if (!res.ok) { console.error(res.data.error || res.data); process.exit(2); }
        console.log(JSON.stringify(res.data, null, 2));
        return;
      }
      if (cmd === 'project-create') {
        const name = args.slice(1).join(' ').trim() || '新项目';
        const res = await req('POST', '/api/projects', { name });
        if (!res.ok) { console.error(res.data.error || res.data); process.exit(2); }
        console.log(JSON.stringify(res.data, null, 2));
        return;
      }
      if (cmd === 'project-set-hex') {
        const projectId = args[1];
        const hexIds = args.slice(2).filter(Boolean);
        if (!projectId) { console.error('缺少 projectId'); process.exit(1); }
        const res = await req('PUT', '/api/projects/' + encodeURIComponent(projectId), { hexIds });
        if (!res.ok) { console.error(res.data.error || res.data); process.exit(2); }
        console.log(JSON.stringify(res.data, null, 2));
        return;
      }
      console.error('未知命令:', cmd);
      process.exit(1);
    } catch (e) {
      console.error(e.message || e);
      process.exit(2);
    }
  })();
}

main();
