# Guia de implantação — Swipe rígido, rodapé fixo (app-shell) e arrastar rotas

Três ajustes na tela Dias e no Mapa. O mais delicado é o segundo: muda a forma
como a página inteira rola (de "rola a janela" para "rola só o miolo"). Vale
testar com mais atenção que o normal.

## O que mudou

- **Swipe mais rígido** (Dias): o cartão acompanha o dedo com mais resistência
  e exige um arrasto mais decidido para trocar de dia.
- **Rodapé nunca mais solta** (Dias e geral): a tela virou um **app-shell** —
  cabeçalho e barra inferior são elementos de layout fixos por construção; só o
  miolo da tela rola. Resolve na raiz o bug de `position: fixed` escorregando
  com conteúdo de altura variável (exatamente o caso de "voltar para um dia com
  muitos itens").
- **Reordenar rota arrastando** (Mapa): os botões ↑↓ saíram; agora se arrasta
  cada parada pela alça ⠿, no mouse ou no toque.

Nada disso toca o domínio, os custos ou o Firestore.

## Passos

```bash
git checkout main && git pull
git checkout -b ajustes-swipe-rodape-rota
npm install
npm test          # 37 testes de domínio
npm run build     # limpo
```

```bash
git add -A
git commit -m "Swipe mais rigido, rodape via app-shell, reordenar rota arrastando"
git push -u origin ajustes-swipe-rodape-rota
```

Abra o PR e teste na **prévia**.

> **Sem deploy de regras** — nada mudou no Firestore.

## Testar na prévia (celular real — é onde tudo isso se prova)

- [ ] **Swipe em Dias**: arrastar um pouco não troca de dia (volta sozinho);
      um arrasto mais firme troca. Compare com a sensação de antes.
- [ ] **Rodapé**: navegue até um dia com **muitos itens** (o cartão fica alto) e
      confira se a barra de 5 destinos continua colada embaixo, sem se soltar
      ao rolar ou durante o swipe. Teste também com o teclado aberto (editando
      um campo) e com a barra de endereço do navegador escondendo/aparecendo ao
      rolar.
- [ ] **Rolagem geral**: confira se rolar dentro de qualquer tela continua
      natural (o miolo rola, cabeçalho e barra ficam parados).
- [ ] **Mapa › Rota**: arrastar uma parada pela alça ⠿ reordena a lista, tanto
      no toque quanto no mouse (desktop). O link do Google Maps reflete a nova
      ordem.
- [ ] **Desktop**: cabeçalho/barra continuam no topo, nada quebrou no layout.

## Se algo parecer estranho

- **Rolagem "diferente" da experiência do navegador** (por exemplo, o gesto de
  "puxar para atualizar" do celular sumir): é um efeito colateral conhecido de
  mover a rolagem da janela para um elemento interno. Se incomodar, me avise —
  dá para restaurar o comportamento nativo em troca de reintroduzir algum risco
  do bug antigo do rodapé.
- **Arrastar trava em algum navegador do celular**: me diga qual (Chrome
  Android, Safari iOS, etc.) — a detecção por toque pode precisar de ajuste de
  sensibilidade específico para esse navegador.
