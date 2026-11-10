# Plano unificado: travel-dashboard

- **Situação:** **aprovado em 2026-11-10** pelo dono do produto. Decisões sem marcação seguiram a opção recomendada (seção 7).
- **Bases:**
  - **Diagnóstico de 2026-11-07** (`docs/prumo/diagnostico-2026-11-07/`): executado. Testes, build, emulador, CI, verificação de regras em 14 cenários, QA com axe, teclado, capturas e teste de duas contas.
  - **Avaliação de 2026-11-09** (`docs/prumo/avaliacao-2026-11-09/`, copiada do projetos-dev): estática, nove especialistas, sem execução.
  - **Verificação de 2026-11-10** (`docs/prumo/verificacao-2026-11-10.md`): o que faltava medir para fechar as hipóteses.
- **Commit avaliado:** `b5a3ce2`.

## 1. Decisões tomadas

| Tema | Decisão | Efeito no plano |
|---|---|---|
| Rumo | **Grupo do seu círculo.** Roteiro e dinheiro do grupo, para você e pessoas próximas. Corrigir, medir e entrevistar; função nova só com critério de entrada cumprido | H3 vira lista condicionada (seção 6). Abrir a terceiros exige os sinais da seção 6 e, antes, privacidade, exclusão de conta e parecer de LGPD |
| Sincronização | **Gravar por campo já no H1.** Primeiro ids no lugar de posição; depois itens em mapas por id com `updateDoc` por campo, `schemaVersion: 2` e leitura do formato antigo por duas versões | Sai a mitigação provisória (issue 5 do 09/11). O ADR-0001 detalha e volta para você aprovar antes do código (gate G2) |
| Rastro | **No repositório do produto**, em `docs/prumo/`, com o `CLAUDE.md` na raiz | No projetos-dev fica só uma linha na tabela de projetos; o branch de 09/11 vira histórico, sem merge |
| Branches | **Um branch por issue**, no padrão `<tipo>/<issue>-<slug>`, cada um com PR em rascunho | O branch da sessão (`claude/magical-tesla-wlyemy`) fica só com o PR de documentação |
| Alertas | **Motor de regras como base**, sobre a lógica de domínio que já existe; IA é opcional | Os avisos do H2 viram um item só, "Alertas da viagem" (seção 5) |
| IA | **Skill e agentes no Claude Code**, que pesquisam e geram um arquivo no formato da planilha do app; a importação usa a prévia que já existe | Sai do H2 o bloco de chave de API no app; ele volta só com o critério da seção 6 |

## 2. Como os dois diagnósticos se combinam

### 2.1 Hipóteses fechadas

| Hipótese | Situação | Evidência |
|---|---|---|
| A1 última gravação vence | `[FATO]` confirmada | 07/11: 5 de 5 execuções com duas contas perderam uma das edições |
| A2 folha edita a cidade errada | `[FATO]` confirmada | 10/11: com um usuário, o check-in da cidade nova reordena a lista e a folha passa a editar Lisboa; com check-out 20/06, Lisboa mudou sem aviso |
| A3 datas recuam em fuso UTC+ | `[FATO]` confirmada | 10/11: 17 de 111 testes falham em Lisboa e 18 em Tóquio; em São Paulo, 111 passam |
| A4 convite e revogação | `[FATO]` confirmada | 07/11 e 10/11: 12 de 14 cenários de ataque permitidos no emulador |
| A5 deploy sem barreira, sem lint | `[FATO]` confirmada | 07/11: lint sai com código 2; deploy publicou sem depender do Qualidade |
| A6 E2E nunca passou no CI | `[FATO]` confirmada, com duas causas | 07/11: o Qualidade falhou 10 de 10 vezes no passo de regras por Java 17 (o firebase-tools exige 21). 10/11: sem `VITE_FIREBASE_*`, os 18 E2E falham com "Firebase: Error (auth/invalid-api-key)" |
| A10 contraste | `[FATO]` confirmada em parte | 10/11: no claro, chips Planejado 4,20, Pago 3,11 e Cancelado 4,27 abaixo de 4,5; Reservado passa; no escuro os 4 passam; `--text-3` falha nos dois temas (2,94 e 4,13). Achado extra: menu de status com 4 violações de ARIA, 2 críticas |
| A13 folha de comentário recortada | `[FATO]` confirmada | 10/11: fundo da folha mede 324×608 em tela de 360×800 e 668×568 em 1366×768; cabeçalho e abas ficam clicáveis por trás |

