# travel-dashboard

App web/PWA de planejamento de viagem em grupo: cidades e datas, cartão por dia, custos, divisão de despesas com acerto, checklist, convites e edição em tempo real. Uso atual: o dono e pessoas próximas.

## Stack
React 18 + Vite 5, Firebase 10 (Auth com Google, e-mail/senha e telefone; Firestore; Hosting, projeto `plano-viagem-certa`), vite-plugin-pwa, xlsx sob demanda. Sem TypeScript e sem backend próprio.

## Rastro e decisões
- `docs/prumo/plano-unificado.md`: plano aprovado em 2026-11-10, com as issues #16 a #33. Leia antes de trabalhar.
- `docs/prumo/diagnostico-2026-11-07/`, `docs/prumo/avaliacao-2026-11-09/`, `docs/prumo/verificacao-2026-11-10.md`: avaliações e evidências.
- Branch `<tipo>/<issue>-<slug>`; um PR por issue, em rascunho, com `Closes #<n>`.
- Nunca commite dados pessoais reais: o repositório é público.
- IA de roteiro: skill `roteiro-viagem` e agente `pesquisador-destino` em `.claude/` (issue #41). Eles gravam só em `importacoes/`, que o git ignora; o app recebe o resultado por Mais → Planilha, com prévia.

## Comandos
| Tarefa | Comando |
|---|---|
| Instalar | `npm ci` |
| Testes de domínio | `npm test` |
| Testes de regras (emulador; exige Java 21) | `npm run test:rules` |
| Testes de jornada (emuladores + Chromium) | `npm run test:e2e` |
| Um arquivo de jornada só | `npx firebase emulators:exec --only firestore,auth "npx playwright test <arquivo>"` (o `npm run test:e2e -- <arquivo>` falha: os argumentos vão para o firebase) |
| Build | `npm run build` |
| Lint | `npm run lint` (sem configuração até a issue #21) |

O build de teste e o E2E exigem as variáveis `VITE_FIREBASE_*`. Sem `.env`, use valores fictícios, que só servem com os emuladores:

```
export VITE_FIREBASE_API_KEY=fake-api-key VITE_FIREBASE_AUTH_DOMAIN=localhost VITE_FIREBASE_PROJECT_ID=plano-viagem-certa VITE_FIREBASE_STORAGE_BUCKET=plano-viagem-certa.appspot.com VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000 VITE_FIREBASE_APP_ID=1:000000000000:web:0000
```

## Verificação por área (ao mexer em X, rode Y)
| Área | Verificação |
|---|---|
| `src/domain/` | `npm test`; `TZ=Europe/Lisbon npm test`; `TZ=Asia/Tokyo npm test` |
| `firestore.rules`, `src/lib/tripData.js` | `npm run test:rules`; scripts `docs/prumo/diagnostico-2026-11-07/verifica-regras*.mjs`; `npm run test:e2e` |
| `src/store/`, `src/components/`, `src/styles/` | `npm run lint` (depois da #21); `npm run test:e2e`; `npm run build`; E2E de duas contas (depois da #26) |
| `vite.config.js`, service worker, `firebase.json`, workflows | `npm run build`; prévia do PR no Firebase Hosting; workflow `Qualidade` verde no PR |
| `.claude/skills/roteiro-viagem/`, `.claude/agents/`, `src/domain/sheet.js`, importação por planilha | `node .claude/skills/roteiro-viagem/scripts/validar-importacao.mjs e2e/fixtures/importacao-exemplo.json` (saída 0); `npm test`; `npx firebase emulators:exec --only firestore,auth "npx playwright test e2e/importacao-json.spec.js"` (depois da #41) |

## Cuidados
- Regras do Firestore valem para o projeto inteiro, inclusive para a prévia do PR. Publicar só com autorização, junto com o front-end que depende delas.
- O emulador e o Playwright deixam `firestore-debug.log`, `ui-debug.log`, `test-results/` e `playwright-report/` na raiz; não commite.
