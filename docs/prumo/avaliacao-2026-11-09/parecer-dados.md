# Parecer de dados e indicadores: travel-dashboard

Data: 2026-11-09 · Autor: data-bi-engineer (Prumo) · Nível: N2, consultivo, somente leitura · Sem issue vinculada.

Rótulos: [FATO] leitura do código, com `caminho:linha`; [HIPÓTESE] depende de execução ou de dado de uso; [RECOMENDAÇÃO] julgamento do parecer. Severidade: Bloqueador, Alto, Médio, Baixo. Esforço: P (horas), M (1 a 3 dias), G (mais de 3 dias).

## 0. Método e limites

- Análise estática de `src/domain/*`, `Custos.jsx`, `Mais.jsx`, `Resumo.jsx`, `PaymentFields.jsx`, `MoneyInput.jsx`, `sheet.js`, `sheetFile.js` e do store (`TripProvider.jsx`). Caminhos abaixo são relativos a `src/`.
- Nenhum código do repositório foi executado (bloqueio da sessão). Contas de casos de borda foram refeitas em Python próprio, sem importar o repositório (seção 2.4). Testes de domínio não foram rodados: ver seção 9.
- [FATO] Não há dados reais nem consulta a fonte produtiva. A "fonte" de todos os indicadores é o documento Firestore `trips/{id}.state` (`lib/tripData.js:101`), lido no cliente. Não há camada analítica separada: cada indicador é calculado no navegador a cada renderização.
- [FATO] `Resumo.jsx` não é importado por nenhum arquivo (busca por `Resumo` em `src/`). O "Resumo" que o usuário vê está em `Mais.jsx:35-38,78-90`. Os indicadores "Média por dia", "Média por pessoa/dia" e "Itens pagos" existem só em código morto (`Resumo.jsx:56-67`).

## 1. Fichas dos indicadores (critério 1)

Convenções comuns: unidade R$ (BRL, única moeda); granularidade: viagem inteira; periodicidade: tempo real, a cada edição; polaridade: sem meta, então não há polaridade definida (ver M-21); responsável: não definido; linha de base e meta: inexistentes. Fonte: `state` da viagem. Filtro de status "ativo" = tudo que não é `Cancelado` (`costs.js:11-18`, comparação sem caixa).

