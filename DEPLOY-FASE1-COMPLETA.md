# Guia de implantação — Fase 1 completa

Implementação do `fase1_backlog_v2.md`. É a maior leva desde o redesign: dois
bugs de dinheiro corrigidos, um terceiro descoberto no caminho, e onze recursos
novos.

**Muda as regras do Firestore** (coleção `feedback`) — os testes de regras no
emulador são obrigatórios antes do deploy.

---

## 0. Login por e-mail e senha (habilitação no Console)

A tela de login agora oferece **e-mail e senha**, além de Google e celular —
com criação de conta e "esqueci minha senha".

**Diferente do login por celular, este NÃO exige o plano Blaze.** É a forma mais
acessível de entrar no app, e resolve o bloqueio `auth/billing-not-enabled` que
aparece no SMS.

Ação necessária (uma vez):

1. Console do Firebase → **Authentication → Sign-in method**.
2. Habilite o provedor **E-mail/senha**.
3. Deixe a opção "Link de e-mail (login sem senha)" **desligada** — não é usada.

O e-mail de redefinição de senha é enviado pelo próprio Firebase, sem custo e
sem provedor de SMTP.

---

## 1. O que mudou

### Bugs corrigidos (o mais importante)

| Bug | Causa-raiz encontrada |
|---|---|
| **"Por status" com valor errado no Reservado** | **Duas causas somadas.** (1) A hospedagem era calculada como `daysBetween(início,fim) × diária` por cidade, enquanto o total da viagem conta **uma diária por data de planejamento** — com cidades sobrepostas, a diária entrava duas vezes no status e uma no total. (2) Transportes liam `x.cost` cru, ignorando `getTransportCost()`, que entende os campos legados (`custo`/`valor`) vindos do Apps Script — transporte importado contava zero. |
| **Café da manhã com status incoerente** | Nascia `'Planejado'` fixo. Agora espelha o status da hospedagem enquanto for automático, e para de espelhar quando você o edita (mesma regra do `autoBreakfast`). |
| **Legenda vazia na distribuição de Custos** *(descoberto durante a execução)* | Mesma classe do bug do status: a tela lia `r.label`, mas a função devolve `r.name`. |

Uma **invariante** agora está travada em teste: a soma dos status não-cancelados
tem que bater com o total da viagem, ao centavo.

### Recursos novos

- **Analytics** (T-1.1) com **allowlist de privacidade**: nomes de cidade,
  valores, e-mails e textos livres **nunca** saem como parâmetro — qualquer
  chave fora da lista é descartada, mesmo se alguém a passar por engano.
- **Feedback in-app** (T-1.2), em Mais › Enviar feedback. **Nova coleção e nova
  regra.**
- **Onboarding** de 3 passos no primeiro uso (T-1.3).
- **PDF do roteiro** (T-1.5): uma view de impressão dedicada, com capa, um bloco
  por dia (itens em ordem de horário) e resumo de custos. **Sem biblioteca de
  PDF** — o navegador já gera, e uma lib custaria centenas de kB no bundle.
- **Duplicar viagem** (T-1.6), com opção de deslocar todas as datas.
- **Divisão de despesas** (T-1.7): "quem pagou" em cada item, cota por pessoa,
  saldo e **acerto de contas** minimizando transferências.
- **Toast** de confirmação e **busca/filtro** no checklist (T-1.9, T-1.10).
- **Lembretes locais** (T-1.11): check-in e pendências do dia seguinte.
- **E2E + CI** (T-1.12).
- **Legenda com nomes** na distribuição (T-1.13).
- **Adicionar item já abre o editor** (T-1.14).
- **Tela Dias abre no dia de hoje** (T-1.15).
- **Central de mensagens** (T-1.16): botão 💬 no cabeçalho, todas as conversas
  num lugar, com "ir para o item".
- **Acessibilidade** (T-1.8): foco preso dentro dos sheets (focus trap) e
  devolvido a quem abriu.

---

## 2. Passos

```bash
git checkout main && git pull
git checkout -b fase-1-completa
npm install          # instala o Playwright (dependência nova)
npx playwright install chromium
```

**Testes locais, em ordem:**

```bash
npm test             # 62 testes de domínio (eram 37)
npm run build        # build de produção
npm run test:rules   # OBRIGATÓRIO: regras mudaram (coleção feedback)
npm run test:e2e     # E2E contra o emulador
```

> **Windows (CMD):** para conferir manualmente o build em modo de teste, use
> `set VITE_USE_EMULATORS=true && npm run build`. No CI isso já é feito
> automaticamente (ver seção 3).

> `npm run test:all` roda os três de uma vez.

**Publicar as regras (obrigatório, antes do app):**

```bash
firebase deploy --only firestore:rules
```

**PR:**

