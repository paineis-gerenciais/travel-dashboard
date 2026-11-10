# Parecer de produto: travel-dashboard

Data: 2026-11-09 · Autor: product-manager (Prumo) · Nível: N2, consultivo, somente leitura · Sem issue vinculada.

Rótulos: [FATO] com fonte no repositório; [HIPÓTESE] sem evidência; [RECOMENDAÇÃO] julgamento do parecer.

## 0. Base de evidência

- [FATO] Não há PRD, issues legíveis nem dados de uso. O único instrumento de descoberta é `PESQUISA-ROTEIRO-T1.4.md`, um roteiro de entrevistas. Nada indica que tenha sido aplicado.
- [FATO] O README ainda descreve a "Fase 1" (login Google, usuário único). Está desatualizado em relação ao app (multiusuário, redesign).
- [FATO] `DEPLOY-FASE5-ESTRUTURAL.md` cita `consultoria_estrategica_v1.md` (persona, jobs-to-be-done, aposta de diferenciação em "coordenar o grupo" e "controlar o dinheiro"). O arquivo não está no repositório, então não foi lido.
- [FATO] `analytics.js` existe desde T-1.1, mas não há painel nem leitura de dados documentados.
- Consequência: tudo sobre público, uso e valor percebido abaixo é [HIPÓTESE], salvo indicação.

## 1. Problema e público

**Problema (uma frase):** quem organiza uma viagem em grupo junta datas, reservas, roteiro e dinheiro espalhados em conversas, e-mails e prints, e o grupo não enxerga o mesmo plano nem sabe quem deve quanto a quem. [FATO: texto do onboarding, `Onboarding.jsx`]

**Público:**
- [FATO] Pessoa que organiza (puxa a responsabilidade) e acompanhantes. A pesquisa T1.4 recruta "quem organizou viagem em grupo ou família nos últimos 12 meses".
- [FATO] Interface, moeda e formatos são só pt-BR e BRL (`money()` formata "R$"; não há campo de moeda).
- [HIPÓTESE] Brasileiros que viajam em casal, família ou amigos, inclusive ao exterior, com um organizador que tolera planilha.
- [HIPÓTESE] O nascimento como planilha pessoal do autor sugere que o primeiro usuário real é o próprio autor e o círculo dele.

**Alternativas atuais** (todas [HIPÓTESE], sem pesquisa registrada):

| Alternativa | O que resolve bem | Onde o app pode ganhar |
|---|---|---|
| WhatsApp + prints | Zero atrito, todos já estão lá | Fonte única; custo por pessoa |
| Planilha | Flexível, conhecida | Dia a dia no celular; acerto de contas automático |
| Notion | Estrutura livre | Mais simples; custos embutidos |
| Wanderlog / TripIt | Mapa, importação de reservas por e-mail, offline | Brasil (BRL, WhatsApp); acerto de contas junto do roteiro |
| Splitwise | Divisão e acerto muito bons, várias moedas | Roteiro e despesa no mesmo lugar |

[RECOMENDAÇÃO] A aposta defensável é "roteiro + dinheiro do grupo em um lugar, em português, grátis". Concorrer em mapa ou importação de reservas é caro e já está tomado. Verifique a aposta com 5 a 8 entrevistas (roteiro T1.4) antes de investir em expansão.

## 2. Núcleo, apoio e acessório

Critério: sem a funcionalidade, o problema principal (plano único do grupo + dinheiro do grupo) deixa de ser resolvido?

| Funcionalidade | Classe | Justificativa |
|---|---|---|
| Cidades e datas (gera os dias) | Núcleo | É o esqueleto; os dias nascem dele |
| Cartão por dia (transporte, hospedagem, refeições, atrações, despesas) | Núcleo | Tela de trabalho (`Dias`) |
| Custos, totais, por pessoa | Núcleo | Resposta a "quanto vai custar" |
| Divisão de despesas com acerto | Núcleo | Metade da aposta do produto; [FATO] teve duas rodadas de correção (`DEPLOY-CORRECAO-NUMEROS`, `DEPLOY-AJUSTES-EDICAO-ACERTO`) |
| Convite e compartilhamento, tempo real | Núcleo | "Grupo" só existe se mais de uma pessoa entra |
| Checklist | Apoio | Útil, mas é lista de tarefas genérica |
| Mapa e rotas (abre Google Maps) | Apoio | Valor real, mas OSM/Nominatim traz política de uso |
| Anexos por link e documentos gerais | Apoio | Substitui "prints"; hoje só link, não arquivo |
| Impressão/PDF do roteiro | Apoio | Barato, serve de "plano B" offline |
| Duplicar viagem | Apoio | Reuso; baixo custo |
| Lembretes locais | Apoio fraco | [FATO] Só dispara com o app aberto (`reminders.js`); não é push |
| Planilha (importar/exportar/colar) | Apoio de transição | Valioso para o autor e para migrar; [HIPÓTESE] pouco usado por novos usuários |
| Exportar/importar JSON | Acessório | Duplica planilha e versões como "cópia de segurança" |
| Versões salvas | Acessório | Mais uma forma de desfazer; confunde com "Limpar" |
| Mensagens + comentários por item + feed de atividade + presença | Acessório / ruído | Quatro canais de conversa e rastro dentro de um grupo que já usa WhatsApp |
| 3 formas de login | Acessório | Ver abaixo |
| Diagnóstico (erros da sessão) | Acessório | Ferramenta de desenvolvedor na tela do usuário |
| Feedback in-app | Apoio | Único canal de aprendizado; manter |
| Modo escuro, onboarding | Apoio | Baratos; onboarding precisa de métrica |

