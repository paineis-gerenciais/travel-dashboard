#!/bin/bash
# Roda dentro de `firebase emulators:exec`. Build fora do worktree versionado (outDir em qa37/dist).
set -e
Q=.
cd ./ctrl
export VITE_USE_EMULATORS=true VITE_FIREBASE_API_KEY=fake VITE_FIREBASE_AUTH_DOMAIN=fake.firebaseapp.com VITE_FIREBASE_PROJECT_ID=demo-fake VITE_FIREBASE_STORAGE_BUCKET=fake VITE_FIREBASE_MESSAGING_SENDER_ID=0 VITE_FIREBASE_APP_ID=fake
npx vite build --outDir $Q/dist-ctrl --emptyOutDir > $Q/build.log 2>&1
node ./node_modules/.bin/vite preview --outDir $Q/dist-ctrl --port 4173 --strictPort > $Q/preview.log 2>&1 &
PV=$!
trap "kill $PV 2>/dev/null" EXIT
for i in $(seq 1 30); do curl -sf http://localhost:4173/ >/dev/null && break; sleep 1; done
node $Q/qa37.mjs