Já medido em 07/11 e não repetido: 111 testes de domínio, 17 de regras e 18 E2E passam com variáveis fictícias; build 5,1 s e 1,6 MB; `npm audit` 33; Lighthouse local 0,94 e 0,98; sem rolagem horizontal em 360 e 1366 px.

### 2.2 O que só um dos lados encontrou

- **Só 09/11:** reordenação das cidades a cada mutação (A2); datas em fuso UTC+ (A3); acerto confirmado não abate o saldo (A9); convite falha para quem entra por telefone (A11); E2E de convite abre o Checklist (falso positivo, `Mais.jsx:98` e `spec:240`); indicadores D-14 a D-19; heurísticas de UX; contraste por token; S-04 a S-15; eventos de analytics.
- **Só 07/11:** causa do CI vermelho (Java); membro pode se marcar como dono e esconder o botão Remover; qualquer membro apaga versões e importa JSON por cima; `EmbeddedMap.jsx` importa `leaflet`, que não está instalado; medições reais de axe, teclado, responsividade e carga; scripts reproduzíveis de regras e de concorrência.

### 2.3 Divergências e como foram resolvidas

| # | Tema | 07/11 | 09/11 | Resolução |
|---|---|---|---|---|
| 1 | Correção da concorrência | Reaplicar edições com contador de revisão | Mapas por id e gravação por campo (O1) | O1. O contador exigiria transação, que falha offline |
| 2 | Momento da concorrência | Logo após regras e CI | H2, com mitigação no H1 | H1, sem mitigação provisória |
| 3 | Rumo | Pronto para o uso atual; evoluir com demanda | Estratégia: ferramenta pessoal; produto: produto de grupo | Grupo do seu círculo |
| 4 | Onde fica o rastro | Repositório do produto | projetos-dev | Repositório do produto |
| 5 | Severidade do contraste | Médio: axe confirmou só `--text-3` (2,94:1) | Alto: cálculo à mão reprova 6 pares | Médio, pela medição de 10/11: 3 chips no claro e `--text-3` nos dois temas; no escuro os chips passam |
| 6 | Falsificar autor e papel | Alto, dentro do modelo de convite | Médio (S-04) | Autoria e papel vão na issue de regras; validação completa de esquema e tamanho fica no H2 |
| 7 | Acerto que não abate saldo | Não coberto | Issue no H1, texto do relatório no H2 | H1: risco de pagar duas vezes |
| 8 | Entrevistas | 3 | 5 a 8 | 5, mínimo do roteiro, com pelo menos 1 pessoa que não usa o app |
| 9 | Funções novas | Só com demanda | Calendário de 60 a 90 dias | Só com o critério de entrada do parecer de produto (seção 6) |
| 10 | Congelamento | Não tratado | Consolidado: 4 canais; produto: também planilha, versões, lembretes | D3 (a): só os 4 canais |
| 11 | Comando de regras | Java 21 | "Java 17" | Java 21 (log do CI) |
| 12 | Contagens | 1 autor; "17 guias"; 989 linhas mortas | 2 autores; 15 guias; 989 linhas | Dois nomes com o mesmo e-mail (1 pessoa); 15 `DEPLOY-*.md` + `DEPLOY.md` + roteiro; **1.047 linhas sem uso** (8 telas, mapa, geocodificação, `tableHelpers.js`, `usePagination.jsx`). Os relatórios históricos não são reescritos |
| 13 | IA | Não tratado | "IA de roteiro" fora do roteiro | Skill no Claude Code que gera arquivo para a importação existente; nenhuma chave no app |

## 3. Verificação de 2026-11-10

Resultados completos, com comandos e saídas, em `verificacao-2026-11-10.md`. Resumo:

