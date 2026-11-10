# Parecer de qualidade e estratégia de testes: travel-dashboard

- **Data:** 2026-11-09 · **Branch:** main (`b5a3ce2`) · **Demanda:** análise consultiva, sem issue · **Nível:** N2
- **Método:** análise estática (leitura de código, `grep`, `wc`, `git log`). Nenhum teste, build ou emulador foi executado nesta sessão.
- **Rótulos:** `[FATO]` = verificado no código (caminho:linha). `[HIPÓTESE]` = inferência que precisa de execução. `[RECOMENDAÇÃO]` = proposta.

## Parecer: REPROVADO (como gate de release)

O produto tem uma boa base de testes de lógica, mas o pipeline não impede publicar com testes vermelhos e a camada de interface não tem teste nenhum. Pela regra da constituição, achado Alto em aberto significa REPROVADO. Isso não prova defeito funcional hoje; prova que o processo não o detectaria.

| Severidade | Qtde | Achados |
|---|---|---|
| Bloqueador | 0 | |
| Alto (confirmados por leitura) | 2 | QA-01, QA-02 |
| Alto se confirmados (hipóteses) | 3 | QA-03, QA-04, QA-05 |
| Médio | 7 | QA-06 a QA-12 |
| Baixo | 5 | QA-13 a QA-17 |

## 1. Mapa de cobertura por camada

Contagem [FATO] (`grep -c`): 111 testes de domínio, 17 de regras, 9 cenários E2E (x2 projetos = 18 execuções). Não há relatório de cobertura (nem `@vitest/coverage-v8` instalado), então "coberto" abaixo significa "função citada por nome no teste". Cobertura indireta é possível e não foi medida.

### 1.1 Domínio (`src/domain/__tests__/domain.test.js`, 1061 linhas)

| Módulo | Situação |
|---|---|
| `split.js` | Bem coberto: rateio, normalização, hospedagem, acerto, confirmação, migração de ids, caso 3 pessoas (domain.test.js:565-700, 761-781, 814-853). Só `itemCost` (split.js:34) sem teste direto. |
| `sheet.js` | Bem coberto: leitura de célula, validação, mesclagem, ida e volta (domain.test.js:922-1061). Sem teste: `resumoValidacao` (sheet.js:353). |
| `links.js` | Coberto (domain.test.js:855-904). `linkDomain` e `hasLink` só indiretos. |
| `dates.js` | Parcial. Cobertos: `daysBetween`, `addDaysISO`, `datesFromCities`, `allPlanningDates`, `tripBounds`, `nearestDayIndex`, `validateCityCoverage`. **Sem teste:** `itemTimeMinutes` (ordem da linha do tempo do dia, dates.js:240), `calendarDays`, `todayISO` (dates.js:293), `cityRecordForDate`, `foodOrder`. |
| `costs.js` | Bem coberto no que importa (totais, status, invariante). Sem teste direto: `dayLodging/Food/Attractions/Transport/Other`, `palette`. |
| `generate.js` | Coberto (`ensureGenerated`, cascata, clone). `sortCitiesByDate` (generate.js:14) sem teste. |
| `format.js` | `num` bem coberto desde a correção (domain.test.js:783-811). `money` e `fmtDate` só com 2 casos cada; arredondamento de centavos não testado. |
| `transport.js` | Fraco: 4 de 14 funções citadas. Os getters com campos legados (`getTransportOrigin/Dest/Mode/Duration/DurationMinutes`) não têm teste. |
| `lib/` | `reminders.pendingReminders` e `quotes` testados. Sem teste: `invite.js` (URLs de WhatsApp, e-mail), `phoneAuth.js` (`isValidE164`, `normalizePhone`), `sheetFile.js` (leitura de arquivo, `lerTextoColado`), `tripData.js` (312 linhas de acesso ao Firestore). |

### 1.2 Regras do Firestore (`src/rules/__tests__/rules.test.js`, 17 testes)

