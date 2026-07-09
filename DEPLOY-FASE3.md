# Guia de implantação — Fase 3 (interface, usabilidade e estética)

A Fase 3 é **só camada de apresentação**: não muda o modelo de dados do
Firestore nem as regras de segurança. Isso torna a implantação bem mais simples
que a Fase 2 — **não há deploy de regras nem migração**, é o fluxo normal de
branch → PR → prévia → merge. Em compensação, vários itens são visuais e só se
validam **no dispositivo** (principalmente no celular).

## O que muda para o usuário nesta fase

- **Modo escuro** (botão ☀️/🌙 nas ações e na tela "Minhas viagens").
- **Máscara monetária**: campos de custo formatam enquanto você digita
  (digite `1234` → vira `12,34`).
- **Menu de ações no celular**: as ações (Compartilhar, Versões, Limpar, etc.)
  antes **sumiam** no mobile; agora aparecem num menu "⋯ Ações".
- **Botão Sair** (logout) — que havia sumido na Fase 2 — de volta.
- **Paginação** em tabelas longas (Transporte, Alimentação, Atrações, Outras),
  que só aparece quando a lista é grande.
- **Diagnóstico**: um registro de erros da sessão, exportável.
- Refinos de tipografia/espaçamento e **code-splitting** (o app carrega mais
  rápido: Firebase e cada tela viram pacotes separados, carregados sob demanda).

## Parte 1 — Branch e dependências

```bash
git checkout main
git pull
git checkout -b fase-3
npm install
```

(Não há dependências novas nesta fase — o `npm install` é só garantia.)

## Parte 2 — Rodar os testes e o build localmente

```bash
npm test          # domínio: deve passar 22/22
npm run test:rules  # regras: devem continuar passando (não foram alteradas)
npm run build     # deve terminar sem erro
```

No fim do `npm run build`, repare que o bundle agora é **vários pacotes** em vez
de um só: um `firebase-*.js`, um `react-*.js`, um `index-*.js` pequeno, e um
pacote por tela (`Cidades-*.js`, `Custos-*.js`, etc.). É o code-splitting
funcionando — o navegador baixa só o que precisa e cacheia o Firebase separado.

## Parte 3 — Prévia por Pull Request

```bash
git add .
git commit -m "Fase 3: design, modo escuro, máscara monetária, mobile e code-splitting"
git push -u origin fase-3
```

Abra um Pull Request de `fase-3` para `main`. O workflow de PR sobe uma prévia
com URL própria (como nas fases anteriores). Teste **nessa URL**, não em
produção.

> Diferente da Fase 2, aqui **não** é preciso rodar `firebase deploy --only
> firestore:rules` — as regras não mudaram.

## Parte 4 — Testar na prévia (com atenção ao celular)

No **desktop**:

- [ ] **Modo escuro**: clique no botão 🌙 Escuro; a interface inteira escurece.
      Recarregue a página — a preferência persiste. Passe pelas 10 telas e
      confira que os textos ficam legíveis (contraste) nos dois modos.
- [ ] **Máscara monetária**: num campo de custo, digite dígitos e veja formar
      `1.234,56` da direita para a esquerda. Confirme que o total bate.
- [ ] **Paginação**: numa viagem com muitos dias/linhas, veja os controles
      "Anterior / Próxima" nas tabelas de Transporte/Alimentação/Atrações/Outras.
      Em viagens pequenas, não deve aparecer nada (correto).
- [ ] **Diagnóstico**: abra o botão Diagnóstico — deve listar erros da sessão
      (idealmente vazio).
- [ ] **Sair**: o botão Sair desloga e volta para a tela de login.

No **celular real** (não só no modo responsivo do navegador):

- [ ] **Menu de ações "⋯"**: toque em "⋯ Ações" no topo — o menu com
      Compartilhar/Versões/Limpar/Sair/tema deve descer. (Antes, no mobile,
      essas ações ficavam inacessíveis — este é o principal conserto.)
- [ ] **Modo escuro no celular**: alterne e confira legibilidade.
- [ ] **Máscara monetária** com o teclado numérico do celular.
- [ ] Navegação inferior (as 10 abas) continua funcionando.

## Parte 5 — Merge para produção

Com a prévia validada, faça o **merge** do PR para `main`. O deploy automático
publica (testes → build → deploy). Acompanhe na aba Actions até o verde.

> Lembrete da Fase 2: se o `deploy.yml` duplicado ainda existir no repositório,
> você verá dois deploys por push. Se ainda não removeu, é um bom momento
> (`del .github\workflows\deploy.yml` no Windows, commit e push).

## Checklist final (produção)

- [ ] Modo escuro alterna e persiste.
- [ ] Máscara monetária funciona nos campos de custo.
- [ ] Menu "⋯ Ações" acessível no celular.
- [ ] Botão Sair funciona.
- [ ] Paginação aparece só em listas grandes.
- [ ] App carrega rápido (code-splitting).
- [ ] Nada de comportamento diferente no compartilhamento/tempo real (a Fase 3
      não mexeu nisso).

## Notas e limitações conhecidas

- **Modo escuro precisa ser conferido no olho.** O contraste foi ajustado de
  forma conservadora, mas como envolve 10 temas de cor por seção, vale passar
  pelas telas mais claras (Atrações, Outras) e confirmar legibilidade — é o tipo
  de coisa que só a tela real revela.
- **Preferência de tema fica só no navegador** (localStorage), de propósito:
  assim a Fase 3 não toca no Firestore. Se você trocar de dispositivo, a
  preferência não viaja junto (comportamento esperado).
- **Máscara monetária** trata o campo como centavos: cada dígito empurra para a
  esquerda. Para apagar, use backspace normalmente.
- **Paginação** é client-side e só ativa acima de um limite (40 linhas ou 15
  dias). Não altera cálculos — os totais consideram todos os itens, não só a
  página visível.
- **Diagnóstico** guarda erros só da sessão atual, na memória do navegador (não
  grava no Firestore). Fecha o app, zera.
- **Item 2.0 (migração) continua fora de escopo** — sem relação com a Fase 3.
