# Parecer de arquitetura: travel-dashboard

- **Data:** 2026-11-09 · **Autor:** software-architect (Prumo) · **Demanda:** avaliação consultiva, N2, somente leitura
- **Base analisada:** branch `main`, commit `b5a3ce2` (`.git/refs/heads/main`). Leitura estática. Nada foi executado (npm, vitest, playwright bloqueados na sessão).
- **Rótulos:** `[FATO]` com `caminho:linha`; `[HIPÓTESE]` quando depende de execução ou de fonte não consultada. Severidade: Bloqueador/Alto/Médio/Baixo. Esforço: P (até 1 dia), M (2 a 5 dias), G (mais de 1 semana).
- **Fora de escopo:** segurança das regras (devsecops-engineer) e UX (ux-research). Quando um achado encosta nesses temas, ele é só sinalizado.

## 1. Veredito

A base é melhor que a média para um app feito em fases curtas. O domínio é puro e bem testado, o acesso ao Firestore tem porta única e o CI testa regras e E2E com emuladores. O ponto fraco é o **modelo de sincronização**: a viagem inteira é um único campo `state`, regravado por inteiro. O controle de concorrência é "último que grava vence" **no nível do documento**, não do campo. Somado a ações que identificam itens pela **posição no array**, isso faz o app **não aguentar 2 a 6 pessoas editando ao mesmo tempo** sem perda silenciosa de edições. Com um editor por vez, ou com edição alternada, ele funciona. A correção não exige trocar de stack: basta guardar os itens em mapas por id e gravar só os campos alterados (horizonte 3), com correções baratas antes disso (horizonte 1).

## 2. Pontos fortes

| # | Achado | Evidência |
|---|---|---|
| F1 | Domínio puro: `src/domain/` não importa React nem Firebase. Tem 111 testes, com comentários que registram a causa-raiz de cada bug corrigido. | [FATO] `src/domain/__tests__/domain.test.js` (111 `it/test`); imports só relativos ao próprio domínio, ex.: `src/domain/costs.js:6-9` |
| F2 | Porta única ao banco, com o modelo documentado no topo do arquivo. | [FATO] `src/lib/tripData.js:1-8` |
| F3 | Peso do bundle sob controle: telas, `xlsx` e analytics são carregados sob demanda. | [FATO] `src/components/App.jsx:14-18`, `src/lib/sheetFile.js:15`, `src/lib/analytics.js:39` |
| F4 | Analytics com allowlist de chaves: privacidade garantida pela construção do código. | [FATO] `src/lib/analytics.js:13-26,49-59` |
| F5 | CI com testes de regras, E2E no emulador e trava contra vazamento do código de teste para o bundle de produção. | [FATO] `.github/workflows/qualidade.yml:53-68` |
| F6 | Participantes com id estável e migração idempotente (corrigiu o vínculo por nome). | [FATO] `src/domain/state.js:95-133` |

## 3. Camadas e fronteiras (critério 1)

O desenho `domain → lib → store → components` existe e, na maior parte, é respeitado. Os vazamentos:

| # | Achado | Evidência | Sev. | Esf. |
|---|---|---|---|---|
| C1 | Componentes falam com o Firebase sem passar pelo store: 6 componentes importam `tripData` direto, e um deles usa `firebase/auth`. Cada um abre os próprios listeners, sem ponto central de custo ou de erro. | [FATO] `SettingsSheet.jsx:2-4`, `VersionsModal.jsx:6`, `CommentThread.jsx:2`, `MessagesSheet.jsx:3`, `ActivityFeed.jsx:2`, `ShareModal.jsx:2`, `screens/Mais.jsx:15` | Médio | M |
| C2 | Regras de negócio vivem no store, sem teste: exclusão em cascata de participante, regra de check-out, fim do café automático ao editar. `npm test` só cobre `src/domain`. | [FATO] `src/store/TripProvider.jsx:130-132,150-167,262-276`; `package.json:11` | Médio | M |
| C3 | Lógica de domínio duplicada em componentes: `dayItems`/`dayTotal` de Dias (sem hospedagem) repetem `costs.js`, e PrintView refaz o agrupamento do dia. | [FATO] `screens/Dias.jsx:28-38` vs `src/domain/costs.js:40-48`; `PrintView.jsx:29-37` | Médio | P |
| C4 | Código morto: 8 telas antigas (870 linhas) mais `tableHelpers.js` e `usePagination.jsx` (58 linhas). Ninguém importa esses arquivos depois do redesign, ao contrário do que diz o guia. São cerca de 9% de `src/`. | [FATO] `App.jsx:14-18` carrega só 5 telas; grep sem importadores de `Alimentacao`, `Atracoes`, `Checklist`, `Outras`, `PorDia`, `Resumo`, `Roteiro`, `Transporte`; `DEPLOY-REDESIGN.md:99-102` | Médio | P |

