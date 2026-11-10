# Parecer de verificação: travel-dashboard (A2, A13, A10)

Data: 2026-11-10. Ambiente: build de preview com variáveis fictícias, emuladores Firestore e Auth, Chromium via Playwright global, axe-core 4.10.3 (wcag2a, wcag2aa, wcag21aa, PrintView excluído). Usuário qa3-a@exemplo.com (só emulador). Dados fictícios.
Pasta de trabalho: docs/prumo/verificacao-2026-11-10/ (scripts em qa2-scripts/, capturas em qa2-capturas/). Nenhum arquivo do repositório foi alterado; `git status --short` vazio ao final.

Resultado: A2 CONFIRMADA, A13 CONFIRMADA, A10 CONFIRMADA (parcial: 3 de 4 chips falham em tema claro; tema escuro passa).

## A2: a folha de edição passa a editar outra cidade

Comando: `cd qa2-scripts && NODE_PATH=$(npm root -g) node A_a2.js` (saída em qa2-A_saida.json). Variante: `A_a2_variante.js` (saída em qa2-A_variante_saida.txt).

[FATO] Mesmo resultado em 360x800 e 1366x768. Passos (folha aberta com "Adicionar cidade", sem fechar):

| Passo | Folha mostra (Cidade / Check-in / Check-out) | Ordem da lista por trás |
|---|---|---|
| 1 aberta (cidade nova) | vazio / vazio / vazio | Lisboa, Cidade sem nome |
| 2 Cidade = Porto | Porto / vazio / vazio | Lisboa, Porto |
| 3 Check-in = 2030-06-01 | **Lisboa / 2030-06-10 / 2030-06-13** | **Porto (01/06 a 02/06), Lisboa** |
| 4 Check-out = 2030-06-05 | Lisboa / 2030-06-10 / 2030-06-13, com erro "O check-out precisa ser depois do check-in." | Porto, Lisboa |
| 5 folha fechada | (lista final) | Porto 01/06 a 02/06 (1 diária), Lisboa 10/06 a 13/06 (3 diárias) |

[FATO] Causa observada: o estado `editing` guarda o índice (1). O check-in de Porto reordena a lista (Porto vai para o índice 0), e o índice 1 passa a apontar para Lisboa. A folha troca de cidade no meio da edição.
[FATO] Resultado final: Porto ficou com check-out 02/06 (a data calculada pelo app), não 05/06. O check-out digitado foi aplicado a Lisboa e só foi rejeitado porque 05/06 é anterior ao check-in de Lisboa.
[FATO] Variante (360, check-out do Porto = 2030-06-20, data válida para Lisboa): lista final = `Porto | 01/06/2030 → 02/06/2030 · 1 diária` e `Lisboa | 10/06/2030 → 20/06/2030 · 10 diárias`. Lisboa foi alterada de 13/06 para 20/06 sem aviso: corrupção silenciosa de dados de outra cidade.
Capturas: qa2-capturas/A2_360_0_antes.png, A2_360_1_folha_aberta.png, A2_360_2_cidade.png, A2_360_3_checkin.png (folha mostra Lisboa), A2_360_4_checkout.png, A2_360_5_depois.png; mesmas com prefixo A2_1366_; variante: A2_variante_360_checkout20.png e A2_variante_360_depois.png.
Severidade sugerida: [RECOMENDAÇÃO] alta (altera dados de outra cidade sem aviso, no fluxo principal de cadastro; cadastrar cidade fora de ordem cronológica é comum).

## A13: folha de comentários recortada dentro do cartão do dia

Comando: `NODE_PATH=$(npm root -g) node B_a13.js` (saída em qa2-B_saida.json).

[FATO] A folha é montada dentro de `.dias-card` (`backdropDentroDoCartao: true`). O cartão tem `contain: layout paint` e `will-change: transform`, que fazem o `position: fixed` do backdrop se ancorar no cartão e ser recortado por ele.

| Viewport | innerWidth x innerHeight | `.sheet-backdrop` (x, y, w x h) | Folha (x, y, w x h) | Cobre a tela? |
|---|---|---|---|---|
| 360x800 | 360 x 800 | 19, 102.7, 324 x 608.5 | 19, 410.7, 324 x 300.5 | não |
| 1366x768 | 1366 x 768 | 350, 188.8, 668 x 568.5 | 404, 330.8, 560 x 284.5 | não |

[FATO] `elementFromPoint` nos cantos devolve `appbar` (topo) e `BUTTON` (360, rodapé = abas) ou `screen` (1366): o fundo escuro não cobre barra superior nem navegação. Em 360 a folha termina em y=711, acima da barra de abas; a barra e as abas ficam clicáveis com a folha aberta. A captura mostra a folha com margem de 16 px dos lados e cortada na borda do cartão.
[FATO] O campo "Escrever comentário" ficou dentro da tela nos dois casos (top 643, bottom 687 em 360), sem perda de uso aparente.
Capturas: A13_360_0_antes.png, A13_360_1_comentarios.png, A13_1366_0_antes.png, A13_1366_1_comentarios.png.
Observação: [HIPÓTESE] o mesmo efeito vale para qualquer Sheet aberto dentro do cartão (por exemplo, outros componentes usados na linha do item). Não verificado.
Severidade sugerida: [RECOMENDAÇÃO] média (visual e foco do modal: o usuário consegue interagir com a barra e as abas por trás de um diálogo `aria-modal`).

