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

O backend valida detecção YOLO com splits por diretórios; manifestos `.txt` não são aceitos nesta fase. Logs dinâmicos, progresso e gráficos de resultados permanecem nas próximas fases. A documentação completa do contrato está em `docs/release-2.md` e `docs/endpoints.md` no repositório do backend.

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

Neste ambiente, use `job-guard` e o caminho do Node/npm instalado quando o guard não o encontrar no PATH. O build da fase 1 foi verificado com webpack:

```bash
job-guard submit --name mlops-frontend-build --cwd "$PWD" -- npm run build -- --webpack
```

A interface compilada foi inspecionada com API isolada e metadados de um treino sintético real com três classes. As alterações locais anteriores de proxy/ngrok não pertencem à fase 1 e são mantidas fora de seu commit.