## 4. Modelo de dados e concorrência (critério 2)

### 4.1 Achados

| # | Achado | Evidência | Sev. | Esf. |
|---|---|---|---|---|
| D1 | **Último que grava vence, no nível do documento.** `saveTripState` regrava o `state` inteiro. O guia da Fase 2 diz que o conflito só ocorre "no mesmo campo", o que não é verdade: edições em itens diferentes também se apagam. Três caminhos de perda: **(a)** duas edições quaisquer dentro de 900 ms mais a latência; **(b)** buffer de foco: o remoto fica em espera, mas o debounce continua gravando o estado local sem a mudança do outro e a apaga no servidor; no `focusout`, o remoto é aplicado e apaga a edição local, então os dois perdem; **(c)** offline: horas de edição sem rede reenviam o documento inteiro e apagam o que os outros fizeram no período. | [FATO] `tripData.js:100-102`; `TripProvider.jsx:60,71-77,88-101`; `DEPLOY-FASE2.md:162-165`. Efeito em produção: [HIPÓTESE] alta probabilidade, confirmar com teste de 2 navegadores | **Alto** | M |
| D2 | **Itens identificados por posição no array.** `updateItem`, `deleteItem`, `setCity*` e `toggleChecklist` recebem índice, e as folhas de edição guardam esse índice. Só que `ensureGenerated` reordena as cidades e filtra `foodItems` a cada mutação. Com um único usuário, mudar o check-in no `CitySheet` reordena a lista e a folha passa a editar outra cidade. Com colaboradores, um item inserido ou removido por outra pessoa faz "Excluir" apagar o item errado. | [FATO] `TripProvider.jsx:123-141,147-167,285-289`; `generate.js:14-24,53,122`; `Dias.jsx:257,271,366-371`; `Cidades.jsx:75,114-185`; `Mais.jsx:252-271`. Efeito: [HIPÓTESE] forte | **Alto** | M |
| D3 | **Datas erradas em fusos a leste de UTC.** O código cria a data à meia-noite local e a lê com `toISOString()` (UTC). Na Europa no verão ou na Ásia, os dias derivados recuam 1 dia: cafés automáticos, dias da viagem, cobertura. Membros em fusos diferentes geram cafés em datas diferentes e se sobrescrevem. É um app de viagem, usado no exterior. Os testes de CI rodam em UTC e não pegam o problema. | [FATO] `dates.js:16-20,47-51,261-262`; `generate.js:41-48,175-179`. Efeito: [HIPÓTESE] forte | **Alto** | P |
| D4 | Edição perdida ao sair: a limpeza do efeito cancela a gravação pendente (troca de viagem, fechamento da aba em menos de 900 ms) e não há gravação forçada em `pagehide` ou `visibilitychange`. | [FATO] `TripProvider.jsx:101`; grep sem `pagehide`/`visibilitychange`/`beforeunload` em `src/` | Médio | P |
| D5 | Migrações informais: não há `schemaVersion`. As migrações rodam a cada leitura e só são persistidas quando alguém edita, então o formato antigo fica no banco para sempre. `migrateParticipants` gera `uid()` novo a cada carga de dado legado, e cada cliente chega a ids diferentes. | [FATO] `state.js:69-79,104`; `generate.js:96-111` | Médio | P–M |
| D6 | Contenção num único documento: 2 a 6 pessoas gravando com debounce de 900 ms podem passar do limite sustentado de cerca de 1 escrita/s por documento. | [HIPÓTESE] limite documentado pelo Firestore, não verificado nesta sessão | Médio | — |
| D7 | Exclusão de viagem incompleta: apaga só `versions`. `comments`, `activity`, `presence` e `members` ficam órfãos, e as regras impedem apagar `activity`. A retenção de dados pessoais vai para o devsecops-engineer. | [FATO] `tripData.js:91-98`; `firestore.rules:95-97` | Médio | P |
| D8 | Tamanho: estimo cerca de 80 KB para 30 dias e 260 itens de ~300 B, pois anexos são só links. O limite de 1 MiB está longe. Mas `fieldOverrides` está vazio, então todo o `state` é indexado (o limite é de 40 mil entradas de índice por documento). Isentar `state` do índice. | [HIPÓTESE] estimativa; [FATO] `firestore.indexes.json:3` | Baixo | P |
| D9 | `listVersions` baixa o `state` completo de cada versão só para montar a lista. | [FATO] `tripData.js:116-119` | Baixo | P |