Escopo desta seção: só cobertura de teste. A segurança das regras é do devsecops-engineer.

| Trecho de `firestore.rules` | Teste |
|---|---|
| `users` (25-27) | Sim (rules.test.js:120-126) |
| `feedback` (33-36) | Sim (179-200) |
| `trips` create (40-42) | Não direto (só semeado sem regras); exercitado indiretamente pelo E2E |
| `trips` read (44) | Sim: dono e estranho (64-76) |
| `trips` delete (46) | Parcial: testa convidado **não membro**; falta membro não dono |
| update **A**, membro edita conteúdo (50-52) | Só com o dono; falta membro convidado. Falta: membro alterando `memberUids` ou `ownerId` |
| update **B**, dono revoga membro (55-56) | **Não** |
| update **C**, auto-inclusão por convite (60-65) | 3 testes (78-99): com convite, sem convite, uid extra. **Faltam:** convidado removendo o dono ou outro membro (linha 63), troca de `ownerId` (64), convite de outra viagem, e-mail em caixa diferente, convite já aceito/revogado, e o caminho real do cliente (`arrayUnion`, tripData.js:177) em vez de array literal |
| `versions`, `presence`, `members` (69-84) | **Não** |
| `comments` (88-91) | Sim (128-159); falta ex-membro apagar o próprio comentário (linha 90 não exige ser membro) |
| `activity` (95-97) | Sim (161-177) |
| `convites` create (102) | Não direto |
| `convites` read (104-107) | Sim (108-118) |
| `convites` update/delete (109-112) | **Não** (aceitar, recusar, cancelar) |
| Negação padrão `{document=**}` (116) | **Não** |

`[FATO]` O E2E sobe o emulador com `firebase.json` e portanto exercita as regras para o dono (create, read, update A), mas nunca com um segundo usuário.

### 1.3 Componentes

`[FATO]` **Não existe nenhum teste de componente.** Arquivos de teste do repositório: só os três já citados (`find` por `*.test.*`, `*.spec.*`, `__tests__`). `jsdom` está em `devDependencies` e `vite.config.js:59-60` define `environment: 'jsdom'`, mas `@testing-library/*` não está instalado e `npm test` roda só `vitest run src/domain` (package.json:11). São ~10,4 mil linhas, das quais a maior parte é interface e `TripProvider.jsx` (307 linhas, sem teste direto).

### 1.4 E2E (`e2e/fluxos-criticos.spec.js`, 9 cenários)

| Jornada | Situação |
|---|---|
| Login | **Contornado** pelo gancho `__E2E_LOGIN__` (spec:17-33). Google e celular nunca são exercitados. |
| Criar viagem | Sim, mas o teste não confere que ela aparece na lista (spec:64-67). |
| Adicionar cidade e ver os dias | Sim (69-85) |
| Item no dia | Sim (87-96) |
| Custos | Sim (98-117) |
| Divisão de despesas | Só estrutura do diálogo e rótulos (119-141). Nenhum valor numérico conferido. |
| Anexo por link | Sim (143-164) |
| Frase da viagem | Sim (166-180) |
| Planilha (colar, prévia, aplicar) | Sim (182-235). Sem upload/download de arquivo `.xlsx`. |
| Convite | **Falso positivo:** ver QA-06. Nenhum convite é criado ou aceito. |
| Ausentes | Dois usuários, concorrência, offline, impressão, importação/exportação JSON (Mais.jsx:63-66), revogação de acesso, versões salvas, comentários, mapa/rota, swipe, dia "em curso" e "passada" |

## 2. Qualidade dos testes existentes

**Pontos fortes** [FATO]: dados fictícios (`exemplo.com`, Ana/Bruno); fixtures criadas por função (`base()`), sem ordem entre testes de domínio; datas fixas, sem `Date.now()` nem `Math.random()` (grep em domain.test.js); testes de regressão nomeados pelo bug (num, rateio 3 pessoas); E2E com `getByRole`, escopo `main` por causa do PrintView; sem `waitForTimeout` e sem `.nth(` (grep em e2e/).

