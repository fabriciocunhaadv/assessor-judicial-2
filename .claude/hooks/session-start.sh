#!/bin/bash
# Prepara o ambiente das sessões do Claude Code na web: instala as dependências
# para que typecheck, testes e build funcionem desde o início da sessão.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
npm install --no-audit --no-fund