**Sinais de feature creep** [FATO, evidências no repo]
- `Mais.jsx` reúne 15 linhas de ações (checklist, anexos, compartilhar, versões, link do app, lembretes, tema, PDF, planilha, JSON x2, diagnóstico, feedback, duplicar, trocar, sair, limpar). O redesign agrupou o menu de 16 botões em vez de reduzi-lo.
- Colaboração sobreposta: mensagens (`MessagesSheet`), comentários por item, feed de atividade e presença em tempo real. [HIPÓTESE] Para 2 a 6 pessoas, o WhatsApp já cumpre isso; o app paga o custo de regras do Firestore (coleções `comments`, `activity`), testes de regras no emulador e moderação.
- Três cópias de segurança: versões, JSON e planilha.
- Login: o briefing cita 3 formas; `useAuth.js` registra apenas `google` e `phone` como `method` (a terceira forma não foi identificada nesta leitura). Cada provedor exige configuração e suporte (`DEPLOY-LOGIN-CELULAR-CONFIG.md`). O convite funciona por e-mail; quem entra por telefone sem e-mail não casa com o convite. [FATO: `DEPLOY-CONVITE-ENVIO.md` descreve o acesso por e-mail convidado]. Isso é uma falha de fluxo, não só de manutenção.
- Fases nomeadas de forma diferente (Fase 1 a 5, R1 a R5, T-x.y) sem backlog único: o que foi priorizado e por quê não está registrado fora dos guias de deploy.

**Custo cobrado** [RECOMENDAÇÃO, estimativa qualitativa]: cada canal de colaboração dobra superfície de teste (regras, offline, tempo real), de privacidade (texto livre de terceiros) e de suporte. Sem uso comprovado, é custo sem retorno conhecido.

## 3. Lacunas de valor (por impacto)

| # | Lacuna | Evidência | Impacto | Esforço |
|---|---|---|---|---|
| L1 | Várias moedas (viagem internacional) | [FATO] só BRL; o exemplo da pesquisa é "10 euros" no Porto | Alto: viagem internacional é o caso em que o grupo mais precisa de ajuda | G |
| L2 | Orçamento-alvo vs realizado | [FATO] só há total e status Planejado/Reservado/Pago | Alto: responde "estamos dentro do que combinamos?" | M |
| L3 | Modo "durante a viagem" (hoje, agora, próximo item, lançar gasto rápido) | [FATO] app é de planejamento; navegação por dia existe, mas sem "hoje" | Alto: é quando o acerto de contas é alimentado | M |
| L4 | Reserva com horário e confirmação (código, link) | [FATO] documentos gerais só com rótulo e URL; item de dia tem status | Médio | M |
| L5 | Exportar para calendário (.ics) | [FATO] inexistente | Médio: leva o roteiro ao lugar que as pessoas já olham | P |
| L6 | Notificação real (push) | [FATO] lembretes só com app aberto | Médio; depende de back-end (fora do meu escopo) | G |
| L7 | Documentos como arquivo | [FATO] só link | Baixo a médio; custo de armazenamento e privacidade | G |
| L8 | Entrada fácil do convidado (sem criar conta antes de ver o plano) | [HIPÓTESE] atrito de convite por e-mail + login | Alto para o pilar "grupo" | M |

## 4. Métricas de resultado

| Métrica | Definição | Linha de base | Meta 90 dias | Fonte |
|---|---|---|---|---|
| M1 Viagens com 2+ membros ativos | Viagens com 2 ou mais pessoas que editaram ou abriram em 14 dias | Lacuna (sem dado) | 40% das viagens criadas | Instrumentar |
| M2 Dias preenchidos por viagem | Dias com ao menos 1 item / dias totais | Lacuna | Mediana >= 60% | Estado da viagem (Firestore) ou evento novo |
| M3 Ativação | Usuários novos que criam viagem e adicionam ao menos 1 cidade e 3 itens em 7 dias | Lacuna | 50% | `login_succeeded`, `trip_created`, `city_added`, `day_item_added` |
| M4 Retorno na semana da viagem | Viagens com uso em qualquer dia entre início e fim | Lacuna | 50% das viagens com datas | Instrumentar |
| M5 Viagens com acerto concluído | Viagens com despesas divididas e acerto marcado | Lacuna | Rastrear e fixar após linha de base | Instrumentar |

