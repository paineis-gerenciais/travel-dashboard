# Parecer de arquitetura e manutenção — travel-dashboard

- Data: 2026-11-07 · Autor: software-architect (Prumo) · Modo: somente leitura, sem terminal
- Demanda: diagnóstico de maturidade (sem issue, por decisão do usuário) · N2
- Base: leitura do código em `/home/user/travel-dashboard` + fatos medidos pelo Head na mesma sessão (testes, build, CI, código morto, documentação)
- Fora de escopo: segurança das regras do Firestore (outro parecer), UX e acessibilidade (QA), funcionalidade nova, troca de stack

## 0. Veredito em uma frase

A base é boa e merece ser preservada: domínio puro bem testado, porta única ao Firestore e build enxuto. O ponto fraco é a camada de sincronização: ela grava a viagem inteira sem controle de concorrência e não tem nenhum teste. Em volta disso, a rede de segurança (CI, lint, versão, documentação) está quebrada ou desatualizada. Para evoluir por 6 meses, conserte a rede de segurança primeiro (1 a 2 dias). Depois corrija a concorrência (2 a 4 dias). Não reescreva nada.

## 1. O que está bom e deve ser preservado (com evidência)

| Ponto forte | Evidência |
|---|---|
| Domínio puro e testado: regras de custo, datas, geração e cascata ficam em `src/domain` e não importam Firebase, React nem `lib/` | [FATO] grep de imports: nenhum arquivo de `src/domain/*.js` importa `lib/` ou `firebase/`; 111 testes em 1,2 s (medido pelo Head) |
| Porta única ao Firestore | [FATO] `firebase/firestore` só é importado em `src/lib/tripData.js:10-14` e `src/lib/firebase.js:16-21`, além do teste de regras. Única exceção da camada: `SettingsSheet.jsx:2-3` usa `firebase/auth` direto (é Auth, não Firestore; desvio pequeno) |
| Migração de esquema na leitura, idempotente | [FATO] `src/domain/state.js:69-133` (`normalizeState` e `migrateParticipants`): troca nome por id estável sem script de migração |
| Código de teste isolado do bundle de produção | [FATO] `src/lib/firebase.js:54-67` sob `VITE_USE_EMULATORS`; `qualidade.yml:53-59` confere que o bundle sai limpo |
| Carregamento sob demanda | [FATO] telas com `lazy()` em `App.jsx:14-18`; xlsx em chunk separado, carregado sob demanda; `manualChunks` em `vite.config.js:49-57` |
| Testes de regras no emulador | [FATO] 17 testes, `npm run test:rules` verde em 6,4 s (medido pelo Head) |
| Escrita esparsa do feed de atividade (não grava cada tecla) | [FATO] `tripData.js:232-248`; `TripProvider.jsx:135-139` |
| Limitações registradas de propósito | [FATO] `DEPLOY-FASE2.md:153-170`. O registro é incompleto (ver Achado 1), mas a prática é boa |

[RECOMENDAÇÃO] Preserve as três fronteiras: `domain` puro, `tripData.js` como única porta ao banco e telas com carregamento sob demanda. Toda correção abaixo cabe dentro delas.

## 2. Achados (máximo 5)

### Achado 1 — [Alto] Gravação da viagem inteira, sem controle de concorrência: "a última gravação vence" vale para a viagem toda, não só para o mesmo campo

- **Evidência**
  - [FATO] `src/lib/tripData.js:100-102`: `saveTripState` faz `updateDoc` com `{ state }`, ou seja, substitui o mapa `state` inteiro. Não há transação, pré-condição nem contador de revisão.
  - [FATO] `src/store/TripProvider.jsx:88-102`: depois de 900 ms sem mudança, cada cliente grava o seu `state` local completo.
  - [FATO] `TripProvider.jsx:41-45` e `:61`: quando chega um snapshot remoto e não há campo com foco, ele substitui o estado local. Mudanças locais ainda não gravadas (dentro da janela de 900 ms) são descartadas. A troca de `state` também cancela o timer de gravação pendente (cleanup na linha 101), e o efeito seguinte sai cedo porque `suppress` está ligado (linha 89).
  - [FATO] `TripProvider.jsx:60` e `:71-77`: durante a edição de um campo, o snapshot remoto fica guardado em `pendingRemote` e é aplicado no blur, por cima do que foi digitado depois.
  - [FATO] Itens são editados pela **posição na lista**, não pelo id: `updateItem(arrName, index, …)` em `TripProvider.jsx:123-127`; `deleteItem` na linha 141; o editor guarda `{ kind, index }` em `Dias.jsx:192-198`. Se outra pessoa remove ou insere um item antes, o mesmo índice passa a apontar para outro item. (`setRowField`, em `:278-284`, já usa id: o padrão certo existe no próprio código.)
  - [FATO] A documentação descreve só o caso "mesmo campo no mesmo instante" (`DEPLOY-FASE2.md:162-165`). O teste manual de aceite verifica apenas que o texto digitado não some no meio (`:128-129`). Ele não confere se a mudança da outra pessoa sobreviveu.
