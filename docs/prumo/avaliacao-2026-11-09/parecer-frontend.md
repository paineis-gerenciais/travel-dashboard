# Parecer de front-end: travel-dashboard

Data: 2026-11-09 · Autor: frontend-engineer · Método: leitura estática do branch main (nenhum comando de build, lint ou teste foi executado; ver "Não verificado").
Rótulos: [FATO] com `caminho:linha`; [HIPÓTESE] precisa de execução para confirmar. Severidade B/A/M/Ba = Bloqueador/Alto/Médio/Baixo. Esforço P/M/G.

## 1. Resumo
O núcleo está melhor do que o histórico sugere: as três causas-raiz de regressão registradas nos DEPLOY-AJUSTES foram tratadas (seção 2). Os maiores riscos hoje são outros: (a) edição por índice de array, que quebra quando o estado é reordenado; (b) perda de edição na janela do debounce de 900 ms; (c) Sheet de comentários renderizado dentro de um cartão com `contain`/`will-change`; (d) ausência de ErrorBoundary, de estados de carregamento/erro por tela e de lint configurado; (e) cerca de 980 linhas de código morto. Não encontrei Bloqueador. Nenhuma troca de framework é necessária.

## 2. Causas-raiz do histórico: status no código atual
| Regressão | Situação | Evidência |
|---|---|---|
| Foco roubado por efeito a cada tecla | Tratada | [FATO] `src/components/ui.jsx:67-81`: `onClose` em ref, foco só na montagem (deps `[]`) |
| Salto de rolagem por estado do visualViewport | Tratada | [FATO] `ui.jsx:109-117`: `maxHeight` escrito via ref, só `resize` |
| `position: fixed` do rodapé | Tratada por layout | [FATO] `app.css` `.app-shell` (flex, `100dvh`, só `main` rola); `App.jsx:154-195` |
| 7 botões "Abrir →" iguais | Tratada em Mais | [FATO] `Mais.jsx:98-125` têm `aria-label="Abrir X"`. Persistem iguais: `Custos.jsx:157` (5x "Ver →" sem rótulo) e `Mais.jsx:106,115,119,121,130` ("Enviar →", "Gerar →", "Exportar"…) (ver A11-2) |
| Dia inicial congelado em 0 | Tratada | [FATO] `Dias.jsx:50-71` (ref `jaPosicionou`) |

## 3. Achados

### 3.1 Padrões React
**R-1 · Alto · M · Edição por índice de array, com estado reordenado a cada mutação.**
[FATO] `Cidades.jsx:15,75,85-89,114-116` guarda `editing = índice`; `ensureGenerated` chama `sortCitiesByDate` em toda mutação (`domain/generate.js:14,122`; `TripProvider.jsx:22-24`). Ao preencher a data de check-in de uma cidade nova (que nasce sem data e vai para o fim da lista), ela sobe na ordenação e o índice passa a apontar outra cidade. [HIPÓTESE forte] Os campos seguintes (check-out, hotel, valor) passam a editar a cidade errada. Mesmo padrão, risco menor, em `Dias.jsx:52,192-198,353-360` (`editing {kind,index}`) e no checklist (`Mais.jsx:187,264-268`). [FATO] `Dias.jsx:368-369`: `ItemSheet` devolve `null` se o índice não existe, mas `editing` não é limpo (um item novo no mesmo índice reabriria o Sheet). Atualização remota que insere ou remove itens desloca o índice do mesmo modo.
Correção: ações por `id` (já existe `setRowField(kind,id,…)` em `TripProvider.jsx:278`) e `editing = {kind,id}`. Teste: e2e que cria cidade, preenche data e confere o título do Sheet.

**R-2 · Alto · M · Edição perdida na janela do debounce e ao trocar de viagem.**
[FATO] Salvar leva 900 ms (`TripProvider.jsx:92-100`); o cleanup do efeito faz `clearTimeout` (`:101`) sem gravar. Não há `pagehide`, `visibilitychange` nem flush no desmontar (grep em `src/`: zero ocorrências). Cenários [HIPÓTESE]: fechar a aba ou "Trocar" de viagem (`Mais.jsx:132`) em menos de 0,9 s após digitar; e, pior, remoto bufferizado: ao sair do campo, `applyRemote` (`:73-77`) troca o estado local pelo remoto antigo e `suppress=true` impede nova gravação, descartando a digitação ainda no timer. Correção: gravar na hora no `focusout`, no `pagehide` e no desmontar; ao aplicar o remoto bufferizado, mesclar ou reaplicar a edição local pendente (a regra de merge é do backend-engineer/domínio). Também [FATO] o documento inteiro é regravado (`tripData.js:100-102`): last-write-wins entre colaboradores (decisão de domínio, fora do meu escopo).

