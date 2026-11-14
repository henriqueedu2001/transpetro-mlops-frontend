export function formatMetric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('pt-BR', { maximumSignificantDigits: 5 }) : 'Indisponível';
}

export function metricPlot(rows, key) {
  const valid = rows.filter(row => Number.isFinite(row[key]));
  if (!valid.length) return null;
  const minX = rows[0].epoch;
  const maxX = Math.max(minX + 1, rows.at(-1).epoch);
  const maxY = key.startsWith('metrics/') ? 1 : Math.max(0.001, ...valid.map(row => row[key])) * 1.05;
  const step = Math.max(1, Math.ceil(rows.length / 1000));
  const points = [];
  let gap = true;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!Number.isFinite(row[key])) { gap = true; continue; }
    if (i % step && i !== rows.length - 1 && !gap) continue;
    const x = 55 + (row.epoch - minX) / (maxX - minX) * 630;
    const y = 225 - row[key] / maxY * 195;
    points.push({ x, y, epoch: row.epoch, value: row[key], move: gap });
    gap = false;
  }
  return { points, path: points.map(p => `${p.move ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
    minX, lastX: rows.at(-1).epoch, maxY, sampled: step > 1 };
}

export function resultQuery(selection, currentAttempt) {
  return selection === 'legacy' ? 'legacy=true' : `attempt=${selection === 'current' ? currentAttempt : Number(selection)}`;
}