- **Quem é afetado:** grupos de 2 ou mais pessoas editando a mesma viagem ao mesmo tempo, que é justamente o uso que presença, comentários e convites incentivam. A perda é silenciosa: ninguém recebe aviso.
- **Correção mínima (sem trocar de stack nem de modelo de documento)**
  1. Corrigir a documentação para dizer o comportamento real. Esforço: 15 min.
  2. Trocar índice por id nas ações de item (`updateItem`, `deleteItem`, o editor em `Dias.jsx`), seguindo o padrão de `setRowField`. Esforço: 2 a 4 h.
  3. "Rebase" das operações locais: guardar numa fila as funções de `mutate` ainda não confirmadas. Ao chegar um snapshot remoto, aplicar a fila sobre ele em vez de descartar ou adiar. Gravar com um contador `rev`. Esforço: 1,5 a 3 dias, com teste. A opção e as alternativas estão em "Decisões pendentes".
- **Reversão:** os passos 2 e 3 ficam restritos a `TripProvider.jsx`, `tripData.js` e `Dias.jsx`. O campo `rev` é aditivo e versões antigas do app o ignoram. Reverter é reverter o commit.

### Achado 2 — [Médio] Publicação sem portão de qualidade e dependente de uma pessoa e uma máquina

- **Evidência**
  - [FATO] `firebase-hosting-merge.yml:4-7,13,21-26` publica em `live` a cada push na `main` e roda só `npm test` (domínio) e o build.
  - [FATO] `qualidade.yml` (regras, E2E, bundle limpo) não é pré-requisito do deploy e falhou nas 10 execuções (dado do Head). A `main` não tem proteção de branch.
  - [FATO] Instalação, testes de domínio e build rodam 2 vezes por evento: `qualidade.yml:33-43` + `firebase-hosting-merge.yml:13` no push, e `qualidade.yml` + `firebase-hosting-pull-request.yml:15` no PR. O build roda 4 vezes dentro de `qualidade.yml` (linhas 42-59).
  - [FATO] As regras do Firestore são publicadas à mão (`DEPLOY-FASE2.md:85-97`, `DEPLOY-FASE5-ESTRUTURAL.md:55-63`), da máquina Windows do único autor (31 commits, 1 autor, segundo o Head). Os próprios guias dizem que, se as regras não subirem antes do app, comentários e atividade falham com erro de permissão (`DEPLOY-FASE5-ESTRUTURAL.md:61-63`).
- **Quem é afetado:** todos os usuários, que recebem regressões sem barreira. O desenvolvedor também: sem a máquina dele, ninguém publica regras.
- **Correção mínima**
  1. Deixar `qualidade.yml` verde. Primeiro diagnosticar as 10 falhas (log do Actions). Esforço: 2 h a 1 dia, conforme a causa.
  2. Fazer o deploy depender da qualidade: juntar a qualidade como job anterior no `firebase-hosting-merge.yml` (`needs:`) e apagar a duplicação. Esforço: 1 a 2 h.
  3. Proteger a `main` exigindo o check (linha vermelha: precisa de autorização do usuário).
  4. Publicar as regras pelo CI (`firebase deploy --only firestore:rules` no job de merge), antes do deploy do Hosting. A permissão da conta de serviço vai para o devsecops-engineer. Esforço: 2 a 4 h.
- **Reversão:** editar os YAML de volta. A proteção de branch se desliga nas configurações.

### Achado 3 — [Médio] A camada de sincronização não tem testes; a força dos testes está só no domínio