**Fragilidades:**
- `[FATO]` `.first()` em 7 pontos (spec:45, 74, 116, 126, 135, 139, 240). `getByRole('button', {name:'Dias'})` e `'Mais'` usam correspondência por substring (padrão do Playwright), então qualquer botão novo com "dias" ou "mais" no nome gera erro de modo estrito ou clique errado.
- `[FATO]` Dados e asserções dependem de textos de interface (`'R$ 200,00'`, `/Pagou .* · deve /`, `/1 a criar/`): quebram em mudança de redação e não detectam valor errado quando o formato persiste.
- `[FATO]` Todos os `.fill()` (spec:50-53, 151-153, 198) definem o valor de uma vez. Não reproduzem digitação tecla a tecla.
- `[FATO]` Descrição desatualizada: domain.test.js:737 cita "transporte de volta para Casa", removido (DEPLOY-AJUSTES-POS-FASE1.md, seção 2). README diz "22 testes"; DEPLOY-*.md citam 84/74/37 testes e "12 E2E" (hoje 111 e 18).
- `[FATO]` Mesma conta de usuário por projeto (spec:25), uma por execução; viagens se acumulam no emulador (nomes únicos evitam colisão). Aceitável; falha se o emulador não for reiniciado e um teste passar a listar viagens.
- `[HIPÓTESE]` Flakiness provável em futuro teste de swipe: `Dias.jsx:176,180` usa `setTimeout` de 160 ms e transição de 220 ms (Dias.jsx:93-106). Playwright não tem gesto de arrastar por toque; seria preciso `dispatchEvent` de `touchstart/move/end` ou CDP e esperar com `expect.poll`, nunca com tempo fixo.
- `[FATO]` `retries: 1` no CI com `trace: 'on-first-retry'` (playwright.config.js:8,12): teste intermitente passa na segunda tentativa e ninguém é avisado. `[RECOMENDAÇÃO]` Publicar a contagem de testes "flaky" no resumo do job.

## 3. Regressões do histórico e o teste que as pegaria

| Defeito (fonte) | Existe teste hoje? | Teste que teria pego |
|---|---|---|
| `num()` destruindo floats, percentuais 33.333.333% (DEPLOY-CORRECAO-NUMEROS.md) | Domínio sim (domain.test.js:783-853), **tela não** | Unitário de `num(100/3)` (já existe) **mais** E2E com 3 participantes conferindo "33,33%" e "R$ 583,33" no diálogo. O próprio spec:3-7 admite que o padrão é "domínio certo, tela lendo errado". |
| Foco roubado a cada tecla (DEPLOY-AJUSTES-EDICAO-ACERTO.md, seção 1) | **Não** | Teste de componente de `Sheet` (ui.jsx:60-135) com `user-event`: digitar "abc" num input e conferir que `document.activeElement` não muda, com `onClose` inline. Alternativa E2E: `pressSequentially` em vez de `fill`. |
| Salto de rolagem no celular (DEPLOY-AJUSTES-POS-FASE1.md, seção 1) | **Não** | E2E no projeto `mobile`: abrir folha longa, rolar o painel, disparar `visualViewport` `resize`/`scroll` e conferir que `scrollTop` não volta a 0. jsdom não tem `visualViewport`. O teclado real continua exigindo teste manual. |
| Dia inicial errado (DEPLOY-AJUSTES-POS-FASE1.md, seção 1) | Só a função pura `nearestDayIndex` (domain.test.js:506-523), que **já passava** quando o bug existia | E2E com `page.clock` (Playwright >= 1.45) ou datas relativas a hoje: viagem em curso abre no dia de hoje, passada no último, futura no primeiro. Hoje só "futura" é exercitada (datas de 2030). |
| 7 botões "Abrir →" com o mesmo nome (DEPLOY-PLANILHA.md, Parte 1) | Só como efeito colateral de um teste que quebrou | `axe` **não** pega isto para botões (não há regra de nomes idênticos). Pega uma asserção própria: coletar nomes acessíveis dos botões de cada tela e exigir unicidade por região. |
| Datas sobrepostas no desktop (mesmo guia) | Não | Teste visual/E2E em projeto desktop: `boundingBox` dos campos Check-in e Check-out sem interseção. |
| Regressões "minhas" de fases seguintes (3 em DEPLOY-AJUSTES-*) | Não | Suíte de componente + E2E rodando em **todo** PR com bloqueio de merge (QA-01). |

