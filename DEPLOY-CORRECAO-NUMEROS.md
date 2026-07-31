# Guia de implantação — Correção dos números da divisão de despesas

Corrige percentuais e valores absurdos na divisão de despesas
(ex.: `33.333.333.333.333.336%` e `R$ 58.333.333.333.333.330,00`).

**Não muda regras do Firestore. Não muda dados salvos** — o defeito era de
cálculo/exibição, não de armazenamento.

---

## A causa-raiz

A função `num()`, que converte valores para número, trata **ponto seguido de 3
dígitos como separador de milhar**. Isso está certo para texto digitado no
formato brasileiro (`1.750,00` → 1750), e é assim desde a versão original do
projeto.

O problema: ela transformava o valor em texto **antes** de converter. Quando
recebia um número de verdade com muitas casas decimais — como o percentual de
uma divisão em 3 partes, `33.333333333333336` —, o ponto decimal era removido
como se fosse milhar:

```
33.333333333333336  →  "33.333333333333336"  →  "33333333333333336"
                                                 = 3,3 × 10¹⁶
```

Daí os percentuais e valores gigantes.

O defeito é antigo, mas ficou **latente** enquanto só passavam por ali valores
de dinheiro com 2 casas (onde o ponto nunca é seguido de 3 dígitos). Ele só
apareceu agora porque o rateio percentual introduziu frações com muitas casas.

## A correção

`num()` passa a devolver **número como número**, sem passar pelo interpretador
de texto. A regra de texto continua idêntica para quem digita.

Como é uma função usada em todo o app, a correção protege qualquer outro cálculo
que venha a lidar com frações — não só a divisão de despesas.

## Testes

**84 testes de domínio** (eram 77). Os novos travam exatamente este caso:

- `num(100/3)` preserva `33.333333333333336`
- `num('1.750,00')` continua dando 1750 (a regra de texto não mudou)
- divisão igual entre 3 dá 33,33% e um terço do valor — e não 3,3 × 10¹⁶
- percentuais 1/1/1 normalizam para 33,33% cada, somando 100%
- a soma das partes de todos os participantes bate com o total da despesa

## Passos

```bash
git checkout main && git pull
git checkout -b correcao-numeros-divisao
npm install
npm test          # 84 testes
npm run build
npm run test:e2e  # 12 testes
```

```bash
git add -A
git commit -m "Corrige num() destruindo floats: percentuais e valores da divisao"
git push -u origin correcao-numeros-divisao
```

## Testar na prévia

- [ ] Divisão de despesas com **3 participantes**: a divisão igual mostra
      **33,33%** e o valor correto (um terço), não números astronômicos.
- [ ] Preencher o rateio com **1, 1, 1**: cada um mostra 33,33%, e o aviso
      "Soma: 3% — será ajustada proporcionalmente" aparece corretamente.
- [ ] Expandir os gastos de um participante: percentual e valor da parte dele
      com no máximo 2 casas.
- [ ] Uma hospedagem de R$ 250/diária × 7 diárias dividida em 3 mostra
      **R$ 583,33** por pessoa.
- [ ] Digitar um valor no formato brasileiro (ex.: `1.750,00`) num campo de
      custo continua funcionando normalmente — a regra de texto não mudou.