- **Evidência**
  - [FATO] `package.json:11`: `"test": "vitest run src/domain"`. O que roda no CI de deploy não alcança `src/store` nem `src/lib`.
  - [FATO] Não existe teste para `TripProvider.jsx` (debounce, filtro de eco em `:58`, buffer em `:60`, `suppress` em `:36/42-44/89`), que é a lógica mais delicada do app.
  - [FATO] Os 9 testes do E2E (`e2e/fluxos-criticos.spec.js:64-237`) usam um único usuário e uma única página. Nenhum abre dois contextos de navegador, então tempo real e concorrência não são testados.
  - [FATO] O lint não roda: não existe arquivo de configuração do ESLint (exit 2, medido pelo Head), embora `package.json:13,29-31` declare o script e os plugins. Sem `eslint-plugin-react-hooks` ativo, dependências erradas de `useEffect`/`useCallback` passam sem alerta (ex.: `actions` lê `state` por closure em `TripProvider.jsx:137,169,286`).
- **Quem é afetado:** o desenvolvedor e quem vier depois. Mexer no Achado 1 sem teste é mexer às cegas.
- **Correção mínima**
  1. Criar `.eslintrc.cjs` com `react` e `react-hooks` e incluir `npm run lint` no CI. Esforço: 2 a 4 h, incluindo os avisos que aparecerem.
  2. Extrair a lógica de sincronização para um módulo puro (ex.: `src/store/syncCore.js`) e testá-lo com vitest, sem React. Esforço: 1 dia.
  3. Criar um E2E com dois contextos (roteiro na seção 4). Esforço: 3 a 5 h.
- **Reversão:** só acrescenta arquivos de teste e configuração.

### Achado 4 — [Médio] Código morto e entrega por "zip extraído por cima" do repositório

- **Evidência**
  - [FATO] Código morto, segundo o Head: 8 telas antigas em `src/components/screens/` (Alimentacao, Atracoes, Checklist, Outras, Resumo, Roteiro, Transporte, PorDia; 870 linhas), além de `EmbeddedMap.jsx` e `src/lib/geocode.js`.
  - [FATO] A causa está registrada: `DEPLOY-REDESIGN.md:51` ("`-A` é importante: há arquivos REMOVIDOS") e `:101-102` ("ao extrair um zip velho por cima"); `qualidade.yml:5-7` ("`deploy.yml` reaparecendo pelo zip"). As mudanças entram por pacote extraído sobre a pasta, e arquivos removidos voltam.
  - [FATO] `README.md:23-24,79` ainda fala em "10 telas", e as telas mortas reforçam essa leitura errada.
- **Quem é afetado:** quem mantém o app, inclusive agentes de IA, que leem as telas mortas como vivas e podem corrigir ou evoluir o arquivo errado.
- **Correção mínima:** apagar os 10 arquivos, rodar build e E2E e confirmar que nada quebra (1 a 2 h). Trocar o fluxo de zip por branch + PR (ou `git apply` de patch), que registra remoções. Esforço: decisão de processo, 0 h de código.
- **Reversão:** `git revert`.

### Achado 5 — [Médio] Sem rastro de versão: documentação desatualizada e versão fixa em 1.0.0

- **Evidência**
  - [FATO] `package.json:4` e `tripData.js:19` estão fixos em `1.0.0`. `APP_VERSION` vai junto com cada feedback (`tripData.js:295`), então todo relato chega marcado "1.0.0" e não indica em qual versão o problema aconteceu.
  - [FATO] `README.md:19,71` (diz 22 testes, são 111), `:30-31` (`deploy.yml` não existe), `:7-9` (cita arquivos ausentes), `:25-27` (descreve o modelo antigo `users/{uid}`, substituído na Fase 2). `src/lib/invite.js:12` e `src/lib/phoneAuth.js:8` citam guias que não existem.
  - [FATO] Faltam CHANGELOG, tags, `docs/`, ADR e `CLAUDE.md`. Os 17 `DEPLOY-*.md` na raiz fazem papel de changelog e de manual ao mesmo tempo.
- **Quem é afetado:** o desenvolvedor, ao triar feedback; qualquer pessoa nova no projeto, ao se orientar.
- **Correção mínima**
  1. `APP_VERSION` passa a vir do `package.json` via `define` do Vite. Esforço: 30 min.
  2. Criar `CHANGELOG.md` (Keep a Changelog) a partir dos `DEPLOY-*.md`, mover esses guias para `docs/historico/` e marcar a versão atual (sugestão: `v1.x` → `v2.0.0`; a tag é linha vermelha). Esforço: 2 a 4 h.
  3. Reescrever o README com a estrutura real e criar o `CLAUDE.md` com a tabela "Verificação por área". Esforço: 2 h.
  4. Registrar ADRs retroativos curtos: documento único por viagem; Firebase/PWA; geocodificação sem chave. Esforço: 2 h.
