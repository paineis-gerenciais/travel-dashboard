# Revisão cruzada de segurança: branch `fix/17-regras-convite-acesso` (issue #17)

- **Responsável:** devsecops-engineer · **Data:** 2026-11-10 · **Modo:** somente leitura (git diff/show) + emulador avulso na porta 8282
- **Commits revisados:** `f235fba` fix(rules) e `2e915ac` fix(ui), sobre `main`
- **Base:** parecer de 2026-11-07 (`parecer-seguranca.md`, achados A1, A2, A4 e testes T1 a T11)

## Veredito: **reprovado**, por um achado alto de correção pequena

Quase tudo que a issue pedia foi fechado. O convite agora só vale se estiver pendente. Ele precisa ter sido criado pelo dono e o e-mail precisa estar verificado. A autoria de comentários e da atividade passou a ser conferida. Só o dono grava `role: 'owner'` e só o dono apaga versões. Os pontos 2, 3, 4 e 5 da delegação estão corretos (provas abaixo).

Resta uma falha. **A revogação ainda depende do cliente.** O cliente apaga o convite usando um e-mail que pode faltar ou que o próprio membro controla. Um convidado que entra sem marcar o convite como aceito volta sozinho depois de removido (R1). A correção nas regras é pequena (1 a 2 h, com os testes) e já foi validada no emulador (seção "Correção proposta").

## Evidência de escopo
```
$ git -C /home/user/travel-dashboard diff --stat main...fix/17-regras-convite-acesso
 firestore.rules                   |  69 ++++++++++----
 src/components/ShareModal.jsx     |  38 +++++---
 src/components/TripPicker.jsx     |  38 ++++++++
 src/components/VersionsModal.jsx  |   8 +-
 src/lib/tripData.js               |  13 ++-
 src/rules/__tests__/rules.test.js | 183 +++++++++++++++++++++++++++++++++++++-
 src/store/TripsProvider.jsx       |   2 +-
 src/store/useAuth.js              |   4 +
 8 files changed, 326 insertions(+), 29 deletions(-)
```
- Script de provas: `docs/prumo/revisao-pr-37/provas.cjs`. Saída: `docs/prumo/revisao-pr-37/saida.txt`. Resultado: 32 cenários, 30 conforme o esperado e 2 divergentes (R1c e R1d, a brecha).
- Proposta de correção: `docs/prumo/revisao-pr-37/firestore.proposta.rules` e `proposta.cjs`. Saída: `saida-proposta.txt` na mesma pasta (6 de 6 conforme o esperado).
- Ambiente: emulador `cloud-firestore-emulator-v1.22.0.jar` em 127.0.0.1:8282, com as regras extraídas por `git show fix/17-regras-convite-acesso:firestore.rules`. Os scripts replicam `acceptPendingInvites`, `ShareModal` e `revokeMember` do branch. O emulador foi encerrado ao final, com a porta 8282 livre.

## Achados

### R1 · Alto · Quem entra sem marcar o convite como aceito volta sozinho depois de removido
- **[FATO] Regra:** a auto-inclusão (regra C, `firestore.rules:69-76`) exige convite `pendente`. Ela **não** exige que o convite seja marcado como `aceito` na mesma operação. O cliente faz três gravações em sequência (`src/lib/tripData.js:180-186`), mas nada obriga quem usa o SDK ou a API REST a fazer a terceira.
- **[FATO] Cliente:** a remoção apaga o convite pelo e-mail `emailDoConvite(uid) || m?.email` (`src/components/ShareModal.jsx:45` e `:83`). `emailDoConvite` procura `acceptedByUid === uid`. Sem convite aceito, o cliente usa `members/{uid}.email`, que o próprio membro grava (P1a) ou nem cria. Em `revokeMember` (`tripData.js:206-209`), sem e-mail, nada é apagado, e a falha de exclusão é engolida.
- **[FATO] Emulador:**
  - R1a: X se inclui pelo SDK só com `arrayUnion` → PERMITIDO.
  - R1b: a remoção pelo fluxo do app usou o e-mail `null`. O convite de X continuou `pendente`.
  - **R1c: X volta sozinho → PERMITIDO.**
  - **R1d:** com `members.email` falso, o app apagou `trip1_qualquer@...`. **X volta → PERMITIDO.**
- **Quem é afetado e como:** o dono que remove um convidado mal-intencionado. É a mesma ameaça de A1: o ex-membro continua lendo roteiro, custos e links de documentos e editando a viagem.
- **Atenuantes [FATO]:**
  - A pessoa aparece em "Com acesso", como "Membro sem perfil" ou com o nome falso (`ShareModal.jsx:74-78`).
  - O convite dela aparece em "Convites pendentes". O dono pode clicar em "Cancelar" e depois em "Remover", mas a interface não indica isso.
  - O ataque exige preparo, com uso do SDK ou da API antes do primeiro login no app.
  - **[HIPÓTESE]** Também acontece sem malícia: se a gravação de `members` falhar depois da gravação da viagem (`tripData.js:180-185`), a próxima remoção não apaga o convite. A pessoa volta no login seguinte pelo próprio `acceptPendingInvites`.
