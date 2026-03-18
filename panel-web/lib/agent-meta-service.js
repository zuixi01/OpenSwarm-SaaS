const fs = require('fs');
const path = require('path');
const { getAgentRoleProfile, getDefaultAgentRoleName } = require('./agent-role-catalog');

function createAgentMetaService(options) {
  const {
    rootDir,
    hexRobots,
    getWorkerByHex,
  } = options;

  const labelFilename = 'LABEL.txt';

  function writeAgentDefinition(hexId, content) {
    if (!hexRobots.some((h) => h.id === hexId)) return { error: { status: 404, message: '员工不存在' } };
    const worker = getWorkerByHex(hexId);
    if (!worker || !worker.stateDir) return { error: { status: 404, message: '该员工未配置 stateDir' } };
    const workspaceDir = path.join(worker.stateDir, 'workspace');
    const filePath = path.join(workspaceDir, '我的定义.md');
    if (!path.resolve(filePath).startsWith(path.resolve(worker.stateDir))) return { error: { status: 400, message: '路径非法' } };
    if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true });
    fs.writeFileSync(filePath, String(content != null ? content : ''), 'utf8');
    return { ok: true, path: filePath };
  }

  function readAgentDefinition(hexId) {
    const worker = getWorkerByHex(hexId);
    if (!worker || !worker.stateDir) return '';
    const filePath = path.join(worker.stateDir, 'workspace', '我的定义.md');
    try {
      if (!fs.existsSync(filePath)) return '';
      return String(fs.readFileSync(filePath, 'utf8') || '').trim();
    } catch (_) {
      return '';
    }
  }

  function readAgentLabel(hexId) {
    const worker = getWorkerByHex(hexId);
    if (!worker || !worker.stateDir) return getDefaultAgentRoleName(hexId, '');
    const filePath = path.join(worker.stateDir, 'workspace', labelFilename);
    try {
      if (!fs.existsSync(filePath)) return getDefaultAgentRoleName(hexId, '');
      const raw = fs.readFileSync(filePath, 'utf8');
      const label = (raw.split('\n')[0] || '').trim();
      return label || getDefaultAgentRoleName(hexId, '');
    } catch (_) {
      return getDefaultAgentRoleName(hexId, '');
    }
  }

  function writeAgentLabel(hexId, label) {
    const worker = getWorkerByHex(hexId);
    if (!worker || !worker.stateDir) return false;
    const workspaceDir = path.join(worker.stateDir, 'workspace');
    const filePath = path.join(workspaceDir, labelFilename);
    if (!path.resolve(filePath).startsWith(path.resolve(worker.stateDir))) return false;
    try {
      if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true });
      fs.writeFileSync(filePath, `${String(label == null ? '' : label).trim()}\n`, 'utf8');
      return true;
    } catch (_) {
      return false;
    }
  }

  function formatAgentNo(hexId) {
    const hex = hexRobots.find((h) => h.id === hexId);
    if (!hex || !Number.isFinite(Number(hex.workerId))) return 'NO.--';
    return `NO.${String(Number(hex.workerId)).padStart(2, '0')}`;
  }

  function resolveAgentDisplayName(hexId) {
    const label = readAgentLabel(hexId);
    if (label) return String(label).trim();
    return formatAgentNo(hexId);
  }

  function formatHexNameWithLabel(hexId) {
    const display = resolveAgentDisplayName(hexId);
    const noTag = formatAgentNo(hexId);
    if (display && display !== noTag) return `${display}(${noTag})`;
    return noTag;
  }

  function normalizeAgentNameForPrompt(rawName) {
    const name = String(rawName || '').trim();
    if (!name) return '员工';
    if (/^(NO\.\d{2}|NO\.\-\-|DG-\d{2})$/i.test(name)) return name.toUpperCase();
    const hit = hexRobots.find((h) => h.name === name || h.id === name);
    if (hit) return resolveAgentDisplayName(hit.id);
    return name;
  }

  function normalizeLegacyAgentMentions(rawText) {
    return String(rawText || '');
  }

  function getAgentRoleProfileById(hexId) {
    return getAgentRoleProfile(hexId);
  }

  function getAgentLabel(hexId) {
    if (!hexRobots.some((h) => h.id === hexId)) return { error: { status: 404, message: '员工不存在' } };
    return { id: hexId, agentId: hexId, label: readAgentLabel(hexId) };
  }

  function setAgentLabel(hexId, label) {
    if (!hexRobots.some((h) => h.id === hexId)) return { error: { status: 404, message: '员工不存在' } };
    if (!writeAgentLabel(hexId, label)) return { error: { status: 500, message: '写入标签失败' } };
    return { id: hexId, agentId: hexId, label: readAgentLabel(hexId) };
  }

  return {
    writeAgentDefinition,
    readAgentDefinition,
    readAgentLabel,
    writeAgentLabel,
    formatAgentNo,
    resolveAgentDisplayName,
    formatHexNameWithLabel,
    normalizeAgentNameForPrompt,
    normalizeLegacyAgentMentions,
    getAgentRoleProfile: getAgentRoleProfileById,
    getAgentLabel,
    setAgentLabel,
  };
}

module.exports = {
  createAgentMetaService,
};