**O que `analytics.js` permite hoje** [FATO: leitura do código]
- Eventos existentes: `login_succeeded` (method), `trip_created` (context), `trip_duplicated`, `city_added`, `day_item_added` (kind), `tab_viewed`, `expense_split_viewed`, `onboarding_*`, `attachment*`, `document_added`, `messages_opened`, `sheet_*`, `pdf_exported`, `reminder_*`, `feedback_*`, `list_filtered`.
- M3: viável de forma parcial, só por usuário (Firebase Analytics usa id de instalação, não de conta). Não há ligação entre eventos e viagem.
- M1: não mensurável. Não há evento de convite enviado, convite aceito nem edição por outro membro. As chaves `members` e `days` estão na lista permitida, mas nenhum evento as usa. [FATO: busca por `track(` em `src`]
- M2 e M4: não mensuráveis pelos eventos. A allowlist veta valores e textos, o que é correto; falta evento agregado (ex.: `trip_snapshot` com `count` de dias preenchidos, `members`, `days`) e identificador estável e anônimo da viagem. Decisão de privacidade a validar pelo devsecops-engineer.
- M5: falta evento de acerto marcado e despesa criada.
- Lacuna adicional: nenhum evento de falha (`login` com erro, `import` com erro). [HIPÓTESE] Há `result` na allowlist para isso.
- [FATO] A allowlist impede enviar dado pessoal. Manter.
- Faltam: `invite_sent` (context: whatsapp, email, link), `invite_accepted`, `member_joined`, `trip_snapshot`, `settlement_marked`, `expense_added`.

## 5. Roadmap em 3 horizontes

Severidade = impacto de não fazer. Esforço: P (até 2 dias), M (até 2 semanas), G (mais).

### H1. Estabilizar (0 a 30 dias)

| ID | Item | Sev. | Esf. | Critério de entrada |
|---|---|---|---|---|
| R1 | Medir o que importa (eventos de M1 a M5) e abrir painel | Alto | M | Nenhum; é pré-condição do resto |
| R2 | Entrevistar 5 a 8 organizadores (roteiro T1.4) e registrar achados | Alto | M | Autor define lista de convidados |
| R3 | Convite que funciona para qualquer login (telefone e e-mail) e entrada do convidado sem ambiguidade | Alto | M | Parecer de segurança sobre o modelo de convite |
| R4 | Corrigir o README e criar backlog único (um arquivo, uma ordem) | Médio | P | Nenhum |
| R5 | Congelar novas funções de colaboração e de conta (ver abaixo) | Médio | P | Decisão D1 |

**Cortar ou congelar** (sem remover dados):
- Congelar: mensagens, comentários por item, feed de atividade, presença. Sem novas melhorias; decidir remoção após M1.
- Esconder do usuário comum: Diagnóstico (só por URL ou modo avançado), Exportar/Importar JSON.
- Congelar: planilha, versões, lembretes locais.
- Login: manter Google; decidir sobre telefone na D2.

### H2. Aprofundar o núcleo (30 a 60 dias)

| ID | Item | Sev. | Esf. | Critério de entrada |
|---|---|---|---|---|
| R6 | Orçamento-alvo vs realizado (L2) | Alto | M | M2 medida; R2 confirma que orçamento é dor |
| R7 | Modo "Hoje" com lançamento rápido de gasto (L3) | Alto | M | M4 medida |
| R8 | Várias moedas com câmbio informado à mão (L1) | Alto | G | R2 confirma viagens internacionais >= 30% |
| R9 | Exportar calendário .ics (L5) | Médio | P | Nenhum |

### H3. Expandir (60 a 90 dias e depois)

| ID | Item | Sev. | Esf. | Critério de entrada |
|---|---|---|---|---|
| R10 | Reservas com horário e confirmação (L4) | Médio | M | R6 e R7 entregues |
| R11 | Push real (L6) e documentos como arquivo (L7) | Médio | G | M4 >= 40% e parecer de segurança e custo |
| R12 | Modelos de roteiro e viagens públicas | Baixo | G | M1 >= 40% estável |

Fora do roteiro: integração com e-mail (importar reservas), IA de roteiro, venda de passagens ou hospedagem.

## 6. Critérios de aceite dos 5 primeiros itens

