# Verificação de 2026-11-10

Fecha as hipóteses que a avaliação de 2026-11-09 deixou pendentes e repete a linha de base das regras. Ambiente: Node 22, Java 21, firebase-tools 15.35, Playwright 1.62 com Chromium, emuladores do Firestore e do Auth. Commit do código: `b5a3ce2`.

## 1. Datas em fuso UTC+ (A3)

```
$ TZ=Europe/Lisbon npx vitest run src/domain
      Tests  17 failed | 94 passed (111)
$ TZ=Asia/Tokyo npx vitest run src/domain
      Tests  18 failed | 93 passed (111)
$ TZ=America/Sao_Paulo npx vitest run src/domain
      Tests  111 passed (111)
```

Exemplos de falha em Lisboa: `addDaysISO` devolve `2026-03-31` em vez de `2026-04-01`; café automático cai em `2026-05-01, 2026-05-02` em vez de `2026-05-02, 2026-05-03`; hospedagem de 2 diárias conta 100 em vez de 200. **Confirmada.** Issue #23.

## 2. E2E sem as variáveis do Firebase (A6)

Ambiente sem nenhuma `VITE_FIREBASE_*`, como no job `Qualidade`:

```
$ npm run test:e2e
  18 failed (todos com "page.waitForFunction: Timeout 30000ms exceeded" ao esperar o gancho de login)
```

Erro no navegador, com o build de teste servido em `localhost:4173`:

```
gancho de login existe? undefined
pageerror: Firebase: Error (auth/invalid-api-key).
```

Com valores fictícios nas variáveis, os 18 passam (medido em 2026-11-07). **Confirmada**, somada à causa de Java 17 do log do CI de 18/08. Issue #19.

## 3. Regras do Firestore: linha de base

Scripts `diagnostico-2026-11-07/verifica-regras.mjs` e `verifica-regras-2.mjs`, contra as regras do repositório, num emulador avulso:

| Cenário | Esperado | Obtido |
|---|---|---|
| A1 estranho cria convite para si numa viagem alheia | negado | permitido |
| A2 estranho entra na viagem com esse convite | negado | permitido |
| A3 estranho lê a viagem | negado | permitido |
| B1 membro não dono convida terceiro | negado | permitido |
| C1 comentário em nome de outra pessoa | negado | permitido |
| C2 atividade em nome de outra pessoa | negado | permitido |
| D1 membro se marca como dono | negado | permitido |
| E1 membro edita a viagem (controle) | permitido | permitido |
| R1 dono remove membro (controle) | permitido | permitido |
| R2 removido volta sem convite novo | negado | permitido |
| R3 removido lê a viagem | negado | permitido |
| V1 conta com e-mail não verificado assume convite pendente | negado | permitido |
| V2 a mesma conta marca o convite como aceito | negado | permitido |
| V3 a mesma conta lê a viagem | negado | permitido |

Igual a 2026-11-07. Issue #17 deve terminar com os 12 cenários negados.

## 4. Navegador: A2, A13 e A10

Parecer completo, scripts e saídas em `verificacao-2026-11-10/`; capturas selecionadas em `verificacao-2026-11-10/qa-capturas/`.

- **A2, folha edita a cidade errada: confirmada** em 360 e 1366 px. Com Lisboa de 10/06 a 13/06, a cidade nova "Porto" recebe check-in 01/06; a lista reordena e a folha aberta passa a mostrar Lisboa. Com check-out 20/06, Lisboa termina em 20/06 sem aviso e Porto fica com 1 diária. Issue #25.
- **A13, folha de comentário recortada: confirmada.** A folha está dentro de `.dias-card` (`contain: layout paint`, `will-change: transform`). O fundo mede 324×608 em tela de 360×800 e 668×568 em 1366×768; cabeçalho e abas ficam clicáveis. Issue #27.
- **A10, contraste: confirmada em parte.** Tema claro: Planejado 4,20, Pago 3,11 e Cancelado 4,27, abaixo de 4,5; Reservado 5,96 passa. Tema escuro: os 4 chips passam (5,36 a 7,19). `--text-3` falha nos dois temas (2,94 no claro, 4,13 no escuro). Achado extra: o menu de status tem 4 violações de ARIA, 2 críticas (`aria-required-children`, `aria-required-parent`). Issue #29.

## 5. Não verificado

Safari, Firefox e aparelho físico; Cidades e editores com chips no axe (a regra de cor é a mesma); regras publicadas em produção (exige o Console).
