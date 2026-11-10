#!/bin/bash
# Uso (dentro de `firebase emulators:exec`): run.sh <worktree> <sufixo-do-dist> <script> [args do script]
# Serve $Q/dist<sufixo> (build feito fora do worktree) na porta 4173 e roda o script.
Q=<pasta-temporária-da-sessão>/qa3839
WT=<pasta-temporária-da-sessão>/$1
cd $WT
node ./node_modules/.bin/vite preview --outDir $Q/dist$2 --port 4173 --strictPort > $Q/preview$2.log 2>&1 &
PV=$!
trap "kill $PV 2>/dev/null" EXIT
for i in $(seq 1 30); do curl -sf http://localhost:4173/ >/dev/null && break; sleep 1; done
shift 2
node $Q/"$@"