| # | Indicador (tela) | Definição e fórmula | Status que entram | A interface deixa claro? |
|---|---|---|---|---|
| I1 | Total (Custos `Custos.jsx:66`, Mais `Mais.jsx:82`, Cidades, Impressão) | `lodging+food+att+trans+other` em `costs.js:51-58` | Planejado, Reservado, Pago. Cancelado fora (`costs.js:16`, `:24`) | Não. O rótulo é só "Total". Não diz que mistura previsto, reservado e pago, nem que exclui cancelados |
| I2 | Hospedagem | Para cada data de `datesFromCities` (`dates.js:43-54`), diária da primeira cidade que cobre `[start,end)` (`costs.js:22-25`, `:52`). Equivale a noites efetivas x `nightly` | Cidade `Cancelado` fora, mas só com a grafia exata (`costs.js:24`) | Parcial. O campo é "Custo por diária" (`Cidades.jsx:166`), sem dizer que é por hospedagem, não por pessoa. A linha da cidade mostra noites nominais x diária (`Cidades.jsx:20,72`), que diverge do total quando há sobreposição |
| I3 | Transporte | Soma de `getTransportCost` (`costs.js:55`; lê `cost`, `custo` ou `valor`, `transport.js:53-55`) | Ativos | Não diz se o valor é por pessoa ou do grupo. O código trata como valor do grupo |
| I4 | Alimentação, Atrações, Outros | Soma de `num(cost)` ativos (`costs.js:53,54,56`) | Ativos | Idem. O café da manhã automático entra com custo 0 (`generate.js:68-71`) |
| I5 | Por pessoa (Custos `:67`, Mais `:83`, Resumo morto `:23`, Impressão `PrintView.jsx:121`) | `Total / max(1, settings.travelers)` (`Custos.jsx:44`) | Os de I1 | Não. Usa `travelers`, número solto, e não a lista de participantes da divisão (`split.js:23-24`). Ver D-7 |
| I6 | Por dia (Custos `:68`) | `Total / allPlanningDates.length` (`dates.js:104-129`) | Os de I1 | Não. O divisor conta o dia do check-out final e qualquer data solta de item (inclusive digitada errada). Hospedagem não cobre esses dias |
| I7 | Pago % (Custos `:69`; "Itens pagos" no Resumo morto) | `round(n.º de itens Pago / n.º de itens não cancelados)` (`costs.js:74-85`) | Transporte, alimentação, atrações, outros. **Hospedagem fora**. Itens de custo 0 contam | Não. O nome "Pago" sugere dinheiro; é contagem de linhas. Ver D-8 |
| I8 | Por status (Custos `:133-139`) | Valor e contagem por Planejado, Reservado, Pago, Cancelado (`costs.js:92-138`). Hospedagem entra por noites efetivas x diária | Todos, **inclusive Cancelado** (de propósito) | Parcial. Cancelado aparece na lista sem aviso de que está fora do Total. O `pct` calculado (`costs.js:136`) não é exibido |
| I9 | Distribuição por categoria | Cinco linhas fixas de `totals` (`costs.js:173-179`); barra = valor / maior valor, rótulo % = valor / total (`Custos.jsx:119,123`) | Os de I1 | Texto explica "participação no total", mas o comprimento da barra é relativo à maior barra, não ao total |
| I10 | Distribuição por cidade | Por data de planejamento, soma hospedagem, comida, atrações, outros da cidade do dia; transporte vai para a cidade inferida da data (`costs.js:143-164`) | Os de I1 | Não. Itens sem data ficam fora (D-14). Cidades homônimas somam juntas (aceitável) |
| I11 | Distribuição por dia | `dayTotal` por data (`costs.js:165-172`) | Os de I1 | Não. Itens sem data ficam fora. O `.filter` da linha 171 é sempre verdadeiro, porque o nome já traz a data |
| I12 | Dias, Cidades (Mais `:80-82`) | Dias = `allPlanningDates.length`; Cidades = nomes distintos, com caixa (`dates.js:96-98`) | Cidade cancelada conta | Não. "Paris" e "paris" contam duas vezes. O período "de X a Y" (`Mais.jsx:87-88`) usa a primeira e a última data solta |
| I13 | Checklist (Mais `:97`) | `done de total`; percentual usa só ativos (`costs.js:61-71`) | Cancelado fica no denominador do texto e fora do percentual | Inconsistente: "3 de 10" e "43%" podem aparecer juntos (Baixo, P) |
| I14 | Divisão: pagou, deve, saldo | Seção 2 | Ativos | Ver seção 2 |

Respostas diretas às perguntas do pedido:
- [FATO] Hospedagem = diárias efetivas x valor por diária, por cidade (`split.js:59-60`, `costs.js:22-25`). A tela não escreve a fórmula.
- [FATO] Transporte, atrações e alimentação são valor único por linha; não há quantidade nem "por pessoa". [RECOMENDAÇÃO] Texto de apoio no campo ou campo "por pessoa x quantidade" (M-17).
- [FATO] Custo por viajante usa `settings.travelers`; a divisão usa `settings.participants`. Os dois só se alinham quando ninguém foi cadastrado (`split.js:19-25`).
- [FATO] Cancelado nunca entra no Total (`costs.js:16,24,55`), só no gráfico de status.

## 2. Divisão de despesas (critério 2)