## 4. Pipeline

- **QA-01 [Alto] `[FATO]` Deploy não depende do workflow Qualidade.** firebase-hosting-merge.yml:13 roda só `npm ci && npm test && npm run build` e publica em `channelId: live` (linha 25), sem `needs` nem `workflow_run`. O Qualidade (`on: push main` e `pull_request`, qualidade.yml:14-16) corre em paralelo e não segura nada. Regras, E2E e vazamento de código de teste podem estar vermelhos e a versão vai ao ar. O de PR (firebase-hosting-pull-request.yml:15) tem a mesma lacuna.
- **QA-04 [Alto se confirmado] `[HIPÓTESE]` O E2E pode nunca ter passado no CI.** qualidade.yml não define nenhuma `VITE_FIREBASE_*` (grep: só os workflows de deploy as definem), e `firebase.js:20-27` lê tudo de `import.meta.env` sem valor padrão. O SDK do Auth costuma recusar `apiKey` indefinida. Localmente passa porque há `.env` (test-results/.last-run.json: `passed`). Verificar o histórico do Actions.
- **QA-12 [Médio] `[FATO]` Lint inexistente na prática.** `npm run lint` (package.json:13) existe, mas não há `.eslintrc*`, `eslint.config*` nem `eslintConfig` no package.json, nem no histórico do git. Também não roda no CI. `[HIPÓTESE]` O comando falha por falta de configuração.
- **QA-09 [Médio] `[FATO]` Artefato de falha vazio.** O CI usa `reporter: 'github'` (playwright.config.js:9), que não gera `playwright-report/`; o passo de upload (qualidade.yml:72-77) não encontra nada. Os traces ficam em `test-results/`, que não é enviado.
- **QA-10 [Médio] `[FATO]` Rastro de execução versionado.** `test-results/.last-run.json` está no git e `.gitignore` não lista `test-results` nem `playwright-report`.
- **QA-11 [Médio] `[FATO]` Sem relatório de cobertura** (nenhum `@vitest/coverage-v8`; `npm test` sem `--coverage`) e sem limite mínimo.
- **QA-13 [Baixo] `[FATO]` Ambiente sem trava.** `npm install -g firebase-tools` sem versão (qualidade.yml:37); os workflows de deploy não fixam Node (sem `setup-node`) enquanto o Qualidade fixa Node 20; nenhum job tem `timeout-minutes` ou `concurrency`.
- **QA-14 [Baixo] `[FATO]` As regras do Firestore não são publicadas por workflow** (os dois workflows só fazem Hosting). Testes de regras passam sobre o arquivo do repositório, não sobre as regras em produção. Divergência possível; conferir com devsecops.
- **Proteção de branch: `[NÃO VERIFICADO]`.** `gh api .../branches/main/protection` retornou 403 (repositório não anexado à sessão). Sem proteção exigindo "Qualidade", QA-01 não tem rede de segurança.
- **Viewport mobile: está declarado** `[FATO]` (playwright.config.js:15, Pixel 5) e todos os cenários rodam também nele. Mas não há asserção específica de celular, e falta largura de tablet (breakpoint em app.css:313, 768 px).
- **Acessibilidade automatizada: ausente** `[FATO]` (nem `@axe-core/playwright` instalado; nenhuma chamada a `axe` em e2e/).