### 4.2 O modelo aguenta 2 a 6 pessoas editando?

**Não**, por D1 e D2. Num grupo de viagem, a edição simultânea é o caso normal (todos preenchendo o roteiro na mesma noite), não a exceção. Pior: o buffer de foco estica a janela de conflito por todo o tempo em que um campo fica selecionado. O modelo aguenta bem 1 editor com leitores, ou edição alternada.

### 4.3 Opções de evolução

| Opção | Como | Ganho | Custo e risco | Esf. |
|---|---|---|---|---|
| O0 Manter e mitigar | Corrigir D2 a D4, encurtar o buffer e gravar logo ao perder o foco | Reduz a frequência da perda | Não elimina D1(a) nem D1(c) | P |
| **O1 Mapas por id + atualização por campo (recomendada)** | Guardar `state.<tipo>.<id>` (mapa) com campo `ord`; gravar com `updateDoc` por caminho (`state.foodItems.<id>.cost`) e excluir com `deleteField()`. A conversão mapa ↔ array fica em `lib/tripData`, e o domínio continua recebendo arrays | Conflito só no mesmo campo do mesmo item. O cache do Firestore (compensação de latência) vira a fonte da verdade, e somem o eco por JSON, o buffer do estado inteiro e o debounce global (fica só um debounce por campo de texto) | Migração v1 → v2 (leitura dos dois formatos). Continua 1 documento e 1 leitura por abertura | M (4–6 dias) [HIPÓTESE] |
| O2 Subcoleção por item | `trips/{id}/items/{itemId}` | Granularidade máxima, sem teto de tamanho | 1 leitura por item ao abrir (~260 contra 1 hoje); versões e importação viram lotes de até 500 operações; geração automática exige ids determinísticos; regras mais complexas | G (2–3 semanas) |
| O3 Transação no documento | `runTransaction` por ação | Sem perda online | Transações exigem conexão: quebram o uso offline, requisito do produto | M — descartada |
| O4 CRDT (ex.: Yjs) | Documento CRDT persistido no Firestore | Fusão automática | Dependência nova, armazenamento binário, depuração difícil, sem necessidade demonstrada | G — descartada |

**Gatilho para O2:** documento acima de ~300 KB medido em produção, ou necessidade de permissão por item.

## 5. Gestão de estado (critério 3)

| # | Achado | Evidência | Sev. | Esf. |
|---|---|---|---|---|
| E1 | O valor do contexto é um objeto novo a cada render e inclui `presence`. Cada batida de presença de qualquer membro (a cada 15 s) re-renderiza os 21 consumidores, inclusive a `PrintView`, que monta a viagem inteira escondida a cada tecla. | [FATO] `TripProvider.jsx:110,303`; `App.jsx:148`; `PrintView.jsx:23-37` | Médio | P |
| E2 | Dois `structuredClone` por mutação, `ensureGenerated` completo a cada tecla e `JSON.stringify` do estado a cada snapshot e a cada gravação. | [FATO] `TripProvider.jsx:22,57,94,116-118`. Impacto: [HIPÓTESE] imperceptível no desktop, mensurável em Android de entrada | Baixo | P |
| E3 | Ações leem `state` de um fechamento antigo para montar rótulos do feed de atividade, que podem sair errados. | [FATO] `TripProvider.jsx:137,169,286` | Baixo | P |
| E4 | ~30 ações num só arquivo, mistura de API por índice e por id (`setRowField` usa id; `updateItem` usa índice). | [FATO] `TripProvider.jsx:122-300,278-284` | Médio | M |

