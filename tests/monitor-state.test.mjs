import test from 'node:test';
import assert from 'node:assert/strict';
import { appendLog, formatDuration, initialLog, LOG_CHARACTER_LIMIT, logText } from '../app/monitor-state.mjs';

test('appends incremental log blocks without duplication', () => {
  const first = appendLog(initialLog(), { stream_id: '7:1:a', cursor: 4, content: 'one\n', reset: false });
  const next = appendLog(first, { stream_id: '7:1:a', cursor: 8, content: 'two\n', reset: false });
  assert.equal(next.text, 'one\ntwo\n');
  assert.equal(next.cursor, 8);
});

test('restart and file reset discard the previous attempt text', () => {
  const old = { streamId: '7:1:a', cursor: 99, text: 'old', truncated: true };
  const next = appendLog(old, { stream_id: '7:2:b', cursor: 3, content: 'new', reset: false });
  assert.equal(next.text, 'new');
  assert.equal(next.truncated, false);
  assert.equal(appendLog(next, { stream_id: '7:2:b', cursor: 0, content: '', reset: true }).text, '');
});

test('bounded display keeps the server byte cursor unchanged', () => {
  const next = appendLog(initialLog(), { stream_id: 'a', cursor: 500000, content: 'x'.repeat(LOG_CHARACTER_LIMIT + 10), reset: false });
  assert.equal(next.text.length, LOG_CHARACTER_LIMIT);
  assert.equal(next.cursor, 500000);
  assert.equal(next.truncated, true);
});

test('terminal escape sequences are removed without treating log text as HTML', () => {
  assert.equal(logText('\x1b[31mred\x1b[0m\rnext\r\n<script>'), 'red\nnext\n<script>');
});

test('unknown duration remains unknown; real zero and long durations are shown', () => {
  for (const value of [null, undefined, NaN, Infinity, -1]) assert.equal(formatDuration(value), 'Indisponível');
  assert.equal(formatDuration(0), '0min 0s');
  assert.equal(formatDuration(3661.9), '1h 1min 1s');
});