## 5. Outros riscos de regressão sem teste

- **QA-02 [Alto] `[FATO]` Zero testes de componente e de `TripProvider`.** Três regressões de foco, rolagem e dia inicial vieram da camada que não tem teste (seção 3). Plano: P1 itens 4 e 5.
- **QA-03 [Alto se confirmado] `[HIPÓTESE]` Edição concorrente pode perder dados.** `saveTripState` grava o `state` inteiro com `updateDoc` (tripData.js:100-102), então vale a última gravação. Além disso, `TripProvider.jsx:60,71-77`: uma atualização remota recebida durante a digitação é guardada e aplicada ao sair do campo, e `applyRemote` substitui o estado local (linha 41-45) sem mesclar. Se o usuário digitou nos últimos 900 ms (debounce, linha 100), a edição local pode ser descartada. Nenhum teste com 2 usuários. Confirmar com E2E de dois contextos.
- **QA-05 [Alto se confirmado] `[HIPÓTESE]` Datas erradas em fusos UTC+.** `datesFromCities` (dates.js:50), `addDaysISO` (dates.js:19), `validateCityCoverage` (dates.js:262), `generate.js:48,179` e `TripProvider.jsx:155` criam `new Date('AAAA-MM-DDT00:00')` (meia-noite **local**) e leem `toISOString()` (UTC). Em Lisboa no verão (UTC+1), a meia-noite local de 01/06 é 31/05 23:00 UTC, e a data sai um dia antes. `todayISO` (dates.js:293-297) compensa o fuso, o que reforça a inconsistência. Os testes passam no CI (UTC) e no Brasil (UTC-3); o viajante usa o aparelho em fuso da viagem. Verificar: `TZ=Europe/Lisbon npx vitest run src/domain`.
- **QA-06 [Médio] `[FATO]` O teste "compartilhar abre a folha de convite" testa a coisa errada.** spec:240 clica no primeiro `/abrir/i`, que é "Abrir Checklist" (Mais.jsx:98; "Abrir Compartilhar" é o terceiro, linha 102), e só confere que existe algum diálogo (spec:241). Passa sem tocar o fluxo de convite. É a mesma classe de erro de posição que o DEPLOY-PLANILHA.md descreve.
- **QA-07 [Médio] `[FATO]` E2E de divisão não confere valores** (spec:119-141), apesar de o histórico de dinheiro ser o mais grave.
- **QA-08 [Médio] `[FATO]` Dinheiro em `number` de ponto flutuante** sem arredondamento a centavos (split.js:145; testes com `toBeCloseTo`). Três partes de R$ 583,33 somam R$ 1.749,99 na tela e o acerto usa tolerância de 1 centavo (split.js:176). Decisão de produto sobre quem fica com o centavo; falta teste que a documente.
- **[Baixo] `[FATO]`** Sem teste do caminho de importação JSON com `confirm()`/`alert()` (Mais.jsx:63-66), nem da impressão (Mais.jsx:419, `window.print`).
- **QA-15 [Baixo]** README desatualizado (cita `deploy.yml`, removido, e 22 testes).
- **QA-16 [Baixo]** Nomes de testes obsoletos (domain.test.js:737).
- **QA-17 [Baixo]** DEPLOY-PLANILHA.md traz o caminho pessoal do desenvolvedor no Windows; não é dado de teste, mas está no repositório.

## 6. Plano de testes priorizado

Esforço: P = até 0,5 dia · M = 1 a 2 dias · G = mais de 2 dias. Quem implementa: autor da mudança ou engenheiro da área; mudanças de workflow, devsecops-engineer.

### P1: antes da próxima publicação