### 2.1 Algoritmo
- [FATO] Linhas de custo: hospedagem de cada cidade, mais transporte, comida, atrações e outros com valor > 0 ou com pagador (`split.js:54-89`). Cancelados valem 0.
- [FATO] `paid[pagador] += valor`; sem pagador válido, o valor vai a `unassigned` (`split.js:139-141`).
- [FATO] `owed[i] += valor x pct / 100`. Sem `split`, divide por `1/n` igual. Com `split`, normaliza os percentuais para somar 100 e ignora quem tem 0 ou não é participante (`split.js:96-117`).
- [FATO] `saldo = pagou - deve`. O acerto é guloso: maior devedor paga ao maior credor, com tolerância de 0,01 (`split.js:175-206`). Gera no máximo n-1 transferências e liquida os saldos líquidos. Não é o mínimo absoluto, mas é adequado a grupos pequenos. [RECOMENDAÇÃO] Manter.

### 2.2 Arredondamento
- [FATO] Nada é arredondado a centavos no domínio (`split.js:145`, `:154`); só a exibição arredonda (`format.js:37-45`). Os valores internos são decimais binários (por exemplo 33,333...).
- [FATO, conta própria] R$ 100 pago por A entre 3 pessoas: saldos +66,666..., -33,333..., -33,333.... Transferências exibidas: 33,33 + 33,33 = 66,66, enquanto A exibe saldo +66,67. Diferença de 1 centavo que ninguém absorve.
- [FATO, conta própria] 10 itens de R$ 1,00 entre 3 pessoas: "deve" exibido por pessoa = 3,33, soma 9,99 contra Total 10,00.
- [RECOMENDAÇÃO] Calcular em centavos inteiros e distribuir o resto pelo método do maior resto (determinístico), de modo que a soma das partes feche com o total e as transferências batam com os saldos (M-16). Atenção: o teste atual aceita `toBeCloseTo(total, 6)` (`domain.test.js`, bloco "rateio entre 3 pessoas"), portanto não detectaria isso.
- Mesma causa no fluxo de entrada: `PaymentFields.jsx:50` grava `Number((100/n).toFixed(2))`, então 3 pessoas começam em 33,33 x 3 = 99,99 e a tela mostra "será ajustada proporcionalmente" logo ao ativar (`:115-116`). Funciona, mas assusta (Baixo, P).

### 2.3 Chave do acerto confirmado
- [FATO] `settlementKey = de>para>round(valor x 100)` (`split.js:212-214`). `settings.settlementsDone` guarda só `{key, at}`.
- [FATO, conta própria] **A confirmação não abate o saldo.** Cenário: A paga 100 dividido entre A, B, C. Acertos: B->A 33,33 e C->A 33,33, os dois confirmados. Depois B paga 30 dividido entre os três. O app passa a mostrar C->A 43,33 e B->A 13,33, ambos pendentes. O residual correto, aplicando o que já foi pago, é C->B 10,00 e A->B 10,00. O app inverte quem recebe e sugere pagar de novo valores já pagos.
- Efeito: o aviso "volta a aparecer como pendente" (`Custos.jsx:354-358`) é verdadeiro, mas o valor pendente é o bruto, não a diferença. Risco real de pagamento em duplicidade (Alto, M, D-2).
- [RECOMENDAÇÃO] Tratar a confirmação como lançamento de pagamento (`{de, para, valor, data}`) que entra no cálculo de `paid`/`owed`; o acerto passa a ser calculado sobre o saldo residual. A chave deixa de ser necessária.
- [FATO] Chaves de participantes removidos ou de valores antigos nunca são limpas (`TripProvider.jsx:262-277`). Baixo.

### 2.4 Participante removido, adicionado, sem pagador
- [FATO] `removeParticipant` zera `paidBy` e apaga o percentual dele (`TripProvider.jsx:262-277`). Consequências:
  - O que ele pagou vira "sem pagador" e deixa de existir como crédito. Em despesa com rateio explícito, a parte dele é redistribuída entre os demais em silêncio (normalização, `split.js:116`). Em despesa de divisão igual, todos passam a dever 1/(n-1). Não há confirmação nem aviso, só um toast (`Custos.jsx:404`).
  - [FATO, conta própria] A pagou 90 entre 3 e é removido: B e C ficam com saldo -45 e o texto é "Ninguém deve nada a ninguém" (`Custos.jsx:332`), porque não há credor.