**R-3 · Médio · P · Efeito de destaque cancela o próprio timer.**
[FATO] `Dias.jsx:75-89`: o efeito depende de `[target]`, chama `onTargetHandled()` (que zera `target` em `App.jsx:205`) e retorna cleanup com `clearTimeout`. A mudança `target -> null` roda o cleanup e cancela o `setTimeout` de 4 s (`:86`), então `highlightId` nunca volta a null (o realce fica até o próximo alvo). Correção: limpar o destaque em efeito próprio, ou não usar cleanup para esse timer.

**R-4 · Médio · P · Resultado de ação lido de dentro do updater do `setState`.**
[FATO] `TripProvider.jsx:124-139` (`becamePaid`) e `:160-166` (`rejected`) são atribuídos dentro de `mutate(fn)`, que roda `fn` dentro de `setState(prev => …)` (`:115-119`), e lidos logo depois, de forma síncrona. O React não garante que o updater rode antes (só no caminho de cálculo antecipado), e o StrictMode o executa duas vezes em dev. [HIPÓTESE] O log "marcou como Pago" e a mensagem "check-out precisa ser depois do check-in" (`Cidades.jsx:142-143`) falham de forma intermitente. Correção: validar contra `state` antes de chamar `mutate` (mutação pura no updater).

**R-5 · Médio · P · `eslint-disable react-hooks/exhaustive-deps` (3 ocorrências + 1 de console).**
- `App.jsx:128`: [FATO] lembretes só reavaliam quando muda `state.cities.length`; aceitável para "uma vez por dia", mas usa `tripName` possivelmente vazio na primeira execução. Baixo.
- `Dias.jsx:70`: [FATO] efeito reexecuta a cada mutação (`state.cities` muda de identidade por causa do `structuredClone`) e se protege pelo ref; funciona, só ruído.
- `Dias.jsx:88`: ver R-3 (a omissão de `onTargetHandled`/`idx` é inofensiva; o cleanup é o defeito).
- [FATO] Não existe configuração do ESLint (sem `.eslintrc*`, sem `eslint.config*`, sem chave `eslintConfig` no `package.json`) e `qualidade.yml` não chama `lint`. [HIPÓTESE] `npm run lint` falha por falta de config; as regras citadas nunca foram aplicadas.

**R-6 · Médio · M · Listeners globais.**
[FATO] `TripProvider.jsx:68-85` (focusin/focusout) e `ui.jsx:84-104` (keydown) limpam no cleanup. Problemas: (a) `editing.current` só zera no `focusout`; checkbox ou `select` mantêm foco após o clique, então remotos ficam bufferizados até o usuário tocar em outro lugar; [HIPÓTESE] elemento removido do DOM com foco pode não disparar `focusout`, deixando `editing` preso em true; (b) cada `Sheet` registra um `keydown` em `document`: com Sheets empilhados (`Mais.jsx:228-240` abre "Anexar link" dentro do Checklist; `CommentThread` dentro de linha) o Esc fecha todos de uma vez, e o trap do externo disputa com o do interno.

**R-7 · Baixo · P · Chaves por índice.** [FATO] Só 2 casos, ambos inofensivos: `Timeline.jsx:36` e `DiagnosticsModal.jsx:32`. Todo o resto usa `id`/chave estável. Boa prática.

**R-8 · Médio · M · Componentes grandes com várias responsabilidades.** [FATO] `Dias.jsx` (510 linhas: navegação, gesto de swipe, animação imperativa, 4 renderizadores de linha quase idênticos em `:261-328`, `ItemSheet` com 4 formulários), `Custos.jsx` (505: métricas, gráfico, 5 relatórios, divisão) e `Mais.jsx` (482: 9 Sheets). Duplicação: `dayItems`/`dayTotal` idênticos em `Dias.jsx:28-38` e `PorDia.jsx:34-45`. Dividir por arquivo, sem mudar comportamento.

