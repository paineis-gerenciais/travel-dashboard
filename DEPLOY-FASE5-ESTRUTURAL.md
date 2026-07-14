# Guia de implantação — Fase 5 estrutural (os seis rethinks de UX)

Diferente das fases anteriores, esta mistura duas categorias de risco:

- **5.A, 5.B, 5.C, 5.E** — só camada de apresentação. Mesmo critério de aceite
  da Fase 3/4-UX: não tocam Firestore nem regras.
- **5.D** — introduz uma dependência de infraestrutura nova (geocodificação e
  tiles de mapa via OpenStreetMap/Nominatim), sem chave de API, mas com
  política de uso a respeitar (ver nota abaixo).
- **5.F** — **toca o Firestore e as regras de segurança** (novas coleções
  `comments` e `activity`). Herda o mesmo rigor de teste da Fase 2: **os testes
  de regras no emulador são obrigatórios antes do deploy**, não opcionais.

## O que muda para o usuário

- **Nova aba "Por dia (beta)"**: navegação por dia em vez de por categoria.
  No celular, arraste o cartão para o lado para trocar de dia; no desktop, os
  botões "Dia anterior / Próximo dia" continuam sempre visíveis.
- Uma **linha do tempo horizontal** no topo dessa aba, com um dia por marcador,
  agrupado por cidade.
- Um par de botões **"Montar" / "Orçamento →"** no topo da aba, formalizando a
  ideia de dois modos (a aba nova = montar; as abas de categoria = orçamento).
- Na aba **Mapa**, um botão **"Ver mapa"** por dia, que abre um mapa de verdade
  (OpenStreetMap) com os pontos localizados — ao lado do botão "Rota" que já
  existia.
- Um botão **🌈 Colorido / ⬛ Minimalista** (ao lado do de modo escuro) alterna
  entre a paleta de 10 cores atual e uma paleta neutra de acento único.
- Em cada item da aba "Por dia", um ícone de comentário (💬) permite conversar
  sobre aquele item específico com quem compartilha a viagem.
- Na tela Resumo, um card **"Atividade recente"** mostra os últimos eventos
  (cidade adicionada, item marcado como pago, item do checklist concluído).

## Parte 1 — Preparar e rodar os testes locais

```bash
git checkout main && git pull
git checkout -b fase-5-estrutural
npm install
npm test          # 33 testes de domínio — devem continuar passando
npm run build     # deve terminar limpo
```

## Parte 2 — Testes de regras (obrigatório, por causa do 5.F)

```bash
npm run test:rules
```

Isso roda no emulador (precisa de Java, como nas fases anteriores) e agora
inclui os testes novos de **comentários** e **atividade**: confirma que um
estranho sem acesso à viagem não lê nem cria nada nessas duas coleções, e que
só o autor de um comentário pode apagá-lo. **Não prossiga sem esses testes
verdes** — é a mesma regra de ouro da Fase 2.

## Parte 3 — Publicar as regras novas

```bash
firebase deploy --only firestore:rules
```

Como da Fase 2: as regras precisam estar em produção antes (ou junto) do
deploy do app, senão os comentários e a atividade falham com erro de
permissão.

## Parte 4 — PR, prévia e merge

```bash
git add .
git commit -m "Fase 5 estrutural: os seis rethinks de UX (5.A a 5.F)"
git push -u origin fase-5-estrutural
```

Abra o PR e teste na **prévia** antes do merge, como sempre.

## Testar na prévia

- [ ] **Aba "Por dia"**: navegar pelos dias; no celular, arrastar o cartão
      muda de dia; no desktop, os botões funcionam. A timeline no topo também
      pula de dia ao tocar num marcador.
- [ ] **Modo Montar/Orçamento**: o botão "Orçamento →" leva à tela Custos.
- [ ] **Mapa embutido**: em um dia com pontos, tocar "Ver mapa" localiza os
      pontos no mapa (pode levar alguns segundos — a geocodificação é
      deliberadamente devagar, 1 busca por segundo, para respeitar o serviço
      gratuito). Testar também um dia sem pontos localizáveis.
- [ ] **Paleta**: alternar 🌈/⬛ e conferir legibilidade nos dois modos, claro e
      escuro.
- [ ] **Comentários** (precisa de duas contas, como no teste de
      compartilhamento da Fase 2): a conta A comenta um item na aba "Por dia";
      a conta B vê o comentário aparecer. B tenta apagar o comentário de A —
      deve falhar (só o autor apaga).
- [ ] **Atividade**: marcar um item como "Pago", concluir um item do
      checklist, adicionar uma cidade — os três devem aparecer no card
      "Atividade recente" do Resumo, para as duas contas.
- [ ] **Isolamento** (o teste que mais importa): uma terceira conta sem acesso
      à viagem não deve conseguir ver comentários nem atividade dela.

## Notas e decisões de infraestrutura (leia antes de decidir manter)

- **5.D usa OpenStreetMap + Nominatim, sem chave de API.** Isso evita uma
  dependência paga, mas tem um custo: a busca é limitada a 1 por segundo (por
  política de uso do Nominatim) e os resultados ficam cacheados no navegador
  (`localStorage`) para não repetir. Para uso pessoal/familiar isso é
  perfeitamente adequado. Se um dia isso virar um app com tráfego alto, a
  troca por um provedor de geocodificação pago (Google/Mapbox) seria
  necessária — mas não há essa necessidade hoje.
- **5.F cria duas coleções novas no Firestore** (`comments`, `activity`) por
  viagem, isoladas com as mesmas regras de member-only das demais subcoleções.
  O feed de atividade só registra eventos discretos e intencionalmente
  **esparsos** (não cada tecla digitada) — status virando "Pago", cidade
  criada/removida, item do checklist concluído — para não virar ruído nem gerar
  uma escrita a cada segundo.
- **A paleta "minimalista" (5.E) é uma opção, não uma substituição.** O padrão
  continua sendo "Colorido" (a identidade visual de sempre); a alternativa fica
  disponível para quem preferir, exatamente como o diagnóstico recomendava
  testar as duas.
- **A aba "Por dia" é aditiva.** Nenhuma das 10 abas originais foi alterada ou
  removida — dá para comparar as duas formas de navegar antes de decidir se
  vale promover uma delas a experiência principal (e, se um dia isso
  acontecer, seria uma decisão separada, não implícita nesta fase).
