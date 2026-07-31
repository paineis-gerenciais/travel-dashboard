# Guia de implantação — Ajustes pós-Fase 1

Corrige três defeitos (dois deles regressões introduzidas por mim na Fase 1) e
evolui a divisão de despesas com participantes identificados, rateio percentual e
edição no próprio relatório.

**Muda o modelo de dados** (participantes e rateio) com migração automática, mas
**não muda as regras do Firestore**.

---

## 1. Bugs corrigidos

| Problema | Causa-raiz | Correção |
|---|---|---|
| **Tela Dias não abria no dia de hoje** | O cálculo estava no inicializador do `useState`, que roda **uma vez só** — e o `TripProvider` renderiza a tela **antes** de o Firestore responder, com estado vazio. A lista de dias era `[]`, o índice virava 0 e nunca mais era recalculado. | O posicionamento passou para um efeito, que roda quando os dias realmente aparecem (uma vez por viagem). |
| **Campos de edição "selecionavam o ✕"** | Regressão do focus trap: eu focava "o primeiro elemento focável", e na ordem do DOM o cabeçalho vem antes do conteúdo — o primeiro focável era o botão de fechar. Além de estranho, um Enter distraído fechava a folha. | Passa a focar o **próprio diálogo** (prática recomendada): não pré-seleciona nenhum botão e faz o leitor de tela anunciar o título. |
| **Tela voltava ao topo sozinha (divisão de despesas, no celular)** | Regressão da correção do teclado no iPhone: eu guardava a altura visível em **estado do React** e ouvia também o evento `scroll` do visual viewport. No celular, cada rolagem disparava um `setState` → re-renderização → a altura mudava → a rolagem saltava. Em folhas longas, como a divisão de despesas, era constante. | A altura passou a ser escrita direto no elemento via `ref` (sem estado, sem re-render), ouvindo só `resize` — que é o evento que de fato importa quando o teclado abre. |

---

## 2. Transportes automáticos de/para "Casa": removidos

Eles apareciam sem o usuário pedir e obrigavam a editar ou apagar algo que ele
não criou. Quem quiser registrar a ida e a volta agora adiciona manualmente.

**Decisão importante que acompanha isso:** o **dia do check-out continua
existindo** na tela Dias. Antes ele só aparecia por efeito colateral — o
transporte automático de volta era datado nele. Agora `allPlanningDates` inclui
esse dia **por direito próprio**, porque é o dia em que você viaja de volta.
Sem isso, remover os transportes faria a viagem perder o último dia.

O custo de hospedagem **não muda**: o dia de check-out nunca gerou diária
(o intervalo é `[check-in, check-out)`).

**Migração automática, com cuidado:** viagens já salvas têm essas linhas no
banco. Ao abrir, as automáticas **ainda intocadas** são removidas; as que você
**editou** (preencheu meio de transporte, horário, custo, duração ou notas) são
**preservadas** e simplesmente deixam de ser automáticas. Nada que você digitou
é apagado.

---

## 3. Divisão de despesas: o que mudou

### Participantes agora têm identificador (não são mais só nomes)

Antes, cada despesa guardava o **nome** de quem pagou. Renomear "Ana" para
"Ana Silva" órfãva silenciosamente todas as despesas dela — elas saíam da conta
e viravam "sem pagador". Agora o vínculo é por um `id` estável e o nome é só
exibição: **renomear não quebra nada**, que era o item pedido.

A migração é automática e idempotente: listas antigas de nomes viram objetos com
id, e cada `paidBy` que guardava um nome é reapontado para o id certo. Um
`paidBy` que aponte para alguém que não existe mais é limpo.

### Rateio percentual por participante

Cada despesa pode ter um percentual por pessoa, em vez da divisão igual. Se os
valores não somarem 100, o sistema **normaliza proporcionalmente** — digitar
3 e 1 equivale a 75% e 25%. A tela mostra a soma ao vivo e avisa quando ela será
ajustada.

Sem rateio definido, a despesa continua dividida igualmente — nada muda para
quem não usa o recurso.

### Hospedagem entra na divisão