**R-9 · Médio · P · Código morto (~980 linhas).** [FATO] Sem importador: `screens/PorDia.jsx`, `Roteiro`, `Transporte`, `Alimentacao`, `Atracoes`, `Outras`, `Checklist`, `Resumo`, `usePagination.jsx`, `EmbeddedMap.jsx`, `lib/geocode.js` (usado só pelo mapa). `Atracoes.jsx:5` e `Outras.jsx:5` importam `statusRowClass`/`StatusSelect`, que não existem mais em `ui.jsx`; `EmbeddedMap.jsx:2` importa `leaflet`, que não está no `package.json` nem em `node_modules` (o build passa só porque ninguém importa o arquivo). Remover.

### 3.2 Desempenho
**D-1 · Médio · M · Provider sem memoização, re-render em cascata.**
[FATO] `TripProvider.jsx:303` cria `{state, tripName, dirty, loaded, presence, actions}` novo a cada render e `actions` (`:122-300`, ~30 funções) é recriado também. Toda tecla muda `state`: `App` (header, `PrintView`), a tela ativa, o Sheet e todos os `CommentThread` re-renderizam. Memoizar `actions` não adianta enquanto `state` for um só valor. Opções: (1) separar dois contextos (ações estáveis via `useRef`/`useMemo`; estado) e `React.memo` em linhas; (2) seletores. Começar por (1), de custo baixo.

**D-2 · Médio · M · Dois `structuredClone` do estado inteiro por mutação.**
[FATO] `mutate` clona (`:116`) e `withGenerated` clona de novo (`:22`), além de `ensureGenerated` (ordena, gera café, remove transportes, recalcula cidade/período de todos os itens: `generate.js:121-134`) a cada tecla; `JSON.stringify` do estado a cada snapshot remoto (`:57`) e a cada save (`:94`). [HIPÓTESE] Com viagens pequenas (dezenas de itens) é imperceptível; cresce com viagens longas. Eliminar o segundo clone (aplicar `ensureGenerated` ao `draft` já clonado) é mudança de uma linha. Medir com Profiler antes de ir além (imutabilidade estrutural, ex.: Immer, só se medir problema).

**D-3 · Médio · M · Um listener do Firestore por item.**
[FATO] `CommentThread.jsx:13-16` assina uma consulta por linha em `Dias.jsx:273,293,311`; cada troca de dia monta e desmonta todos. Custo de leituras e latência. Alternativa: um listener por viagem (ou contador agregado) em contexto, e o Sheet só consulta ao abrir. Combinar com o backend-engineer (regras e índice).

**D-4 · Baixo · P · `PrintView` sempre montado.** [FATO] `App.jsx:224` renderiza o documento de impressão completo e recalcula tudo a cada tecla, oculto por CSS. Montar só em `beforeprint` (ou ao abrir "Gerar PDF", `Mais.jsx:413-433`).

**D-5 · Baixo · P · Pequenos custos por render.** [FATO] `state[kind].indexOf(x)` por linha (`Dias.jsx:257`), ordenação do dia a cada render (`:132-137`), `validateCityCoverage` com `useMemo` que se invalida a cada mutação (`:54`, dependência `[state]`). Irrelevante em escala atual.

**D-6 · Baixo · —. Listas sem virtualização.** [FATO] Sem virtualização, mas as listas são curtas (itens do dia, checklist). Não recomendo agora. `Mapa.jsx:63-84` renderiza todos os dias; aceitável.

**D-7 · Bundle.** [FATO] `xlsx` é carregado sob demanda (`lib/sheetFile.js:15`, `import('xlsx')`); `firebase/analytics` também (`lib/analytics.js:39,71`); telas em `lazy` (`App.jsx:14-18`). `manualChunks` separa `firebase` e `react` (`vite.config.js:46-52`). Médio · P: [FATO] `globPatterns: ['**/*.{js,…}']` (`:35`) pré-cacheia também o chunk do `xlsx`, então ele é baixado na instalação do SW mesmo para quem nunca importa planilha. [HIPÓTESE] ~400 KB; confirmar no `dist`. Excluir esse chunk do precache e usar `runtimeCaching` CacheFirst para ele. Login, TripPicker, Onboarding e Sheets de Mais entram no chunk principal (não lazy): Baixo.