| # | Teste ou ação | Tipo | Arquivo | Esforço |
|---|---|---|---|---|
| 1 | Fazer o deploy depender do Qualidade (workflow reutilizável ou `needs`) e exigir o check "Qualidade" na proteção do branch (QA-01) | Pipeline | `.github/workflows/*.yml` | P |
| 2 | Confirmar se o E2E já passou no CI; se não, injetar `VITE_FIREBASE_*` fictícios no job (QA-04) | Pipeline | `qualidade.yml` | P |
| 3 | Matriz de fuso: rodar `src/domain` com `TZ=Europe/Lisbon`, `Asia/Tokyo`, `America/Sao_Paulo`; testes de `datesFromCities`, `addDaysISO`, cobertura de cidades, `setCityStart` (QA-05) | Unitário | `src/domain/__tests__/dates-fuso.test.js` + matriz no CI | P |
| 4 | Infra de componente: `@testing-library/react` + `user-event`; `npm test` passa a incluir `src/components` | Config | `package.json` | P |
| 5 | `Sheet`: digitar sem perder foco com `onClose` inline, Esc fecha, Tab preso, foco volta ao abridor, `maxHeight` via `visualViewport` sem re-render (QA-02) | Componente | `src/components/__tests__/Sheet.test.jsx` | M |
| 6 | Regras: revogação pelo dono (B); membro não altera `memberUids`/`ownerId` (A); C com `arrayUnion`, remoção do dono, convite aceito ou cancelado; `convites` update/delete; `members`, `presence`, `versions`; negação padrão | Regras | `src/rules/__tests__/rules.test.js` | M |
| 7 | Corrigir QA-06: abrir "Abrir Compartilhar" e esperar diálogo "Compartilhar"; no teste de criar viagem, conferir o nome na lista | E2E | `e2e/fluxos-criticos.spec.js` | P |

### P2: próxima iteração

| # | Teste | Tipo | Arquivo | Esforço |
|---|---|---|---|---|
| 8 | Divisão com 3 participantes: "33,33%", "R$ 583,33" por pessoa, acerto, confirmar pagamento (QA-07) | E2E | `e2e/divisao-despesas.spec.js` | M |
| 9 | Digitação tecla a tecla (`pressSequentially`) em editores de item e cidade, valor final íntegro | E2E | `e2e/edicao.spec.js` | P |
| 10 | Rolagem mobile: folha longa, evento `visualViewport`, `scrollTop` estável (projeto `mobile`) | E2E | `e2e/mobile-rolagem.spec.js` | M |
| 11 | Dia inicial: viagem em curso, passada e futura com `page.clock` | E2E | `e2e/dia-inicial.spec.js` | M |
| 12 | Dois usuários (dois contextos): convite, aceite, edição concorrente (QA-03), revogação, comentário | E2E | `e2e/colaboracao.spec.js` | G |
| 13 | `@axe-core/playwright` em Login, Dias, Custos, Mais e nas folhas, nos dois projetos + unicidade de nomes de botões | E2E a11y | `e2e/acessibilidade.spec.js` | M |
| 14 | Cobertura: `@vitest/coverage-v8` no domínio, resumo no job, limite mínimo gradual (QA-11) | Config | `vite.config.js`, `qualidade.yml` | P |
| 15 | Criar configuração do ESLint e passo de lint no CI; corrigir o reporter para gerar HTML e enviar `test-results/` (QA-09, QA-10, QA-12) | Config | `.eslintrc.cjs`, `playwright.config.js`, `.gitignore` | P |
| 16 | Lacunas de domínio: `itemTimeMinutes`, `sortCitiesByDate`, getters legados de `transport.js`, `resumoValidacao`, arredondamento de `money` e centavos (QA-08) | Unitário | `domain.test.js` | M |

### P3: quando houver folga