**Recomendação, em ordem e sem biblioteca nova:**
1. **Memoização (P):** separar em 3 contextos: estado; ações estáveis (`useMemo`/`useRef`); presença. Renderizar a `PrintView` só em `beforeprint` ou ao pedir o PDF. Remover o clone duplicado.
2. **`useReducer` com reducer puro em `src/domain/tripReducer.js` (M):** ações por id (`{type:'item/update', kind, id, key, value}`). O reducer passa a ser testado no vitest que já existe, o que resolve C2, E3 e E4. O mesmo reducer prepara O1: cada ação também devolve os caminhos alterados.
3. Zustand, Redux ou Immer só se 1 e 2 não bastarem. Hoje não há evidência disso.

## 6. Dívida técnica estrutural (critério 4)

| # | Achado | Evidência | Sev. | Esf. |
|---|---|---|---|---|
| T1 | Sem tipos. O maior risco é o formato do `state`, com campos legados tolerados (`meio`, `custo`). Recomendo JSDoc `@typedef` com `// @ts-check` (`checkJs`) em `domain/`, `lib/` e `store/`, mais um JSON Schema versionado do estado, antes de migrar para TypeScript. A migração completa (M–G) não se paga agora. | [FATO] sem `tsconfig`/`jsconfig`; getters legados em `src/domain/transport.js` | Médio | P–M |
| T2 | Componentes grandes: `Dias.jsx` (510 linhas, 4 componentes), `Custos.jsx` (505, 6) e `Mais.jsx` (482, 8). O tamanho em si é sintoma; o problema real é C3. Dividir em pasta por tela quando cada uma for tocada, sem reescrever tudo de uma vez. | [FATO] contagem de linhas; `Mais.jsx:184-449`, `Custos.jsx:169-464` | Baixo | M |
| T3 | Documentação espalhada: 15 `DEPLOY-*.md` e 1 `PESQUISA-*.md` na raiz. As decisões estão enterradas em guias de deploy. O README está desatualizado: diz "Fase 1", descreve o modelo `users/{uid}` de um só usuário, cita um `deploy.yml` que não existe e fala em "10 telas" e "22 testes". | [FATO] `README.md:7,23-31`; `DEPLOY-FASE2.md:162`; `DEPLOY-FASE5-ESTRUTURAL.md:99-111` | Médio | P |
| T4 | Versão fixa `1.0.0` no `package.json` e em `APP_VERSION`, apesar de muitas entregas. O feedback dos usuários sai sem versão real. Não há CHANGELOG. | [FATO] `package.json:4`; `tripData.js:19` | Baixo | P |
| T5 | O lint não roda no CI e não há arquivo de configuração do ESLint. O store não tem testes. O E2E não tem cenário com 2 usuários. O deploy na `main` roda só testes de domínio e build, sem regras nem E2E (encaminhar ao devsecops-engineer). | [FATO] `qualidade.yml:39-68`; `package.json:13`; `e2e/fluxos-criticos.spec.js:59-237`; `firebase-hosting-merge.yml:13` | Médio | P |

## 7. Requisitos não funcionais (critério 5)

**Lacunas sem número:** usuários simultâneos por viagem, tamanho típico de uma viagem, aparelho mínimo, plano de cobrança do Firebase (Spark ou Blaze; o login por celular sugere Blaze, `DEPLOY-LOGIN-CELULAR-CONFIG.md:14-18`) e orçamento mensal.

