'use client';

import { useEffect, useState } from 'react';
import { formatMetric, metricPlot, resultQuery } from './results-state.mjs';

const SUMMARY = [
  ['metrics/precision(B)', 'Precisão'], ['metrics/recall(B)', 'Recall'],
  ['metrics/mAP50(B)', 'mAP@0,50'], ['metrics/mAP50-95(B)', 'mAP@0,50:0,95'],
];
const STATUS = { succeeded: 'Concluído', failed: 'Falhou', cancelled: 'Cancelado', running: 'Executando', queued: 'Na fila', unknown: 'Não comprovado' };

function MetricCards({ values }) {
  return <dl className="result-metrics">{SUMMARY.map(([key, label]) => <div key={key}>
    <dt>{label}</dt><dd>{formatMetric(values?.[key])}</dd>
  </div>)}</dl>;
}

function MetricChart({ rows, metric, label }) {
  const plot = metricPlot(rows, metric);
  if (!plot) return <p className="monitor-note">Não há valores válidos para esta métrica.</p>;
  return <>
    <svg className="metric-chart" viewBox="0 0 720 270" role="img" aria-label={`${label} por época`}>
      <title>{label} por época</title>
      {[0, 0.5, 1].map(f => <g key={f}>
        <line x1="55" x2="685" y1={225 - f * 195} y2={225 - f * 195} stroke="#d9dce0" />
        <text x="48" y={229 - f * 195} textAnchor="end">{formatMetric(plot.maxY * f)}</text>
      </g>)}
      <path d={plot.path} fill="none" stroke="#991b2b" strokeWidth="2" />
      {plot.points.map(p => <circle key={p.epoch} cx={p.x} cy={p.y} r="2.8" fill="#991b2b"><title>Época {p.epoch}: {formatMetric(p.value)}</title></circle>)}
      <text x="55" y="247">{plot.minX}</text><text x="685" y="247" textAnchor="end">{plot.lastX === plot.minX ? '' : plot.lastX}</text>
      <text x="370" y="266" textAnchor="middle">Época</text>
    </svg>
    {plot.sampled && <p className="monitor-note">Gráfico reduzido para leitura. Valores completos disponíveis no CSV.</p>}
  </>;
}