- [FATO] Participante adicionado depois entra automaticamente em toda despesa de divisão igual (efeito retroativo) e fica de fora das que têm rateio explícito. Também não há aviso.
- [FATO] Despesa sem pagador: a soma dos saldos não é zero (= -`unassigned`). [FATO, conta própria] A pagou 100 e outra despesa de 100 não tem pagador, ambas divididas entre A e B: A = 0, B = -100, acertos vazios e texto "Ninguém deve nada a ninguém", com B marcado com -R$ 100,00 na linha acima. O aviso de "sem pagador" (`Custos.jsx:316-321`) ajuda, mas o texto de acerto vazio contradiz o saldo (Médio, P).

### 2.5 Divergência entre a divisão e o Total
- [FATO] `allCostRows` usa `noites.get(c.id) ?? daysBetween(...)` (`split.js:59`). Uma cidade totalmente coberta por outra (sobreposição) não aparece no mapa de noites e cai no fallback nominal. O Total (`costs.js:52`) conta zero noite para ela. Resultado: `splitSummary.total` pode superar `totals().total` (Médio, P). O app já avisa sobre sobreposição (`Cidades.jsx`, `validateCityCoverage`), então é caso raro, mas o invariante "a divisão fecha com o Total" não é testado.
- [FATO] Cidades sem `id` (dados legados) colidiriam na chave do mapa (`split.js:44`, `:59`); `normalizeState` não atribui ids a itens (`state.js:69-77`). [HIPÓTESE] só relevante se houver dado legado sem id em produção.

### 2.6 Casos de borda sem teste (blocos `describe` de `domain.test.js` listados por grep)
1. Acerto com 3 ou mais pessoas (só há caso com 2: linhas 636 e 645).
2. Saldos com dízima e soma das transferências contra o saldo.
3. Despesa sem pagador combinada com acerto.
4. Confirmação seguida de despesa nova (só se testa que a chave muda, linhas 761-781).
5. `removeParticipant` e `addParticipant` (estão no store, fora de `domain/`; `npm test` roda só `src/domain`, `package.json:11`).
6. Cidade totalmente sobreposta na divisão.
7. `paidPct` (importado, sem caso próprio), `costRowsByView` nas visões cidade e dia com itens sem data.
8. Fuso horário diferente de UTC e de Brasil (ver D-1).
9. `num()` com formato americano e vírgula de milhar (seção 6).

## 3. Moeda (critério 3)

- [FATO] Não há suporte a mais de uma moeda: `money()` fixa "R$" (`format.js:37-45`); nenhum campo de moeda ou câmbio no esquema (`sheet.js:35-118`); a busca por moeda, câmbio, USD e EUR em `src/` só encontra o comentário de `money()`.
- [FATO, `parecer-produto.md`] O público inclui viagem ao exterior e o concorrente de referência (Splitwise) tem várias moedas.
- [HIPÓTESE] Sem moeda, o usuário converte de cabeça ou digita já em reais com uma cotação que ninguém registra; a divisão entre pessoas fica correta, mas o orçamento não é auditável nem comparável com a fatura do cartão. Gravidade para o público-alvo: Alto (produto), não bloqueia o uso.
- [RECOMENDAÇÃO] Desenho mínimo (G, mas dá para fatiar):
  1. `settings.currency`: moeda-base da viagem (padrão BRL) e `settings.rates`: `{USD: 5,40, EUR: 6,10}` com data de referência. A taxa é digitada pelo usuário, sem API externa (evita custo recorrente e envio de dados a terceiros).
  2. Em cada item de custo e em `nightly` da cidade: `currency` (padrão = base). O valor original fica em `cost` e a conversão é derivada: `custoBRL = round(cost x rate[currency], 2)`.
  3. Um ponto único de leitura (`itemCost`/`activeCost`/`getTransportCost`) devolve BRL; todos os totais, a divisão e o acerto continuam em BRL, sem mudar sua lógica. O acerto é em BRL.
  4. Interface: o campo mostra o valor original e a conversão ("US$ 120,00 = R$ 648,00"). Exportação traz as colunas `moeda` e `custo` original.
  5. Teste: item em USD com taxa alterada recalcula o Total; item sem moeda segue igual (compatível com dados antigos).
  Fora do desenho mínimo: IOF e taxa de cartão (campo "taxa %" opcional depois), câmbio por dia, histórico de cotação.

