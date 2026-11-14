export const LOG_CHARACTER_LIMIT = 120000;

export function initialLog() {
  return { streamId: null, cursor: 0, text: '', truncated: false };
}

export function appendLog(previous, chunk) {
  const reset = chunk.reset || previous.streamId !== chunk.stream_id;
  const text = (reset ? '' : previous.text) + chunk.content;
  return {
    streamId: chunk.stream_id,
    cursor: chunk.cursor,
    text: text.slice(-LOG_CHARACTER_LIMIT),
    truncated: (!reset && previous.truncated) || text.length > LOG_CHARACTER_LIMIT,
  };
}

export function logText(text) {
  return text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function formatDuration(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return 'Indisponível';
  const value = Math.floor(seconds);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor(value % 3600 / 60);
  return `${hours ? `${hours}h ` : ''}${minutes}min ${value % 60}s`;
}