- **Reversão:** só documentação.

## 3. Avaliação por critério pedido

- **Acoplamento e camadas:** saudável. `domain` → nada; `lib/tripData` → Firestore; `store` → `lib` + `domain`; componentes → `store`, mas também chamam `lib/tripData` direto para coleções secundárias (`VersionsModal.jsx:6`, `ShareModal.jsx:2`, `CommentThread.jsx:2`, `ActivityFeed.jsx:2`, `MessagesSheet.jsx:3`, `Mais.jsx:15`). [RECOMENDAÇÃO] Nesse tamanho, aceitável. Não criar uma camada nova só por pureza.
- **Duplicação:** sobretudo no CI (Achado 2) e na documentação (README × DEPLOY-*.md). Portas dos emuladores definidas em dois lugares: `firebase.js:55-56` e `firebase.json:41-50`. Risco baixo; não entrou nos achados.
- **Dependência de uma pessoa ou máquina:** Achado 2 (regras manuais, 1 autor, Windows/OneDrive segundo `DEPLOY-PLANILHA.md:197-205`).
- **Limites do documento único** (`trips/{id}.state`)
  - *1 MiB por documento:* [HIPÓTESE] uma viagem de 30 dias com cerca de 300 itens de 250 a 400 bytes cada dá algo entre 75 e 120 kB. Isso deixa uma folga de quase 10 vezes. Anexos são links (`settings.documents`, `state.js:57-59`), e comentários e atividade estão em subcoleções. Não é risco para os próximos 6 meses. Não há medição do tamanho real. [RECOMENDAÇÃO] Registrar `JSON.stringify(state).length` no Diagnóstico e avisar acima de 500 kB (1 a 2 h). Assim a decisão de dividir o documento passa a se basear em número.
  - *Custo de leitura e escrita:* [FATO] 1 escrita a cada pausa de 900 ms na digitação; presença grava a cada 15 s por aba aberta (`TripProvider.jsx:109`, `tripData.js:260-266`), ou seja, até 5.760 escritas por dia para uma aba aberta 24 h. `subscribeMyTrips` (`tripData.js:39-57`) baixa o documento inteiro, com `state`, de todas as viagens do usuário a cada mudança. [HIPÓTESE] Cada gravação gera leitura em 2 listeners por membro (viagem e lista). Com poucos usuários fica dentro da cota gratuita. A cota e o plano (Spark ou Blaze) não foram verificados (ver seção 5).
  - *Concorrência:* Achado 1. É o limite real do modelo hoje, e não o tamanho.
  - *Versões:* [FATO] copiam o `state` inteiro (`tripData.js:121-131`). Isso é aceitável. `deleteTrip` (`:91-98`) apaga só `versions`; `members`, `comments`, `activity` e `presence` ficam órfãos. Risco baixo de armazenamento; vai para o backlog.
- **Estratégia de testes:** domínio forte (111), regras razoáveis (17), integração e sincronização inexistentes, E2E só com um usuário e sem portão no deploy (Achados 2 e 3).
- **CI:** Achado 2.
- **Padrão `paineis-gerenciais/padroes`:** **não se aplica**. O travel-dashboard é um app de planejamento colaborativo, não um painel gerencial de indicadores.

## 4. A confirmar (hipóteses; não são achados)

**H1 — Hipótese do Head sobre perda silenciosa com foco no campo.** A leitura do código é **consistente** com a hipótese, com uma correção.

Passo a passo:
1. B está com foco no campo X.
2. Chega o snapshot de A. A linha 58 não o reconhece como eco. A linha 59 grava `lastSyncedJson` = estado de A. A linha 60 põe esse estado em `pendingRemote`.
3. B continua digitando. Depois de 900 ms, a linha 94 marca o estado de B como sincronizado e a linha 95 grava o `state` inteiro de B, sem a mudança de A. A mudança de A some do banco. Quando o snapshot chega ao cliente de A e A não está editando, A também a perde na tela.
4. No blur (linhas 71-77), `applyRemote` aplica o estado de A. As teclas que B digitou depois do passo 2 somem da tela.
5. Não há nova gravação nesse momento, porque `suppress` está ligado (linhas 42 e 89). [HIPÓTESE] Isso depende de o efeito rodar antes do `setTimeout(0)`.

A tela de B (com A e sem as teclas novas) e o banco (com B e sem A) ficam diferentes. **Correção à hipótese:** a edição de B não "volta na próxima gravação". A próxima gravação de B parte da tela, então as teclas novas de B se perdem de vez e a mudança de A volta ao banco.