## 4. Qualidade dos dados (critério 4)

- Esquema legado (transport.js): [FATO] getters tolerantes para custo, data, origem, destino, meio e duração (`transport.js:12-55`) e o status usa `getTransportCost` de forma consistente em `totals`, `expenseStatusTotals` e `split` (corrigido em T-C.1). **Mas** o relatório de Transporte lê `num(x.cost)` direto (`Custos.jsx:184`) e a exportação lê só `cost` e `date` (`sheet.js:224-229`). Ver P-3 e D-15.
- Campos vazios: [FATO] `num` trata vazio, nulo e inválido como 0, sem sinalizar (`format.js:22-34`). Um item sem custo conta como "linha" em `paidPct` e em `count` de status. Não há indicador de "itens sem valor" (M-19).
- Datas fora do intervalo: [FATO] itens com data fora de qualquer cidade são mantidos, entram no Total e criam um "dia" próprio (`dates.js:118-125`). Isso aumenta "Dias", muda "Por dia" e o período mostrado em `Mais.jsx:87-88`. Nada alerta o usuário (Médio, P).
- Itens sem data: [FATO] `allPlanningDates` os ignora (`dates.js:118-125`), então as visões por cidade e por dia somam menos que o Total (D-14). Importação exige data, mas JSON e dados legados não.
- Itens órfãos após excluir cidade: [FATO] `deleteCityCascade` (`generate.js:140-161`) remove por **nome** da cidade (`:146`); com "excluir itens relacionados" desligado os itens ficam órfãos e seguem no Total. Com ligado, apaga os de qualquer cidade homônima (viagem de ida e volta pela mesma cidade). Há diálogo de confirmação (`Cidades.jsx:93-96`). Médio, P (usar id ou intervalo de datas). Também fica `paidBy` de hospedagem apagada e `settlementsDone` obsoleto.
- Geração automática: [FATO] `ensureGenerated` roda a cada mutação (`TripProvider.jsx:114-120`) e cria um café da manhã por noite, de custo 0, herdando o status da hospedagem (`generate.js:36-73`). Efeitos nos indicadores: infla `count` de status e o denominador de `paidPct`, e um hotel "Pago" faz o café contar como "Pago" (Médio, P: excluir custo 0 dessas contagens).
- [HIPÓTESE com forte indício, ver D-1] Datas geradas com `toISOString()` sobre meia-noite local (`dates.js:19,50,262`, `generate.js:48,179`) saem um dia antes em fuso UTC+ (celular na Europa ou Ásia). Aí a primeira noite de cada cidade fica fora de `dayLodging` e a hospedagem do Total perde uma diária por cidade. O código usa o deslocamento correto só em `todayISO` (`dates.js:296`) e na planilha (`sheet.js:149`). Os testes não fixam fuso (nenhum `TZ` em `package.json` ou `vite.config.js`). O público viaja ao exterior com o celular em fuso local. Alto, P a M.
- [FATO] Gravação do estado inteiro por escrita (`tripData.js:101`), sem merge por campo: duas pessoas editando a mesma viagem podem sobrescrever pagador, rateio e acertos uma da outra. [HIPÓTESE] devolver ao backend-engineer; afeta a integridade da divisão.

## 5. Visualização (critério 5)

