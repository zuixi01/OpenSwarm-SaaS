function normalizeAutonomousStatus(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (['completed', 'done', 'finish', 'finished', '已完成', '完成'].includes(text)) return 'completed';
  if (['handoff', '需协作', '协作', '交接'].includes(text)) return 'handoff';
  if (['blocked', '阻塞', '卡住'].includes(text)) return 'blocked';
  if (['needs_yin', 'needs-human', 'need_human', '需主控', '需人工', '需管理者'].includes(text)) return 'needs_yin';
  return text;
}

function extractJsonObject(text) {
  const source = String(text || '');
  const codeBlock = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];
  if (codeBlock && codeBlock[1]) candidates.push(codeBlock[1].trim());
  const firstBrace = source.indexOf('{');
  const lastBrace = source.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(source.slice(firstBrace, lastBrace + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (_) {}
  }
  return null;
}

function createAutonomyParser({ parseMentionedHexIds }) {
  function parseHandoffTarget(text) {
    const msg = String(text || '');
    const match = msg.match(/@([A-Za-z]{2,}-\d{2}|[A-Za-z0-9_-]+)/);
    if (!match) return null;
    const token = match[1];
    const mentioned = parseMentionedHexIds('@' + token);
    return mentioned[0] || null;
  }

  function parseAutonomousDirective(reply) {
    const text = String(reply || '').trim();
    if (!text) return { status: '', artifacts: [], handoffTo: null, handoffMessage: '', needsYin: false, taskDone: false };

    const taggedBlock = text.match(/<autonomy_result>\s*([\s\S]*?)\s*<\/autonomy_result>/i);
    const taggedText = taggedBlock && taggedBlock[1] ? taggedBlock[1].trim() : '';
    if (taggedText) {
      const fromTaggedJson = extractJsonObject(taggedText);
      if (fromTaggedJson && typeof fromTaggedJson === 'object') {
        const status = normalizeAutonomousStatus(fromTaggedJson.status);
        const handoffTo = fromTaggedJson.handoff_to || fromTaggedJson.handoffTo || null;
        const normalizedTarget = handoffTo ? (parseMentionedHexIds('@' + String(handoffTo))[0] || String(handoffTo).trim()) : null;
        return {
          status,
          artifacts: Array.isArray(fromTaggedJson.artifacts) ? fromTaggedJson.artifacts.map((v) => String(v)).filter(Boolean) : [],
          handoffTo: normalizedTarget,
          handoffMessage: String(fromTaggedJson.handoff_message || fromTaggedJson.handoffMessage || '').trim(),
          needsYin: Boolean(fromTaggedJson.needs_yin || fromTaggedJson.needsYin),
          taskDone: Boolean(fromTaggedJson.task_done || fromTaggedJson.taskDone || status === 'completed')
        };
      }
    }

    const fromJson = extractJsonObject(text);
    if (fromJson && typeof fromJson === 'object') {
      const status = normalizeAutonomousStatus(fromJson.status);
      const handoffTo = fromJson.handoff_to || fromJson.handoffTo || null;
      const normalizedTarget = handoffTo ? (parseMentionedHexIds('@' + String(handoffTo))[0] || String(handoffTo).trim()) : null;
      return {
        status,
        artifacts: Array.isArray(fromJson.artifacts) ? fromJson.artifacts.map((v) => String(v)).filter(Boolean) : [],
        handoffTo: normalizedTarget,
        handoffMessage: String(fromJson.handoff_message || fromJson.handoffMessage || '').trim(),
        needsYin: Boolean(fromJson.needs_yin || fromJson.needsYin),
        taskDone: Boolean(fromJson.task_done || fromJson.taskDone || status === 'completed')
      };
    }

    const lines = text.split('\n');
    const result = { status: '', artifacts: [], handoffTo: null, handoffMessage: '', needsYin: false, taskDone: false };
    lines.forEach((line) => {
      let m = line.match(/^状态[：:]\s*(.+)$/);
      if (m) result.status = normalizeAutonomousStatus(m[1]);
      m = line.match(/^产出(?:路径)?[：:]\s*(.+)$/);
      if (m) result.artifacts.push(String(m[1]).trim());
      m = line.match(/^下一步[：:]\s*(.+)$/);
      if (m) {
        result.handoffMessage = String(m[1]).trim();
        result.handoffTo = parseHandoffTarget(m[1]);
      }
      m = line.match(/^@([A-Za-z]{2,}-\d{2}|[A-Za-z0-9_-]+)/);
      if (m && !result.handoffTo) result.handoffTo = parseMentionedHexIds('@' + m[1])[0] || null;
      m = line.match(/^需(?:主控|人工|管理者)[：:]\s*(是|yes|true|1)$/i);
      if (m) result.needsYin = true;
      m = line.match(/^任务完成[：:]\s*(是|yes|true|1)$/i);
      if (m) result.taskDone = true;
    });

    if (!result.status) {
      if (result.taskDone) result.status = 'completed';
      else if (result.needsYin) result.status = 'needs_yin';
      else if (result.handoffTo) result.status = 'handoff';
    }
    if (result.status === 'completed') result.taskDone = true;
    if (result.status === 'needs_yin') result.needsYin = true;
    if (!result.handoffTo) result.handoffTo = parseHandoffTarget(text);
    if (!result.status && result.handoffTo) result.status = 'handoff';
    return result;
  }

  return {
    normalizeAutonomousStatus,
    extractJsonObject,
    parseAutonomousDirective,
  };
}

module.exports = {
  createAutonomyParser,
  normalizeAutonomousStatus,
  extractJsonObject,
};