**R1. Medir o que importa**
- Dado um usuário autenticado, quando ele cria uma viagem, então é registrado `trip_created` e um identificador de viagem anônimo e estável (não reversível ao nome da viagem).
- Dado que um convite é gerado, quando é enviado por WhatsApp, e-mail ou link, então `invite_sent` é registrado com `context`.
- Dado que um convidado abre a viagem pela primeira vez, quando o acesso é concedido, então `member_joined` é registrado com `members` (total).
- Dado qualquer evento, quando contém nome, valor em dinheiro, e-mail ou texto livre, então a chave é descartada (teste automatizado da allowlist).
- Dado o painel de uso, quando se consulta a semana corrente, então M1 a M5 aparecem com definição e fonte documentadas.

**R2. Entrevistas**
- Dado o roteiro T1.4, quando 5 organizadores são entrevistados (ao menos 1 que não usa o app), então existe um arquivo em `docs/` com o resumo por entrevista.
- Dado o resumo, quando comparado à persona, então a aposta "coordenar o grupo e controlar o dinheiro" aparece confirmada ou refutada, com citações curtas e sem dados pessoais.
- Dado o resultado, quando o dono do produto revisa, então registra a decisão D1 com base nele.

**R3. Convite para qualquer login**
- Dado um convite por e-mail, quando a pessoa entra com Google usando o mesmo e-mail, então vê a viagem.
- Dado um convite, quando a pessoa entra só por telefone (sem e-mail), então o app oferece um caminho explícito para acessar (ex.: vincular e-mail), em vez de mostrar lista vazia.
- Dado que o e-mail digitado difere do e-mail da conta, quando a pessoa entra, então vê mensagem dizendo qual e-mail usar.
- Dado um convite revogado, quando a pessoa tenta abrir a viagem, então o acesso é negado.

**R4. README e backlog único**
- Dado o README, quando lido, então descreve o app atual (5 destinos, multiusuário), e não só a Fase 1.
- Dado `docs/produto/backlog.md`, quando aberto, então lista R1 a R12 com severidade, esforço e critério de entrada.
- Dado um item entregue, quando o PR é aberto, então referencia o ID do backlog.

**R5. Congelamento**
- Dado o menu Mais, quando um usuário comum abre, então Diagnóstico e JSON não aparecem na lista principal (continuam acessíveis por caminho documentado).
- Dado qualquer PR após a decisão, quando altera mensagens, comentários, atividade ou presença, então é recusado, exceto correção de bug ou segurança.
- Dado o backlog, quando listada cada função congelada, então há a condição de reabertura (métrica e limite).

## 7. Sucesso em 90 dias

Todos os números abaixo dependem de R1; sem linha de base, as metas são provisórias [HIPÓTESE].
1. Painel de M1 a M5 no ar e lido semanalmente.
2. Pelo menos 5 entrevistas feitas, com decisão registrada sobre colaboração e login.
3. M3 (ativação) >= 50% e M1 >= 40% entre viagens criadas após o convite corrigido.
4. R6, R7 entregues; R8 entregue se a condição de entrada for cumprida.
5. Nenhuma função nova de colaboração entrou.

## 8. Decisões do dono do produto

**D1. Qual é o produto?**
- (a) Roteiro e dinheiro do grupo; colaboração mínima. **Recomendada.** Alinha com a aposta e reduz manutenção.
- (b) Ferramenta pessoal do autor, com compartilhamento ocasional. Menor custo; abandona métricas de grupo.
- (c) Concorrente geral de Wanderlog. Escopo enorme; não recomendo sem equipe.

**D2. O que fazer com as funções de colaboração e de login?**
- (a) Congelar mensagens, comentários, atividade e presença; manter Google e decidir telefone após R3. **Recomendada.** Efeito: corta superfície sem perder dados.
- (b) Remover agora. Mais limpo, mas irreversível para quem já usa.
- (c) Manter tudo. Mantém custo sem evidência.

**D3. Qual a prioridade do H2?**
- (a) Orçamento e modo Hoje primeiro, moedas depois, se as entrevistas mostrarem viagens internacionais. **Recomendada.**
- (b) Moedas primeiro. Resolve o caso do exemplo do autor; esforço G sem confirmação de demanda.
- (c) Push real primeiro. Exige back-end e custo recorrente; gatilho de escalonamento.

## 9. Limites deste parecer

- Não avaliei viabilidade comercial, solução técnica nem desenho de tela.
- Não li `consultoria_estrategica_v1.md`, `plano_melhorias_graduais_v2.md` nem os demais DEPLOY-*.md além dos cabeçalhos, nem os componentes fora dos citados.
- Não executei código nem acessei o app publicado.
- Classificação e esforço são julgamento qualitativo; esforço P/M/G é estimativa sem base de velocidade medida.
