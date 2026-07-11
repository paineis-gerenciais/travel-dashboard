# Guia de implantação — Fase 4 (UX pontual + itens novos)

Como a Fase 3: **só apresentação** — não muda o modelo de dados nem as regras do
Firestore. Sem deploy de regras, sem migração. Fluxo normal branch → PR →
prévia → merge.

## Passos

```bash
git checkout main && git pull
git checkout -b fase-4
npm install
npm test          # 24 testes (inclui duração), devem passar
npm run build     # deve terminar limpo, com os chunks separados
```

```bash
git add .
git commit -m "Fase 4: UX pontual + ícone avião, duração h/min, mapa editável, transporte mobile"
git push -u origin fase-4
```

Abra o Pull Request `fase-4 → main` e teste **na prévia**.

> Não é preciso `firebase deploy --only firestore:rules` — as regras não mudaram.

## Testar na prévia (com atenção ao que é visual)

Desktop:
- [ ] **Chips de status** coloridos e clicáveis nas tabelas.
- [ ] **Alimentação**: linhas vazias ocultas por padrão; contador "X de N
      preenchidas"; botão "Mostrando todas" revela as vazias.
- [ ] **Dinheiro apagado** em R$ 0,00 até preencher.
- [ ] **Roteiro**: clicar num bloco leva à tela de edição.
- [ ] **Selo "Salvo"/"Salvando…"** no cabeçalho.
- [ ] **Modelo**: no seletor, "Começar de um modelo" cria viagem preenchida.
- [ ] **Transporte**: campo Tempo é contador de horas/minutos; a duração aparece
      no **Roteiro** e nos pontos do **Mapa**.
- [ ] **Mapa**: um botão **Rota** por dia; abre o editor para incluir/remover/
      reordenar paradas e então "Abrir no Google Maps".

Celular real:
- [ ] **Ícone do app**: ao instalar (Adicionar à tela inicial), o ícone é o
      **avião**. (Pode ser preciso reinstalar o PWA para atualizar o ícone.)
- [ ] **Aba ativa** sempre visível/centralizada na barra inferior.
- [ ] **Transporte** em layout compacto, utilizável no toque.
- [ ] **Editor de rota** confortável no toque (reordenar com ↑/↓).
- [ ] Modo escuro legível nas telas claras (Atrações, Outras).

## Merge

Prévia validada → merge para `main` → deploy automático publica.

## Notas

- **Ícone do PWA**: navegadores cacheiam o ícone agressivamente; para ver o avião
  pode ser necessário remover e reinstalar o app na tela inicial.
- **Duração** é gravada em minutos no mesmo campo `duration` — durações antigas
  em texto livre ("2h30", "150") continuam sendo lidas corretamente.
- **Editor de rota**: a ordem/edição das paradas é da sessão (não persiste); ao
  reabrir, parte de novo da rota sugerida do dia. Persistir seria uma mudança de
  modelo de dados, fora do escopo desta fase.
- **Ocultar vazias** é só de exibição — os totais consideram todos os itens.