- **Correção [RECOMENDAÇÃO]:** ver "Correção proposta". Esforço: regras de 0,5 h, cliente de 0,5 h e testes de 1 h. **Responsável:** frontend-engineer. O devsecops confere.

### R2 · Médio · Ao reabrir o app depois de confirmar o e-mail, o aceite falha em silêncio por até 1 hora
- **[FATO] SDK** (`node_modules/firebase/node_modules/@firebase/auth/dist/esm2017/index-68602d24.js`, `@firebase/auth` 1.7.9):
  - Na inicialização, `reloadAndSetCurrentUserOrClear` → `_reloadWithoutSaving` (linhas 2758-2760 e 1450-1482) atualiza `user.emailVerified` a partir do servidor.
  - Mas ela chama `getIdToken()` sem forçar a renovação. `getToken` devolve o token em cache enquanto ele não expira (linhas 1607-1610 e 1589-1591). A claim `email_verified` do token continua `false` por até cerca de 1 hora.
- **[FATO] Efeito:**
  - `acceptPendingInvites` passa pela trava do cliente (`tripData.js:173`, `user.emailVerified === true`).
  - A query é negada pelas regras: P4c, token não verificado com `where emailConvidado ==` → NEGADO.
  - O erro é engolido (`TripsProvider.jsx:36`).
  - O aviso some, porque `precisaConfirmar` é falso (`TripPicker.jsx:41`).
  - O efeito não roda de novo, porque `emailVerified` não muda na sessão (`TripsProvider.jsx:47`).
  - A pessoa só ganha acesso ao reabrir o app depois que o token for renovado.
- **Quem é afetado:** quem cria conta por e-mail e senha, confirma pelo link em outra aba ou no celular e volta ao app. É exatamente o caminho mais comum. Não há risco de segurança, mas o fluxo legítimo quebra.
- **Correção [RECOMENDAÇÃO]:** em `acceptPendingInvites`, ou no `onAuthStateChanged` de `useAuth.js:23`, conferir `(await auth.currentUser.getIdTokenResult()).claims.email_verified`. Se `user.emailVerified` for `true` e a claim não, chamar `getIdToken(true)` antes da query. Esforço: 0,5 h. **Responsável:** frontend-engineer.

### R3 · Baixo · O membro controla o e-mail exibido e pode desviar a exclusão para o convite de outra pessoa
- **[FATO] Emulador:**
  - P1a: o membro troca `members/{seu uid}.email` para o e-mail do dono → PERMITIDO.
  - P1b: o membro apaga o próprio convite já aceito → PERMITIDO.
  - P1c e P1d: com `email` apontando para Y, a remoção de X apagou o **convite pendente de Y**.
  - P1e: X não volta. A revogação de X funcionou.
- **Impacto:** o membro pode se passar por outra pessoa na lista. O papel não pode ser falsificado, porque agora vem do uid (`ShareModal.jsx:76`). Ele também pode cancelar o convite pendente de outra pessoa. É um incômodo visível, e o dono pode convidar de novo.
- **Correção [RECOMENDAÇÃO]:** com a correção de R1, `acceptedByUid` sempre existe, e o fallback `m?.email` pode sair de `ShareModal.jsx:83`. Opcionalmente, travar `email` em `members` com `request.resource.data.email == myEmail()` (0,5 h).

### R4 · Baixo · `acceptedByUid` aceita qualquer uid
- **[FATO]** `firestore.rules:135-137` limita as chaves alteradas, mas não o valor. R2 (emulador): o convidado grava `acceptedByUid` de outra pessoa → PERMITIDO.
- **Impacto:** isso confunde `emailDoConvite` (`ShareModal.jsx:45` usa `find`, que pega o primeiro). Não concede acesso.
- **Correção:** já incluída na proposta abaixo (Q5 → NEGADO).

### R5 · Baixo · Reenviar o convite de quem ainda é membro deixa um convite pendente "dormente"
- **[FATO]** P3m e P3n: `createInvite` sem merge (`tripData.js:147`) sobre o convite aceito de um membro atual o deixa `pendente`, sem `acceptedByUid`.
- **Efeito:**
  - O membro passa a aparecer em "Convites pendentes".
  - `acceptPendingInvites` falha a cada login, porque a regra C exige que a pessoa não seja membro.
  - Se o dono remover essa pessoa e o fallback de e-mail falhar (R3), o convite vira bilhete de volta.
- **Correção [RECOMENDAÇÃO]:** no ShareModal, não permitir convidar um e-mail que já tem convite aceito de um membro atual (0,5 h).

### Observações sem severidade nova
- **[FATO]** P5c: `deleteTrip` deixa `members/` e o convite órfãos. Isso já existia (A5 do parecer anterior) e não é regressão.
- **[FATO]** O membro ainda destrói o conteúdo de uma versão com "Sobrescrever" (`firestore.rules:81`, `update`). Foi o recorte proposto em A4. O backup continua sendo a mitigação.

## Os seis pontos da delegação

