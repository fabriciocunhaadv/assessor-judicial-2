# Versão para o claude.ai

Código-fonte da página publicada em https://claude.ai/artifact/TgJ4w94SJLd5nJWZRVU7gd.

Roda inteiramente dentro do claude.ai: o Claude é chamado pela conta de quem usa a página (capacidade `sample`), teses, paradigmas e precedentes ficam no banco compartilhado do artifact (`db`), e o histórico de minutas fica privado por pessoa.

- `index.html` — marcação e estilos (o claude.ai acrescenta o esqueleto `<html><head><body>` ao publicar)
- `core.js` — lógica sem IA: limpeza de PDFs, fidelidade alfanumérica, fusão do dossiê, consectários (Lei 14.905/2024)
- `prompts.js` — instruções dos agentes (Assessor Fático, Juiz Revisor, Lupa, Audiência, Chat, indexador de precedentes)
- `app.js` — interface e integração com `sample`, `db`, `user` e `downloads`
- `test-core.mjs` — testes do núcleo: `node claude-ai/test-core.mjs`

Capacidades declaradas na publicação: `sample`, `db` (regras: `teses` e `paradigmas` só com nível admin), `user`, `downloads`.
