# Assessor Judicial IA

Aplicação web para gabinetes de magistrados (Varas Cíveis, Juizados Especiais e Fazenda Pública): triagem de autos em PDF (Projudi, PJe, eproc), minutas em duas etapas, auditoria de conformidade (Lupa do Magistrado), Mesa de Audiência, repositório de precedentes vinculantes e governança de custos.

## Início rápido (desenvolvimento local)

```bash
npm install
cp .env.example .env
# no .env: AUTH_DISABLED=true, VITE_AUTH_DISABLED=true, DATA_BACKEND=memory
# e a chave do Claude em ANTHROPIC_API_KEYS (console.anthropic.com → API Keys)
npm run dev          # API em :8787 e interface em http://localhost:5173
npm test             # testes unitários
npm run typecheck
```

Com `AUTH_DISABLED=true` o usuário local é "super_admin" do gabinete `gabinete_dev`, e os dados ficam em memória (somem ao reiniciar). O servidor **se recusa a iniciar** em produção com essa flag ativa.

## Produção

1. Crie um projeto no Firebase com Authentication (Google) e Firestore.
2. Publique `firestore.rules` (`firebase deploy --only firestore:rules`).
3. Configure `DATA_BACKEND=firestore`, credenciais do Admin SDK (`GOOGLE_APPLICATION_CREDENTIALS` ou ADC no Cloud Run), `SUPER_ADMIN_EMAILS` e as variáveis `VITE_FIREBASE_*`.
4. `npm run build && npm start`, ou use o `Dockerfile`.
5. O Super Admin (e-mail em `SUPER_ADMIN_EMAILS`) cria os gabinetes em **Configurações → Super Admin**. Na tela **Equipe, lotações e avisos**, cadastra as lotações e convida o Juiz Titular pelo e-mail Google; o juiz convida assessores e estagiários. O acesso é liberado no primeiro login com o e-mail convidado.

## Estrutura

```
shared/                     código comum a navegador e servidor
  judicialTextCleaner.ts    motor de limpeza de PDFs forenses (Módulo 2)
  schemas.ts                contratos zod: dossiê fático, minuta, auditoria, audiência, precedentes
  fidelity.ts               verificador de fidelidade alfanumérica e piso de parágrafos
  consectarios.ts           cálculo determinístico da Lei 14.905/2024 (IPCA + taxa legal)
  roles.ts                  RBAC: estagiário < assessor < juiz titular < super admin
  pricing.ts                preços por modelo (custo em USD/R$)
server/
  index.ts, app.ts          bootstrap Express 5
  config/env.ts             variáveis de ambiente + travas de segurança de produção
  middleware/               requireAuth (Firebase ID Token), requirePermission, rateLimit, errorHandler
  ai/orchestrator.ts        cascata modelo → chave do Claude; retry 429/529; fallback
  ai/providers/anthropic.ts requisição ao Claude: cache de prompt, effort, busca na web, fallback de recusa
  ai/prompts/               Etapa 1, Etapa 2, auditor, audiência, chat, resumo, indexador
  pipelines/                minutePipeline (2 etapas), synopsis (Resumo Executivo), precedentsImport (chunking)
  services/                 llmJson (validação zod + nova tentativa), pdfService, precedentMatcher, usage
  repositories/             interface + implementação Firestore (merge, histórico) e em memória
  routes/                   minutas, lupa, audiencia, chat, pesquisa, pdf, precedentes, gabinete, admin, misc
web/src/
  pages/                    Esteira, Lupa (3 painéis), Audiência, Chat, Precedentes, Gabinete, Admin
  lib/                      firebase, auth, api, pdf (PDF.js + limpeza), caso (estado do processo)
  components/               ui, PdfUpload, MarkdownLite
tests/                      vitest: limpeza, consectários, fidelidade, orquestrador, RBAC, pipeline
docs/PLANO.md               plano de desenvolvimento por fases
```

## API