- [FATO] As "distribuições" são barras horizontais feitas com `div`, com valor em R$ e % ao lado (`Custos.jsx:111-127`). Sem pizza. Escolha adequada para "qual a participação" com poucas categorias.
- Adequado: categoria (5 itens), valor + % em texto, ponto colorido com `aria-hidden`. As barras são decorativas e a informação está no texto, o que atende leitor de tela sem rótulo extra. Falta texto alternativo agregado só se as barras virarem informação principal.
- Problemas:
  1. [FATO] Comprimento da barra relativo ao maior item, % relativo ao total (`Custos.jsx:45,119,123`): uma categoria com 40% enche a barra. Escalar pelo total ou explicar.
  2. [FATO] Cor por posição, ciclo de 10 (`costs.js:183-196`), em cidade e dia a cor não significa nada. [RECOMENDAÇÃO] Cor só na categoria (e a mesma da pilha de status); cidade e dia em um só tom.
  3. [FATO] Visão por dia lista todos os dias como barras de leitura longa. Para "como evolui no tempo", usar série (colunas por dia, com acumulado) e deixar a lista como tabela.
  4. [FATO] "Por status" é só lista, sem barra nem %, com Cancelado na mesma lista (`Custos.jsx:130-140`). [RECOMENDAÇÃO] Uma barra empilhada com Planejado, Reservado, Pago (soma = Total) e uma linha à parte "Cancelado (fora do Total)".
  5. [FATO] `Math.round` por linha pode somar 99 ou 101 (`Custos.jsx:119`). Aceitável; apenas evitar mostrar a soma.
  6. [HIPÓTESE] No celular, nome de dia ou cidade longo mais valor e % na mesma linha pode quebrar. Não verificado (sem navegador).
- Tabela alternativa: [FATO] os relatórios são listas de `Row` (`Custos.jsx:168-244`), sem ordenar, filtrar nem exportar; o valor exato está visível. A exportação de planilha existe (`sheetFile.js:62-89`), mas só dos dados, sem totais. [RECOMENDAÇÃO] Linha de total por relatório e botão de exportar o relatório (P).
- [FATO] Impressão traz as cinco categorias e o Total (`PrintView.jsx:114-122`), sem status.

## 6. Planilha (critério 6)

Colunas e formatos: [FATO] 6 abas, `id` primeiro; data `AAAA-MM-DD` (texto ambíguo é recusado, `sheet.js:144-167`); dinheiro número; booleano "sim/não"; status canônico sem acento e caixa (`:191-199`). Boas decisões: mesclagem nunca apaga (`:304-350`); preview antes de aplicar (`SheetImportSheet.jsx:55-66`); erro por linha e coluna.

Riscos de perda ou corrupção:
- P-1 [FATO] Coluna ausente reseta o campo no item existente: coluna não encontrada vira `''` (`sheet.js:281`) e cada tipo devolve um padrão (status `Planejado` `:206`, custo `0` `:209`, booleano `false`), que a mesclagem grava (`:331-336`). O comentário de `sheet.js:307-308` promete "atualiza só as colunas da planilha". Quem apagar a coluna `status` ou `custo` e reimportar zera status e valor dos itens com `id`. Célula em branco faz o mesmo. A prévia só informa quantidades (Médio, P: ignorar coluna ausente; célula vazia explícita é decisão de produto).
- P-2 [FATO] Dinheiro nunca falha: `parseCelula` devolve `ok: true` para qualquer texto (`sheet.js:209`). `num()` torna "abc" e "grátis" em 0, negativo em 0 (reembolso e desconto não existem) e formato americano em erro silencioso: "US$ 1,234.56" vira 0; "1,234" vira 1,234 (R$ 1,23). `num("0.125")` vira 125 (ponto seguido de 3 dígitos é milhar, `format.js:28-33`). Em célula numérica do Excel não há problema; o risco está em células de texto e no "colar da planilha" (`sheetFile.js:120-131`). Médio, P: rejeitar texto não numérico e avisar por linha.
- P-3 [FATO] Campos legados não são exportados: a coluna `custo` lê `item.cost` (`sheet.js:227-229`). Transporte legado com `custo` ou `valor` sai com 0; reimportar com `id` grava `cost: 0`, e `getTransportCost` usa `cost ?? custo` (`transport.js:54`), portanto o valor legado é mascarado (Médio, P). Data legada em `data` sai vazia e a linha falha na importação. [HIPÓTESE] só afeta viagens migradas do Apps Script que ainda tenham esses campos.
- P-4 [FATO] Duração: coluna `duracao_min` tipada como inteiro (`sheet.js:63`) mas exporta o valor bruto, que pode ser "2h30" em dado legado. Reimportar converte para 230 minutos (`num("2h30")` = 230) em vez de 150 (Baixo, P: exportar `getTransportDurationMinutes`).
- P-5 [FATO] Não exportados: pagador, rateio, participantes, acertos, `travelers`, café automático. A mesclagem por `id` preserva esses campos no mesmo app; em outra viagem, não. A aba de instruções não avisa (Baixo, P: avisar).
- P-6 [FATO] Importação não valida coerência: check-out menor ou igual ao check-in, cidades sobrepostas ou datas fora da viagem passam (`sheet.js:255-300`); a interface do app recusa `end <= start` (`TripProvider.jsx:163`). Médio, P.
- P-7 [FATO] `link` sempre reimportado com `label: ''` (`sheet.js:215`), apagando rótulos. Baixo.
- P-8 [FATO] Sem formato de célula: valores saem como número cru, sem formato monetário nem total (`sheetFile.js:80-85`). O Excel em pt-BR mostra vírgula; em outros idiomas, ponto. Baixo.
- Dependência: `xlsx ^0.18.5` (`package.json:23`), lê arquivo do usuário. [HIPÓTESE] versões 0.18.x têm avisos de segurança conhecidos; verificar com `npm audit`. Fora do meu papel: devsecops-engineer.

