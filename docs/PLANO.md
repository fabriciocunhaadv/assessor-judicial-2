# Plano de desenvolvimento

Legenda: ✅ entregue nesta base · ⏭ próxima fase

## Fase 0 — Fundação ✅
- Monorepo único (React 19 + Vite + Tailwind 4 / Express 5 / Firebase), TypeScript estrito.
- `shared/` com código usado por cliente e servidor.
- CI (typecheck, testes, build) e Dockerfile.

## Fase 1 — Segurança e RBAC ✅
- Toda a API exige ID Token do Firebase; o papel do usuário é lido no servidor, nunca vem do cliente.
- 4 papéis cumulativos; papéis legados normalizados em leitura.
- Regras do Firestore negam escrita direta do navegador (sem escalada de privilégio).
- Limite de requisições por usuário; travas que impedem subir em produção com auth desligada ou dados em memória.
- ⏭ Convites por e-mail (hoje o cadastro de membro usa o UID do Firebase).
- ⏭ Rate limit distribuído (Redis) para múltiplas instâncias.

## Fase 2 — Ingestão de PDFs (Módulo 2) ✅
- Limpeza: assinaturas, ICP-Brasil, hashes, URLs de validação, numeração de folhas, tarjas laterais, cabeçalhos e rodapés repetidos.
- Fusão de orações na virada de página com marcador `⟦Pág. N⟧` para a tríplice localização.
- Leitura página a página com progresso (cliente) e pdf-parse (servidor).
- ⏭ OCR para PDFs digitalizados sem camada de texto (hoje o sistema detecta e avisa).
- ⏭ Detecção automática de Mov./Arq. pelos marcadores de cada tribunal.

## Fase 3 — Esteira em duas etapas (Módulo 1) ✅
- Etapa 1 (Assessor Fático, temperatura 0) → dossiê JSON validado: cronologia, pedidos por litisconsorte, provas e fase processual.
- Autos acima de 900 mil caracteres: a Etapa 1 roda por blocos e os dossiês são fundidos sem juntar litisconsortes.
- Etapa 2 (Juiz Revisor): 7 blocos, Minuta Paradigma, Caderno de Teses e precedentes relevantes selecionados por busca contextual.
- Verificações após a geração: piso de 14 parágrafos densos (com uma rodada automática de aprofundamento), pedidos não apreciados e dados sem lastro nos autos.
- ⏭ Streaming de progresso por etapa (SSE) na interface.
- ⏭ Exportação em .docx com o papel timbrado do gabinete.

## Fase 4 — Lupa do Magistrado (Módulo 3) ✅
- 3 painéis: PDF com busca por página, editor da minuta, diagnóstico com minuta gabarito.
- Matriz de Conformidade: extra/ultra/citra petita, alucinações (automática + IA), precedentes e consectários.
- ⏭ Comparação visual (diff) entre a minuta do assessor e o gabarito.

## Fase 5 — Precedentes (Módulo 4) ✅
- Importador de PDFs em blocos paralelos (concorrência 4), deduplicação por hash e relatório de blocos com falha.
- Filtro por tribunal e busca contextual.
- ⏭ Reprocessar só os blocos que falharam.
- ⏭ Busca semântica com embeddings.

## Fase 6 — Audiência e Chat (Módulos 5 e 6) ✅
- 5 pilares, perguntas sugeridas e redator de termo e de homologação.
- Chat sobre o Resumo Executivo (gerado uma vez por processo) e as últimas 8 trocas.
- ⏭ Gravação e transcrição da audiência.

## Fase 7 — Governança e custos (Módulo 7) ✅
- Paradigmas com "⚡ Injetar no Prompt", teses com histórico de versões e exclusão só lógica.
- Painel Super Admin com consumo de tokens e custo em USD/R$, por funcionalidade, modelo e gabinete, além da cascata ativa.
- ⏭ Alertas de orçamento por gabinete.
- ⏭ Painel multi-tenant (criar ou suspender gabinetes).

## Fase 8 — Qualidade contínua ⏭
- Conjunto de avaliação com autos anonimizados, medindo adstrição, fidelidade e extensão por modelo.
- Testes de integração das rotas com provedores simulados; testes das regras do Firestore no emulador.