| # | Achado | Evidência | Sev. | Esf. |
|---|---|---|---|---|
| R1 | **Offline:** persistência multiaba bem configurada, mas, combinada com D1(c), vira o principal vetor de perda. O cache `NetworkFirst` do Workbox para `firestore.googleapis.com` é redundante e pode devolver respostas velhas do canal de streaming; remover. O aviso "Salvando…" fica preso enquanto offline, porque a promessa só resolve com a confirmação do servidor; falta distinguir "salvo no aparelho" de "erro". | [FATO] `firebase.js:39-41`; `vite.config.js:36-45`; `App.jsx:83`; `TripProvider.jsx:95-96`. Cache: [HIPÓTESE] | Médio | P |
| R2 | **Atualização do PWA:** `autoUpdate`, telas carregadas sob demanda e o rewrite `**` → `index.html`. Depois de um deploy, uma aba aberta pode pedir um chunk antigo e receber HTML ("Failed to fetch dynamically imported module"). Tratar o erro de import com recarga. | [FATO] `vite.config.js:12`; `App.jsx:14-18`; `firebase.json:9-14`. Efeito: [HIPÓTESE] | Médio | P |
| R3 | **Custo do Firestore** (estimativa abaixo). Presença: 4 gravações/min por membro; cada uma custa 1 escrita, mais 1 leitura do `get()` da regra, mais 1 leitura por ouvinte. Comentários: um `onSnapshot` por item visível, reaberto a cada troca de dia. Atividade e mensagens leem a coleção inteira e cortam no cliente, então crescem sem limite. | [FATO] `TripProvider.jsx:104-112`; `firestore.rules:17-21,74-77`; `CommentThread.jsx:13-16` com `Dias.jsx:273,293,311`; `tripData.js:250-258,303-311` | Médio | P |
| R4 | **Observabilidade:** o logger só guarda em memória (some ao recarregar). A falha de gravação vai para `console.error`, não para `logError`, então não aparece no Diagnóstico nem para o usuário. Não há coleta remota de erros. Analytics está bem feito. | [FATO] `logger.js:6-8`; `TripProvider.jsx:97-98`; `DiagnosticsModal.jsx:2` | Médio | P |
| R5 | **Desempenho:** funções de domínio de ordem itens × datas recalculadas sem memoização a cada render, em várias telas ao mesmo tempo (ver também E1). | [FATO] `Dias.jsx:42`; `PrintView.jsx:25-26`; `Mais.jsx:35-37`. Impacto: [HIPÓTESE] aceitável até centenas de itens | Baixo | P |

**Estimativa de custo** [HIPÓTESE, a confirmar no console de uso]: 6 pessoas por 1 hora geram ≈ 1.440 escritas e ≈ 10.080 leituras só com presença (1.440 × 6 ouvintes + 1.440 leituras das regras). A cota gratuita diária é de 50 mil leituras e 20 mil escritas (não verificada nesta sessão), então cerca de 5 horas de sessão de grupo esgotariam a cota de leituras. Mitigações P: batida a cada 60 s, pausada com `document.hidden`; `orderBy` + `limit` em atividade e comentários; um único listener de comentários por viagem (`subscribeAllComments` já existe), agrupado em memória. Alternativa M: presença no Realtime Database com `onDisconnect`, que é o padrão do Firebase; exige avaliar custo, porque é um produto novo.

## 8. Reescrita de stack?

**Não recomendada.** O problema é o formato do dado, não React, Vite ou Firebase. Uma troca (ex.: Supabase/Postgres com sincronização própria) custaria G+, perderia o offline pronto do Firestore e refaria auth, regras e testes, sem ganho que O1 não entregue por M.

## 9. Evolução em 3 horizontes

**H1 Correções (1 a 2 semanas; cada item P, salvo indicação)**
1. D3: datas em UTC de ponta a ponta (`T00:00Z`, `setUTCDate`), com teste rodando em `TZ=Asia/Tokyo`.
2. D2: todas as ações e folhas por id, eliminando o índice (M).
3. D4: gravar na hora na desmontagem, em `pagehide` e em `visibilitychange`.
4. E1: 3 contextos e `PrintView` só ao imprimir.
5. R3: presença a 60 s com pausa em aba oculta; `limit` em atividade e comentários; listener único de comentários.
6. R4: falha de gravação passa por `logError` e mostra o estado na tela (o texto fica com ux-research).
7. R2: recarga em erro de chunk; R1: remover o `runtimeCaching` do Firestore.
8. C4: remover o código morto. T5: lint no CI. D7: exclusão completa, com o devsecops-engineer.