## 7. Outros achados de cálculo
- D-15 [FATO] Relatório de Transporte usa `num(x.cost)` (`Custos.jsx:184`), não `getTransportCost`; para dado legado mostra R$ 0 onde o Total conta o valor (Baixo, P).
- D-18 [FATO] `a.date.localeCompare` sem `String()` nos relatórios de Alimentação e Atrações (`Custos.jsx:194,204`) quebra a tela com item sem data; "Outras" já usa `String` (`:214`). Baixo, P.
- D-17 [FATO] Cancelamento com duas regras: `isCanceled` sem caixa (`costs.js:11-13`), `dayLodging` e `normStatus` com caixa exata (`costs.js:24`, `:96-99`). Com status `cancelado` (dado legado ou JSON), o item sai do Total mas aparece como Planejado no gráfico de status (Baixo, P).
- D-19 [FATO] Em `PaymentFields`, o rateio mostra valor mesmo para item cancelado (usa `valor` da tela, `Dias.jsx:455`), enquanto o domínio zera. Baixo.
- D-21 [FATO] "Modo orçamento" sem orçamento: não há campo de limite, previsto, realizado nem saldo. Há só Total e distribuição.

## 8. Achados consolidados e lista priorizada

| Id | Achado | Severidade | Esforço | Rótulo |
|---|---|---|---|---|
| D-1 | Datas com `toISOString` sobre meia-noite local: em UTC+ some uma diária por cidade e as datas recuam um dia | Alto | P a M | HIPÓTESE (código `dates.js:19,50,262`, `generate.js:48,179`) |
| D-2 | Acerto confirmado não abate saldo; despesa nova mostra valor bruto, com risco de pagar em duplicidade | Alto | M | FATO + conta própria |
| D-3 | Sem multimoeda para público que viaja ao exterior | Alto | G | FATO |
| D-4 | Texto "Ninguém deve nada" contradiz saldos quando há despesa sem pagador ou pagador removido | Médio | P | FATO + conta própria |
| D-5 | Cidade totalmente sobreposta conta na divisão e não no Total | Médio | P | FATO |
| D-6 | Remover ou adicionar participante muda divisões antigas sem aviso | Médio | M | FATO |
| D-7 | "Por pessoa" usa `travelers`; divisão usa participantes | Médio | P | FATO |
| D-8 | "Pago %" por contagem, sem hospedagem, com itens de custo 0; diverge de "Por status" | Médio | P | FATO |
| D-9 | "Por status" mistura Cancelado na lista sem aviso e sem % | Médio | P | FATO |
| D-14 | Visões por cidade e dia excluem itens sem data; soma menor que o Total, sem aviso | Médio | P | FATO |
| D-16 | Partes e transferências não fecham a centavos (9,99 contra 10,00; 66,66 contra 66,67) | Médio | M | FATO + conta própria |
| D-20 | Item com data fora das cidades altera Dias, "Por dia" e período; exclusão em cascata por nome | Médio | P | FATO |
| P-1 | Importação com coluna ou célula ausente zera status e custo de itens existentes | Médio | P | FATO |
| P-2 | Dinheiro em texto vira 0 em silêncio; formato americano; negativos | Médio | P | FATO |
| P-3 | Exportação perde campos legados de transporte e regrava custo 0 | Médio | P | FATO / HIPÓTESE (dado legado) |
| P-6 | Importação não valida check-out e sobreposição | Médio | P | FATO |
| D-15, D-17, D-18, D-19, P-4, P-5, P-7, P-8, I13 | Itens de acabamento listados acima | Baixo | P | FATO |

