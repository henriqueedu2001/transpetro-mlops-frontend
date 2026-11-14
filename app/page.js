'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import './styles.css';
import JobMonitor from './job-monitor';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const FALLBACK_MODELS = [
  { id: 'yolov8', label: 'YOLOv8', sizes: ['n', 's', 'm', 'l', 'x'] },
  { id: 'yolo11', label: 'YOLO11', sizes: ['n', 's', 'm', 'l', 'x'] },
  { id: 'yolo12', label: 'YOLO12', sizes: ['n', 's', 'm', 'l', 'x'] },
  { id: 'yolo26', label: 'YOLO26', sizes: ['n', 's', 'm', 'l', 'x'] },
];

const INITIAL_CONFIG = {
  model_version: 'yolov8', model_size: 'n', epochs: 10, batch: 16, workers: 8,
  imgsz: 640, patience: 100, optimizer: 'auto', lr0: 0.01, lrf: 0.01,
  momentum: 0.937, weight_decay: 0.0005, warmup_epochs: 3,
  cos_lr: false, close_mosaic: 10, seed: 0, deterministic: true, device: '0',
};

const STATUS = {
  queued: { label: 'Na fila', className: 'status-queued' },
  running: { label: 'Executando', className: 'status-running' },
  succeeded: { label: 'Concluído', className: 'status-succeeded' },
  failed: { label: 'Falhou', className: 'status-failed' },
  cancelled: { label: 'Cancelado', className: 'status-cancelled' },
};

function Field({ label, name, value, onChange, type = 'number', ...props }) {
  return (
    <div className="form-group">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} value={value} onChange={onChange} {...props} />
    </div>
  );
}

function DatasetClasses({ dataset }) {
  return <div className="dataset-classes">
    <ul>{dataset.names.map((name, id) => <li key={id}><strong>{id}</strong>: {name}</li>)}</ul>
    {Object.entries(dataset.validation || {}).map(([split, counts]) => (
      <p key={split}>{split}: {counts.images} imagem(ns), {counts.objects_per_class.reduce((total, count) => total + count, 0)} objeto(s) anotado(s), {counts.empty_labels} anotação(ões) vazia(s), {counts.missing_labels} ausente(s).</p>
    ))}
    {(dataset.warnings || []).map((warning) => <p className="warning" key={warning}>{warning}</p>)}
  </div>;
}

