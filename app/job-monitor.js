'use client';

import { useEffect, useRef, useState } from 'react';
import { appendLog, formatDuration, initialLog, logText } from './monitor-state.mjs';

const STAGES = {
  queued: 'Na fila', starting: 'Iniciando processo', preparing: 'Preparando treinamento',
  training: 'Treinando', validating: 'Validando época', finalizing: 'Finalizando',
  succeeded: 'Concluído', failed: 'Falhou', cancelled: 'Cancelado', running: 'Executando',
};

export default function JobMonitor({ jobId, apiBase, onClose }) {
  const [snapshot, setSnapshot] = useState(null);
  const [log, setLog] = useState(initialLog);
  const [error, setError] = useState('');
  const [followLog, setFollowLog] = useState(true);
  const logElement = useRef(null);
  const panelElement = useRef(null);

  useEffect(() => {
    panelElement.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [jobId]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timer;
    let currentLog = initialLog();
    setSnapshot(null);
    setLog(currentLog);
    setError('');
    const poll = async () => {
      let delay = 2000;
      try {
        const query = new URLSearchParams({ cursor: String(currentLog.cursor) });
        if (currentLog.streamId) query.set('stream_id', currentLog.streamId);
        const response = await fetch(`${apiBase}/jobs/${jobId}/monitor?${query}`, {
          signal: controller.signal, cache: 'no-store',
        });
        if (!response.ok) throw new Error(response.status === 404 ? 'Job não encontrado.' : 'Não foi possível atualizar o acompanhamento.');
        const data = await response.json();
        if (!active) return;
        if (data.progress.attempt !== data.log.attempt) throw new Error('Tentativa mudou; atualizando novamente.');
        currentLog = appendLog(currentLog, data.log);
        setLog(currentLog);
        setSnapshot(data.progress);
        setError('');
        delay = data.log.has_more ? 100 : 2000;
        // Keep a slow poll after completion to detect a restart requested elsewhere.
        if (!data.log.has_more && ['succeeded', 'failed', 'cancelled'].includes(data.progress.status)) delay = 5000;
      } catch (failure) {
        if (!active || failure.name === 'AbortError') return;
        setError(`${failure.message} Os últimos dados exibidos podem estar desatualizados.`);
        delay = 3000;
      }
      if (active) timer = setTimeout(poll, delay);
    };
    poll();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [apiBase, jobId]);

  useEffect(() => {
    if (followLog && logElement.current) logElement.current.scrollTop = logElement.current.scrollHeight;
  }, [log.text, followLog]);

  const progress = snapshot;
  const total = progress?.epochs_total;
  const completed = progress?.epochs_completed;
  const fraction = total && completed !== null ? Math.min(100, completed / total * 100) : null;
  const devices = progress?.devices || [];
  return <section ref={panelElement} className="card job-monitor" aria-label={`Acompanhamento do job ${jobId}`}>
    <div className="section-title">
      <div className="section-copy">
        <span className="section-kicker">Acompanhamento</span>
        <h2>Job #{jobId}{progress && ` · tentativa ${progress.attempt}`}</h2>
        <p>{progress ? STAGES[progress.stage] || progress.status : 'Carregando acompanhamento…'}</p>
      </div>
      <button className="btn-secondary" onClick={onClose}>Fechar acompanhamento</button>
    </div>
    {error && <p className="warning" role="alert">{error}</p>}
    {progress?.cancel_requested && <p className="warning">Cancelamento solicitado. Aguardando o encerramento do processo.</p>}
    {progress?.stale && <p className="warning">Sem atualização de progresso há mais de 30 segundos. O processo pode estar em uma operação longa; consulte o log.</p>}
    {progress && !progress.available && <p className="monitor-note">{progress.status === 'queued'
      ? 'Esta tentativa ainda não iniciou. O progresso anterior não é reutilizado.'
      : 'Progresso não registrado nesta tentativa. Jobs antigos podem ter apenas o log histórico.'}</p>}
    <dl className="monitor-stats">
      <div><dt>Época atual</dt><dd>{progress?.epoch != null && total ? `${progress.epoch} / ${total}` : 'Indisponível'}</dd>
        {completed != null && <small>{completed} época(s) concluída(s)</small>}</div>
      <div><dt>Tempo decorrido</dt><dd>{formatDuration(progress?.elapsed_seconds)}</dd></div>
      <div><dt>Tempo restante estimado</dt><dd>{formatDuration(progress?.eta_seconds)}</dd>
        {progress?.estimated_finish_at != null && <small>Previsão: {new Date(progress.estimated_finish_at * 1000).toLocaleString('pt-BR')}</small>}</div>
    </dl>
    {fraction !== null && <progress className="epoch-progress" value={completed} max={total} aria-label="Épocas concluídas">{fraction.toFixed(0)}%</progress>}
    <p className="monitor-note">A estimativa usa até cinco épocas completas da tentativa atual. Não inclui a finalização e pode variar ou terminar antes por parada antecipada.</p>
    <div className="monitor-devices">
      <h3>Dispositivos observados no modelo</h3>
      {devices.length ? <ul>{devices.map((device, index) => <li key={`${device.rank}-${index}`}>
        <strong>{device.type === 'cuda' ? `CUDA:${device.index} · ${device.name}` : device.name || device.type}</strong>
        {progress.expected_devices > 1 && <span> · processo {device.rank}</span>}
        {device.uuid && <small>UUID: {device.uuid}</small>}
      </li>)}</ul> : <p className="monitor-note">Ainda não registrados nesta tentativa.</p>}
      {progress?.expected_devices > devices.length && <p className="monitor-note">{devices.length} de {progress.expected_devices} processo(s) registraram o dispositivo.</p>}
    </div>
    <div className="monitor-log-toolbar">
      <h3>Log desta tentativa</h3>
      <label><input type="checkbox" checked={followLog} onChange={(event) => setFollowLog(event.target.checked)} /> Acompanhar últimas linhas</label>
      <a className="btn-link" href={`${apiBase}/jobs/${jobId}/logs${progress?.available ? `?attempt=${progress.attempt}` : ''}`} target="_blank" rel="noreferrer">
        {progress?.available ? 'Abrir log completo' : 'Abrir log disponível / histórico'}
      </a>
    </div>
    {log.truncated && <p className="monitor-note">Exibindo apenas os últimos 120 mil caracteres. O arquivo completo permanece disponível.</p>}
    <pre className="monitor-log" ref={logElement} tabIndex={0} aria-label="Log do treinamento">{log.text ? logText(log.text) : 'Nenhum log recebido para esta tentativa.'}</pre>
    {progress?.updated_at != null && <p className="monitor-note">Última atualização do progresso: {new Date(progress.updated_at * 1000).toLocaleString('pt-BR')}</p>}
  </section>;
}