export default function JobResults({ jobId, apiBase, currentAttempt, currentStatus }) {
  const [selection, setSelection] = useState('current');
  const [responseData, setData] = useState(null);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState('metrics/mAP50-95(B)');
  const query = resultQuery(selection, currentAttempt);
  // A selection/restart must hide old data before the next effect/fetch runs.
  const data = responseData?.query === query ? responseData.payload : null;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timer;
    setData(null);
    setError('');
    const poll = async () => {
      try {
        const response = await fetch(`${apiBase}/jobs/${jobId}/results?${query}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Não foi possível carregar os resultados.');
        const next = await response.json();
        if (!active) return;
        setData({ query, payload: next });
        setError('');
      } catch (failure) {
        if (!active || failure.name === 'AbortError') return;
        setError(`${failure.message} Os dados exibidos podem estar desatualizados.`);
      }
      if (active) timer = setTimeout(poll, currentStatus === 'running' ? 5000 : 10000);
    };
    poll();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [apiBase, jobId, query, currentStatus]);

  const columns = data?.metrics.columns || [];
  const selectedMetric = columns.find(c => c.key === metric) || columns[0];
  const rows = data?.metrics.rows || [];
  const url = name => `${apiBase}/jobs/${jobId}/artifacts/${name.split('/').map(encodeURIComponent).join('/')}?${query}&v=${encodeURIComponent(data?.artifacts.find(a => a.name === name)?.revision || '')}`;
  const images = data?.artifacts.filter(a => a.kind === 'image') || [];
  const downloadable = data?.artifacts.filter(a => a.kind !== 'image' && (!a.name.endsWith('.pt') || ['succeeded', 'failed', 'cancelled'].includes(data.status) || data.scope === 'legacy')) || [];

  return <section className="job-results" aria-label="Resultados do treinamento">
    <div className="results-heading"><div><h3>Resultados e artefatos</h3>
      <p className="monitor-note">Valores entre 0 e 1 para precisão, recall e mAP. Loss mede erro e usa escala própria.</p></div>
      <label>Origem dos resultados<select value={selection} onChange={event => setSelection(event.target.value)}>
        <option value="current">Tentativa atual ({currentAttempt})</option>
        {(data?.attempts || []).filter(n => n !== currentAttempt).map(n => <option key={n} value={String(n)}>Tentativa {n}</option>)}
        {(data?.legacy_available || selection === 'legacy') && <option value="legacy">Legados — tentativa não comprovada</option>}
      </select></label>
    </div>
    {error && <p className="warning" role="alert">{error}</p>}
    {!data && !error && <p>Carregando resultados…</p>}
    {data && <>
      <p className="result-provenance">{data.scope === 'legacy' ? 'Arquivos legados' : `Tentativa ${data.attempt}`} · {STATUS[data.status] || 'Estado desconhecido'}</p>
      {data.warnings.map((warning, i) => <p className="warning" key={i}>{warning}</p>)}
      {data.history_limited && <p className="monitor-note">Seletor limitado às últimas 100 tentativas.</p>}
      {!data.available && <p className="empty-state">Ainda não há resultados registrados nesta tentativa.{data.legacy_available && ' Os arquivos antigos estão na opção Legados.'}</p>}
      <h3>Avaliação final do melhor modelo</h3>
      <p className="monitor-note">{data.final ? 'Métricas da avaliação de best.pt no conjunto de validação.' : 'Avaliação final não registrada para esta origem. A última época não substitui essa avaliação.'}</p>
      {data.final && <MetricCards values={data.final.metrics} />}
      {data.metrics.warnings.map((warning, i) => <p className="warning" key={`csv-${i}`}>{warning}</p>)}
      {rows.length > 0 && <>
        <h3>Última época registrada: {data.metrics.latest.epoch}</h3>
        <MetricCards values={data.metrics.latest} />
        <label className="metric-selector">Métrica do gráfico<select value={selectedMetric.key} onChange={e => setMetric(e.target.value)}>
          {columns.map(column => <option key={column.key} value={column.key}>{column.label}</option>)}
        </select></label>
        <MetricChart rows={rows} metric={selectedMetric.key} label={selectedMetric.label} />
        <details className="result-values"><summary>Valores do gráfico — últimas {Math.min(25, rows.length)} épocas</summary>
          <table><thead><tr><th>Época</th><th>{selectedMetric.label}</th></tr></thead>
            <tbody>{rows.slice(-25).map(row => <tr key={row.epoch}><td>{row.epoch}</td><td>{formatMetric(row[selectedMetric.key])}</td></tr>)}</tbody></table>
        </details>
      </>}
      <div className="result-downloads">{downloadable.map(a => <a className="btn-link" key={a.name} href={url(a.name)} target="_blank" rel="noreferrer">{a.name}</a>)}
        {data.available && (['succeeded', 'failed', 'cancelled'].includes(data.status) || data.scope === 'legacy') &&
          <a className="btn-link" href={`${apiBase}/downloads/zip?train_id=${data.train_id}&${query}`}>Baixar pacote desta origem</a>}
      </div>
      <p className="monitor-note">O pacote contém resultados, pesos e registros disponíveis desta origem; não inclui o dataset original. Pesos de uma execução interrompida são parciais.</p>
      {images.length > 0 && <details className="result-gallery" open><summary>Imagens produzidas pelo YOLO ({images.length})</summary>
        <div className="result-image-grid">{images.map(a => <figure key={`${query}/${a.name}`}><a href={url(a.name)} target="_blank" rel="noreferrer">
          <img src={url(a.name)} alt={`Artefato YOLO: ${a.name}`} loading="lazy" />
        </a><figcaption>{a.name}</figcaption></figure>)}</div>
      </details>}
    </>}
  </section>;
}