export default function Home() {
  const [metadata, setMetadata] = useState({ train_name: '', project_name: '', project_owner: '' });
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [datasetFile, setDatasetFile] = useState(null);
  const [argsYaml, setArgsYaml] = useState(null);
  const [dataYaml, setDataYaml] = useState(null);
  const [submittedDataset, setSubmittedDataset] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [apiWarning, setApiWarning] = useState('');
  const [downloadTrainId, setDownloadTrainId] = useState('');
  const [monitoredJobId, setMonitoredJobId] = useState(null);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === config.model_version) || models[0],
    [models, config.model_version],
  );

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/jobs/`);
      if (!response.ok) throw new Error('Não foi possível buscar os jobs.');
      setJobs(await response.json());
      setApiWarning('');
    } catch (error) {
      setApiWarning('API indisponível; a lista será atualizada assim que a conexão voltar.');
    }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/models`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setModels(data.models))
      .catch(() => setModels(FALLBACK_MODELS));
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const updateMetadata = (event) => {
    setMetadata((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const updateConfig = (event) => {
    const { name, type, checked, value } = event.target;
    setConfig((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }));
  };

  const handleModelChange = (event) => {
    const model = models.find((item) => item.id === event.target.value);
    setConfig((current) => ({ ...current, model_version: model.id, model_size: model.sizes[0] }));
  };

  const parseError = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (Array.isArray(payload.detail)) return payload.detail.map((item) => item.msg).join('; ');
    return payload.detail || `Erro HTTP ${response.status}`;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!datasetFile) {
      setSubmitMessage('Selecione um dataset .zip.');
      return;
    }
    setIsSubmitting(true);
    setSubmittedDataset(null);
    setSubmitMessage('Enviando e validando o treinamento...');
    const formData = new FormData();
    Object.entries(metadata).forEach(([key, value]) => formData.append(key, value));
    Object.entries(config).forEach(([key, value]) => formData.append(key, String(value)));
    formData.append('file', datasetFile);
    if (argsYaml) formData.append('args_yaml', argsYaml);
    if (dataYaml) formData.append('data_yaml', dataYaml);

    try {
      const response = await fetch(`${API_BASE}/trainings/`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(await parseError(response));
      const data = await response.json();
      setSubmitMessage(`Treinamento ${data.train_id} criado na fila com o modelo ${data.model}.`);
      setDownloadTrainId(String(data.train_id));
      setSubmittedDataset(data.configuration?.dataset || null);
      setDatasetFile(null);
      setArgsYaml(null);
      setDataYaml(null);
      document.getElementById('dataset-file').value = '';
      document.getElementById('args-yaml').value = '';
      document.getElementById('data-yaml').value = '';
      await fetchJobs();
    } catch (error) {
      setSubmitMessage(`Erro: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const controlJob = async (jobId, action) => {
    const verb = action === 'cancel' ? 'cancelar' : 'reiniciar';
    if (!window.confirm(`Deseja ${verb} o job ${jobId}?`)) return;
    try {
      const response = await fetch(`${API_BASE}/jobs/${jobId}/${action}`, { method: 'POST' });
      if (!response.ok) throw new Error(await parseError(response));
      await fetchJobs();
    } catch (error) {
      window.alert(error.message);
    }
  };

  const downloadFile = async (url, filename) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(await parseError(response));
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      window.alert(error.message);
    }
  };

  const formatDate = (date) => date ? new Date(date).toLocaleString('pt-BR') : '—';

  return (
    <main className="container">
      <header className="header">
        <div className="header-copy">
          <span className="header-eyebrow">CITI-USP · Transpetro</span>
          <h1>Treinamento de modelos</h1>
          <p>Configure, acompanhe e recupere experimentos YOLO em um único ambiente.</p>
        </div>
        <div className="release-card" aria-label="Versão atual da plataforma">
          <span className="release-indicator" aria-hidden="true" />
          <div>
            <span>Ambiente atual</span>
            <strong>Release 2</strong>
          </div>
        </div>
      </header>

      <section className="card">
        <div className="section-title">
          <div className="section-copy">
            <span className="section-kicker">Configuração</span>
            <h2>Novo treinamento</h2>
            <p>Defina os dados, o modelo e os parâmetros da execução.</p>
          </div>
          <span className="required-note">* Campos obrigatórios</span>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-section-title">
            <h3>Identificação e dados</h3>
            <p>Informações usadas para organizar e localizar o treinamento.</p>
          </div>
          <div className="form-grid">
            <Field label="Nome do treinamento *" name="train_name" type="text" value={metadata.train_name} onChange={updateMetadata} required />
            <Field label="Projeto *" name="project_name" type="text" value={metadata.project_name} onChange={updateMetadata} required />
            <Field label="Responsável *" name="project_owner" type="text" value={metadata.project_owner} onChange={updateMetadata} required />
            <div className="form-group">
              <label htmlFor="dataset-file">Dataset (.zip) *</label>
              <input id="dataset-file" type="file" accept=".zip,application/zip" onChange={(event) => setDatasetFile(event.target.files[0])} required />
            </div>
          </div>

          <div className="yaml-row">
            <div className="form-group">
              <label htmlFor="data-yaml">Classes do dataset (data.yaml)</label>
              <input id="data-yaml" type="file" accept=".yaml,.yml" onChange={(event) => setDataYaml(event.target.files[0] || null)} aria-describedby="data-yaml-help" />
            </div>
            <div className="yaml-help" id="data-yaml-help">
              <p>Defina os nomes na ordem dos IDs das anotações, começando em 0. Obrigatório aqui ou dentro do ZIP. Limite: 64 KiB.</p>
              <p>Use names e, se necessário, train e val com diretórios relativos ao YAML (ou à raiz do ZIP no envio separado). Definições conflitantes serão recusadas.</p>
              <a className="yaml-example-link" href="/data-example.yaml" download="data.yaml">Baixar exemplo de classes</a>
            </div>
          </div>

          <div className="form-section-title">
            <h3>Modelo e parâmetros principais</h3>
            <p>Configuração essencial utilizada pelo Ultralytics.</p>
          </div>
          <div className="form-grid params-grid">
            <div className="form-group">
              <label htmlFor="model_version">Família YOLO</label>
              <select id="model_version" name="model_version" value={config.model_version} onChange={handleModelChange}>
                {models.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="model_size">Tamanho da rede</label>
              <select id="model_size" name="model_size" value={config.model_size} onChange={updateConfig}>
                {selectedModel.sizes.map((size) => <option key={size} value={size}>{size.toUpperCase()}</option>)}
              </select>
            </div>
            <Field label="Épocas" name="epochs" value={config.epochs} onChange={updateConfig} min="1" max="10000" />
            <Field label="Batch size" name="batch" value={config.batch} onChange={updateConfig} min="1" max="1024" />
            <Field label="Workers" name="workers" value={config.workers} onChange={updateConfig} min="0" max="128" />
            <Field label="Tamanho da imagem" name="imgsz" value={config.imgsz} onChange={updateConfig} min="32" max="4096" />
            <Field label="Dispositivo (0, 0,1 ou cpu)" name="device" type="text" value={config.device} onChange={updateConfig} />
          </div>

          <details className="advanced-panel">
            <summary>Hiperparâmetros avançados</summary>
            <div className="form-grid advanced-grid">
              <Field label="Paciência" name="patience" value={config.patience} onChange={updateConfig} min="0" />
              <div className="form-group">
                <label htmlFor="optimizer">Otimizador</label>
                <select id="optimizer" name="optimizer" value={config.optimizer} onChange={updateConfig}>
                  {[
                    ['auto', 'Automático'], ['SGD', 'SGD'], ['Adam', 'Adam'],
                    ['AdamW', 'AdamW'], ['NAdam', 'NAdam'], ['RAdam', 'RAdam'],
                    ['RMSProp', 'RMSProp'],
                  ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {config.optimizer === 'auto' && <small className="field-hint">O Ultralytics definirá lr0 e momentum. Escolha um otimizador explícito para controlá-los.</small>}
              </div>
              <Field label="Taxa inicial (lr0)" name="lr0" value={config.lr0} onChange={updateConfig} min="0.000001" max="1" step="0.000001" inputMode="decimal" />
              <Field label="Fator final (lrf)" name="lrf" value={config.lrf} onChange={updateConfig} min="0" max="1" step="0.001" />
              <Field label="Momentum" name="momentum" value={config.momentum} onChange={updateConfig} min="0" max="1" step="0.001" />
              <Field label="Weight decay" name="weight_decay" value={config.weight_decay} onChange={updateConfig} min="0" max="1" step="0.0001" />
              <Field label="Warmup epochs" name="warmup_epochs" value={config.warmup_epochs} onChange={updateConfig} min="0" step="0.1" />
              <Field label="Fechar mosaic" name="close_mosaic" value={config.close_mosaic} onChange={updateConfig} min="0" />
              <Field label="Seed" name="seed" value={config.seed} onChange={updateConfig} min="0" />
              <label className="check-field"><input type="checkbox" name="cos_lr" checked={config.cos_lr} onChange={updateConfig} /> Cosine LR</label>
              <label className="check-field"><input type="checkbox" name="deterministic" checked={config.deterministic} onChange={updateConfig} /> Execução determinística</label>
            </div>
          </details>

          <div className="yaml-row">
            <div className="form-group">
              <label htmlFor="args-yaml">args.yaml customizado (opcional)</label>
              <input id="args-yaml" type="file" accept=".yaml,.yml" onChange={(event) => setArgsYaml(event.target.files[0])} />
            </div>
            <div className="yaml-help">
              <p>Os valores do YAML substituem os campos equivalentes. Caminhos e opções de saída são protegidos pela plataforma.</p>
              <a className="yaml-example-link" href="/args-example.yaml" download="args.yaml">
                Baixar YAML de exemplo
              </a>
            </div>
          </div>

          <div className="form-submit-row">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Criando treinamento…' : 'Adicionar à fila'}
            </button>
            {submitMessage && <p className="message" role="status">{submitMessage}</p>}
          </div>
        </form>
        {submittedDataset && <div className="dataset-summary" role="status">
          <strong>Classes validadas para o treinamento criado</strong>
          <DatasetClasses dataset={submittedDataset} />
        </div>}
      </section>

      <section className="card">
        <div className="section-title">
          <div className="section-copy">
            <span className="section-kicker">Execução</span>
            <h2>Jobs</h2>
            <p>Acompanhe o estado das execuções e acesse seus artefatos.</p>
          </div>
          <button className="btn-secondary" onClick={fetchJobs}>Atualizar</button>
        </div>
        {apiWarning && <p className="warning">{apiWarning}</p>}
        {jobs.length === 0 ? <p className="empty-state">Nenhum job disponível.</p> : (
          <div className="table-responsive">
            <table>
              <thead><tr><th>Job</th><th>Treinamento</th><th>Modelo</th><th>Configuração</th><th>Status</th><th>Início</th><th>Fim</th><th>Ações</th></tr></thead>
              <tbody>{jobs.map((job) => {
                const state = STATUS[job.status] || { label: job.status, className: '' };
                return (
                  <tr key={job.id}>
                    <td>#{job.id}</td>
                    <td><strong>{job.train_name}</strong><small>#{job.train_id} · {job.project_name}<br />{job.project_owner}</small></td>
                    <td>{job.model_version}{job.model_size}</td>
                    <td>{job.epochs} ep. · batch {job.batch}<small>{job.workers} workers{job.retry_count ? ` · tentativa ${job.retry_count + 1}` : ''}</small>
                      {job.dataset?.names ? <details className="dataset-details"><summary>{job.dataset.nc} classe(s)</summary><DatasetClasses dataset={job.dataset} /></details> : <small>Classes não registradas</small>}
                    </td>
                    <td><span className={`status ${state.className}`}>{state.label}</span>{job.error_message && <small className="error-text" title={job.error_message}>{job.error_message}</small>}</td>
                    <td>{formatDate(job.scheduled_at)}</td><td>{formatDate(job.finished_at)}</td>
                    <td><div className="action-buttons">
                      <button className="btn-secondary compact" onClick={() => setMonitoredJobId(job.id)}>Acompanhar</button>
                      {['queued', 'running'].includes(job.status) && <button className="btn-danger" onClick={() => controlJob(job.id, 'cancel')}>Abortar</button>}
                      {Boolean(job.config_ready) && ['succeeded', 'failed', 'cancelled'].includes(job.status) && <button className="btn-secondary compact" onClick={() => controlJob(job.id, 'restart')}>Reiniciar</button>}
                      <a className="btn-link" href={`${API_BASE}/jobs/${job.id}/logs`} target="_blank" rel="noreferrer">Log</a>
                      {job.status === 'succeeded' && <>
                        <button className="btn-link" onClick={() => downloadFile(`${API_BASE}/downloads/model?train_id=${job.train_id}`, `train_${job.train_id}_best.pt`)}>Modelo</button>
                        <button className="btn-link" onClick={() => downloadFile(`${API_BASE}/downloads/zip?train_id=${job.train_id}`, `train_${job.train_id}_output.zip`)}>ZIP</button>
                      </>}
                    </div></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </section>

      {monitoredJobId !== null && <JobMonitor key={monitoredJobId} jobId={monitoredJobId} apiBase={API_BASE} onClose={() => setMonitoredJobId(null)} />}

      <section className="card compact-card">
        <div className="section-title">
          <div className="section-copy">
            <span className="section-kicker">Artefatos</span>
            <h2>Downloads</h2>
            <p>Baixe o modelo ou o pacote de resultados da tentativa atual. Para histórico e arquivos legados, use Acompanhar.</p>
          </div>
        </div>
        <div className="download-by-id">
          <Field label="Train ID" name="download-id" value={downloadTrainId} onChange={(event) => setDownloadTrainId(event.target.value)} min="1" placeholder="Ex.: 42" />
          <button className="btn-primary" disabled={!downloadTrainId} onClick={() => downloadFile(`${API_BASE}/downloads/model?train_id=${downloadTrainId}`, `train_${downloadTrainId}_best.pt`)}>Baixar modelo</button>
          <button className="btn-secondary" disabled={!downloadTrainId} onClick={() => downloadFile(`${API_BASE}/downloads/zip?train_id=${downloadTrainId}`, `train_${downloadTrainId}_output.zip`)}>Baixar artefatos</button>
        </div>
      </section>

      <footer className="footer">CITI-USP · Transpetro · Plataforma de treinamento de modelos</footer>
    </main>
  );
}
