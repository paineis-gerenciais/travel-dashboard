# Revisão cruzada de segurança v2: branch `fix/17-regras-convite-acesso` (issue #17)

- **Responsável:** devsecops-engineer · **Data:** 2026-11-10 · **Modo:** somente leitura (git diff/show) + emulador avulso na porta 8282
- **Commits:** `f235fba`, `2e915ac` e **`3daaef7`** (novo: correções de R1 a R5 da revisão v1, `revisao-v1.md`)

## Veredito: **aprovado com ressalvas**

R1, que era o achado alto e o motivo da reprovação, está fechado nas regras. Ele não depende mais do cliente. R2, R3, R4 e R5 foram corrigidos. Não há achado bloqueador, alto ou médio em aberto.

As ressalvas são três:
1. Duas condições de implantação (abaixo).
2. Uma limitação residual de severidade baixa.
3. A correção de R2 só foi conferida por leitura de código, não no navegador.

## Evidência de escopo
```
$ git -C /home/user/travel-dashboard diff --stat main...fix/17-regras-convite-acesso
 firestore.rules                   |  75 +++++++++++---
 src/components/ShareModal.jsx     |  46 ++++++--
 src/components/TripPicker.jsx     |  38 +++++++
 src/components/VersionsModal.jsx  |   8 +-
 src/lib/tripData.js               |  38 ++++++-
 src/rules/__tests__/rules.test.js | 213 ++++++++++++++++++++++++++++++++++++--
 src/store/TripsProvider.jsx       |   2 +-
 src/store/useAuth.js              |   4 +
 8 files changed, 386 insertions(+), 38 deletions(-)
```
- **[FATO] Regras:** as regras do branch são iguais a `firestore.proposta.rules` da v1. A única diferença são 3 linhas de comentário: `diff firestore.proposta.rules firestore.v2.rules` mostra só as linhas 69-71, todas comentário.
- **[FATO] Provas:** `docs/prumo/revisao-pr-37/provas-v2.cjs`, com saída em `docs/prumo/revisao-pr-37/saida-v2.txt`.
  - O script replica o cliente do `3daaef7`: aceite em `writeBatch` com `members` gravado depois, e remoção só com o e-mail do convite aceito.
  - Inclui 7 cenários novos (R2b a R2g).
  - **Resultado: 38 de 38 conforme o esperado, 0 divergentes.**
- **[FATO] Proposta:** `docs/prumo/revisao-pr-37/proposta-v2.cjs` contra as regras do branch, com saída em `saida-proposta-v2.txt`. **Resultado: Q1 a Q6, 6 de 6 conforme o esperado.**
- Ambiente: emulador v1.22.0 em 127.0.0.1:8282, com as regras de `git show fix/17-regras-convite-acesso:firestore.rules`. Ao final, o processo foi encerrado (0 processos) e a porta ficou livre.

## Situação dos achados da v1
| Achado v1 | Correção (arquivo:linha) | Evidência | Situação |
|---|---|---|---|
| R1 · Alto · removido volta sozinho | Regra C exige `getAfter(convite).status == 'aceito'` e `acceptedByUid == request.auth.uid` (`firestore.rules:80-81`); cliente em lote (`src/lib/tripData.js:193-197`) | R1a (entrar sem aceitar no mesmo lote) → NEGADO; R1c e R1d (volta) → NEGADO; R2d (cliente antigo, sem lote) → NEGADO; R2g (aceita, apaga o próprio convite, é removido e tenta voltar) → NEGADO; Q1 e Q4 → NEGADO; Q2 → PERMITIDO | **Fechado** |
| R2 · Médio · token desatualizado ao reabrir | `getIdTokenResult()` e, se a claim divergir, `getIdToken(true)` antes da query (`tripData.js:174-186`, linha 182) | Leitura de código. O SDK atualiza `emailVerified` no início, mas não o token (`@firebase/auth` 1.7.9, `index-68602d24.js:1450-1482` e `1607-1610`). A correção força a renovação justamente nesse caso | **Corrigido por leitura de código** (não executado no navegador) |
| R3 · Baixo · exclusão desviada pelo `members.email` | `revokeMember(tripId, uid, emailDoConvite(uid))`, sem fallback (`ShareModal.jsx:91`) | P1d: a remoção usou `null` e **o convite pendente de Y continuou existindo** (na v1 foi apagado) | **Corrigido** |
| R4 · Baixo · `acceptedByUid` livre | `get('acceptedByUid', request.auth.uid) == request.auth.uid` (`firestore.rules:143`) | R2 e R2b (lote com uid alheio) → NEGADO; Q5 → NEGADO; Q6 (recusar) → PERMITIDO | **Corrigido** |
| R5 · Baixo · convite "dormente" | Recusa convidar quem tem convite aceito e é membro atual (`ShareModal.jsx:34-39`) | Leitura de código. Nas regras, o reenvio pelo dono continua permitido (P3m). A trava fica no cliente, o que é aceitável: só o dono consegue fazer isso, e contra os próprios convites | **Corrigido no cliente** |

