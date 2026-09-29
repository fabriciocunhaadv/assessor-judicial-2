# Assessor Judicial IA

Aplicação web para gabinetes de magistrados (Varas Cíveis, Juizados Especiais e Fazenda Pública): triagem de autos em PDF (Projudi, PJe, eproc), minutas em duas etapas, auditoria de conformidade (Lupa do Magistrado), Mesa de Audiência, repositório de precedentes vinculantes e governança de custos.

## Início rápido (desenvolvimento local)

```bash
npm install
cp .env.example .env
# no .env: AUTH_DISABLED=true, VITE_AUTH_DISABLED=true, DATA_BACKEND=memory
# e pelo menos uma chave de IA (GEMINI_API_KEYS ou ANTHROPIC_API_KEYS)
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
5. O primeiro Super Admin cadastra o Juiz Titular de cada gabinete na tela **Gabinete → Equipe**; o Juiz cadastra assessores e estagiários.

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
  ai/orchestrator.ts        cascata provedor → modelo → chave; retry 429/503; fallback
  ai/providers/             gemini.ts, anthropic.ts, openai.ts
  ai/prompts/               Etapa 1, Etapa 2, auditor, audiência, chat, resumo, indexador
  pipelines/                minutePipeline (2 etapas), synopsis (Resumo Executivo), precedentsImport (chunking)
  services/                 llmJson (validação zod + nova tentativa), pdfService, precedentMatcher, usage
  repositories/             interface + implementação Firestore (merge, histórico) e em memória
  routes/                   minutas, lupa, audiencia, chat, pdf, precedentes, gabinete, admin, misc
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
| POST | `/api/lupa/auditar` | lupa:auditar | Matriz de Conformidade + minuta gabarito |
| POST | `/api/audiencia/painel` | audiencia:usar | 5 pilares + perguntas |
| POST | `/api/audiencia/termo` | audiencia:usar | Termo de audiência / homologação |
| POST | `/api/chat` | minuta:refinar | Refino sobre o Resumo Executivo |
| POST | `/api/pdf/extrair` | minuta:gerar | Extração no servidor (pdf-parse) + limpeza |
| GET/POST | `/api/precedentes`, `/buscar`, `/importar` | precedentes:* | Repositório e importador de informativos |
| GET/PUT | `/api/gabinete/teses`, `/paradigmas`, `/equipe` | gabinete:* | Governança do gabinete |
| GET | `/api/admin/consumo`, `/api/admin/motor` | admin:custos | Tokens e custos; cascata de IA |
| POST | `/api/consectarios/calcular` | autenticado | Cálculo Lei 14.905/2024 |

## Motor de IA

- Ordem de provedores em `AI_PROVIDER_ORDER`; modelos por provedor em `*_MODELS`; várias chaves por provedor em `*_API_KEYS` (separadas por vírgula).
- Em 503, sobrecarga ou timeout, o sistema tenta de novo no mesmo modelo com espera exponencial e depois passa ao próximo modelo. Em 429 por minuto, espera e depois troca de chave. Com a cota esgotada ou a chave inválida, troca de chave na hora. Em 400, passa ao próximo modelo. Em recusa de segurança, passa ao próximo provedor.
- Na Etapa 1, o Gemini recebe `temperature: 0`. O Claude (`claude-opus-5-5`) não aceita parâmetros de amostragem: a profundidade é controlada por `ANTHROPIC_EFFORT`, e o fallback de recusa do próprio servidor da Anthropic (`fallbacks: "default"`) fica ativado.
- Os preços do Gemini e da OpenAI não vêm preenchidos (dependem do contrato). Cadastre-os em `shared/pricing.ts`; enquanto isso, o painel mostra esses modelos como "sem preço".

## Versão que roda dentro do claude.ai

A pasta `claude-ai/` traz o código-fonte da mesma aplicação publicada como página do claude.ai, que usa o Claude da conta de quem a abre, sem servidor nem chave de API. Veja `claude-ai/README.md`.