### 3.3 Acessibilidade implementada
**A11-1 · Médio · M · Sheet.** [FATO] Pontos bons: `role="dialog" aria-modal`, `aria-label`, Esc, trap de Tab, retorno de foco (`ui.jsx:77-81,84-104,125`). Falhas: (a) o painel (`tabIndex=-1`) recebe o foco inicial; Shift+Tab nele sai do diálogo porque a checagem compara com o primeiro elemento focável (`:98`); (b) fundo não fica `inert`/`aria-hidden` (só o backdrop cobre); (c) retorno do foco falha se o gatilho foi desmontado (ex.: `Dias.jsx:371`, excluir item); (d) Esc em Sheets empilhados (R-6); (e) sem foco inicial no primeiro campo. Correção: `inert` no `#root` irmão ou no shell enquanto houver Sheet, trap só no Sheet do topo (pilha), foco no primeiro campo.

**A11-2 · Médio · P · Nomes acessíveis repetidos.** [FATO] `Custos.jsx:157` ("Ver →" x5), `Custos.jsx:147`, `Mais.jsx:106,115,119,121,130,132,134`, "Editar" x N por dia (`Dias.jsx:271,291,309,326`). `Row` não associa título e botão. Usar `aria-label={`Ver ${label}`}`; "Editar" com o nome do item (`aria-label={`Editar ${título}`}`). Mesmo vale para o "✕" de `RouteEditorModal.jsx:318` (já tem rótulo, sem o nome da parada).

**A11-3 · Médio · P · `Timeline` como `tablist`.** [FATO] `Timeline.jsx:387-404`: `role="tab"` sem `tabpanel`, sem `aria-controls`, sem setas e todos os botões tabulares (viagem de 20 dias = 20 paradas de Tab). Trocar para botões comuns com `aria-current="true"` e `aria-label` completo, ou implementar roving tabindex.

**A11-4 · Médio · P · Gesto sem alternativa e menus sem teclado.** O swipe tem alternativa (Stepper, `Dias.jsx:340-344`) e `prefers-reduced-motion` é respeitado (`app.css` e `Dias.jsx:96`). Já `StatusChip` (`ui.jsx:9-32`): `role=listbox` com botões `role=option`, sem setas, sem Esc, foco não volta, e `aria-label` do botão inclui só o valor ("Planejado ▾", sem dizer "status"). O arraste de paradas (`RouteEditorModal.jsx:296-319`) não tem alternativa por teclado (a alça é `span` sem `role`/`tabIndex`; o histórico cita que os botões subir/descer foram removidos). Reintroduzir botões "Mover para cima/baixo" (P).

**A11-5 · Médio · P · Rótulos faltando.** [FATO] Checklist: campo do nome sem rótulo (`Mais.jsx:262-266`) e checkbox com `aria-label={c.item}` vazio se o item estiver vazio (`:257`); `CommentThread.jsx:56` (`input` só com `placeholder`); `RouteEditorModal.jsx:325`; `Mais.jsx:206`. `alert()`/`confirm()` nativos em `Mais.jsx:56,59`.

**A11-6 · Médio · P · Emoji como ícone.** [FATO] Maioria com `aria-hidden` (`App.jsx:189`, `ui.jsx:42,155`), mas: 📎 e 💬 do cabeçalho são o único conteúdo do botão (rótulo existe, `App.jsx:165,172`); `LinkChip` (`Dias.jsx:476-489`); "⋯" da aba Mais; `StatusChip`. Emoji muda de aparência por sistema e não segue tema. [RECOMENDAÇÃO] Conjunto de SVG inline (decisão visual: ui-product-design).

**A11-7 · Baixo · P · Alvos de toque.** [FATO] `--tap: 44px` (`app.css` `:root`) é padrão para `button`, campos e abas (64 px), mas `.btn-sm` é 36 px (`:154`), `.chip` 32 px (`:215`), `.timeline-day` 40 px; `Row` dentro de card junta 3 a 4 botões `btn-sm` em linha (`Dias.jsx:270-273`). Atende WCAG 2.2 AA (mín. 24 px), abaixo da meta de 44 px.

