const fs = require('fs');
const path = require('path');

function createDevtoolsService(options) {
  const {
    rootDir,
    hexRobots,
    readProjects,
    writeProjects,
    readPlatforms,
    writePlatforms,
    readPlatformTasks,
    writePlatformTasks,
    platformTasksFile,
    getHexWorkspaceDir,
    getHexagramProfilesMerged,
    scoreHexagramForNeeds,
    nextTaskId,
    execSync,
  } = options;

  const cursorEnvFile = path.join(rootDir, 'panel-web', 'data', 'cursor-env.json');

  function readCursorEnv() {
    try {
      return JSON.parse(fs.readFileSync(cursorEnvFile, 'utf8'));
    } catch (_) {
      return {};
    }
  }

  function writeCursorEnv(obj) {
    fs.mkdirSync(path.dirname(cursorEnvFile), { recursive: true });
    fs.writeFileSync(cursorEnvFile, JSON.stringify(obj, null, 2), 'utf8');
  }

  function cursorInstall(body = {}) {
    const target = body.target === 'host' || !body.target ? rootDir : getHexWorkspaceDir(body.target);
    const pm = body.packageManager || 'npm';
    const packages = Array.isArray(body.packages) ? body.packages : (body.packages ? [body.packages] : []);
    let cmd = '';
    if (pm === 'npm') cmd = packages.length ? `npm install ${packages.join(' ')}` : 'npm install';
    else if (pm === 'pip') cmd = packages.length ? `pip install ${packages.join(' ')}` : 'pip install';
    else if (pm === 'brew') cmd = packages.length ? `brew install ${packages.join(' ')}` : '';
    else if (body.command) cmd = body.command;
    if (!cmd) return { error: { status: 400, message: '需提供 packages 或 command' } };
    execSync(cmd, { cwd: target, stdio: 'pipe', shell: true });
    return { ok: true, target: body.target || 'host', command: cmd };
  }

  function cursorCode(body = {}) {
    const content = body.content != null ? String(body.content) : `// ${String(body.prompt || '')}`;
    const targetPath = body.path ? path.resolve(rootDir, body.path) : null;
    if (targetPath) {
      if (!targetPath.startsWith(rootDir)) return { error: { status: 400, message: 'path 须在项目目录下' } };
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, content, 'utf8');
    }
    return { ok: true, path: body.path || null, length: content.length };
  }

  function getCursorConfigure(hexId) {
    const env = readCursorEnv();
    if (hexId) return env[hexId] || {};
    return env;
  }

  function setCursorConfigure(body = {}) {
    const hexId = body.hexId || body.hex;
    if (!hexId) return { error: { status: 400, message: '需提供 hexId' } };
    const env = readCursorEnv();
    env[hexId] = { ...(env[hexId] || {}), ...(body.config || body) };
    delete env[hexId].hexId;
    delete env[hexId].hex;
    writeCursorEnv(env);
    return env[hexId];
  }

  function githubPull(body = {}) {
    const repoPath = body.repo ? path.resolve(rootDir, body.repo) : rootDir;
    if (!repoPath.startsWith(rootDir)) return { error: { status: 400, message: 'repo 须在项目目录下' } };
    if (!fs.existsSync(path.join(repoPath, '.git'))) return { error: { status: 400, message: '非 git 仓库' } };
    execSync('git pull', { cwd: repoPath, stdio: 'pipe', shell: true });
    return { ok: true, repo: body.repo || '.' };
  }

  function githubSync(body = {}) {
    const repoPath = body.repo ? path.resolve(rootDir, body.repo) : rootDir;
    if (!repoPath.startsWith(rootDir)) return { error: { status: 400, message: 'repo 须在项目目录下' } };
    if (!fs.existsSync(path.join(repoPath, '.git'))) return { error: { status: 400, message: '非 git 仓库' } };
    execSync('git fetch --all', { cwd: repoPath, stdio: 'pipe', shell: true });
    execSync('git pull', { cwd: repoPath, stdio: 'pipe', shell: true });
    return { ok: true, repo: body.repo || '.' };
  }

  function githubCommit(body = {}) {
    const repoPath = body.repo ? path.resolve(rootDir, body.repo) : rootDir;
    if (!repoPath.startsWith(rootDir)) return { error: { status: 400, message: 'repo 须在项目目录下' } };
    if (!fs.existsSync(path.join(repoPath, '.git'))) return { error: { status: 400, message: '非 git 仓库' } };
    const message = String(body.message || 'update');
    const files = Array.isArray(body.files) ? body.files : (body.files ? [body.files] : ['.']);
    execSync(`git add ${files.map((f) => `"${f}"`).join(' ')}`, { cwd: repoPath, stdio: 'pipe', shell: true });
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: repoPath, stdio: 'pipe', shell: true });
    return { ok: true, repo: body.repo || '.', message };
  }

  function listPlatformsSummary() {
    return readPlatforms().map((p) => ({ id: p.id, type: p.type, name: p.name, status: p.status || 'connected', createdAt: p.createdAt }));
  }

  function connectPlatform(body = {}) {
    const type = String(body.type || 'demo').toLowerCase();
    const name = String(body.name || type);
    const list = readPlatforms();
    const id = `plat${list.length + 1}`;
    const platform = { id, type, name, status: 'connected', credentials: body.credentials != null ? body.credentials : {}, createdAt: new Date().toISOString() };
    list.push(platform);
    writePlatforms(list);
    if (type === 'demo') {
      writePlatformTasks(id, [
        { id: 'pt1', title: '演示任务1', description: '示例接单任务', reward: 100, status: 'available' },
        { id: 'pt2', title: '演示任务2', description: '示例写作任务', reward: 200, status: 'available' },
      ]);
    }
    return { status: 201, body: { id: platform.id, type: platform.type, name: platform.name, status: platform.status } };
  }

  function deletePlatform(platformId) {
    let list = readPlatforms();
    const len = list.length;
    list = list.filter((p) => p.id !== platformId);
    if (list.length === len) return { error: { status: 404, message: '平台不存在' } };
    writePlatforms(list);
    try { fs.unlinkSync(platformTasksFile(platformId)); } catch (_) {}
    return { ok: true };
  }

  function getPlatformTasks(platformId) {
    const platform = readPlatforms().find((p) => p.id === platformId);
    if (!platform) return { error: { status: 404, message: '平台不存在' } };
    return readPlatformTasks(platformId);
  }

  function fetchPlatformTasks(platformId) {
    const platform = readPlatforms().find((p) => p.id === platformId);
    if (!platform) return { error: { status: 404, message: '平台不存在' } };
    const tasks = readPlatformTasks(platformId);
    return { fetched: tasks.length, tasks };
  }

  function acceptPlatformTask(platformId, taskId, body = {}) {
    const platform = readPlatforms().find((p) => p.id === platformId);
    if (!platform) return { error: { status: 404, message: '平台不存在' } };
    const tasks = readPlatformTasks(platformId);
    const ti = tasks.findIndex((t) => t.id === taskId);
    if (ti < 0) return { error: { status: 404, message: '任务不存在' } };
    tasks[ti].status = 'accepted';
    if (body.assignedTo) tasks[ti].assignedTo = body.assignedTo;
    writePlatformTasks(platformId, tasks);
    return tasks[ti];
  }

  function pipelinePlatformToProject(body = {}) {
    const platformId = body.platformId || body.platform;
    const projectId = body.projectId || body.project;
    if (!platformId || !projectId) return { error: { status: 400, message: '需提供 platformId 与 projectId' } };
    const platform = readPlatforms().find((p) => p.id === platformId);
    if (!platform) return { error: { status: 404, message: '平台不存在' } };
    const projList = readProjects();
    const pIdx = projList.findIndex((p) => p.id === projectId);
    if (pIdx < 0) return { error: { status: 404, message: '项目不存在' } };
    const project = projList[pIdx];
    if (!project.tasks) project.tasks = [];
    const platformTasks = readPlatformTasks(platformId).filter((t) => t.status === 'available');
    const needs = String(body.need || 'coding').split(/[,，\s]/).map((s) => s.trim()).filter(Boolean);
    const idle = getHexagramProfilesMerged().filter((p) => p.status === 'idle');
    const scored = idle.map((p) => ({ ...p, _score: scoreHexagramForNeeds(p, needs) })).sort((a, b) => b._score - a._score);
    let created = 0;
    platformTasks.slice(0, scored.length).forEach((pt, i) => {
      const hex = scored[i];
      if (!hex) return;
      const taskId = nextTaskId(project.tasks);
      project.tasks.push({ id: taskId, title: pt.title || pt.id, assignedTo: hex.id, status: 'in-progress', deadline: '', dependencies: [], _platformTaskId: pt.id });
      const tasks = readPlatformTasks(platformId);
      const tti = tasks.findIndex((t) => t.id === pt.id);
      if (tti >= 0) {
        tasks[tti].status = 'accepted';
        tasks[tti].assignedTo = hex.id;
        writePlatformTasks(platformId, tasks);
      }
      created += 1;
    });
    writeProjects(projList);
    return { created, projectId, platformId };
  }

  return {
    cursorInstall,
    cursorCode,
    getCursorConfigure,
    setCursorConfigure,
    githubPull,
    githubSync,
    githubCommit,
    listPlatformsSummary,
    connectPlatform,
    deletePlatform,
    getPlatformTasks,
    fetchPlatformTasks,
    acceptPlatformTask,
    pipelinePlatformToProject,
  };
}

module.exports = {
  createDevtoolsService,
};
