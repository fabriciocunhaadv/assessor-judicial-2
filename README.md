# Assessor TJGO

Mesa de trabalho do assessor de gabinete do TJGO, feita para rodar **dentro do claude.ai**: autos em PDF, minuta em duas etapas e chat com a minuta lado a lado, com prompts e histórico. A IA é o Claude da conta de quem usa a página: não há servidor, chave de API nem Firebase.

**Abrir o sistema:** https://claude.ai/artifact/S7vtCQnFK874KNH63sCnA3

> Este repositório guarda o código da página. Abrir `index.html` fora do claude.ai (por exemplo, num Codespace) mostra a tela, mas o Claude, o banco de dados e os downloads só funcionam dentro do claude.ai.

## O que a página faz

- **Processo:** anexa os autos em PDF (PROJUDI, PJe, eproc), lê o texto no navegador, remove assinaturas, carimbos e cabeçalhos repetidos e guarda a localização de cada página (Mov., Arq. e página do arquivo, lidas do carimbo do PROJUDI).
- **Etapa 1:** o Claude extrai cronologia, pedidos de cada parte, provas e pontos controvertidos. Autos grandes são lidos em blocos, 3 ao mesmo tempo, com progresso por bloco e retomada de onde parou.
- **Etapa 2:** o Claude redige a minuta (sentença, decisão, despacho ou embargos) em texto corrido, com citações "(Mov. X, Arq. Y, Pág. Z)", lei, súmulas e provas transcritas em bloco recuado e linguagem simples (sem latim nem arcaísmos).
- **Conferência:** pedidos não julgados, valores, datas e números que não aparecem nos autos.
- **Chat com a minuta:** resumo, reanálise de documentos (o Claude busca e lê as páginas dos autos), melhorias e ajustes que você aplica ou desfaz.
- **Reformatar:** aplica o padrão atual a uma minuta já gerada, sem reler os autos.
- **Exportação:** Word (.docx) e PDF no padrão de peça (Times 12, justificado, recuo de 2 cm, citações recuadas 4 cm em itálico).
- **Alerta de prompt injection:** ao anexar os autos, a página procura texto escondido em fonte branca no PDF e trechos que tentam dar ordens à IA ("se você é uma IA…", "ignore as instruções anteriores", caracteres invisíveis). Tarja vermelha com Mov./Arq./Pág. de cada trecho (ou verde, autos limpos); o Claude recebe a lista e é instruído a não obedecer e a registrar o fato no relatório.
- **TPU do PROJUDI:** toda minuta termina com a TPU (movimento) a cadastrar no PROJUDI, escolhida da tabela em `tpu.js` (aba Teses) e conferida pela página.
- **Mesa de Audiência** (aba Audiência, portada do sistema antigo): briefing probatório (fatos e provas de cada parte, o que falta provar, pontos controvertidos com o ônus, testemunhas, perguntas-chave e alertas); ata preliminar no layout do Termo de Audiência do gabinete (brasão, questões a verificar antes do ato, testemunhas, citações e intimações com Mov./Arq./Pág., conferência automática do que não aparece nos autos, edição e ajuste pelo Claude); inquirição com perguntas por testemunha e anotações; deliberações (acordo, revelia, contradita, indeferimento de pergunta, diligência) e sentença em mesa; Termo de Audiência final (esqueleto sem IA ou redigido pelo Claude), em Word e PDF. Cada pessoa vê só as suas audiências; os autos não são gravados. Autos grandes: entram o início, o fim e as páginas sobre audiência, testemunhas, citação e intimação.
- **Prompts:** instruções por matéria, com importação do JSON exportado pelo sistema antigo.
- **Teses:** banco de súmulas, temas, informativos, artigos e entendimentos do gabinete com o texto conferido. Anexe o PDF de um informativo ou lista de súmulas e o Claude extrai e lança cada item (texto literal, tribunal, assunto, área, página), sem duplicar o que já existe. O Claude transcreve daqui na minuta, no Reformatar e no chat; a Conferência aponta súmulas e temas citados fora do banco. Importação só acrescenta.
- **Histórico:** minutas e conversas, privadas por pessoa. Os autos nunca são gravados.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Tela e estilos |
| `app.js` | Lógica da página (leitura do PDF, etapas, chat, prompts, histórico, exportação) |
| `core.js` | Regras sem IA: limpeza do PDF, carimbos Mov./Arq./Pág., conferência, seleção do banco de teses, divisão em blocos, prazos |
| `prompts.js` | Instruções enviadas ao Claude |
| `docx.min.js`, `jspdf.min.js` | Bibliotecas de Word e PDF (docx 9.8.1 e jsPDF 2.5.2), carregadas só ao exportar |
| `test-core.mjs` | Testes de `core.js` (`node test-core.mjs`) |

## Publicar uma alteração

A página é publicada pelo Claude no claude.ai, sempre no mesmo endereço. Depois de alterar os arquivos, rode `node test-core.mjs` e peça ao Claude para publicar de novo.
