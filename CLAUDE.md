# Assessor Judicial IA — instruções para o Claude

Este repositório é construído pelo Claude sob a direção de Fabrício Cunha (assessor judicial, TJGO). As regras permanentes estão em @AGENTS.md; o roteiro de fases em @docs/PLANO.md.

## Comandos

```bash
npm install          # a sessão web já roda isso via .claude/hooks/session-start.sh
npm run typecheck    # tsc --noEmit — obrigatório antes de todo commit
npm test             # vitest (tests/*.test.ts)
npm run build        # vite (web) + esbuild (server)
npm run dev          # API :8787 + interface :5173 (use AUTH_DISABLED=true e VITE_AUTH_DISABLED=true no .env)
node claude-ai/test-core.mjs   # testes do núcleo da versão claude.ai
```

## Mapa do código

- `shared/` — código usado pelo navegador e pelo servidor. Regras determinísticas moram aqui (limpeza de PDF, fidelidade alfanumérica, consectários, RBAC, preços). Toda regra nova que possa ser verificada por código entra aqui, com teste.
- `server/` — Express 5. `ai/orchestrator.ts` (cascata provedor → modelo → chave), `ai/prompts/` (instruções dos agentes), `pipelines/` (esteira em 2 etapas, resumo executivo, importação de precedentes), `routes/`, `repositories/` (Firestore com merge + histórico; memória para dev).
- `web/src/` — React 19 + Tailwind 4. Páginas: Esteira, Lupa, Audiência, Chat, Precedentes, Gabinete, Admin.
- `claude-ai/` — a mesma aplicação como página do claude.ai (https://claude.ai/artifact/TgJ4w94SJLd5nJWZRVU7gd), sem servidor: usa `sample` para o Claude e `db` para dados do gabinete. `core.js` espelha a lógica de `shared/`: mudou uma, atualize a outra.

## Como trabalhar neste repositório

1. Uma tarefa por branch e por pull request. Commits pequenos, mensagem em português.
2. Antes de todo push: `npm run typecheck && npm test`. Mudou `claude-ai/core.js`: `node claude-ai/test-core.mjs`.
3. Funcionalidade nova ou alterada: atualize `README.md` (tabela da API e estrutura), marque a fase em `docs/PLANO.md` e acrescente uma entrada em `web/src/lib/changelog.ts` (aparece no Manual de uso).
4. Prompts: mantenha o prefixo `REGRAS_INEGOCIAVEIS` (`server/ai/prompts/base.ts`) byte a byte estável — ele é o prefixo de cache.
5. Modelos Claude: padrão `claude-opus-5-5`. Não envie `temperature` para modelos Claude atuais (400); controle profundidade com `output_config.effort`.
6. Nunca versione autos, históricos, backups, `.env` ou chaves. Se encontrar um segredo no código ou no histórico, pare e avise o usuário.
7. Mudanças que apagam dados ou reescrevem histórico do git só com confirmação explícita.

## Domínio (resumo)

Varas Cíveis, Juizados Especiais e Fazenda Pública (TJGO). Autos do Projudi/PJe/eproc. Toda minuta deve: julgar cada pedido de cada litisconsorte (sem extra/ultra/citra petita), citar Mov./Arq./Pág., não inventar dado alfanumérico, ter fundamentação de 14+ parágrafos densos em 7 blocos, e liquidar consectários pela Lei nº 14.905/2024 (IPCA + taxa legal Selic − IPCA, piso zero).
