#!/bin/zsh
cd "${0:A:h}"
if ! command -v node >/dev/null 2>&1; then
  source "$HOME/.zshrc" 2>/dev/null
fi
node server.mjs --open
