# Assessor TJGO

Página enxuta do claude.ai para o dia a dia do assessor: autos em PDF, minuta em duas etapas e chat com a minuta lado a lado, com prompts e histórico.

- Publicada em https://claude.ai/artifact/S7vtCQnFK874KNH63sCnA3
- IA: o Claude da conta de quem usa a página (capacidade `sample`), sem chave de API nem servidor.
- Dados: prompts no banco da página (`db`), compartilhados com quem tiver acesso; histórico (minuta, resumo e chat) privado por pessoa em `data/users/<id>`. Os autos nunca são gravados.
- `core.js` e `prompts.js` são os mesmos de `claude-ai/` (limpeza do PDF, conferência, prompts das 2 etapas e do chat). Testes: `node assessor-tjgo/test-core.mjs`.
