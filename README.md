# Transpetro MLOps — frontend

Interface web da plataforma de treinamentos YOLO do projeto CITI-USP/Transpetro.

## Release 1

- Escolha da família YOLO e do tamanho da rede.
- Configuração de parâmetros básicos e avançados.
- Upload opcional de `args.yaml` validado pelo backend.
- Acompanhamento dos estados `queued`, `running`, `succeeded`, `failed` e `cancelled`.
- Ações de abortar e reiniciar jobs.
- Acesso ao log e download do modelo ou do pacote de artefatos.

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

```bash
npm run build
```