## A10: contraste dos chips de status

Comandos: `C_a10.js` (axe na tela, saída em qa2-C_resultado.json; resumo em qa2-C_resumo.txt e qa2-C_contraste_detalhe.txt) e `C2_chips_um_a_um.js` (cada chip rolado para a vista e avaliado isolado; saída em qa2-C2_chips.txt). O primeiro passou por limitação do axe: chips fora da área visível do `main` não foram avaliados na varredura da tela, por isso o segundo script.

[FATO] Razões por chip (idênticas em 360 e 1366; texto 11 px, peso normal, mínimo exigido 4,5:1):

| Status | Tema claro (fg / bg) | Razão | Tema escuro (fg / bg) | Razão |
|---|---|---|---|---|
| Planejado | #64748b / #eef1f5 | 4,20 FALHA | #94a3b8 / #1e242c | 6,09 ok |
| Reservado | #1b4fd0 / #e8f0ff | 5,96 ok | #8ab0ff / #1a2438 | 7,19 ok |
| Pago | #0f9d58 / #e6f5ec | 3,11 FALHA | #3ac07d / #12241b | 6,96 ok |
| Cancelado | #d1372f / #fdecea | 4,27 FALHA | #f0645c / #2d1715 | 5,36 ok |

[FATO] Na tela Custos não existem chips: a seção "Por status" mostra só texto com o nome do status. O chip só aparece na tela Dias (e em Cidades e nos editores). Na tabela abaixo, Custos aparece, portanto, sem chips.

Violações axe por tela x tema (nós por viewport 360 / 1366; "ex." é um seletor de exemplo):

| Tela | Tema | Regra | Nós | Seletor exemplo | Razão reportada |
|---|---|---|---|---|---|
| Dias | claro | color-contrast | 8 / 12 | `.appbar-title > .tiny.t3`; `.chip-planejado`; `.chip-pago` (e `.chip-cancelado` em 1366); `.timeline-city.city-c6` | 2,94 (texto terciário); 4,20; 3,11; 4,27; 3,67 |
| Dias | escuro | color-contrast | 7 / 7 | `.appbar-title > .tiny.t3`; linha cancelada (`.row-title`, `.num`) | 4,13 (#717d8d sobre #171b21); chips sem falha |
| Dias, menu de status aberto | claro | color-contrast | 10 / 14 | `.chip-planejado`, `.chip-pago`, `.chip-cancelado` nas opções | 4,20; 3,11; 4,27 |
| Dias, menu de status aberto | claro e escuro | aria-required-children (critical) | 1 | `ul` (`.chip-menu`, role=listbox) | listbox sem filhos `option` diretos |
| Dias, menu de status aberto | claro e escuro | aria-required-parent (critical) | 4 | `.chip-planejado.chip[role="option"]` | option precisa estar em listbox (está dentro de `li`) |
| Dias, menu de status aberto | claro e escuro | aria-input-field-name (serious) | 1 | `ul` | listbox sem nome acessível |
| Dias, menu de status aberto | claro e escuro | listitem (serious) | 4 | `li:nth-child(1)` | `li` fora de `ul`/`ol` por causa do `role="listbox"` |
| Dias, menu de status aberto | escuro | color-contrast | 7 / 7 | `.appbar-title > .tiny.t3` | 4,13; chips ok |
| Custos | claro | color-contrast | 10 / 11 | `.tiny.t3`, `.t3` (5 nós) | 2,94 (#8e97a5 sobre #fff) |
| Custos | escuro | color-contrast | 10 / 10 | `.tiny.t3`, `.t3` | 4,13 |

[FATO] O texto terciário `--text-3` (#8e97a5 no claro, #717d8d no escuro) falha em todas as telas e temas testados; isso é mais amplo do que os chips e pode ser o achado de maior alcance.
[FATO] Dos 4 status, 3 falham em tema claro (Planejado, Pago, Cancelado); nenhum falha em tema escuro. Em tema escuro, a linha de item cancelado (texto `--text-3` com riscado) falha com 4,13.
[FATO] Achado extra (fora do pedido): o menu de status (`StatusChip`, listbox) tem 4 violações de ARIA, 2 delas críticas.
Capturas: A10_{360,1366}_{light,dark}_{dias,dias_menu,custos}.png (12 arquivos).

## Não verificado
- Tela Cidades e editores com chips (só o código foi lido; a regra CSS é a mesma, então as razões valem).
- Teclado real em celular físico e Safari/Firefox (só Chromium).
- Outros Sheets dentro de `.dias-card` além dos comentários.
- Telas além de Dias e Custos no tema escuro.
- Dispositivo com visualViewport reduzido por teclado.

## Observações sobre o método
- Em A2 a folha foi preenchida com `fill()` do Playwright sem fechar entre campos, como pedido. Um usuário digitando na mesma ordem passa pelo mesmo ponto: o `onChange` do check-in dispara a reordenação.
- Em A10, a primeira varredura não avaliou chips fora da área visível; por isso o complemento `C2_chips_um_a_um.js`.
