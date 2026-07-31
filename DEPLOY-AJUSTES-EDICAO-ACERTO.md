# Guia de implantação — Correções de edição e melhorias no acerto

Cinco itens: três correções (duas delas regressões minhas) e duas melhorias na
divisão de despesas.

**Não muda as regras do Firestore.**

---

## 1. Correções

### O foco saía do campo a cada caractere digitado

O sintoma era não conseguir digitar: a cada letra, a seleção pulava do campo
para a tela inteira.

**Causa-raiz:** o efeito que dá o foco inicial ao diálogo tinha `onClose` como
dependência — e `onClose` chega como função inline (`onClose={() => setX(null)}`),
ou seja, **uma função nova a cada renderização**. Como digitar renderiza, o
efeito re-executava a cada tecla e o `focus()` roubava o cursor.

Vale notar: é a **mesma causa** do problema anterior em que o botão ✕ aparecia
selecionado ao abrir a edição. Naquela vez eu troquei *qual* elemento recebia o
foco, mas não impedi o efeito de re-executar — corrigi o sintoma, não a causa.
Agora o foco inicial roda **só na montagem**, e `onClose` vive num `ref`.

### Datas se sobrepondo no desktop

No desktop, a grade de duas colunas virava **quatro** (regra pensada para as
métricas). Espremido em 1/4 da largura, o campo de data — que tem interface
nativa com largura mínima — transbordava por cima do campo vizinho.

Agora há duas grades separadas: `.grid-2` (formulários, sempre 2 colunas) e
`.grid-metrics` (métricas, 2 no celular e 4 no desktop). Campos de data também
ganharam `min-width: 0`.

### "Quem pagou" não persistia com nomes automáticos

Enquanto ninguém é cadastrado, a lista de participantes é gerada na hora
("Viajante 1", "Viajante 2") e **esses ids não existem no banco**. Ao escolher
um deles como pagador, a referência era descartada no carregamento seguinte e o
campo voltava vazio — silenciosamente.

Agora, ao atribuir um pagador (ou um rateio) pela primeira vez, os participantes
automáticos são **materializados** como registros de verdade, mantendo os mesmos
ids já exibidos. A partir daí tudo persiste normalmente.

---

## 2. Melhorias

### Confirmar que o acerto foi feito

Cada linha do acerto ganhou um botão **✓ Confirmar pagamento**. Confirmado, a
linha fica marcada (e dá para desfazer). O cabeçalho mostra quantos acertos
seguem pendentes.

**Detalhe importante do comportamento:** a confirmação guarda também o *valor*.
Se novas despesas mudarem quanto alguém deve, o acerto antigo **volta a aparecer
como pendente** — em vez de ficar marcado como resolvido escondendo uma dívida
nova. A tela avisa isso quando há acertos confirmados.

### Percentuais com 2 casas decimais

Divisões que não fecham (1/3, por exemplo) agora aparecem como **33,33%** em vez
de arredondadas para 33%, tanto nos campos de rateio quanto na lista de gastos
por participante. Ao lado de cada percentual aparece o valor correspondente em
reais, e o campo aceita casas decimais.

Na divisão igual, a tela passa a mostrar explicitamente quanto é por pessoa
(percentual e valor), em vez de só dizer "dividido igualmente".

---

## 3. Passos

```bash
git checkout main && git pull
git checkout -b ajustes-edicao-acerto
npm install

npm test             # 77 testes de domínio (eram 74)
npm run build
npm run test:e2e     # 12 testes
```

```bash
git add -A
git commit -m "Corrige foco na edicao e datas no desktop; pagador com nomes automaticos; confirma acerto; percentuais com 2 casas"
git push -u origin ajustes-edicao-acerto
```

> Sem deploy de regras.

---

## 4. Testar na prévia

**As correções:**
- [ ] Abrir a edição de qualquer item e **digitar uma frase inteira** num campo
      de texto: o cursor permanece no campo, sem pular.
- [ ] O mesmo na edição de cidade e na de despesa dentro da divisão.
- [ ] **No desktop**, abrir a edição de uma cidade: os campos de check-in e
      check-out aparecem lado a lado, **sem sobreposição**, e ambos abrem o
      seletor de data normalmente.
- [ ] Numa viagem **sem participantes cadastrados**, definir "quem pagou" num
      item, fechar e reabrir o app: a escolha **continua lá**, e os
      participantes aparecem cadastrados na divisão.

**As melhorias:**
- [ ] Na divisão, confirmar um acerto → ele fica marcado e o contador de
      pendentes diminui.
- [ ] Depois de confirmar, **adicionar uma despesa nova** que mude o valor
      devido → o acerto volta a aparecer como pendente.
- [ ] Definir um rateio entre 3 pessoas em partes iguais → aparece 33,33% para
      cada, com o valor em reais ao lado.
