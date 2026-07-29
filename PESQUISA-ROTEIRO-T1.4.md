# T-1.4 — Roteiro de pesquisa com usuários (v1)

Instrumento qualitativo da Fase 1. **Este é o único ticket que não é código** —
as sessões precisam ser conduzidas por você, com pessoas reais. O que está aqui
é o roteiro pronto para aplicar.

**Objetivo:** validar (ou derrubar) a persona e os jobs-to-be-done da seção 2 do
`consultoria_estrategica_v1.md`, e descobrir os atritos de usabilidade que a
analytics mostra como número mas não explica.

---

## 1. Quem recrutar

**5 a 8 pessoas.** Acima disso o retorno cai rápido; abaixo de 5, o risco de
viés de amostra é alto.

Perfil-alvo (a hipótese a testar): pessoas que **organizaram uma viagem em
grupo ou família nos últimos 12 meses** — quem puxou a responsabilidade, não
quem só foi junto.

Busque variedade em: idade, familiaridade com tecnologia, tamanho do grupo
(casal / família com crianças / grupo de amigos) e tipo de viagem (nacional /
internacional, poucos dias / longa).

**Inclua ao menos uma pessoa que NÃO usa o app hoje.** Só ouvir quem já usa é a
forma mais comum de confirmar o que já se acredita.

---

## 2. Antes de começar (2 min)

Diga, com estas palavras ou parecidas:

> "Não existe resposta certa nem errada. Não estou testando você — estou
> testando o aplicativo. Se algo ficar confuso, é uma falha nossa, e é
> exatamente isso que preciso descobrir. Pode pensar em voz alta e ser
> honesto: crítica me ajuda muito mais que elogio."

Peça permissão para gravar. Deixe claro que pode parar quando quiser.

---

## 3. Parte A — Entrevista sobre o problema (15 min)

**Não fale do app ainda.** Esta parte é sobre a vida da pessoa, não sobre o
produto. Se você mostrar o app antes, contamina tudo o que vem depois.

1. Me conta sobre a última viagem que você organizou. Como começou?
2. Quem mais participou das decisões? Como vocês combinavam as coisas?
3. Onde você guardava as informações — datas, reservas, valores?
4. Me mostra, se puder, como isso ficou (WhatsApp, planilha, e-mail, papel).
5. Qual foi a parte mais chata ou trabalhosa desse processo?
6. Aconteceu alguma coisa dar errado por falta de informação ou de combinação?
7. Como vocês lidaram com o dinheiro — quem pagou o quê, quem devia a quem?
8. Se você pudesse apagar uma parte chata dessa organização, qual seria?
9. Você já usou algum aplicativo para isso? O que fez você parar (ou não usar)?

**O que escutar:** as palavras que a pessoa usa (elas devem virar os rótulos do
app), onde ela demonstra frustração real (tom de voz, não só conteúdo), e se
"coordenar o grupo" e "controlar o dinheiro" aparecem espontaneamente — que é o
coração da aposta de diferenciação.

---

## 4. Parte B — Teste de usabilidade (20 min)

Agora entregue o app **sem explicar nada**. Peça para a pessoa pensar em voz
alta. **Não ajude**, mesmo que doa. Quando travar, pergunte: "o que você
esperava que acontecesse?"

Tarefas, nesta ordem:

1. **Primeiro uso:** "Você acabou de instalar isso. Comece a planejar uma
   viagem para o Porto, de 10 a 14 de setembro."
   *Observe: ela descobre sozinha que começa pelas cidades? O onboarding ajudou
   ou foi pulado sem ler?*

2. **Montar um dia:** "No dia 11, vocês vão almoçar num restaurante e visitar
   uma livraria que custa 10 euros."
   *Observe: acha os botões de adicionar? Entende que o editor abre sozinho?*

3. **Orçamento:** "Quanto essa viagem está custando por pessoa?"
   *Observe: vai direto a Custos? Entende a distribuição e a legenda?*

4. **Divisão:** "Você pagou o hotel e sua irmã pagou as passagens. Quem deve a
   quem?"
   *Observe: encontra a divisão de despesas? O conceito faz sentido para ela?*

5. **Colaboração:** "Chame sua irmã para ver e editar essa viagem."
   *Observe: entende que o convite é por e-mail? Entende que precisa avisar por
   fora?*

6. **Livre:** "Explore por 2 minutos e me diga se tem algo aqui que você não
   entendeu para que serve."

---

## 5. Parte C — Fechamento (5 min)

1. Se esse aplicativo sumisse amanhã, você sentiria falta? De quê,
   especificamente?
2. Você indicaria para alguém? Para quem, e por quê?
3. Tem alguma coisa que ele **não faz** e que faria você usar de verdade?
4. Se tivesse que pagar por isso, o que precisaria ter para valer a pena?

*A pergunta 4 é desconfortável, mas é a que informa o modelo de negócio (seção
5.F da consultoria). Faça-a sem pedir desculpas.*

---

## 6. Como sintetizar (depois das sessões)

Produza um `pesquisa_usuarios_v1.md` com:

- **Persona:** confirmada, ajustada ou derrubada? Com evidência (frases reais).
- **Top 3 dores** mencionadas espontaneamente, com quantas pessoas citaram cada
  uma.
- **Top 3 atritos de usabilidade** observados (não relatados — observados).
- **Tarefas com maior taxa de falha** no teste.
- **Repriorização recomendada** do backlog: o que subir, o que descer, o que
  cortar.
- **Veredito sobre a aposta:** "coordenação familiar + orçamento" apareceu como
  dor real, ou as pessoas querem outra coisa (descoberta de roteiro, preço de
  passagem…)? **Esta é a saída mais importante** — ela destrava ou redireciona
  a Fase 2 inteira.

---

## 7. Armadilhas que invalidam a pesquisa

- **Perguntar se a pessoa gostou.** Ela vai dizer que sim, por educação.
  Pergunte o que ela *fez*, não o que ela *acha*.
- **Explicar o app durante o teste.** Se você precisou explicar, a interface
  falhou — anote isso em vez de socorrer.
- **Perguntar "você usaria?".** Intenção declarada não prevê comportamento.
  Prefira "quando foi a última vez que você precisou disso?".
- **Só ouvir quem já gosta do app.** É o caminho mais rápido para confirmar as
  próprias crenças.
- **Tratar 1 opinião forte como tendência.** Só conte como sinal o que apareceu
  em 3+ das sessões.
