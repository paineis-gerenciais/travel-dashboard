# Parecer de qualidade: PR #38 (fix/24-acerto-saldo-centavos, commit f667be3)

- **Demanda:** #24 · **Responsável:** qa-engineer · **Data:** 2026-11-10
- **Parecer:** APROVADO COM RESSALVAS
- **Contagem de defeitos:** bloqueador 0 · alto 0 · médio 2 · baixo 3

Ambiente: worktree `wt38` (main atual mesclado), emuladores Firestore e Auth (`--project demo-fake`), Chromium (Playwright) em 1280x900 e 360x800, build de teste com variáveis fictícias. Dados 100% fictícios (Ana, Bia, Caio, Davi). Scripts em `qa3839/` (`dominio38-registro.mjs`, `qa38-registro.mjs`, `qa38b-registro.mjs`, `qa38c-registro.mjs`, `pagou38-registro.mjs`, `lib-registro.mjs`, `run.sh`).

## Critérios de aceite
| Critério (issue #24) | Resultado | Evidência |
|---|---|---|
| Confirmar grava pagamento `{de, para, valor, data}` que entra no saldo; acerto sobre o saldo que sobra | atendido | Tela (S1.1 a S1.6): 100 por 3, Bia e Caio confirmam 33,33 a Ana; documento gravado com `payments[2]` (`id, de, para, valor, data` ISO); colaborador acrescenta despesa de 30 paga por Bia, a tela mostra Ana->Bia 10,00 e Caio->Bia 10,00 (nunca 43,33 / 13,33). Desfazer o pagamento de Bia: Bia->Ana 13,33 e Caio->Ana 10,00 (conferido à mão) e `payments` cai para 1 no documento |
| Migração idempotente dos acertos antigos | atendido | S4 (legado no navegador, ver abaixo): 2 entradas válidas viram 2 pagamentos com id `mig-<key>-<at>`; a entrada inválida (`lixo-sem-formato`) é descartada; reabrir e "aba antiga" regravando `settlementsDone` com as mesmas chaves não duplicam (2 pagamentos na tela e no documento) |
| Centavos inteiros, maior resto, determinístico; partes fecham com o total | atendido | `dominio38-registro.mjs`: 100/3 = 33,34 / 33,33 / 33,33 (soma 100,00; centavo vai ao primeiro em empate); 1750/3 soma 1.750,00; fuzz de 3000 cenários (2 a 5 pessoas, rateio desigual, pagamentos parciais): partes somam o total, saldos somam 0, aplicar o acerto zera todos os saldos, novo acerto após pagamentos parciais também zera. 4 pessoas na tela (S2.1): acerto da tela igual ao do domínio e `n-1` transferências |
| "Ninguém deve nada" só com saldos zerados; aviso da despesa sem pagador | atendido | S3.1: só despesa sem pagador, sem a frase de quitação, aviso "Há despesa sem pagador definido: Passeio barco (R$ 90,00)". S3.2/S3.3: despesa sem pagador combinada com acerto, mesmo após confirmar todos os acertos a frase não aparece e o aviso fica. S2.2: a frase só surge quando os 4 saldos ficam +R$ 0,00 |
| Evento `settlement_confirmed` | atendido só por leitura do código | `TripProvider.jsx:228` com chave permitida `count`. Em execução não foi possível capturar: o Analytics falha com a chave fictícia (`config-fetch-failed`). Ver "Não verificado" |
| Testes: exemplo do parecer, 3+ pessoas, sem pagador com acerto, soma das partes | atendido | `npx vitest run src/domain`: 126 passed (11 testes novos do PR cobrem os quatro itens) |

## Conversão do legado no navegador (pedido específico)
Documento gravado pelo admin com regras desligadas: sem campo `payments`, `settlementsDone` = 3 entradas (2 válidas + 1 inválida), despesas 100 (Ana) e 30 (Bia).
- Ao abrir, sem editar (S4.1): "Pagamentos feitos" mostra "Bia pagou a Ana 09/11/2026 R$ 33,33" e "Caio pagou a Ana 09/11/2026 R$ 33,33"; acertos Ana->Bia 10,00 e Caio->Bia 10,00 (batem com a conta esperada).
- Depois de uma edição (nota da cidade, S4.3): documento com `payments` = 2 (`mig-p-bia>p-ana>3333-2026-11-09T14:00:00.000Z` e o de Caio) e `settlementsDone` = `[]`.
- Recarregar (S4.4): continuam 2 pagamentos, mesmos acertos, documento com 2.
- "Aba antiga" regrava `settlementsDone` com as mesmas chaves (S4.5): na tela continuam 2 pagamentos.
- Observação [FATO]: a gravação da conversão sem edição do usuário é instável. Numa rodada o documento foi regravado já migrado sem nenhuma edição; em outra, 8 s depois de abrir continuava antigo (S4.0). Vem do efeito de salvamento do `TripProvider` (existente, não do PR): o salvamento depende de uma corrida entre `suppress` e `setLoaded`. Não afeta a correção do cálculo (a conversão é refeita a cada carga), mas é relevante para a revisão de reversibilidade: o documento pode ser migrado só por abrir a viagem.

## Testes executados
| Tipo | Comando ou procedimento | Resultado |
|---|---|---|
| Unitários (do autor) | `npx vitest run src/domain` em `wt38` | 126 passed |
| Domínio independente | `node qa3839/dominio38-registro.mjs` | todas as verificações passaram (caso do parecer, 100/3, 1750/3, 4 pessoas, sem pagador, pagamento a maior, fuzz 3000) |
| Jornada do autor | `npm run test:e2e -- --project demo-fake` (variáveis fictícias) | 18 passed (21,3 s), mobile e desktop |
| Jornada do QA (tela e legado) | `firebase emulators:exec --project demo-fake --only firestore,auth "qa3839/run.sh wt38 38 qa38-registro.mjs"` | 24 verificações, 3 falhas: S5.1 (data, defeito D1), S6.2 (axe, pré-existente), S6.3 (nomes de botões, D4). As demais passam |
| Acessibilidade | axe (WCAG 2 A/AA) na folha, 360 px, tema claro e escuro (`qa38-registro.mjs` S6.2, `qa38b-registro.mjs`) | `color-contrast` serious: `--ok` (3,11:1) e `--danger` (4,31:1) nos saldos, botão "Fechar" (4,13:1 claro, 3,27:1 escuro). Todos são tokens e componentes já existentes, não introduzidos pelo PR. Nenhuma violação nos elementos novos ("Pagamentos feitos", "Desfazer") |
| Responsividade | 360 px (Pixel-like) e 1280 px | sem rolagem horizontal na folha (scrollWidth 360 = clientWidth 360); captura em `qa3839/shots/s6-mobile-360.png` |
| Desempenho | não medido | sem alteração de carga relevante; fora do escopo do PR |

## Defeitos encontrados
| Sev. | Descrição | Passos para reproduzir | Esperado x obtido | Responsável sugerido |
|---|---|---|---|---|
| Médio (D1) | A data do pagamento aparece com um dia a mais à noite. `data` é gravada em ISO UTC e a tela usa `pg.data.slice(0, 10)`, que é o dia UTC | Contexto com fuso `America/Sao_Paulo`, relógio fixo 2026-11-10 23:30 (-03:00). Custos > Ver > "Confirmar pagamento" | Esperado "10/11/2026". Obtido "11/11/2026" (documento: `2026-11-11T02:30:00.000Z`). Afeta toda confirmação depois das 21h no Brasil. `Custos.jsx:369`, `TripProvider.jsx:225`. Evidência: `qa38-registro.mjs` S5.1 | frontend-engineer: gravar a data local (AAAA-MM-DD do usuário) ou formatar `new Date(iso)` no fuso local |
| Médio (D2) | "Pagou R$ X" de cada pessoa passa a ser alterado pelos pagamentos de acerto (quem recebeu tem "pagou" reduzido, quem pagou tem "pagou" aumentado). O PR documenta no código, mas a tela mostra o número como despesa paga | Seed 100 pago por Ana; Bia e Caio confirmam 33,33 cada. `node qa3839/pagou38-registro.mjs` | Esperado Ana "Pagou R$ 100,00". Obtido Ana "Pagou 33,34", Bia e Caio "Pagou 33,33", embora só Ana tenha pago despesa. O saldo está certo, o rótulo engana. `Custos.jsx:291`, `split.js:198-199` | frontend-engineer / data-bi: exibir "Pagou" só das despesas e uma linha separada "Acertos recebidos/enviados", ou renomear o rótulo |
| Baixo (D3) | Pagamento de participante removido fica "órfão": some do saldo (ignorado em `split.js:197`) mas continua listado como "— pagou a Ana" e só se resolve com "Desfazer" | Seed com payment Bia->Ana 30 e participantes Ana, Bia, Caio. Colaborador remove Bia da lista (`qa38c-registro.mjs`) | Esperado aviso ou limpeza. Obtido linha "— pagou a Ana R$ 30,00", acerto passa a Caio->Ana 45,00; "Desfazer" funciona (S7.1 a S7.3) | frontend-engineer (backlog) |
| Baixo (D4) | Botões repetidos "✓ Confirmar pagamento" e "Desfazer" têm o mesmo nome acessível em todas as linhas; leitor de tela não sabe a qual pagamento se referem | Custos > Ver > folha com 2 acertos e 1 pagamento; ler os nomes dos botões (`qa38-registro.mjs` S6.3) | Esperado `aria-label` com o contexto ("Confirmar pagamento de Bia a Ana"). Obtido `["✓ Confirmar pagamento","✓ Confirmar pagamento","Desfazer"]`. `Custos.jsx:353,373`. O "Confirmar" já era assim antes | frontend-engineer (backlog) |
| Baixo (D5) | O texto do PR afirma E2E de "confirmar e desfazer pagamento", mas os 18 E2E não cobrem isso (o teste de divisão só confere totais). A jornada nova só foi exercitada pelos scripts do QA | `grep -n "Confirmar pagamento\|Desfazer" e2e/*.js` sem resultado | Esperado teste de jornada. Obtido só teste de domínio. Os scripts `qa38-registro.mjs` S1 e S4 podem virar E2E | autor / qa-engineer (E2E em `e2e/`) |

## Não verificado
- Evento `settlement_confirmed` em execução (Analytics não inicializa com a chave fictícia; só leitura de código).
- Segurança e reversibilidade da conversão (outra revisão), em especial: aba antiga com a versão anterior sobrescrevendo o documento inteiro e descartando `payments` quando ela não os conhece (o `normalizeState` antigo preserva chaves desconhecidas, então só se perde se a aba tiver o estado de antes dos pagamentos). Não simulei duas versões do app.
- Clique duplo em "Confirmar pagamento" (o layout se desloca; o segundo clique pode cair em outro acerto). Não testado.
- Valores com mais de 2 casas decimais vindos de importação (arredondamento de `toCents` com meio centavo).
- Fuso Lisboa/Tóquio: rodados pelo Head, não repeti.
- Desempenho e prévia do PR no Firebase real (proibido pelo escopo).

## Riscos remanescentes
- Uma entrada legada "obsoleta" (chave com valor diferente do residual de hoje) é convertida em pagamento pelo valor da chave. No exemplo do parecer isso é o desejado (33,33 já pagos), mas não há como distinguir um acerto que nunca foi pago de fato.
- Dois ids iguais em `payments` contam duas vezes (`paymentsList` não deduplica); só ocorre com dado gravado à mão.
- Os saldos negativos aparecem como "R$ -33,33" na linha dos participantes (formato existente).

---

# Adendo: reteste em cb47cb7 (2026-11-10)

- **Parecer final:** APROVADO COM RESSALVAS (bloqueador 0, alto 0, médio 0, baixo 3 em aberto)
- Escopo: commits `692226c` (conversão do legado) e `cb47cb7` (D1, D2, E2E). Ambiente igual ao do parecer; scripts `qa3839/qa38r-registro.mjs` (reteste), `dominio38-registro.mjs`, `pagou38-registro.mjs`; saída em `qa3839/saida38r.log`.

## Resultado por item pedido
| Item | Resultado | Evidência |
|---|---|---|
| Conversão só dos acertos vigentes, id `mig-<key>`, `settlementsDone` preservado, `paymentsMigrated: true`, sem duplicar | atendido | L1.1 a L1.5. Seed com 4 chaves (2 vigentes, 1 vencida `p-bia>p-caio>1000`, 1 inválida). Tela: 2 pagamentos (Bia e Caio -> Ana 33,33), "Ninguém deve nada". Documento: `payments` = `mig-p-bia>p-ana>3333` e `mig-p-caio>p-ana>3333` (33,33), `settlementsDone` com as 4 entradas idênticas, `paymentsMigrated=true`. Reabrir: 2 na tela e no documento. Chave nova em `settlementsDone` depois da marca: nenhuma conversão nova |
| Duas chaves do mesmo par (`pb>pa>4500` e `pb>pa>7500`) | atendido | L2.1/L2.2: UM pagamento "Bia pagou a Ana R$ 75,00" (`mig-p-bia>p-ana>7500`, valor 75), saldos +R$ 0,00, `settlementsDone` com as 2 chaves |
| "Desfazer" depois da conversão não volta na releitura | atendido | L4, duas variantes (depois de gravar e logo ao abrir, sem esperar gravar): após Desfazer e recarregar, 1 pagamento, Bia->Ana 33,33 como acerto pendente, `settlementsDone` ainda com 4 entradas |
| D1 (23h30 local) | corrigido | S5.1: fuso America/Sao_Paulo, 23:30 de 10/11: tela "10/11/2026"; documento `2026-11-11T02:30:00.000Z` |
| D2 ("Pagou" da Ana) | corrigido | L1.2: Ana "Pagou R$ 100,00 · deve R$ 33,34 · acertos −R$ 66,66"; Bia "Pagou R$ 0,00 · deve R$ 33,33 · acertos +R$ 33,33". `pagou38-registro.mjs`: Ana 100, Bia 0, Caio 0 |
| Regressão do cálculo | sem regressão | S1 a S3 (24 das 27 verificações do `qa38r-registro.mjs`) e `dominio38-registro.mjs` (inclui fuzz de 3000 cenários) passam |

## Testes executados
- `npx vitest run src/domain` em `wt38`: 138 passed, 3 skipped (os 3 pulados são do `data-local.test.js`, que o Head disse ser por fuso; não investiguei o motivo).
- `npm run test:e2e -- --project demo-fake` (variáveis fictícias): 20 passed (18 antigos + `e2e/pagamentos.spec.js` em mobile e desktop). O D5 do parecer anterior (falta de E2E de confirmar/desfazer) está resolvido.
- `qa38r-registro.mjs` sob `emulators:exec --project demo-fake --only firestore,auth`: 27 verificações, 2 falhas (S6.2 contraste do axe nos tokens `--ok`/`--danger` e no botão "Fechar", pré-existentes; S6.3 nomes de botões repetidos, o D4 abaixo).
- `git -C wt38 status -s` vazio; portas 8080, 9099, 4000, 4400, 4500, 9150 e 4173 livres; sem `vite preview` ou emulador restante.

## Em aberto
| Sev. | Descrição |
|---|---|
| Baixo (D3) | Pagamento de participante removido continua listado como "— pagou a ..." e fora do saldo (`split.js`, `Custos.jsx`). Não reavaliado: o código não mudou nesse ponto |
| Baixo (D4) | Botões "✓ Confirmar pagamento" e "Desfazer" repetidos sem nome acessível contextual (S6.3 falhou de novo) |
| Baixo (D6, novo, observação do desenho) | Chaves legadas vencidas não viram pagamento. No caso do parecer em formato legado (100 pago por Ana, 30 por Bia, chaves 33,33), a tela mostra Caio->Ana 43,33 e Bia->Ana 13,33 pendentes (L3.1), e não o 10/10 do exemplo da issue, que só vale a partir de confirmações no modelo novo. É coerente com o modelo antigo (a confirmação antiga não abatia saldo e a tela antiga também a exibia como pendente), mas o usuário que já pagou 33,33 precisa registrar de novo. Vale uma linha na nota de release |

## Observações
- A gravação da conversão sem edição do usuário continua instável (corrida existente no efeito de salvamento): em L1.3, L2.2 e L4 a marca só chegou ao documento depois de uma edição ou do "Desfazer". Como a conversão é refeita a cada carga enquanto a marca falta e é determinística (id `mig-<key>`), não vi divergência de resultado, mas confirmo que o documento pode permanecer sem a marca até a primeira gravação.
- `tol = max(1, nº de despesas)` centavos: não exercitei casos de borda de tolerância na tela (coberto pelos testes de domínio do autor, que passaram).
- Segurança (A1/A2) e reversibilidade seguem com a outra revisão. Notei só que `settlementsDone` preservado e a marca `paymentsMigrated` deixam o rollback e abas antigas sem perda.
