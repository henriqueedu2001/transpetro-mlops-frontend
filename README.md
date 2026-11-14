# Transpetro MLOps — frontend

Interface web da plataforma de treinamentos YOLO do projeto CITI-USP/Transpetro.

## Release 1

- Escolha da família YOLO e do tamanho da rede.
- Configuração de parâmetros básicos e avançados.
- Upload opcional de `args.yaml` validado pelo backend.
- Acompanhamento dos estados `queued`, `running`, `succeeded`, `failed` e `cancelled`.
- Ações de abortar e reiniciar jobs.
- Acesso ao log e download do modelo ou do pacote de artefatos.

## Release 2 — fase 1

- Campo “Classes do dataset” para upload separado de `data.yaml`/`data.yml` (até 64 KiB), além da opção de incluir o YAML no ZIP.
- Exemplo em `public/data-example.yaml`; `names` associa IDs consecutivos a partir de zero aos nomes reais das classes. `args.yaml` continua separado, para hiperparâmetros.
- Classes efetivas exibidas após a criação e nos detalhes de cada job, com contagens de imagens, objetos, labels vazios/ausentes e avisos.
- Jobs sem metadados aparecem como “Classes não registradas”. O backend recusa classes ausentes ou conflitantes, IDs inválidos e remapeamento `single_cls=true`.

O backend valida detecção YOLO com splits por diretórios; manifestos `.txt` não são aceitos nesta fase. A documentação completa do contrato está em `docs/release-2.md` e `docs/endpoints.md` no repositório do backend.

## Release 2 — fase 2

- “Acompanhar” abre o progresso e o log incremental da tentativa atual, com época, duração, estimativa de término e CPU/GPU observada no modelo.
- A estimativa depende de épocas completas; dados antigos ou ausentes são sinalizados. O painel não inventa progresso para jobs legados.
- Reinícios limpam o progresso exibido. O log visível mantém até 120 mil caracteres, com acesso ao arquivo completo da tentativa.
- Consultas sequenciais a cada dois segundos durante a execução e cinco segundos após o término; fechar ou trocar de job cancela a consulta anterior.

Fase 2 aprovada em 14/11/2026. API e scheduler precisam carregar o código correspondente para disponibilizar a telemetria.

## Release 2 — fase 3

- Resultados da tentativa atual, histórico e arquivos legados selecionados explicitamente em “Acompanhar”. Reinícios preservam os resultados anteriores.
- Avaliação final de `best.pt` separada da última época do CSV; valores ausentes não aparecem como zero.
- Gráficos de precisão, recall, mAP e perdas, tabela das últimas 25 épocas e galeria de imagens originais do YOLO.
- Downloads de CSV, modelo e ZIP da origem selecionada. ZIP inclui resultados/configuração/registros reconhecidos, sem dataset original; limite de 2 GiB. Pesos e pacote exigem tentativa encerrada.
- Resultados atualizam a cada cinco segundos durante o treino e dez após término. O seletor mostra as últimas 100 tentativas; a API mantém acesso às anteriores. Limites de CSV e catálogo estão na documentação do backend.

Em 14/11/2026, Henrique autorizou commit e push antes de sua revisão manual, que permanece pendente. As três fases estão implementadas; serviços ativos não foram reiniciados. O roteiro de validação está em `docs/release-2.md` no backend.

## Execução

```bash
npm ci
npm run dev
```

A aplicação usa `http://localhost:8000` como API. Para outro endereço:

```bash
NEXT_PUBLIC_API_BASE_URL=http://servidor:8000 npm run dev
```

## Verificação

Neste ambiente, use `job-guard` e o caminho do Node/npm instalado quando o guard não o encontrar no PATH. O build foi verificado com webpack:

```bash
job-guard submit --name mlops-frontend-build --cwd "$PWD" -- npm run build -- --webpack
job-guard submit --name mlops-frontend-tests --cwd "$PWD" -- node --test tests/monitor-state.test.mjs tests/results-state.test.mjs
```

A interface compilada foi inspecionada com API isolada e resultados de treino sintético real com três classes, incluindo GPU, cancelamento, reinício, histórico e legado. Dez testes cobrem acumulação/limites de logs, reinício, duração indisponível, seleção de origem, valores ausentes e geometria dos gráficos. O build webpack passou. As alterações locais anteriores de proxy/ngrok são mantidas fora dos commits das três fases.
