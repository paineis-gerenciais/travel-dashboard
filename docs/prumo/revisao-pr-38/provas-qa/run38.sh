#!/bin/bash
# Roda dentro de `firebase emulators:exec`. Build do wt38 já feito em qa3839/dist${DISTSFX:-38}.
Q=<pasta-temporária-da-sessão>/qa3839
WT=<raiz-do-repositório>
cd $WT
node ./node_modules/.bin/vite preview --outDir $Q/dist${DISTSFX:-38} --port 4173 --strictPort > $Q/preview38.log 2>&1 &
PV=$!
trap "kill $PV 2>/dev/null" EXIT
for i in $(seq 1 30); do curl -sf http://localhost:4173/ >/dev/null && break; sleep 1; done
node $Q/${1:-qa38-registro.mjs}