| Verificação | Resultado |
|---|---|
| `TZ=Europe/Lisbon npx vitest run src/domain` | 17 falham, 94 passam |
| `TZ=Asia/Tokyo npx vitest run src/domain` | 18 falham, 93 passam |
| `TZ=America/Sao_Paulo npx vitest run src/domain` | 111 passam |
| `npm run test:e2e` sem `VITE_FIREBASE_*` | 18 de 18 falham; o app não carrega: "Firebase: Error (auth/invalid-api-key)" |
| Regras, 14 cenários (`verifica-regras*.mjs`) | 12 permitidos que deveriam ser negados; 2 controles corretos. Linha de base para a issue de regras |
| A2, A13 e A10 no navegador | as três confirmadas (seção 2.1); capturas em `verificacao-2026-11-10/qa-capturas/` |

## 4. Horizonte 1: estabilizar (cerca de 4 a 5 semanas)

Esforço: P até 1 dia, M de 2 a 5 dias. Issues criadas em 2026-11-10 no repositório `paineis-gerenciais/travel-dashboard`.

| ID | Issue | Título | Origem | Sev. | Esf. | Depende de |
|---|---|---|---|---|---|---|
| **Onda 1: rastro, segurança e rede de proteção (semana 1)** | | | | | | |
| I-01 | #16 | docs: rastro da Prumo no repositório | ambos | Médio | P | — |
| I-02 | #17 | fix(rules): convite e acesso | 07/11 A1, M1 · 09/11 A4, S-01 a S-04 | Alto | M | — |
| I-03 | #18 | fix(security): links de Documentos validados | 09/11 S-05 · 07/11 H3 | Médio | P | — |
| I-04 | #19 | ci: workflow Qualidade verde | 07/11 A2 · 09/11 A6, QA-04, QA-06, QA-07, QA-09, QA-13 | Alto | P | — |
| I-05 | #20 | ci: deploy depende do Qualidade | 07/11 A2 · 09/11 A5, QA-01, S-07, S-08 | Alto | P | I-04; autorizações 5 e 6 |
| I-06 | #21 | chore: lint e remoção de código sem uso | 07/11 M3, M4 · 09/11 A5, QA-10, QA-12, S-13 | Médio | P | I-04 |
| I-07 | #22 | feat(analytics): eventos de convite, membro, despesa e login | 09/11 A15 | Médio | P | — |
| **Onda 2: dados e sincronização (semanas 2 a 4)** | | | | | | |
| I-08 | #23 | fix(domain): datas sem dependência de fuso | 09/11 A3 | Alto | P | I-04 |
| I-09 | #24 | fix(domain): acerto abate o saldo e centavos fecham | 09/11 A9, D-16 | Alto | M | — |
| I-10 | #25 | refactor(store): edição por id | 09/11 A2 · 07/11 A3 | Alto | M | — |
| I-11 | #26 | feat(sync): gravação por campo (ADR-0001) | 07/11 A3 · 09/11 A1, D1, D5, D8 | Alto | M (4 a 6 dias) | I-10; aprovação do ADR |
| **Onda 3: interface e convite (semanas 4 e 5)** | | | | | | |
| I-12 | #27 | fix(a11y): folhas por portal e foco preso | 07/11 M6 · 09/11 A13, A11-1 | Médio | P | — |
| I-13 | #28 | feat(ui): falhas visíveis | 09/11 A8, R2, R4 | Alto | P | I-11 |
| I-14 | #29 | fix(a11y): contraste, ARIA do menu de status e nomes acessíveis | 07/11 M6 · 09/11 A10, A11-2 · 10/11 | Médio | P | — |
| I-15 | #30 | fix(ux): convite para qualquer login com e-mail | 09/11 A11 | Alto | M | I-02 |
| I-16 | #31 | fix(ux): confirmação ou desfazer nas ações destrutivas | 07/11 M1 · 09/11 A12 | Alto | M | — |
| **Contínuo** | | | | | | |
| I-17 | #32 | docs: README, CHANGELOG, versão, licença MIT, aviso de privacidade | ambos | Médio | P | — |
| I-18 | #33 | research: 5 entrevistas do roteiro T1.4 | 07/11 M5 · 09/11 R2, UX | Alto | seu tempo | ux-research ajusta o roteiro |