**A11-8 · Médio · P · Contraste (cálculo estático).** [FATO] `--text-3: #8e97a5` sobre `#fff` (`app.css:16`) dá cerca de 2,9:1, abaixo de 4,5:1, e é usado em texto de 11 a 13 px (`App.jsx:159` "Salvo/Salvando…", `Dias.jsx:225,347`). [HIPÓTESE] Combinações de `--city` com texto branco em `timeline-day` e chips `--warn` precisam de medição real.

**A11-9 · Baixo.** [FATO] Pontos bons: `<html lang="pt-BR">`, `nav` com `aria-label`, `aria-current` nas abas, foco visível global (`app.css:165`, `:focus-visible`), `role=alert/status` em Banner e Toast. [FATO] `Row` usa `all: unset` no botão (`ui.jsx:45`), o que apaga o contorno de foco (estilo inline vence a regra `:focus-visible`); hoje nenhum `Row` usa `onClick`, mas fica armadilha. [FATO] `Dias.jsx:212` e `.dias-card` em CSS: ver P-1.

### 3.4 Sheet de comentários dentro de contexto de contenção
**P-1 · Alto · P · [HIPÓTESE forte, a confirmar no navegador].** [FATO] `CommentThread` renderiza seu `Sheet` no ponto de uso, dentro da `Row` do cartão do dia (`Dias.jsx:273`, sem `createPortal`; grep zero). [FATO] O cartão tem `will-change: transform` inline (`Dias.jsx:212`), `transform` definido por JS (`:99-105`) e `contain: layout paint` (`app.css:421`). Por especificação, os três fazem do cartão o bloco de contenção de descendentes `position: fixed`, e `paint` recorta o que sai da caixa. O `.sheet-backdrop` (`position: fixed; inset: 0`) tende a ficar do tamanho do cartão e cortado. É o mesmo tipo de falha do histórico "position fixed". `ItemSheet` não sofre: é irmão do cartão (`Dias.jsx:353`). Nenhum teste e2e cobre comentário (`e2e/fluxos-criticos.spec.js`). Correção: renderizar `Sheet` via `createPortal(…, document.body)` (muda uma linha em `ui.jsx:119`, beneficia todos os Sheets).

### 3.5 PWA e offline
**PW-1 · Médio · P · `autoUpdate` sem aviso.** [FATO] `vite.config.js:11` `registerType: 'autoUpdate'`, nenhum `registerSW`/`useRegisterSW` em `src/`. [HIPÓTESE] Pela documentação do plugin, o modo recarrega as abas abertas quando há versão nova, e o comentário em `vite.config.js:6-9` ("próxima abertura") não confere; um reload no meio da digitação pode perder o que ainda está no timer de 900 ms (R-2). Opção: `registerType: 'prompt'` com Toast "Nova versão disponível. Atualizar" (usa `ToastProvider` existente) ou recarregar só ao voltar para a tela inicial.

**PW-2 · Médio · P · Cache `firestore-cache` sem utilidade.** [FATO] `vite.config.js:38-46` aplica `NetworkFirst` a `firestore.googleapis.com`. O SDK usa canais de streaming (WebChannel) e o app já tem `persistentLocalCache` com várias abas (`lib/firebase.js:39-40`), então a persistência offline vem do IndexedDB. [HIPÓTESE] O cache do SW quase não armazena nada útil (só GET), e `NetworkFirst` sem `networkTimeoutSeconds` pode atrasar leituras offline. Remover a regra.

**PW-3 · Baixo · P · Primeira abertura offline.** [FATO] `navigateFallback: '/index.html'` e precache de `js/css/html/svg/png` dão shell offline depois da 1ª visita online; sem 1ª visita online não há app (esperado). [HIPÓTESE] Offline sem sessão anterior o Login falha sem mensagem de rede: `Login.jsx` só mostra erro do provedor. Sem aviso de offline na interface (grep `navigator.onLine`, `online`/`offline`: zero). Adicionar faixa "Sem conexão: alterações serão enviadas depois" e estado do salvamento honesto (ver E-3).

**PW-4 · Baixo · P · Manifest.** [FATO] Ícones 192, 512 e 512 maskable presentes em `public/`. Falta `id`, `scope` e `screenshots`. `orientation: 'portrait'` (`:21`) trava tablet e desktop deitados; `theme_color` fixo escuro (`index.html:6`, manifest) enquanto o app tem tema claro; `useTheme.js` não atualiza `<meta name="theme-color">`. O ícone maskable de 512 tem 54 KB e o 512 comum 133 KB: otimizar.