**H2 Consolidação (2 a 4 semanas)**
1. `useReducer` com reducer puro e testado em `src/domain/` (C2, E3, E4).
2. JSDoc com `checkJs`, mais o JSON Schema do estado com `schemaVersion` e uma rotina única de migração (T1, D5).
3. ADRs retroativos em `docs/adr/` (stack Firebase, estado em documento único, convites por e-mail, anexos por link, OSM/Nominatim, PWA). Mover os `DEPLOY-*.md` para `docs/historico/`, reescrever o README, criar CHANGELOG e versão real (T3, T4).
4. Teste E2E com 2 contextos de navegador editando ao mesmo tempo. Ele prova D1 hoje e protege O1 depois.
5. Dividir Dias, Custos e Mais por pasta, conforme forem tocadas (T2, C3).

**H3 Próxima arquitetura (4 a 6 dias de implementação, mais migração)**
- O1: mapas por id e `updateDoc` por caminho de campo; migração preguiçosa v1 → v2. O cache local do Firestore passa a ser a única fonte da verdade, e saem o eco por JSON, o buffer do estado inteiro e o debounce global. O2 fica em espera até o gatilho de tamanho ou de permissão por item.

## 10. Decisão para ADR

**ADR-0001: Modelo de sincronização da viagem.** Contexto: D1, D2 e o requisito de 2 a 6 editores com uso offline. Opções: O0 a O4 (seção 4.3). **Decisão proposta:** O1, documento único com itens em mapas por id e atualização por campo, `schemaVersion: 2`. Consequências: conflito restrito ao mesmo campo do mesmo item; 1 leitura por abertura, como hoje; a camada `lib/tripData` passa a converter os formatos; versões e importação gravam o formato v2. **Reversão:** durante 2 versões, o app lê v1 e v2. Para voltar, basta gravar o `state` inteiro no formato v1, cuja conversão já existe. Nenhum dado é apagado na migração. **Verificação:** o E2E de 2 usuários do H2 passa sem perda em edição simultânea de itens diferentes e após reconexão offline. Exige aprovação do usuário (gate G2: mudança de modelo de dados).

## 11. Não verificado nesta sessão

- Limites e cotas do Firestore (1 MiB, 40 mil entradas de índice, ~1 escrita/s por documento, 50 mil leituras e 20 mil escritas diárias no plano gratuito, cobrança do `get()` nas regras, transações offline): `firebase.google.com` está fora da rede permitida, e `npmjs.com` respondeu 403. Conferir em https://firebase.google.com/docs/firestore/quotas e https://firebase.google.com/pricing.
- Versões atuais e manutenção de `firebase` (^10.12.2), `react` (^18.3.1), `vite` (^5.3.1) e `vite-plugin-pwa`: rodar `npm outdated`. A situação do `xlsx@0.18.5` (pacote npm sem atualização, possíveis alertas de segurança) fica com o devsecops-engineer: `npm audit`.
- D1/D2: dois navegadores (ou 2 contextos do Playwright) na mesma viagem. Editar itens diferentes em menos de 1 s; manter um campo em foco enquanto o outro edita; editar offline e reconectar. Conferir no console do Firestore qual versão ficou.
- D2 com um usuário: abrir uma cidade, mudar o check-in para antes da primeira cidade e ver se a folha troca de cidade.
- D3: `TZ=Asia/Tokyo npx vitest run src/domain` e `TZ=Europe/Lisbon` com datas de julho.
- R3: medir leituras e escritas por hora no painel de uso com 2 a 3 contas abertas.
- E1/E2: React Profiler numa viagem de 30 dias, em celular Android de entrada.
- R2: deploy de prévia com uma aba antiga aberta, depois trocar de tela.