Critérios de aceite e verificação de cada uma estão no corpo da issue. Regras de execução: um PR por issue, em rascunho, com `Closes #<n>`; issues que tocam os mesmos arquivos vão em sequência (I-04, I-05 e I-06 mexem nos workflows; I-10 e I-11 no store). Antes de cada push, a verificação da área (seção 8). Regras novas vão a produção junto com o front-end de I-02, com sua autorização.

## 5. Horizonte 2: consolidar (cerca de 3 a 4 semanas, depois do H1)

- **Alertas da viagem (motor de regras).** Regras puras em `src/domain/`, testadas, que leem a viagem e mostram avisos numa área própria, sem IA, sem rede e sem custo:
  - dia sem hospedagem;
  - dia sem refeição planejada;
  - reserva ou ingresso ainda "Planejado" a poucos dias da data;
  - despesa sem pagador, que hoje sai do acerto sem aviso;
  - itens sem data, que hoje somem das visões por dia e por cidade;
  - itens sem valor;
  - acerto pendente entre participantes;
  - checklist sugerido pelo tipo de viagem (internacional, com criança).

  Quais entram primeiro sai das entrevistas de I-18. Esforço: 2 a 4 dias para os seis a oito primeiros.
- **Lançar por frase, sem IA.** Campo único ("45 jantar Ana", "táxi 30 ontem") resolvido por regras locais: valor, descrição, pagador pelo nome do participante, data. Microfone do navegador onde houver suporte; nos demais, o ditado do teclado. Passa pela prévia antes de entrar. Até 1 dia.
- **Indicadores honestos:** "Pago %" por valor, "Por pessoa" com a mesma base da divisão, relatório de transporte com o custo legado, cancelamento com uma regra só.
- `useReducer` com reducer puro em `src/domain/`, testado; ele também devolve os caminhos alterados para a gravação por campo.
- Testes de componente (`Sheet`, `TripProvider`, `StatusChip`) com `@testing-library/react`; cobertura com limite mínimo; E2E de acessibilidade com axe e projeto de tablet.
- Interface: ícones SVG copiados de Lucide ou Phosphor (D4), alvos de 44 px, estados de erro, carregando e pressionado, `Row` clicável por inteiro; Mais em Viagem, Exportar, Conta e Avançado (Diagnóstico e JSON em Avançado); relatórios de Custos levando ao item em Dias.
- Operação: presença a 60 s e pausada em aba oculta; `limit` em atividade e comentários; listener único de comentários; remover o cache do Firestore no service worker; logout limpa dados locais; atualização do PWA sem recarregar durante a digitação.
- Segurança e dados: validação de esquema e tamanho nas regras (resto de S-04); exclusão completa da viagem (S-06); SheetJS pelo CDN oficial (D5) e limite de 2 MB; importação sem zerar campos ausentes (**adiantado no PR #45**, issue #41, junto com o limite de 2 MB para JSON); Dependabot; ferramentas de desenvolvimento atualizadas num PR só.

### IA pelo Claude Code (pode começar em paralelo ao H1)

Usa a exportação e a importação por planilha que já existem (`src/domain/sheet.js`: insere e atualiza, nunca apaga; prévia antes de aplicar). Ajuste de 2026-11-10 (issue #41): a skill gera também um JSON com as mesmas abas e colunas, e "Importar planilha" passa a aceitá-lo pela mesma prévia; "Importar JSON" (substituir) recusa esse arquivo.
1. **Skill `roteiro-viagem`** em `.claude/skills/` do repositório: regras de pesquisa (fontes oficiais, preço sempre como estimativa com data e link, status "Planejado"), leitura da planilha exportada da viagem, geração do arquivo `.xlsx` ou do texto para "Colar", e um script que valida a saída com a própria `validarAba` do app antes de você importar. P a M (1 a 2 dias).
2. **Agente `pesquisador-destino`** em `.claude/agents/`, só se a pesquisa por várias cidades ganhar com paralelismo. P.
3. **Dados pessoais fora do repositório público:** a planilha da viagem e o arquivo gerado ficam só na sessão ou no seu computador, nunca em commit.
4. **Custo:** com o Claude Code pela assinatura (Pro ou Max), não há cobrança por chamada; o uso consome os limites da assinatura. Se o Claude Code estiver ligado a uma conta da API, a cobrança é por token, como na estimativa da seção 12.

Issue própria: #41, criada em 2026-11-10 com autorização do dono.

## 6. Horizonte 3: só com critério de entrada

| Item | Critério de entrada | Esf. |
|---|---|---|
| Orçamento-alvo contra realizado | dias preenchidos por viagem medido (M2) e orçamento citado como dor em 3 das 5 entrevistas | M |
| Modo "Hoje" com gasto rápido e chave PIX no acerto | retorno na semana da viagem medido (M4) e entrevistas | M |
| Várias moedas com taxa digitada por viagem | 30% ou mais das viagens internacionais (entrevistas ou dados) | G |
| IA dentro do app, com a chave de cada pessoa | outros membros do grupo pedindo IA dentro do app, não só você; antes: CSP ativa e I-03 entregue | M |
| Exportar calendário `.ics` | nenhum (barato) | P |
| Exclusão de conta e retenção definida | obrigatório antes de abrir a terceiros | M |
| CSP em modo relatório; JSDoc com `checkJs` e JSON Schema do estado; dividir Dias, Custos e Mais quando tocados | quando houver folga | M |

**Sinais para abrir a terceiros:** 3 ou mais pessoas fora do seu círculo usando e voltando sem ajuda; pedido espontâneo e repetido de quem não é você; 40% ou mais das viagens com 2 ou mais pessoas ativas. Se as entrevistas mostrarem que os grupos já resolvem bem com outras ferramentas, o projeto para no H2.

**Fora do roteiro:** motor de IA próprio (treinado, hospedado ou no navegador), importar reservas por e-mail, anexos hospedados, push com backend, venda de passagens, instalar o kit Prumo no repositório do produto (decisão separada).

## 7. Decisões registradas em 2026-11-10

- **D3. Colaboração e login:** (a) congelar presença, mensagens, comentários e atividade, sem apagar dados; manter Google e e-mail/senha; decidir o telefone depois de I-15, com dado de uso.
- **D4. Contraste e ícones:** (a) escurecer ok, warn, danger, neutral e `--text-3`, criar `--on-accent` (H1, I-14) e trocar emoji por SVG próprio (H2).
- **D5. Leitura de planilha:** (a) SheetJS pelo CDN oficial, 0.20.2 ou mais nova, versão confirmada na fonte no dia.
- **D6. Licença:** (a) MIT. Qualquer pessoa pode usar, alterar e vender cópias, mantendo o aviso de autoria; sem garantia.
- **D7. Centavo na divisão:** (a) maior resto determinístico; a soma sempre fecha.
- **D8. IA:** skill e agentes no Claude Code, com importação pela planilha. A IA dentro do app foi para o H3, com critério. **Ajuste de 2026-11-10:** a skill gera JSON e planilha `.xlsx`; o app passa a aceitar o JSON na mesma prévia e mesclagem da planilha (issue #41).
- **D9. Modelo de IA no app:** não se aplica enquanto a IA estiver no Claude Code.

## 8. Verificação por área (vai para o `CLAUDE.md` do produto)

| Área | Verificação |
|---|---|
| `src/domain/` | `npm test`; `TZ=Europe/Lisbon npm test`; `TZ=Asia/Tokyo npm test` |
| `firestore.rules`, `src/lib/tripData.js` | `npm run test:rules` (Java 21); scripts `verifica-regras*.mjs`; `npm run test:e2e` |
| `src/store/`, `src/components/`, `src/styles/` | `npm run lint` (depois de I-06); `npm run test:e2e`; `npm run build`; E2E de duas contas (depois de I-11) |
| `vite.config.js`, service worker, `firebase.json`, workflows | `npm run build`; prévia do PR no Firebase Hosting; Qualidade verde no PR |
| `.claude/skills/`, `.claude/agents/` | validar uma saída de exemplo com o script da skill; importar no app pela prévia |

`npm run test:e2e` e `npm run build` em modo de teste exigem as variáveis `VITE_FIREBASE_*`; fora do CI, valores fictícios bastam (ver `CLAUDE.md`).

## 9. Autorizações

Concedidas com a aprovação do plano:
1. Criar as 18 issues do H1 em lote.
2. Criar só as labels do padrão Prumo usadas por elas.
3. Criar e enviar um branch por issue.
4. PR em rascunho de I-01 no branch da sessão e PR no projetos-dev com a linha na tabela de projetos.

Pedidas de novo no momento, uma a uma:

5. Proteger `main` exigindo o Qualidade (configuração do repositório).
6. Dar à conta de serviço do deploy o papel para publicar regras pelo CI; sem isso, a publicação das regras continua manual.
7. Publicar as regras corrigidas em produção, junto com o front-end de I-02.
8. Cada merge, um por vez, por PR.
9. Criar a issue da skill de IA no Claude Code. **Concedida em 2026-11-10: #41.**

## 10. O que só você pode conferir no Console do Firebase

- Regras publicadas iguais às do repositório no commit `b5a3ce2` (anote a data).
- Plano Blaze ativo ou não; login por telefone em uso ou não.
- Analytics ativo e com dados (viagens, membros, retorno).
- Papéis da conta de serviço do deploy; restrição da chave de API e domínios autorizados.

## 11. Riscos do plano

- **Troca de formato (I-11):** mitigada por leitura v1 e v2 durante duas versões, exportação de todas as viagens antes, ADR com caminho de volta e E2E de duas contas como portão.
- **Regras novas (I-02):** contas de e-mail e senha não verificadas deixam de aceitar convites novos até verificar; membros atuais não perdem acesso.
- **CI como portão (I-05):** enquanto o Qualidade não estiver verde, nada publica. Por isso I-04 vem antes.
- **Prazo:** com a gravação por campo no H1, o horizonte passa de 30 dias para cerca de 4 a 5 semanas.
- **Skill de IA:** a planilha da viagem tem dados pessoais; não pode entrar em commit no repositório público.

## 12. Custos de IA

- **Caminho escolhido (Claude Code):** pela assinatura do Claude, sem cobrança por chamada, dentro dos limites dela; por uma conta da API, cobrança por token.
- **Referência para a IA dentro do app (H3):** estimativa de 2026-11-09 em `custos-ia/estimativa-custos-ia.md`, com a chave de cada pessoa. Valores centrais no Opus 5.5: R$ 0,06 por lançamento por frase, R$ 1,48 por dia de roteiro pesquisado, R$ 19,65 por viagem do organizador, R$ 75,44 por ano para um grupo de 4.

## 13. Registro de 2026-11-10 (respostas do dono)

- **G2 do ADR-0001 aprovado** com as opções recomendadas da seção 9: (1) viagem no formato antigo aberta sem internet fica somente leitura até conectar; (2) criar a cópia automática "antes da atualização"; (3) no mesmo campo do mesmo item, vale a última gravação, sem aviso. PR #40.
- **Console do Firebase:** o dono confirmou que as regras publicadas hoje são as do repositório (`b5a3ce2`). A publicação das regras do PR #37 continua dependendo da autorização 7.
- **Skill de IA:** D8 ajustada para JSON e planilha (#41).
- **Backlog aberto com autorização:** #42 (membro não altera o e-mail exibido), #43 (excluir viagem apaga membros e convites) e #44 (emuladores com projeto `demo-*`).
- **Skill de IA (#41):** PR #45. Segurança aprovada com ressalvas; QA reprovou duas vezes (campos zerados na atualização parcial, pelo JSON e depois pela planilha do script) e aprovou com ressalvas depois das correções. Revisões em `docs/prumo/revisao-pr-45/` (no PR #45).
- **Ressalvas baixas do PR #45:** issue #46. **Incidente de processo** (delegações paralelas com pasta no mesmo diretório; uma limpeza apagou o trabalho da outra): paineis-gerenciais/prumo#13.

## 14. Próximos passos

1. Rastro no repositório e PRs de documentação (I-01).
2. Onda 1 em paralelo onde os arquivos não se cruzam: I-02, I-03, I-04 e I-07; depois I-05 e I-06.
3. ADR-0001 para sua aprovação enquanto I-08, I-09 e I-10 andam.