| Método | Rota | Permissão | Função |
|---|---|---|---|
| POST | `/api/minutas` | minuta:gerar | Esteira em 2 etapas → minuta, dossiê, verificações, Resumo Executivo |
| POST | `/api/lupa/auditar` | lupa:auditar | Matriz de Conformidade + minuta gabarito (diretriz, ponto de atenção; salva a auditoria) |
| GET | `/api/lupa/auditorias` | lupa:auditar | Processos auditados do gabinete |
| POST | `/api/audiencia/painel` | audiencia:usar | 5 pilares + perguntas |
| POST | `/api/audiencia/termo` | audiencia:usar | Termo de audiência / homologação |
| POST | `/api/chat` | minuta:refinar | Refino sobre o Resumo Executivo |
| POST | `/api/pdf/extrair` | minuta:gerar | Extração no servidor (pdf-parse) + limpeza |
| GET/POST | `/api/precedentes`, `/buscar`, `/importar` | precedentes:* | Repositório e importador de informativos |
| GET/PUT | `/api/gabinete/teses`, `/paradigmas`, `/prompts` | minuta:gerar (ler) · juiz (editar) | Teses, paradigmas e prompts por área |
| GET/PUT | `/api/gabinete/caderno` | minuta:gerar (ler) · juiz (editar) | Caderno de Teses em texto corrido (entra em todas as minutas) |
| GET/PUT | `/api/gabinete/documentos/:chave` | ler: todos · editar: juiz | Guia do PROJUDI (`guia_projudi`) e Google Agenda vinculado (`agenda_config`) |
| GET/PUT/DELETE | `/api/agenda` | minuta:gerar | Prazos, audiências e diligências do gabinete |
| GET | `/api/gabinete/unidades` | autenticado | Lotações liberadas ao usuário |
| GET/PUT | `/api/gabinete/unidades/todas`, `/unidades/:id` | gabinete:equipe_gerenciar | Cadastro de lotações/comarcas |
| GET/PATCH | `/api/gabinete/equipe`, `/equipe/:uid` | gabinete:equipe_gerenciar | Membros: papel, status, unidades liberadas |
| POST/DELETE | `/api/gabinete/convites` | gabinete:equipe_gerenciar | Convite por e-mail (ativado no 1º login) |
| PUT | `/api/gabinete/aviso` | gabinete:equipe_gerenciar | Aviso para a equipe |
| GET | `/api/comunicados` | autenticado | Comunicado geral + aviso do gabinete |
| GET/PUT/PATCH | `/api/admin/resumo`, `/gabinetes`, `/usuarios`, `/comunicado` | admin:tenants | Painel Super Admin |
| GET | `/api/admin/consumo`, `/api/admin/motor` | admin:custos | Tokens e custos; cascata de IA |
| POST | `/api/consectarios/calcular` | autenticado | Cálculo Lei 14.905/2024 |

## Motor de IA: Claude

Todo o processamento de IA roda no Claude (Anthropic). Não há mais Gemini nem OpenAI.

- **Chaves e modelos:** `ANTHROPIC_API_KEYS` (várias, separadas por vírgula) e `ANTHROPIC_MODELS` (cascata; padrão `claude-opus-5-5`).
- **Cascata:** em 529/5xx ou timeout, tenta de novo no mesmo modelo com espera exponencial; em 429, espera e troca de chave; com crédito esgotado ou chave inválida, troca de chave na hora; em 400 ou recusa, passa ao próximo modelo. Recusas de segurança também são refeitas pelo próprio servidor da Anthropic no modelo de apoio (`fallbacks: "default"`).
- **Profundidade por tarefa** (`output_config.effort`; o Claude não aceita `temperature`):

  | Tarefa | Esforço |
  |---|---|
  | Etapa 1 (Assessor Fático), Etapa 2 (Juiz Revisor), aprofundamento, Lupa, painel de audiência | high |
  | Resumo Executivo, chat, termo de audiência, indexação de precedentes, pesquisa ao vivo | medium |

- **Cache de prompt:** os autos (Etapa 1, Resumo Executivo, Lupa, audiência) e o Resumo Executivo (chat, cache de 1 h) vão como documento com marcador de cache. Retentativas e mensagens seguintes do chat leem o documento do cache a 10% do preço de entrada. A economia aparece no painel do Super Admin.
- **Pesquisa ao vivo** (`POST /api/pesquisa`): busca na web do Claude restrita a sites oficiais (STF, STJ, CJF/TNU, TJGO, CNJ; Planalto, Câmara e Senado para legislação), com as fontes citadas. Disponível em Súmulas e em Legislação & Juros.
- **Custos:** `shared/pricing.ts` traz os preços por modelo, cache (leitura 0,1×, escrita 1,25×) e busca na web (US$ 10 por 1.000).
- **Identidade visual:** tudo o que o Claude produz (minuta, gabarito, auditoria, termo, chat, pesquisa) aparece com o selo "Claude" e a barra lateral terracota.

## Versão que roda dentro do claude.ai

A pasta `claude-ai/` traz o código-fonte da mesma aplicação publicada como página do claude.ai, que usa o Claude da conta de quem a abre, sem servidor nem chave de API. Veja `claude-ai/README.md`.
