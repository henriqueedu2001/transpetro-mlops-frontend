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

Fase 2 aprovada em 14/11/2026. Gráficos, imagens e resultados finais permanecem na fase 3, ainda não executada. A API e o scheduler devem carregar o código correspondente para disponibilizar a telemetria.

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
job-guard submit --name mlops-frontend-tests --cwd "$PWD" -- node --test tests/monitor-state.test.mjs
```

A interface compilada foi inspecionada com API isolada e metadados de um treino sintético real com três classes, incluindo quatro épocas na GPU. Cinco testes verificam acumulação e limites de logs, reinício do fluxo, normalização de texto e duração indisponível. As alterações locais anteriores de proxy/ngrok são mantidas fora dos commits das fases 1 e 2.
