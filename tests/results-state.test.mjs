import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMetric, metricPlot, resultQuery } from '../app/results-state.mjs';

test('unknown values stay unknown while zero is valid', () => {
  assert.equal(formatMetric(null), 'Indisponível');
  assert.equal(formatMetric(NaN), 'Indisponível');
  assert.equal(formatMetric(0), '0');
});
test('charts preserve epoch coordinates and break at missing values', () => {
  const plot = metricPlot([{epoch:1, loss:2}, {epoch:2, loss:null}, {epoch:3, loss:1}], 'loss');
  assert.deepEqual(plot.points.map(p => p.epoch), [1, 3]);
  assert.equal(plot.path.split('M').length - 1, 2);
  assert.equal(plot.lastX, 3);
});
test('single epoch and zero metric remain visible', () => {
  const plot = metricPlot([{epoch:1, 'metrics/x':0}], 'metrics/x');
  assert.equal(plot.points.length, 1);
  assert.equal(plot.points[0].y, 225);
  assert.equal(plot.maxY, 1);
  assert.equal(metricPlot([{epoch:1, loss:null}], 'loss'), null);
});
test('large series is bounded and includes the final epoch without changing values', () => {
  const rows = Array.from({length:10000}, (_,i) => ({epoch:i+1, loss:10000-i}));
  const plot = metricPlot(rows, 'loss');
  assert.ok(plot.points.length <= 1001);
  assert.equal(plot.points.at(-1).epoch, 10000);
  assert.equal(plot.points.at(-1).value, 1);
  assert.equal(plot.sampled, true);
});
test('selection is explicit and current follows the attempt on restart', () => {
  assert.equal(resultQuery('current', 2), 'attempt=2');
  assert.equal(resultQuery('1', 2), 'attempt=1');
  assert.equal(resultQuery('legacy', 2), 'legacy=true');
});
