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
- Etapa 1 (Assessor Fático, Claude com esforço alto) → dossiê JSON validado: cronologia, pedidos por litisconsorte, provas e fase processual.
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

## Fase 9 — Layout e configuração do gabinete ✅
Com base nas telas do sistema anterior:
- Barra superior com unidade judiciária ativa, prompt ativo, perfil e menu Configurações; menu lateral em "Ações principais" e "Repositório jurídico".
- Nova Análise: prompt por área, entrada por PDF ou texto, tipo de minuta (Auto-detectar, Sentença, Decisão, Despacho, Embargos), Modo Simplificado/Avançado, guia "Como iniciar" e painel Resultado & Análise (minuta, dossiê fático, conferência).
- Tipo de ato orienta a Etapa 2; o piso de 14 parágrafos vale só para sentença.
- Administração do Gabinete: convite por e-mail (ativado no primeiro login), papéis, unidades liberadas por membro, lotações/comarcas e aviso à equipe.
- Painel Super Admin: indicadores, gabinetes (criar/suspender), usuários globais (papel, gabinete, status), comunicado geral e consumo.
- Limite de requisições separado: 300/min para navegação e 20/min para chamadas de IA.
- Lupa do Magistrado com abas Bancada de Tripla Conferência, Nova auditoria (diretriz, nº do processo, assessor, minuta, autos PDF/texto, ponto de atenção do juiz) e Processos auditados (salvos no banco).
- Súmulas, Teses e Informativos: cartões com ementa, etiquetas, copiar ementa, filtros com contagem por tribunal, paginação e links das bases oficiais.
- Legislação & Juros: catálogo de regimes de correção e juros por microssistema (civil, consumo, Fazenda Pública/EC 113, previdenciário, tributário, JEC) + calculadora.
- Prompts: Selecionar/Em uso, backup e importação em JSON (importação só acrescenta).
- Caderno de Teses em texto corrido (com histórico), injetado em todas as minutas e auditorias; teses avulsas mantidas.
- Nova Análise: card de Minuta Paradigma com prévia e "Ativo no prompt", co-piloto "Controle total da decisão" e status do caderno e da consulta vinculante.
- Não há migração de dados: o cadastro é refeito no sistema novo.

## Fase 10 — Agenda, Guia do PROJUDI, Word e Manual ✅
- Exportação da minuta em Word (.docx) no padrão forense (`shared/minutaDocx.ts`), carregada sob demanda.
- Agenda do gabinete (prazos, audiências, diligências) com calendário mensal e Google Agenda opcional.
- Calculadora de prazos em dias úteis (`shared/prazos.ts`): CPC arts. 219, 220 e 224, feriados nacionais fixos e datas sem expediente informadas pelo usuário.
- Guia do PROJUDI do gabinete (documento com histórico; começa vazio, sem conteúdo pré-carregado).
- Manual de uso com registro de mudanças (`web/src/lib/changelog.ts` — acrescentar uma entrada a cada entrega).
- Testes de API por HTTP (`tests/api.test.ts`).

## Migração do legado ⏭
O sistema anterior está em `legado/` (fora do build). Funcionalidades dele que ainda não existem no sistema novo, a portar em PRs separados:
- Mutirão Previdenciário (extração de atas e vídeos de audiência) — `legado/src/components/MutiraoPrevidenciarioView.tsx`, rotas `/api/mutirao-*` em `legado/server.ts`
- Petições iniciais para advogados — `legado/server/petitionAdvogadoRoutes.ts`, `InitialPetitionPanel.tsx`
- Tour guiado interativo — `SystemTour.tsx` (o Manual já existe em /ajuda)
- Guia do PROJUDI, calendário de prazos do gabinete, tickets de suporte e avisos globais
- Gerenciador de prompts personalizados, histórico e comparação de versões de minutas, painel Fato × Prova, Raio-X do processo
- Sincronização semanal automática de informativos (a pesquisa ao vivo com o Claude já existe em Súmulas e em Legislação & Juros)
- Base de conhecimento do gabinete, "Mapear PDFs" e varredura automática para sugerir teses
- "Conheça o Assessor" e "Raio X da Lotação"
- Extensão de navegador para importar autos