### Melhorias de indicadores, em ordem
1. D-1: tornar a geração de datas independente do fuso (formatar pela data local, não por UTC) e rodar a suíte com `TZ=Europe/Lisbon` e `TZ=Asia/Tokyo` além de `America/Sao_Paulo` e `UTC` (P a M). Confirmar primeiro por execução (seção 9).
2. D-2: registrar pagamentos do acerto como lançamentos e calcular o acerto sobre o saldo residual (M). Inclui o teste da seção 2.3.
3. Invariantes de totais com teste: Total = soma por categoria = soma por status ativo = `splitSummary.total` (com sobreposição e itens sem data); resolve D-5, D-14 e parte de D-8 (P).
4. Fichas e rótulos honestos (P): renomear "Pago" para "Pago (R$ x de y)" por valor; "Total (sem cancelados)"; "Por pessoa (média, N viajantes)"; ajuda de campo "valor do grupo" em transporte e atrações; unificar D-7 usando participantes quando houver.
5. Dinheiro e rateio em centavos inteiros, com maior resto (D-16, M).
6. Importação: ignorar coluna ausente, rejeitar dinheiro inválido, validar datas e exportar campos legados normalizados (P-1, P-2, P-3, P-6, P-4; P no conjunto).
7. Visual: barra empilhada por status com Cancelado à parte; cor só em categoria; série por dia; linha de total e exportar no relatório (seção 5, P a M).
8. Multimoeda (D-3, G) conforme seção 3, depois de 1 a 4.
9. Avisos de qualidade no painel: "N itens sem valor", "N itens sem data ou fora das cidades", "R$ X sem pagador" (P).
10. Orçamento: limite por viagem e por categoria, com previsto, comprometido (Reservado + Pago) e pago (M; relevância de negócio a validar com o product-manager).

## 9. Não verificado
Nada abaixo foi executado. O Head deve rodar, quando houver terminal liberado:
1. `npm test` (hoje cobre só `src/domain`): confirmar que a suíte passa como está.
2. `TZ=Europe/Lisbon npm test` e `TZ=Asia/Tokyo npm test`: confirma ou refuta D-1 (falhas esperadas em datas e hospedagem).
3. Teste novo, sem alterar código de produção: para as contas da seção 2 (acerto com 3 pessoas, confirmação seguida de despesa, despesa sem pagador, cidade totalmente sobreposta em `splitSummary` contra `totals`). As contas aqui foram refeitas em Python (`/tmp/claude-0/-home-user/2730c3f9-0804-5a61-bc5b-a6909d896ccb/scratchpad/sim.py`), que replica a lógica lida e não o código.
4. `npm audit` para a dependência `xlsx`.
5. Legibilidade em celular e comportamento do leitor de tela nos gráficos (precisa de navegador).
6. Se há viagens reais com campos legados (`custo`, `valor`, `data`, cidades sem `id`): consulta de leitura somente na base, fora do alcance desta sessão.