- *Teste que confirma (Playwright, 2 contextos, emulador):*
  1. Contexto A e contexto B abrem a mesma viagem.
  2. B foca o campo "hotel" da cidade 1.
  3. A altera o subtítulo e espera o indicador "salvo" (`dirty=false`).
  4. B digita "XYZ" e espera 2 s.
  5. B tira o foco do campo.
  6. Um terceiro contexto recarrega a viagem e verifica se o subtítulo de A e o "XYZ" de B estão presentes.
  - Esperado pela hipótese: falha (falta o subtítulo de A, e na tela de B falta "XYZ").

**H2 — Perda sem foco dentro da janela de 900 ms.** B clica em um botão (ex.: "adicionar cidade"). Antes de a gravação de B sair, chega o snapshot de A. A linha 61 substitui o estado e a adição de B some.
- *Teste:* igual ao anterior, com A gravando logo depois do clique de B. Verificar se a cidade de B existe no banco.

**H3 — Falha do filtro de eco com um único usuário.** Se o Firestore devolver as chaves dos mapas em ordem diferente da ordem gravada, `JSON.stringify` (linhas 57-58 × 94) não reconhece a própria gravação. Com campo em foco, o eco iria para `pendingRemote` e, no blur, desfaria as teclas digitadas depois daquela gravação.
- *Teste:* 1 contexto. Focar um campo, digitar "abc", esperar 2 s, digitar "def", tirar o foco, recarregar e verificar se o valor é "abcdef". Também é possível pôr um `console.count` temporário na linha 60 e conferir se ele dispara sem um segundo usuário.

**H4 — Cache do service worker sobre o Firestore.** `vite.config.js:36-45` aplica `NetworkFirst` a `firestore.googleapis.com`. O canal de escuta do Firestore é um fluxo longo. Guardá-lo em cache é, no mínimo, inútil, porque o SDK já tem persistência própria (`firebase.js:39-41`). Offline, pode até devolver uma resposta velha ao canal.
- *Teste:* DevTools → Application → Cache Storage → `firestore-cache`. Verificar se há entradas. Depois abrir o app offline e ver se aparecem erros do canal Listen no console.
- [RECOMENDAÇÃO] Se houver entradas, remover o bloco `runtimeCaching` (30 min).

## 5. O que este parecer não verificou e por quê

Eu não tenho terminal, navegador nem rede.
- Não executei nenhum teste. Os números de testes, build e CI são do Head.
- Não reproduzi H1 a H4 (os roteiros estão acima).
- Não li os logs das 10 falhas do `qualidade.yml`. O Head pode ver com `gh api repos/{owner}/{repo}/actions/workflows/qualidade.yml/runs?per_page=10` e o log do job.
- Não verifiquei as cotas atuais do Firestore nem o plano do projeto `plano-viagem-certa`. Fonte: https://firebase.google.com/pricing e Console → Uso e faturamento.
- Não medi o tamanho real dos documentos `trips/*`. Procedimento: Console do Firestore, ou `JSON.stringify(state).length` no DevTools com uma viagem real.
- Não confirmei a lista de código morto além da checagem dos imports. Procedimento: apagar os arquivos e rodar `npm run build && npm run test:e2e`.

## 6. O que falta para "evoluir nos próximos 6 meses" — sequência recomendada

| Ordem | O quê | Achado | Esforço | Quem |
|---|---|---|---|---|
| 1 | CI verde, deploy dependente da qualidade, lint configurado, código morto removido | 2, 3, 4 | 1 a 2 dias | backend/frontend-engineer; devsecops (permissão das regras no CI) |
| 2 | Testes da sincronização (módulo puro + E2E com 2 contextos) confirmando ou refutando H1 a H3 | 3 | 1 a 1,5 dia | frontend-engineer + qa-engineer |
| 3 | Concorrência: ids em vez de índices + rebase de operações com `rev` | 1 | 2 a 4 dias | frontend-engineer; ADR pelo software-architect |
| 4 | Rastro: CHANGELOG, SemVer automático no `APP_VERSION`, README, CLAUDE.md, ADRs retroativos | 5 | 1 dia | Head + software-architect |

Não fazer agora, por falta de necessidade demonstrada: dividir o documento em subcoleções por item, adotar biblioteca de estado, migrar para TypeScript ou criar backend próprio. Volte a avaliar só se a medição de tamanho passar de 500 kB ou se o rebase não resolver os conflitos observados.
