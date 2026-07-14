'use client';

import { useState, useEffect } from 'react';
import './styles.css'; // CSS importado

const API_BASE = 'http://localhost:8000';

export default function Home() {
  // --- Estado do Formulário ---
  const [trainName, setTrainName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectOwner, setProjectOwner] = useState('');
  const [epochs, setEpochs] = useState(100);
  const [batch, setBatch] = useState(16);
  const [workers, setWorkers] = useState(8);
  const [datasetFile, setDatasetFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  // --- Estado dos Jobs ---
  const [jobs, setJobs] = useState([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  // --- Estado do Download por ID ---
  const [downloadTrainId, setDownloadTrainId] = useState('');

  // --- Buscar Jobs ao montar ---
  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const res = await fetch(`${API_BASE}/jobs/`);
      if (!res.ok) throw new Error('Erro ao buscar jobs');
      const data = await res.json();
      setJobs(data);
    } catch (error) {
      console.error(error);
      alert('Falha ao carregar a lista de jobs.');
    } finally {
      setIsLoadingJobs(false);
    }
  };

  // --- Envio do Treinamento ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!datasetFile) {
      alert('Por favor, selecione o arquivo do dataset (.zip).');
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage('Enviando...');

    const formData = new FormData();
    formData.append('train_name', trainName);
    formData.append('project_name', projectName);
    formData.append('project_owner', projectOwner);
    formData.append('epochs', String(epochs));
    formData.append('batch', String(batch));
    formData.append('workers', String(workers));
    formData.append('file', datasetFile);

    try {
      const res = await fetch(`${API_BASE}/trainings/`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Erro no servidor');
      }

      const data = await res.json();
      setSubmitMessage(`Treinamento criado com sucesso! Train ID: ${data.train_id}`);
      setDownloadTrainId(data.train_id);
      // Limpa o campo de arquivo
      setDatasetFile(null);
      document.getElementById('fileInput').value = '';
      // Atualiza a lista de jobs
      await fetchJobs();
    } catch (error) {
      console.error(error);
      setSubmitMessage(`Erro: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Funções de Download ---
  const downloadFile = (url, filename) => {
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Download falhou');
        return res.blob();
      })
      .then((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      })
      .catch((err) => {
        console.error(err);
        alert('Erro ao baixar o arquivo. Verifique se o treinamento foi finalizado.');
      });
  };

  const downloadZip = (trainId) => {
    const url = `${API_BASE}/trainings/${trainId}/download/zip`;
    downloadFile(url, `train_${trainId}_output.zip`);
  };

  const downloadModel = (trainId) => {
    const url = `${API_BASE}/trainings/${trainId}/download/model`;
    downloadFile(url, `train_${trainId}_best.pt`);
  };

  const downloadMetrics = async (trainId) => {
    try {
      const res = await fetch(`${API_BASE}/trainings/${trainId}/metrics`);
      if (!res.ok) throw new Error('Erro ao buscar métricas');
      const metrics = await res.json();
      const blob = new Blob([JSON.stringify(metrics, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `train_${trainId}_metrics.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error(err);
      alert('Erro ao baixar as métricas.');
    }
  };

  const handleDownloadById = (e) => {
    e.preventDefault();
    if (!downloadTrainId) {
      alert('Por favor, informe um Train ID.');
      return;
    }
    // Abre um submenu ou apenas baixa todos? Vamos baixar o ZIP por padrão, mas disponibilizamos botões.
    // Na área de download, já temos os botões específicos, então apenas focamos nela.
    // Vamos apenas exibir os botões para o ID digitado.
    // Para simplificar, vou apenas chamar a função que baixa o zip, mas vou criar um estado para exibir ações.
    // Melhor: vou apenas rolar até a área de download e preencher o campo.
    alert(`Use os botões abaixo para o Train ID ${downloadTrainId}.`);
  };

  // --- Renderização da Tabela de Jobs ---
  const renderJobStatus = (status) => {
    const colors = {
      created: '#ffc107',
      processing: '#17a2b8',
      finished: '#28a745',
      cancelled: '#dc3545',
    };
    return <span style={{ backgroundColor: colors[status] || '#6c757d', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>{status}</span>;
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Transpetro MLOps</h1>
        <p>Dashboard de Treinamento YOLO</p>
      </header>

      {/* ==================== 1. SOLICITAÇÃO ==================== */}
      <section className="card">
        <h2>Solicitar Novo Treinamento</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Nome do Treinamento *</label>
              <input type="text" value={trainName} onChange={(e) => setTrainName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Nome do Projeto *</label>
              <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Proprietário (Usuário) *</label>
              <input type="text" value={projectOwner} onChange={(e) => setProjectOwner(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Dataset (.zip) *</label>
              <input id="fileInput" type="file" accept=".zip" onChange={(e) => setDatasetFile(e.target.files[0])} required />
            </div>
          </div>
          <div className="form-grid params-grid">
            <div className="form-group">
              <label>Épocas (Epochs)</label>
              <input type="number" value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} min="1" />
            </div>
            <div className="form-group">
              <label>Batch Size</label>
              <input type="number" value={batch} onChange={(e) => setBatch(Number(e.target.value))} min="1" />
            </div>
            <div className="form-group">
              <label>Workers</label>
              <input type="number" value={workers} onChange={(e) => setWorkers(Number(e.target.value))} min="0" />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando...' : 'Iniciar Treinamento'}
          </button>
          {submitMessage && <p className="message">{submitMessage}</p>}
        </form>
      </section>

      {/* ==================== 2. VISUALIZAÇÃO DOS JOBS ==================== */}
      <section className="card">
        <div className="section-header">
          <h2>Status dos Jobs</h2>
          <button className="btn-secondary" onClick={fetchJobs} disabled={isLoadingJobs}>
            {isLoadingJobs ? '🔄 Atualizando...' : '🔄 Atualizar'}
          </button>
        </div>
        {jobs.length === 0 ? (
          <p>Nenhum job encontrado. Inicie um treinamento!</p>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Train ID</th>
                  <th>Nome</th>
                  <th>Projeto</th>
                  <th>Proprietário</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  <th>Agendado</th>
                  <th>Finalizado</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.id}</td>
                    <td><strong>{job.train_id}</strong></td>
                    <td>{job.train_name}</td>
                    <td>{job.project_name}</td>
                    <td>{job.project_owner}</td>
                    <td>{renderJobStatus(job.status)}</td>
                    <td>{new Date(job.created_at).toLocaleString()}</td>
                    <td>{job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : '-'}</td>
                    <td>{job.finished_at ? new Date(job.finished_at).toLocaleString() : '-'}</td>
                    <td>
                      {job.status === 'finished' && (
                        <div className="action-buttons">
                          <button className="btn-download" onClick={() => downloadZip(job.train_id)} title="Baixar ZIP"></button>
                          <button className="btn-download" onClick={() => downloadModel(job.train_id)} title="Baixar Modelo (.pt)"></button>
                          <button className="btn-download" onClick={() => downloadMetrics(job.train_id)} title="Baixar Métricas"></button>
                        </div>
                      )}
                      {job.status !== 'finished' && <span className="no-action">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ==================== 3. DOWNLOAD ==================== */}
      <section className="card">
        <h2>Download por Train ID</h2>
        <p>Informe o Train ID para baixar os artefatos específicos (disponível apenas para jobs finalizados).</p>
        <div className="download-by-id">
          <input
            type="number"
            placeholder="Digite o Train ID..."
            value={downloadTrainId}
            onChange={(e) => setDownloadTrainId(e.target.value)}
          />
          <div className="download-actions">
            <button className="btn-primary" onClick={() => downloadZip(downloadTrainId)}>Baixar ZIP</button>
            <button className="btn-primary" onClick={() => downloadModel(downloadTrainId)}>Baixar Modelo (.pt)</button>
            <button className="btn-primary" onClick={() => downloadMetrics(downloadTrainId)}>Baixar Métricas</button>
          </div>
        </div>
        <p className="hint">* Certifique-se de que o Train ID existe e o job foi finalizado.</p>
      </section>

      <footer className="footer">
        <p>Transpetro MLOps - Solução interna de treinamento YOLO</p>
      </footer>
    </div>
  );
}

// export default function Home() {
//   return (
//     <div>
//       <main>
//         <h1>TRANSPETRO ML OPS TOOL</h1>
//       </main>
//     </div>
//   );
// }