### Outras verificações desta rodada [FATO, emulador]
- R2c: entrar em lote com o convite marcado como `recusado` → NEGADO.
- R2e: entrar usando o convite de outro e-mail → NEGADO.
- R2f: gravar `members` dentro do lote → NEGADO. Isso confirma que o cliente acertou ao gravar `members` depois do lote (`tripData.js:197-203`).
- Pontos 2 a 5 da v1 sem regressão: P2a a P2f, P3a a P3l, P4a a P4e e P5a a P5b deram o mesmo resultado de antes.

## Achados remanescentes
### V2-1 · Baixo · O membro ainda controla o nome e o e-mail exibidos em "Com acesso"
- **[FATO]** P1a e P1c dão PERMITIDO. A regra `firestore.rules:100-102` não restringe `email` nem `displayName`.
- **Impacto:** depois de R3, o efeito ficou restrito à exibição. A pessoa aparece com outro nome ou e-mail. O papel não muda, porque vem do uid. A remoção não usa mais esse e-mail.
- **[RECOMENDAÇÃO] opcional:** travar `request.resource.data.email == myEmail()` em `members` (0,5 h). Vai para o backlog.

### V2-2 · Baixo · Já existia: `deleteTrip` deixa `members/` e o convite órfãos
- **[FATO]** P5c. É o A5 do parecer de 07/11, sem regressão.

## Condições de implantação (ressalvas)
1. **Publicar as regras e o Hosting juntos.**
   - **[FATO]** R2d: o cliente antigo, que faz as gravações em sequência, deixa de conseguir aceitar convites com as regras novas.
   - O app é uma PWA com `registerType: 'autoUpdate'` (`vite.config.js:12`). Uma aba aberta com o bundle antigo falha no aceite até recarregar.
   - O erro é engolido e o convite continua `pendente`, então ele é aceito no próximo login com o bundle novo. Não há perda de dados.
   - Ordem sugerida: o merge publica o Hosting, e logo em seguida `firebase deploy --only firestore:rules`.
2. **Antes de publicar, revisar no Console os convites `pendente` existentes.**
   - Pelas regras antigas, um convidado podia voltar o próprio convite para `pendente` (A1 da v1).
   - Um convite assim, de alguém já removido, ainda vale com as regras novas: a pessoa entra pelo lote legítimo.
   - Apague os pendentes de quem não deve voltar. São poucos registros: consulta manual de cerca de 0,2 h.

Rollback: o mesmo do parecer de 07/11. Republicar a versão anterior das regras pelo histórico do Console. Critério: membros legítimos recebendo `permission-denied`.

## Não verificado
- **R2 no navegador:** cadastro por e-mail e senha, confirmação em outra aba e reabertura do app em menos de 1 hora. O E2E não cobre esse fluxo. Para verificar: com o emulador de Auth, marcar o e-mail como verificado pela API do emulador, recarregar e conferir que o convite é aceito sem novo login.
- **Se o Firestore usa o token novo** logo depois de `getIdToken(true)`. [HIPÓTESE forte, pelo desenho do SDK.]
- **Os testes do projeto:** não rodei `npm run test:rules` nem o E2E. Usei a evidência do Head: 39 testes de regras, 14 cenários, 18 E2E e build ok.
- **Regras publicadas em produção** e os dados reais de convites (condição 2).