### 3.6 CSS
[FATO] Pontos fortes: tokens em `:root` (cores, espaço, raio, tipografia, `--tap`), tema escuro por `[data-theme="dark"]` (`app.css:41-60`) com `useTheme` respeitando `prefers-color-scheme` (`useTheme.js:14-17`), cores de cidade por classe com variantes claro/escuro (`:232-248` na seção), `prefers-reduced-motion`, `100dvh` e `env(safe-area-inset-*)`, impressão dedicada (`@media print`) que oculta o app e mostra `PrintView`.
**C-1 · Médio · M · Estilo inline.** [FATO] 176 ocorrências de `style={{` em `src/components` (36 em `PorDia`, morto; 28 em `Custos.jsx`, 13 em `Mais.jsx` e `Login.jsx`). Muitos repetem padrões que merecem classe (`display:flex; gap:var(--sp-2)` em ao menos 8 lugares; barras de distribuição em `Custos.jsx:115-123`; `PresenceBar.jsx:11-17`). Inline não responde a `@media`, hover nem dark mode sem variável. Migrar para classes utilitárias, cobrindo antes os casos que mexem com tema.
**C-2 · Baixo · P.** [FATO] Comentário de cabeçalho do CSS diz "Sem temas por seção" mas existe tema por cidade (`city-c0…c7`): atualizar. `.chip-backdrop` com `z-index:19` fixo (`ui.jsx:19`) depende de contexto; também afetado por P-1. `tabbar` mobile fixo em 5 colunas; em 768px+ vira layout lateral (`:313`).
**C-3 · Baixo · P.** Há uma só quebra (`min-width:768px`) para toda a UI; tablets e telas largas só ganham `max-width:720px` no `.container`. Aceitável para o uso.

### 3.7 Robustez
**E-1 · Alto · P · Sem ErrorBoundary.** [FATO] grep por `ErrorBoundary|componentDidCatch|getDerivedStateFromError` em `src/`: zero. `Suspense` (`main.jsx:30`, `App.jsx:196`) não captura erro. Qualquer exceção de render, ou falha ao carregar um chunk lazy (caso real após deploy com SW antigo ou rede ruim), derruba a árvore inteira e deixa tela em branco. [FATO] `lib/logger.js` existe e captura `window.error`/`unhandledrejection` (`main.jsx:14`), alimenta `DiagnosticsModal`, mas o ErrorBoundary de React não alimenta o log. Criar um ErrorBoundary na raiz (e outro por tela) com botão "Tentar de novo", que chame `logError`.

**E-2 · Médio · P · Sem estado de carregamento nas telas.** [FATO] `loaded` existe (`TripProvider.jsx:32,303`) mas nenhuma tela o lê (grep em `components/`). `Dias` mostra o estado vazio "Comece pelas cidades" (`Dias.jsx:108-121`) enquanto o Firestore responde (o próprio comentário `:44-49` reconhece que renderiza antes da resposta); o mesmo em `Custos.jsx:47`, `Mapa.jsx:41`. Usuário pode cadastrar cidade nesse intervalo e o estado local é então sobrescrito pelo remoto. Mostrar esqueleto até `loaded`.

**E-3 · Alto · P · Falhas de rede e de gravação invisíveis.** [FATO] `TripProvider.jsx:97-99` só faz `console.error` ao falhar a gravação (nem `logError`), e `dirty` fica true: o cabeçalho mostra "Salvando…" para sempre (`App.jsx:159`) sem explicar. [FATO] Nenhum `onSnapshot` de `lib/tripData.js` (ex.: `:61-65`, `:204-213`) tem callback de erro; `permission-denied` ou viagem removida deixam a tela vazia sem mensagem. `CommentThread.jsx:18-23` limpa o texto antes do `await` e não trata falha (comentário digitado some). Estados: "Salvo", "Salvando…", "Sem conexão, pendente", "Erro ao salvar (tentar de novo)".

**E-4 · Baixo.** `exportJSON`/`importJSON` usam `alert/confirm` (`Mais.jsx:56,59`); trocar por Sheet de confirmação com mensagem clara.

