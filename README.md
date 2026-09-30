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
