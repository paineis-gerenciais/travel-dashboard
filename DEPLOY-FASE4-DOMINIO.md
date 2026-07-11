# Guia de implantação — Fase 4 (lógica de domínio: dias multi-cidade, Casa, café da manhã)

> **Não confundir** com a `DEPLOY-FASE4.md` anterior (aquela era a "UX pontual":
> ícone de avião, duração h/min, editor de rota). Esta é a **Fase 4 do plano
> mestre v6** — lógica de domínio. Nomes colidem; o conteúdo é diferente.

Esta fase **mexe na lógica de domínio e no formato dos dados** (campos novos:
`breakfastIncluded` na cidade, `autoBreakfast` na refeição, `autoHome` no
transporte). Porém **não muda as regras do Firestore** — o Firestore é
schemaless, os campos novos só trafegam. Logo: **sem deploy de regras, sem
migração**. O que muda o rigor aqui é a lógica: por isso os testes de domínio são
o portão principal.

## O que muda para o usuário

- **Cidades**: caixa "Café da manhã incluso" ao lado da hospedagem. Marcada, a
  Alimentação ganha a linha "Café da manhã" com o nome do hotel (editável).
  **Desmarcar remove** essa linha automática — a menos que você já a tenha
  editado (aí ela permanece como sua).
- **Cidades**: painel de aviso quando há **dia sem cidade** (buraco) ou **duas
  cidades no mesmo dia** (sobreposição real — check-out/check-in no mesmo dia
  não é acusado).
- **Alimentação**: não nasce mais com 5 linhas vazias por dia. Cada dia tem
  **+ item**. (Botão para **remover as vazias legadas** de viagens antigas.)
- **Roteiro e Mapa**: o dia de troca de cidade mostra **"Lisboa → Porto"**; o
  primeiro dia mostra **"Casa → primeira cidade"** e o último **"última cidade →
  Casa"**.
- **Transporte**: a viagem passa a ter **duas linhas automáticas** — ida
  (Casa → primeira cidade) e volta (última cidade → Casa) — com datas que se
  ajustam sozinhas ao primeiro e último dia.

## Passos

```bash
git checkout main && git pull
git checkout -b fase-4-dominio
npm install
npm test          # 33 testes (inclui os 9 novos da Fase 4) — devem passar
npm run build     # limpo
```

```bash
git add .
git commit -m "Fase 4 (dominio): dias multi-cidade, Casa, cafe da manha, sem refeicoes vazias"
git push -u origin fase-4-dominio
```

Abra o PR `fase-4-dominio → main` e teste **na prévia**.

> Sem `firebase deploy --only firestore:rules` — as regras não mudaram.

## Testar na prévia

Com uma **viagem nova** (ou o modelo de exemplo):
- [ ] **Café da manhã**: marque numa cidade → a linha aparece na Alimentação com
      o hotel; desmarque → some (se não editada). Edite uma linha, desmarque →
      ela permanece.
- [ ] **Alimentação** não tem mais linhas vazias; **+ item** por dia funciona.
- [ ] **Validação** na Cidades: crie um buraco (datas com lacuna) e uma
      sobreposição real (duas cidades cobrindo o mesmo dia) → os avisos aparecem;
      um check-out/check-in normal **não** dispara aviso.
- [ ] **Roteiro/Mapa**: primeiro dia "Casa → cidade"; dia de troca "A → B";
      último dia "cidade → Casa".
- [ ] **Transporte**: existem as duas linhas Casa (ida e volta) com as datas nas
      pontas; mudar as datas da viagem reajusta essas datas.

Com uma **viagem existente** (importante):
- [ ] Ao abrir, as **duas linhas de transporte Casa** são adicionadas
      automaticamente (é esperado).
- [ ] As **5 refeições vazias antigas** ainda aparecem; use **"Remover N
      refeição(ões) vazia(s)"** para limpá-las de uma vez.
- [ ] Cálculos de custo (totais, hospedagem, regra do cancelado) **idênticos** ao
      de antes — esta fase não mexe na matemática.

## Merge

Prévia validada → merge para `main` → deploy automático.

## Notas e decisões

- **"Casa" não é uma cidade real** — é um rótulo de exibição/sentinela. Não
  aparece na lista de cidades, não gera diária, não pode ser excluída por engano.
  Se um dia você quiser um endereço de casa configurável, o caminho é um campo em
  `settings`, não uma entrada em `cities`.
- **Linhas Casa (transporte)**: a data e o lado "Casa" são automáticos; o outro
  lado (cidade) é preenchido só se estiver vazio, e meio/custo/horário são seus.
  Elas não são removidas pela exclusão em cascata de cidade.
- **Café automático**: enquanto não editado, o local acompanha o nome do hotel;
  ao editar qualquer campo dele, ele "vira seu" e para de ser gerido
  automaticamente (não some ao desmarcar).
- **Sem migração**: campos novos convivem com dados antigos; nada precisa ser
  convertido.