## 4. Testes
[FATO] `package.json` `test` roda só `vitest run src/domain`; há 1 teste de domínio, 1 de regras e 1 spec e2e; zero teste de componente (nenhum `*.test.jsx`; sem `@testing-library`). `vite.config.js:57-60` já configura `jsdom`. Nenhum dos achados R-1 a R-4, P-1 e A11-1 tem teste. [RECOMENDAÇÃO] Adicionar `@testing-library/react` (MIT, mantida, dev-only) para Sheet, `TripProvider` (buffer remoto) e `StatusChip`; e2e para cidade com data e comentário.

## 5. Plano de refatoração incremental (sem reescrita)
Ordem por valor/risco; cada passo é um PR pequeno com teste.
| # | Passo | Achados | Esforço | Risco | Como testar |
|---|---|---|---|---|---|
| 1 | Configurar ESLint (react, react-hooks) e passo `lint` no `qualidade.yml`; remover código morto (R-9) | R-5, R-9 | P | Baixo | `npm run lint`, `npm run build`, `npm test` |
| 2 | `createPortal` no `Sheet`; pilha de Sheets para Esc/trap; `inert` no fundo; foco inicial | P-1, A11-1, R-6b | P | Médio (visual) | Teste de componente (foco, Esc, Shift+Tab); e2e abrir comentário em celular e desktop; capturas antes e depois |
| 3 | ErrorBoundary raiz e por tela; `logError` nele; erro e estado "pendente" no salvamento; `onSnapshot` com callback de erro | E-1, E-3 | P | Baixo | Componente que lança erro; simular offline no Playwright |
| 4 | Editar por `id` (cidade, item, checklist); limpar `editing` ao sumir o item | R-1 | M | Médio | e2e: criar cidade, definir data, conferir que o Sheet segue na mesma cidade; teste de componente com remoto inserindo item |
| 5 | Flush do save no `focusout`, `pagehide`, desmontar; preservar edição local ao aplicar remoto bufferizado | R-2, R-6a | M | Alto (dados): combinar merge com backend-engineer | Teste do Provider com timers falsos; e2e digitar e trocar de viagem em < 900 ms |
| 6 | Corrigir R-3 (destaque) e R-4 (validar antes do `mutate`) | R-3, R-4 | P | Baixo | Teste de componente; e2e "ir para o item" e checar a classe após 4 s |
| 7 | Estado de carregamento por tela (`loaded`) | E-2 | P | Baixo | Teste: sem `loaded` não aparece "Comece pelas cidades" |
| 8 | PWA: aviso de atualização, remover `firestore-cache`, tirar `xlsx` do precache, manifest (`id`, `scope`, orientação), aviso offline | PW-1 a PW-4, D-7 | P a M | Médio (SW é difícil de reverter: testar em preview) | `vite build` e `vite preview`; Application tab do DevTools; Lighthouse PWA |
| 9 | Acessibilidade: nomes únicos, rótulos, `Timeline` sem `tablist`, mover paradas por botão, contraste do `--text-3` (visual: ui-product-design) | A11-2 a A11-8 | P a M | Baixo | `getByRole` por nome nos testes; axe (`@axe-core/playwright`, MPL-2.0, dev-only: avaliar licença) |
| 10 | Desempenho (só se medir): 1 clone por mutação, contexto dividido, `PrintView` sob demanda, comentários com 1 listener | D-1 a D-4 | M | Médio | React Profiler antes e depois com viagem de 30 dias; contar leituras no emulador |
| 11 | Dividir `Dias`, `Custos`, `Mais` por arquivo; classes no lugar de estilo inline | R-8, C-1 | M a G | Baixo (mecânico) | Mesmos testes e capturas idênticas |

## 6. Não verificado (precisa executar)
- `npm run lint` (provável falha por falta de configuração), `npm test`, `npm run build`, tamanho real dos chunks e do precache (`dist/`), Lighthouse (PWA, desempenho, acessibilidade).
- P-1 (recorte do Sheet de comentários), R-1 (troca de cidade ao preencher data), R-2 (perda na janela de 900 ms), R-3, R-4 e PW-1 só se confirmam no navegador ou em teste.
- Contraste real, ordem de leitura com leitor de tela, comportamento do `focusout` com elemento desmontado.
- Custo de `structuredClone` e de re-render com viagens grandes.
