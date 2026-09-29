# Diretrizes de desenvolvimento — Assessor Judicial IA

1. **Não sobrescrever dados de usuários.** Teses, paradigmas, precedentes, equipe, históricos e configurações de gabinete nunca são substituídos por padrões do sistema. Não existe seed automático. Escritas no Firestore são sempre `merge`, e teses/paradigmas guardam a versão anterior em `historico/`.
2. **Mudanças cirúrgicas.** Altere só o que o pedido exige; não refatore módulos que funcionam.
3. **Regras da IA ficam no código, não só no prompt.** Fidelidade alfanumérica (`shared/fidelity.ts`), piso de extensão e pedidos não apreciados são verificados deterministicamente após a geração. Consectários são calculados por `shared/consectarios.ts`.
4. **Prompts versionados** em `server/ai/prompts/`. Mantenha o prefixo `REGRAS_INEGOCIAVEIS` estável (cache de prompt).
5. **Toda rota `/api/*` exige autenticação** e permissão explícita via `requirePermission`.
6. **Antes de enviar:** `npm run typecheck && npm test`.
7. **Nunca versionar autos, históricos ou backups** com dados processuais reais (`data/`, `*.tar.gz` estão no `.gitignore`).