```bash
git add -A
git commit -m "Fase 1: bugs de custo, analytics, feedback, PDF, divisao de despesas, mensagens e mais"
git push -u origin fase-1-completa
```

---

## 3. Atenção: novo workflow de CI

Esta leva inclui `.github/workflows/qualidade.yml`. **Ele NÃO faz deploy** — só
roda testes e build. Os deploys continuam nos workflows que já existem no seu
repositório (`firebase-hosting-merge.yml` e `firebase-hosting-pull-request.yml`).

Essa separação é deliberada, para não repetir o problema antigo do `deploy.yml`
que reaparecia pelo zip e causava deploy em duplicidade. **Se você vir dois
deploys disparando, o problema não é este arquivo** — confira se algum
`deploy.yml` voltou ao repositório.

O workflow roda **dois builds**: o de produção e o em modo de teste
(`VITE_USE_EMULATORS=true`). Isso existe por causa de uma falha real desta
fase: código guardado por variável de ambiente só é compilado quando a variável
existe, então um erro dentro do bloco de emuladores passava batido no build
normal e só estourava no E2E. O CI também confere que o código de teste **não
vaza** para o bundle de produção.

---

## 4. Testar na prévia

**Os bugs (comece por aqui, numa viagem real sua):**
- [ ] Custos › Por status: os quatro valores fazem sentido, e a soma de
      Planejado + Reservado + Pago **bate com o total da viagem**.
- [ ] O café da manhã de um hotel "Pago" aparece como Pago na tela Dias.
- [ ] Edite um café automático → ele para de acompanhar o status da cidade.
- [ ] A legenda da distribuição mostra os nomes (categorias/cidades/dias) e
      muda junto com a seleção.

**Recursos novos:**
- [ ] Dias abre no dia de hoje (teste com uma viagem em curso e outra futura).
- [ ] "+ Atração" abre o editor direto.
- [ ] Custos › Divisão de despesas: cadastre os participantes, marque "quem
      pagou" em alguns itens e confira o acerto.
- [ ] Mais › Exportar PDF → o PDF sai **completo** (todos os dias), não só a
      tela aberta.
- [ ] Mais › Duplicar viagem, com e sem deslocamento de datas.
- [ ] Mais › Enviar feedback → confirme no Console do Firebase que o documento
      chegou na coleção `feedback`.
- [ ] Botão 💬 no cabeçalho → comente um item, abra Mensagens, toque em "ir para
      o item" e veja o item destacado.
- [ ] Mais › Lembretes → ativar pede permissão **só nesse momento**.
- [ ] Onboarding aparece no primeiro acesso e **não volta** depois.

**Acessibilidade:**
- [ ] Abra um sheet e navegue só com Tab: o foco não escapa para o fundo, e ao
      fechar volta para o botão que o abriu.

**Analytics:**
- [ ] No Console do Firebase (Analytics › DebugView), confirme que os eventos
      chegam **sem nenhum dado pessoal** nos parâmetros.

---

## 5. Notas e limitações honestas

- **Lembretes são locais, não push.** Disparam com o app aberto (ou pouco
  depois). Push de verdade exige back-end e está na Fase 2 (bloco 5.A). No iOS,
  notificação em PWA só funciona a partir do iOS 16.4 **e** com o app instalado
  na tela inicial — no Safari em aba comum, não funciona. Isso é limitação da
  plataforma, não bug.
- **A divisão de despesas começa igual entre todos.** Divisão por percentual ou
  por item fica para a Fase 2; o formato de dados (`paidBy` por item) já
  comporta essa evolução sem migração.
- **A hospedagem entra na divisão como despesa do grupo ainda não atribuída** —
  não há um `paidBy` por cidade. Se isso incomodar no uso, é um ajuste pequeno.
- **A central de mensagens não é um chat.** Sem tempo real com não-lidas, sem
  notificação de nova mensagem — decisão registrada no backlog: entregar a
  versão ancorada em itens, medir com analytics, e só então decidir se vale
  virar chat na Fase 2.
- **O gancho de login E2E (`__E2E_LOGIN__`) só existe em ambiente de teste**,
  atrás de `VITE_USE_EMULATORS`. No build de produção essa variável não existe e
  o bloco inteiro é removido pelo bundler.

---

## 6. O que a Fase 1 ainda espera de você

**T-1.4 (pesquisa com usuários) não é código** e não pode ser feito por mim —
são entrevistas com pessoas reais. O roteiro pronto está em
`PESQUISA-ROTEIRO-T1.4.md`: quem recrutar, as perguntas, as tarefas do teste de
usabilidade e como sintetizar.

Junto com os dados de analytics, essa síntese é o que **destrava a Fase 2** — e
diz qual pilar atacar primeiro (coordenação ou orçamento). Sem ela, a Fase 2
volta a ser aposta.
