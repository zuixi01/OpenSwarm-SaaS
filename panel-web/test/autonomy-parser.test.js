const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAutonomyParser } = require('../lib/autonomy-parser');

const parser = createAutonomyParser({
  parseMentionedHexIds(text) {
    const match = String(text).match(/@(?:DG-|h)0?([1-9]\d?)/i);
    return match ? [`h${match[1].padStart(2, '0')}`] : [];
  },
});

test('tagged handoff takes precedence over incidental JSON in an agent reply', () => {
  const result = parser.parseAutonomousDirective(`Draft: {"status":"completed"}
<autonomy_result>{"status":"handoff","handoff_to":"DG-02","handoff_message":"Review the report","artifacts":["outputs/report.md"]}</autonomy_result>`);
  assert.equal(result.status, 'handoff');
  assert.equal(result.handoffTo, 'h02');
  assert.equal(result.handoffMessage, 'Review the report');
  assert.deepEqual(result.artifacts, ['outputs/report.md']);
  assert.equal(result.taskDone, false);
});

test('a fenced completed result marks the task complete and preserves artifacts', () => {
  const result = parser.parseAutonomousDirective('Report ready.\n```json\n{"status":"done","artifacts":["report.md"]}\n```');
  assert.equal(result.status, 'completed');
  assert.equal(result.taskDone, true);
  assert.deepEqual(result.artifacts, ['report.md']);
});

test('text handoffs resolve an agent and retain its instruction', () => {
  const result = parser.parseAutonomousDirective('状态：交接\n产出路径：outputs/report.md\n下一步：@DG-03 请核对数据');
  assert.equal(result.status, 'handoff');
  assert.equal(result.handoffTo, 'h03');
  assert.equal(result.handoffMessage, '@DG-03 请核对数据');
  assert.deepEqual(result.artifacts, ['outputs/report.md']);
  assert.equal(result.taskDone, false);
});

test('a request for human review remains unfinished', () => {
  const result = parser.parseAutonomousDirective('需人工：是\n产出：draft.md');
  assert.equal(result.status, 'needs_yin');
  assert.equal(result.needsYin, true);
  assert.equal(result.taskDone, false);
});

test('empty, ordinary and malformed replies do not accidentally complete a task', () => {
  for (const text of ['', 'Still working on the report.', '{"status":', '<autonomy_result>{broken}</autonomy_result>']) {
    const result = parser.parseAutonomousDirective(text);
    assert.equal(result.taskDone, false);
    assert.equal(result.status, '');
    assert.equal(result.handoffTo, null);
  }
});

test('an explicit blocked result does not infer success or a handoff', () => {
  const result = parser.parseAutonomousDirective('{"status":"blocked","artifacts":null}');
  assert.equal(result.status, 'blocked');
  assert.equal(result.taskDone, false);
  assert.equal(result.handoffTo, null);
  assert.deepEqual(result.artifacts, []);
});