A cidade/hospedagem agora aceita "quem pagou" e rateio, como qualquer outra
despesa. Antes ela era sempre contabilizada como "gasto do grupo sem pagador",
o que distorcia o acerto.

### Lista de gastos por participante, editável

Na divisão de despesas, cada pessoa pode ser expandida para mostrar os gastos
ligados a ela (pagos e/ou de sua responsabilidade), com o percentual e o valor
da parte dela. Dali é possível abrir e editar **valor, status, quem pagou e o
rateio**.

> Nota de projeto: isto **reverte parcialmente** uma decisão do redesign, que
> separava "montar" (Dias/Cidades) de "consultar" (relatórios só de leitura). Na
> prática, editar direto onde o problema aparece se mostrou mais útil.

---

## 4. Relatório de Alimentação

O café da manhã **incluso na hospedagem e sem custo** não aparece mais no
relatório — não é gasto, só poluía a lista. Ele continua visível na tela Dias,
onde tem valor informativo ("hoje o café está incluso").

Cafés com custo maior que zero, e refeições adicionadas manualmente, aparecem
normalmente.

---

## 5. Passos

```bash
git checkout main && git pull
git checkout -b ajustes-pos-fase1
npm install

npm test             # 74 testes de domínio (eram 63)
npm run build        # produção
npm run test:rules   # regras não mudaram, mas vale confirmar
npm run test:e2e     # 12 testes
```

```bash
git add -A
git commit -m "Corrige dia inicial, foco do sheet e salto de rolagem; remove transportes automaticos; divisao com ids e rateio"
git push -u origin ajustes-pos-fase1
```

> **Sem `firebase deploy --only firestore:rules`** — nenhuma regra mudou. Os
> campos novos (`paidBy`, `split` e o formato de `participants`) trafegam sem
> alteração de regra, como sempre.

---

## 6. Testar na prévia

**Os três bugs:**
- [ ] Abrir a tela Dias numa viagem **em curso** → abre no dia de hoje. Numa
      viagem **futura** → primeiro dia. Numa **passada** → último dia.
- [ ] Abrir a edição de qualquer item → **nenhum campo ou botão aparece
      pré-selecionado**; o ✕ não fica destacado.
- [ ] **No celular**, abrir Custos › Divisão de despesas, expandir participantes
      até a lista ficar longa, e rolar: a tela **não volta ao topo**.
- [ ] Ainda no celular, abrir a edição de um item e tocar num campo de texto: o
      teclado abre e o botão de excluir **continua alcançável** (a correção
      original do iPhone não foi perdida).

**Transportes automáticos:**
- [ ] Numa viagem **existente** que tinha as linhas de Casa intocadas → elas
      desaparecem ao abrir.
- [ ] Se você havia **editado** uma delas (ex.: pôs "Voo" e o valor) → ela
      **permanece**, agora como transporte comum.
- [ ] O **último dia** (check-out) continua aparecendo na tela Dias, com o
      rótulo "cidade → Casa".
- [ ] O total de hospedagem **não mudou**.

**Divisão de despesas:**
- [ ] Cadastrar participantes; **renomear um deles** → o nome muda em "quem
      pagou" de todas as despesas, sem perder nenhuma atribuição.
- [ ] Remover um participante → as despesas dele ficam sem pagador, sem erro.
- [ ] Definir rateio 70/30 numa despesa → os valores por pessoa refletem isso.
- [ ] Digitar percentuais que somam 90 → o aviso aparece e o cálculo normaliza.
- [ ] Definir "quem pagou" na **hospedagem** (tela Cidades) → aparece na divisão.
- [ ] Expandir um participante → ver os gastos dele; editar valor/status/pagador
      dali e conferir que o acerto recalcula.

**Alimentação:**
- [ ] Relatório não mostra mais café incluso de custo zero; mostra café pago.

---

## 7. Notas

- **74 testes de domínio** cobrem toda a matemática nova: rateio, normalização
  de percentuais, hospedagem na divisão, migração de nomes para ids e a
  preservação do vínculo ao renomear.
- Se algum dia fizer sentido remover um participante que pagou coisas, hoje as
  despesas dele ficam "sem pagador" (não são apagadas). Isso é intencional — o
  gasto existiu, só perdeu o responsável.