| # | Teste | Tipo | Arquivo | Esforço |
|---|---|---|---|---|
| 17 | Offline: `context.setOffline(true)`, editar, reconectar, conferir sincronização; risco alto de instabilidade com o emulador | E2E | `e2e/offline.spec.js` | G |
| 18 | Swipe de dia por eventos de toque, esperando com `expect.poll` (nunca tempo fixo) | E2E mobile | `e2e/swipe.spec.js` | M |
| 19 | Impressão: `emulateMedia({media:'print'})`, `PrintView` visível e `main` oculto; `page.pdf()` com texto esperado | E2E | `e2e/impressao.spec.js` | M |
| 20 | Importar e exportar JSON e `.xlsx` (`setInputFiles`, download) | E2E | `e2e/arquivos.spec.js` | M |
| 21 | `invite.js`, `phoneAuth.js` (`isValidE164`, `normalizePhone`), `reminders` | Unitário | `src/lib/__tests__/lib.test.js` | P |
| 22 | Projeto de tablet (768 px) no Playwright; fixar versões de `firebase-tools` e Node; `timeout-minutes` | Config | `playwright.config.js`, workflows | P |

## 7. Checklist manual mínimo de release

Executar na prévia (canal de PR), em aparelho real e nos dados fictícios da prévia. Registrar aparelho, sistema, navegador e versão.

**Celular real (iPhone e Android):**
- [ ] Entrar por Google e por celular (SMS); sair e entrar de novo.
- [ ] Abrir a edição de um item, tocar no campo e **digitar uma frase inteira** com o teclado aberto: o cursor não sai do campo e o botão de excluir continua alcançável.
- [ ] Custos > Divisão de despesas com lista longa: rolar sem a tela voltar ao topo; a barra inferior não se solta.
- [ ] Tela Dias: swipe curto não troca de dia, swipe firme troca; viagem em curso abre no dia de hoje.
- [ ] Instalar na tela inicial (PWA) e abrir; atualização de versão chega na abertura seguinte.

**Offline:**
- [ ] Abrir o app, desligar a rede, editar um item e um custo, recarregar: dados continuam; religar e conferir que sincronizou no outro aparelho.
- [ ] Sem rede, nenhuma mensagem de erro enganosa ao salvar.

**Dois usuários (duas contas, dois aparelhos):**
- [ ] Dono convida; convidado entra, vê a viagem e edita.
- [ ] Os dois editam campos diferentes ao mesmo tempo; nada se perde. Os dois editam o mesmo campo; resultado explicável.
- [ ] Dono revoga o acesso: o convidado perde a viagem; confirmar que ele **não consegue voltar** sozinho.
- [ ] Comentário e feed de atividade aparecem para o outro em segundos.

**Geral:**
- [ ] Aparelho com fuso de outro país (ex.: Lisboa ou Tóquio): datas de check-in, check-out e dias iguais às digitadas (QA-05).
- [ ] Divisão com 3 pessoas: percentuais 33,33% e centavos coerentes com o total.
- [ ] Imprimir (PDF) mostra a viagem inteira; tela escura legível.
- [ ] Importar e exportar planilha e JSON.

## 8. NÃO VERIFICADO (comandos para o Head rodar com o repositório anexado)

```
npm ci
npm test                      # 111 testes de domínio devem passar
TZ=Europe/Lisbon npx vitest run src/domain    # confirma ou descarta QA-05
npm run test:rules            # 17 testes de regras (precisa de Java e Firebase CLI)
npm run test:e2e              # 18 execuções (precisa de emuladores e Chromium)
npm run lint                  # esperado: falha por falta de configuração (QA-12)
npm run build
env -u VITE_FIREBASE_API_KEY -u VITE_FIREBASE_PROJECT_ID npm run test:e2e   # simula o CI (QA-04)
```

Também não verificados: histórico de execuções do Actions, proteção do branch `main`, se as regras publicadas em produção são iguais às do repositório, estabilidade (flakiness) do E2E em execuções repetidas (`--repeat-each=5`), cobertura real por linha, qualquer comportamento em celular real.

## 9. Limites desta análise

Não avaliei segurança das regras (devsecops-engineer) nem experiência de uso (ux-research). Os achados sobre revogação e convite aceito (seção 1.2) são só de cobertura de teste; a expectativa correta de comportamento precisa ser decidida pelo devsecops-engineer.
