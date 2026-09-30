# Diretrizes de desenvolvimento — Assessor TJGO

1. **Não sobrescrever dados de usuários.** Prompts, históricos e qualquer dado cadastrado nunca são substituídos por padrões do sistema. Não existe seed automático; importações só acrescentam.
2. **Mudanças cirúrgicas.** Altere só o que o pedido exige; não refatore o que funciona.
3. **Regras verificáveis ficam no código** (`core.js`, com teste em `test-core.mjs`): limpeza do PDF, localização Mov./Arq./Pág., conferência de pedidos e de dados alfanuméricos.
4. **Prompts** ficam em `prompts.js`. Regras comuns (`REGRAS`, `LINGUAGEM`, `ESTRUTURA_TEXTO`, `REGRAS_CITACAO`) valem para a redação, a reformatação e o chat.
5. **Antes de publicar:** `node test-core.mjs` e `node --check app.js core.js prompts.js`.
6. **Nunca versionar autos, históricos, backups, `.env` ou chaves** (`data/`, `*.tar`, `*.zip` estão no `.gitignore`).
7. Mudanças que apagam dados ou reescrevem o histórico do git só com confirmação explícita do usuário.