| # | Pergunta | Resposta | Evidência |
|---|---|---|---|
| 1 | O membro troca o próprio `email`? Importa? | **Sim, troca, e importa.** O papel está protegido, mas o fallback de `revokeMember` usa esse e-mail. Isso gera R1 (volta) e R3 (desvio da exclusão) | `firestore.rules:95-97` não restringe `email`; P1a, P1b, P1c → PERMITIDO; P1d apagou o convite de Y; R1c e R1d → PERMITIDO |
| 2 | `conviteDe` com `myEmail()` nulo | **Nega com segurança.** Erro de avaliação equivale a negar. O dono que entrou só por telefone continua operando | P2a (com convites `trip1_null`, `trip1_undefined` e `trip1_` plantados) → NEGADO; P2b → NEGADO; P2c (sem a claim `email_verified`) → NEGADO; P2d, P2e e P2f (dono por telefone cria, lista e reenvia) → PERMITIDO |
| 3 | O reenvio do dono reabre um convite aceito? Remover e convidar de novo funciona? | O reenvio reabre, mas só o dono faz isso. É um novo convite intencional. Não troca viagem, e-mail nem autoria e não marca `aceito`. O fluxo de remover e convidar de novo funciona | `firestore.rules:141-145`; P3a e P3b → NEGADO; P3c e P3d → PERMITIDO; P3e, P3f e P3g → NEGADO; P3h apagou o convite; P3i → NEGADO; P3j e P3k → PERMITIDO; memberUids final `["uid_dono","uid_x"]`. Ressalva em R5 |
| 4 | As queries satisfazem a leitura de lista? | **Sim** | P4a (`where ownerUid ==` pelo dono) → PERMITIDO; P4b (`where emailConvidado ==` próprio, verificado) → PERMITIDO; P4c (não verificado), P4d (alheio) e P4e (estranho) → NEGADO |
| 5 | `deleteTrip` como dono | **Funciona.** As versões são apagadas enquanto a viagem existe, e `tripData()` resolve | `firestore.rules:82`, `tripData.js:91-98`; P5a (não dono) → NEGADO; P5b → PERMITIDO; P5c: versões e viagem apagadas |
| 6 | O aviso e o "Já confirmei" atualizam o token antes do aceite? | **No "Já confirmei", sim** (leitura de código). **Ao reabrir o app depois de confirmar, não** (R2) | `TripPicker.jsx:71-80` faz `reload()`, depois `getIdToken(true)`, depois `refreshUser()`. `useAuth.js:60` cria um objeto novo, e `emailVerified` é propriedade própria de `UserImpl` (auth `index-68602d24.js:1706`). Isso dispara o efeito de `TripsProvider.jsx:47`. `onAuthStateChanged` não dispara em reload (`notifyAuthListeners`, linhas 2987-2997). Caso negativo descrito em R2 |

## Correção proposta para R1 e R4 (validada no emulador, não aplicada)
Na regra C (`firestore.rules:76`), trocar `)` por:
```
&& getAfter(/databases/$(database)/documents/convites/$(tripId + '_' + myEmail())).data.status == 'aceito'
&& getAfter(/databases/$(database)/documents/convites/$(tripId + '_' + myEmail())).data.acceptedByUid == request.auth.uid )
```
No ramo do convidado (`firestore.rules:137`):
```
&& request.resource.data.status in ['aceito', 'recusado']
&& request.resource.data.get('acceptedByUid', request.auth.uid) == request.auth.uid )
```
No cliente, em `acceptPendingInvites`, trocar o par de gravações por um `writeBatch`: `update(trips/{id}, memberUids: arrayUnion(uid))` mais `update(convite, {status:'aceito', acceptedByUid: uid, acceptedAt})`, e gravar `members/{uid}` **depois** do lote. Dentro do lote, `isMember()` usa `get()`, que lê o estado anterior à gravação, então a gravação de `members` falharia.

Resultado (`saida-proposta.txt`):
- Q1: inclusão sozinha → NEGADO.
- Q2: lote → PERMITIDO.
- Q3: dono remove → PERMITIDO.
- Q4: removido volta → NEGADO.
- Q5: `acceptedByUid` alheio → NEGADO.
- Q6: recusa → PERMITIDO.

Testes a acrescentar em `rules.test.js`: Q1, Q2, Q4 e Q5. T11 passa a usar lote.

## Não verificado
- **Comportamento no navegador** do "Já confirmei" e do caso de R2: só foi lido no código do SDK, sem E2E de verificação de e-mail no projeto (`e2e/fluxos-criticos.spec.js` não cobre o fluxo). Para verificar: com o emulador de Auth, cadastrar, marcar o e-mail como verificado pela API do emulador, recarregar a página e conferir se o convite é aceito.
- **Se o Firestore troca o token dos streams já abertos** logo depois de `getIdToken(true)`. [HIPÓTESE forte, pelo desenho do SDK.]
- **Normalização de maiúsculas na claim `email`** do token comparada com o id do convite, que fica em minúsculas. Não testado, e não é regressão.
- **Regras publicadas em produção** e configuração do Console (provedores, "uma conta por e-mail").
- **Não rodei** `npm run test:rules` nem o E2E. Usei os resultados do Head: 36 testes, 14 ataques, 18 E2E e build.
