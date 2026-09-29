# Sistema anterior (legado)

Código do Assessor Judicial original (Gemini / AI Studio), preservado como referência para a migração de funcionalidades para o sistema novo na raiz do repositório.

- Não faz parte do build, dos testes nem do CI.
- Foram removidos daqui os backups (`*.tar`, `*.tar.gz`), o `.zip` e `data/history.json`, que continham dados processuais reais e/ou chaves de API. Eles continuam no histórico do git — as chaves do Google citadas pelo GitHub precisam ser revogadas no Google Cloud Console.
- Funcionalidades daqui que ainda não existem no sistema novo (ex.: Mutirão Previdenciário, Manual do Sistema, Tour Guiado, Guia do PROJUDI, calendário de prazos, tickets de suporte) estão listadas em `docs/PLANO.md`.
