# Avaliação Prumo do travel-dashboard: relatório consolidado

- **Data:** 2026-11-09 · **Repositório avaliado:** `paineis-gerenciais/travel-dashboard`, branch `main`, commit `b5a3ce2` · **Nível:** N2, consultivo, somente leitura
- **Head:** sessão principal da Prumo. **Especialistas:** software-architect, devsecops-engineer, frontend-engineer, qa-engineer, data-bi-engineer, ux-research, ui-product-design, product-manager, business-strategy. Os nove pareceres completos estão nesta pasta (índice na seção 9).
- **Rótulos:** `[FATO]` com caminho:linha ou comando e resultado; `[HIPÓTESE]` quando depende de execução, de usuários ou de fonte não consultada; `[RECOMENDAÇÃO]`. Severidade: Bloqueador, Alto, Médio, Baixo. Esforço: P (até 1 dia), M (2 a 5 dias), G (mais de 1 semana).

## 0. Sumário executivo

O travel-dashboard é um app bem acima da média para um projeto pessoal: domínio puro com 111 testes, acesso ao banco por porta única, CI com emulador do Firestore, PWA offline, analytics sem dado pessoal por construção e uma série de bugs antigos corrigidos na causa-raiz. O nicho é defensável: roteiro, custos e divisão de despesas do grupo num só lugar, em português, sem anúncio.

Os problemas graves são poucos e concentrados:

1. **O modelo de sincronização não aguenta o uso em grupo.** A viagem inteira é um documento só, regravado por inteiro a cada 900 ms: a última gravação vence o documento todo, e as telas editam itens pela posição no array, que é reordenado a cada mutação. Duas pessoas editando ao mesmo tempo perdem edições em silêncio, e um usuário sozinho pode editar a cidade errada ao preencher a data.
2. **Datas recuam um dia em fusos a leste de UTC.** Confirmado por reprodução: o padrão `new Date('AAAA-MM-DDT00:00')` seguido de `toISOString()` devolve o dia anterior em Lisboa ou Tóquio. É um app de viagem usado no exterior.
3. **As regras de segurança deixam forjar convite, reentrar depois de removido e entrar com e-mail não verificado.** Correção pequena, mas vale para o app já publicado.
4. **O deploy publica sem esperar os testes de regras e de jornada**, não existe configuração de lint, e nenhum componente de interface tem teste.
5. **Falhas são invisíveis para o usuário:** sem ErrorBoundary, "Salvando…" fica para sempre em caso de erro ou sem rede, e o acerto de contas confirmado não abate o saldo (risco de pagar duas vezes).

Recomendação: estabilizar antes de expandir. Um mês de correções baratas (horizonte 1), depois a decisão de arquitetura (mapas por id com gravação por campo) e, só então, as funções de maior valor ainda ausentes: orçamento-alvo contra realizado, modo "Hoje" com gasto rápido e várias moedas. Congelar os quatro canais de colaboração e o login por telefone até haver evidência de uso. Nada aqui exige trocar de stack.

## 1. Método e limites

- Leitura estática do código, dos 15 guias `DEPLOY-*.md`, do roteiro de pesquisa e do histórico git (31 commits, 2 autores, 2026-07-08 a 2026-08-18, 15 PRs). Linhas em `src/` e `e2e/`: 10.401.
- `[FATO]` Nesta sessão a execução de código do repositório foi bloqueada (`npm test`, `vitest`, `vite build`, `eslint`, `playwright`), e o app publicado não é alcançável pela rede. Tudo que depende de execução está em "Verificação pendente" (seção 8).
- O Head executou por conta própria, fora do código do repositório: `npm ci --ignore-scripts`, `npm audit`, cálculo de contraste WCAG em Python, reprodução do defeito de fuso em Node, e conferiu no código cada achado Alto dos pareceres (seção 3).
- `[FATO]` Não há PRD, issues legíveis daqui, dados de uso nem resultado de pesquisa com usuários no repositório. Tudo sobre público e valor percebido é hipótese.

## 2. O que o app é

App web/PWA de planejamento de viagem em grupo: React 18 + Vite 5 + Firebase 10 (Auth com Google, e-mail/senha e telefone; Firestore; Hosting) + vite-plugin-pwa, sem TypeScript e sem backend próprio. Navegação em 5 destinos (Dias, Cidades, Mapa, Custos, Mais). Funções: cidades e datas, cartão por dia (transporte, hospedagem, refeições, atrações, despesas), rotas abertas no Google Maps, totais e relatórios, divisão de despesas com acerto, checklist, anexos por link, convites por e-mail avisados por WhatsApp, presença e edição em tempo real, mensagens e comentários, feed de atividade, versões salvas, impressão, planilha (importar, exportar, colar), lembretes locais, feedback, diagnóstico, modo escuro. Nasceu como planilha e Apps Script pessoal do autor.

## 3. Pontos fortes

| # | Ponto forte | Evidência |
|---|---|---|
| F1 | Domínio puro e testado: `src/domain/` não importa React nem Firebase; 111 testes com a causa-raiz de cada bug registrada em comentário | `[FATO]` `src/domain/__tests__/domain.test.js`; `costs.js:6-9` |
| F2 | Porta única ao Firestore, com o modelo documentado | `[FATO]` `src/lib/tripData.js:1-8` |
| F3 | CI com testes de regras e E2E no emulador, e trava contra vazamento do código de teste para produção | `[FATO]` `.github/workflows/qualidade.yml:53-68` |
| F4 | Analytics com lista de chaves permitidas: dado pessoal não passa | `[FATO]` `src/lib/analytics.js:13-59` |
| F5 | Sem segredos no código nem no histórico; chaves públicas do Firebase documentadas como tal | `[FATO]` `git log --all -p` filtrado; `.env.example` |
| F6 | Carregamento sob demanda das telas, de `xlsx` e do analytics; chunks separados | `[FATO]` `App.jsx:14-18`; `sheetFile.js:15`; `vite.config.js:46-52` |
| F7 | PWA com casco offline e Firestore com cache persistente multiaba | `[FATO]` `vite.config.js`; `firebase.js:39-41` |
| F8 | Causas-raiz do histórico tratadas: foco roubado, salto de rolagem, rodapé solto, dia inicial | `[FATO]` `ui.jsx:67-81,109-117`; `app.css` `.app-shell`; `Dias.jsx:50-71` |
| F9 | Diálogos acessíveis: `role=dialog`, foco preso, Esc, retorno de foco; abas com `aria-current`; foco visível global; `prefers-reduced-motion` | `[FATO]` `ui.jsx:77-125`; `App.jsx:105-116`; `app.css:164` |
| F10 | Base visual sólida: tokens em `:root`, um acento, modo escuro completo, alvo de toque de 44 px como token, cor por cidade com significado | `[FATO]` `app.css:7-67,365-387` |
| F11 | Participantes da divisão com id estável e migração idempotente | `[FATO]` `state.js:95-133` |
| F12 | Convite honesto: o app diz que não envia nada sozinho e abre a folha de envio na hora | `[FATO]` `ShareModal.jsx:32`; `DEPLOY-CONVITE-ENVIO.md` |
| F13 | Nicho defensável e custo de infraestrutura irrisório (R$ 50 a 7.300 por ano de 100 a 10.000 usuários) | `[HIPÓTESE]` `parecer-estrategia.md`, seções 3 e 5 |

## 4. Achados de severidade Alta (consolidados e conferidos pelo Head)

Nenhum Bloqueador. Cada linha junta os achados equivalentes dos pareceres.

| ID | Achado | Conferência do Head | Origem | Esf. |
|---|---|---|---|---|
| A1 | **Último que grava vence, no documento inteiro.** `saveTripState` regrava `state` completo com debounce de 900 ms; o buffer de foco adia o remoto, mas o debounce continua gravando o local sem a mudança do outro; edição offline reenvia tudo. Não há flush ao sair da aba ou trocar de viagem. | `[FATO]` `TripProvider.jsx:88-101`; `tripData.js:100-102`. Efeito em produção: `[HIPÓTESE]` forte, confirmar com 2 navegadores | arq D1, D4; front R-2; QA-03; dados | M |
| A2 | **Itens identificados por índice e array reordenado a cada mutação.** `ensureGenerated` chama `sortCitiesByDate` em toda mutação; `Cidades.jsx` guarda `editing = índice`. Preencher o check-in de uma cidade nova a move na lista e a folha passa a editar outra cidade. Mesmo padrão em Dias e no checklist. | `[FATO]` cadeia confirmada: `generate.js:121-122`; `TripProvider.jsx:22-24,115-119`; `Cidades.jsx:15,85-89,125-185` | arq D2; front R-1 | M |
| A3 | **Datas recuam um dia em fuso UTC+.** `addDaysISO`, `datesFromCities`, cobertura de cidades e café automático criam meia-noite local e leem `toISOString()`. | `[FATO]` reprodução: `TZ=Europe/Lisbon node -e "..."` com 2026-07-10 + 1 dia devolve `2026-07-10`; em `America/Sao_Paulo` devolve `2026-07-11`. Código: `dates.js:16-20,47-53`; `generate.js:41-48` | arq D3; QA-05; dados D-1 | P |
| A4 | **Convite forjável, revogação ineficaz, e-mail não verificado.** Qualquer usuário logado cria convite para qualquer `tripId`; a cláusula C só exige que o convite exista (sem checar `status` nem dono); `revokeMember` não apaga o convite aceito, então o removido reentra com uma escrita direta; o cadastro por e-mail/senha não envia verificação e as regras não checam `email_verified`. O id da viagem não é adivinhável, mas é conhecido por membros e ex-membros. | `[FATO]` `firestore.rules:60-65,102,109-112`; `tripData.js:196-199`; `useAuth.js:40-47`. Ressalva do Head: o cliente ignora convites já aceitos (`tripData.js:175`), então a reentrada não é automática; exige escrita direta | seg S-01 a S-03 | P |
| A5 | **Deploy sem barreira de qualidade.** O workflow de deploy roda só testes de domínio e build e publica em `live`, sem `needs` do workflow Qualidade. Não existe configuração do ESLint (`npm run lint` falha), e o lint não roda no CI. | `[FATO]` `firebase-hosting-merge.yml:13-25`; ausência de `.eslintrc*`/`eslint.config*`/`eslintConfig` confirmada por listagem | QA-01, QA-12; seg S-07; front R-5 | P |
| A6 | **E2E pode nunca ter passado no CI.** O job Qualidade não define `VITE_FIREBASE_*` e `firebase.js` lê tudo de `import.meta.env` sem valor padrão; o Firestore exige `projectId`. | `[HIPÓTESE]` forte; confirmar no histórico do Actions (403 nesta sessão) | QA-04 | P |
| A7 | **Sem testes de componente.** Zero testes em `src/components` e no `TripProvider`; as três regressões do histórico vieram dessa camada. | `[FATO]` `package.json:11`; `@testing-library` ausente | QA-02; front | M |
| A8 | **Falhas invisíveis.** Sem ErrorBoundary (tela branca em erro de render ou de chunk após deploy); falha de gravação vai só para `console.error` e "Salvando…" fica para sempre; sem aviso de "sem conexão"; nenhum `onSnapshot` trata erro. | `[FATO]` grep sem `ErrorBoundary`; `TripProvider.jsx:97-99`; `App.jsx:83`; `tripData.js` | front E-1, E-3; UX rec. 1; arq R4 | P |
| A9 | **Acerto confirmado não abate o saldo.** A confirmação guarda só uma chave com o valor; uma despesa nova recalcula o bruto e sugere pagar de novo o que já foi pago, invertendo quem recebe. | `[FATO]` `split.js:212-226` (só marca `confirmado`); conta refeita em Python no parecer de dados | dados D-2 | M |
| A10 | **Contraste reprova AA** em chips e banners de status (ok 3,11; warn 3,31; danger 4,27; neutral 4,20), em `--text-3` (2,95, usado em texto de 11 px) e, no escuro, branco sobre o acento (3,13). | `[FATO]` recalculado pelo Head a partir de `app.css:9-27,51-63` | design; front A11-8; UX | P |
| A11 | **Convite falha em silêncio** para quem entra por telefone (sem e-mail) ou com outro e-mail; o texto diz "conta Google", mas o login por e-mail/senha também vale. O convidado cai no login sem contexto. | `[FATO]` `tripData.js:168-171`; `invite.js:25`; `ShareModal.jsx:44` | UX J2; produto R3 | M |
| A12 | **Ações destrutivas sem desfazer:** excluir item, carregar versão e remover membro não confirmam; "Limpar viagem" apaga para todos e qualquer editor pode fazer. | `[FATO]` `Dias.jsx:371`; `VersionsModal.jsx:82`; `ShareModal.jsx:68`; `Mais.jsx:137-178` | UX heurística 3 | M |
| A13 | **Sheet de comentários dentro de contêiner com `contain: layout paint` e `will-change`**, sem portal: o fundo fixo tende a ficar recortado no cartão. | `[HIPÓTESE]` forte; confirmar no navegador. `Dias.jsx:212,273`; `app.css:421` | front P-1 | P |
| A14 | **Sem várias moedas** para um público que viaja ao exterior; o acerto e o orçamento ficam inauditáveis. | `[FATO]` `format.js:37-45`; nenhum campo de moeda | dados D-3; produto L1 | G |
| A15 | **Métricas de resultado não mensuráveis:** não há evento de convite enviado, aceito, membro entrou, acerto confirmado, falha de gravação ou de login. | `[FATO]` grep `track(` em `src/` | produto M1 a M5; UX seção 8 | P |

## 5. Achados Médios (resumo por área; detalhes nos pareceres)

- **Arquitetura:** contexto sem memoização re-renderiza 21 consumidores e a `PrintView` inteira a cada tecla e a cada batida de presença (`TripProvider.jsx:303`; `App.jsx:148`); dois `structuredClone` por mutação; presença a cada 15 s custa cerca de 10 mil leituras por hora com 6 pessoas (`[HIPÓTESE]`); atividade e mensagens leem a coleção inteira sem `limit`; migrações informais sem `schemaVersion`; exclusão de viagem deixa `comments`, `activity`, `presence` e `members` órfãos; 989 linhas de código morto (8 telas antigas, `EmbeddedMap.jsx`, `geocode.js`, `usePagination.jsx`), uma delas importando `leaflet`, que não está instalado; documentação espalhada em 15 guias na raiz, README descrevendo a Fase 1, versão fixa `1.0.0`, sem ADR nem CHANGELOG.
- **Segurança e privacidade:** sem validação de esquema e tamanho nas regras (`authorUid`, `authorName` e `role` livres); link `javascript:` gravável e aberto em Documentos (`AttachmentsSheet.jsx:132`); `xlsx 0.18.5` com prototype pollution e ReDoS lendo arquivo do usuário, sem correção no npm; cache `NetworkFirst` do Firestore no service worker é inútil e guarda dados de viagem por 24 h; sem CSP; sem aviso de privacidade, exclusão de conta nem retenção definida; actions por tag mutável, sem `permissions` explícitas, sem Dependabot. `npm audit` (Head, 2026-11-09): 33 vulnerabilidades, 2 críticas e 15 altas, quase todas em ferramentas de desenvolvimento; em runtime pesam `xlsx` e, com exposição provavelmente baixa no navegador, `firebase` via `grpc-js` e `undici`.
- **Front-end:** 176 estilos inline em 27 arquivos; emoji como ícone; `autoUpdate` do PWA pode recarregar a aba durante a digitação; `xlsx` entra no precache do service worker mesmo para quem não usa planilha; listener do Firestore por item de comentário; nomes acessíveis repetidos ("Ver →" x5, "Editar" x N); `Timeline` como `tablist` incompleto; arrastar paradas sem alternativa por teclado; `StatusChip` sem navegação por setas.
- **QA:** teste E2E "compartilhar" abre o Checklist, não o convite (`spec:240` contra `Mais.jsx:98`), falso positivo; E2E de divisão não confere valores; `retries: 1` esconde testes intermitentes; relatório do Playwright nunca é gerado no CI; `test-results/` versionado; sem cobertura; regras sem teste para revogação, `members`, `presence`, `versions` e update/delete de convites.
- **Dados e indicadores:** "Pago %" é por contagem de linhas, sem hospedagem e com itens de custo 0; "Por pessoa" usa `travelers` enquanto a divisão usa participantes; visões por cidade e por dia excluem itens sem data sem avisar; partes e transferências não fecham a centavos (9,99 contra 10,00); "Ninguém deve nada" aparece com saldos negativos quando há despesa sem pagador; importação de planilha zera status e custo quando falta coluna, e dinheiro em texto vira 0 em silêncio; exclusão em cascata de cidade é por nome, não por id; "modo orçamento" sem orçamento-alvo.
- **UX:** tela Mais com 17 linhas de importância desigual (Checklist ao lado de Diagnóstico); "Quem pagou" nasce vazio e tira a despesa do acerto sem aviso no item; registrar um gasto na rua exige 4+ toques e uma folha de 8 campos; item novo fica gravado vazio ao fechar a folha; termos técnicos na interface (Diagnóstico, JSON, Sobrescrever, Carregar); onboarding termina sem ação; modelo de exemplo com valores inventados sem rótulo dentro da viagem; feed de atividade registra só 4 tipos de evento e não responde "quem alterou o quê" nos casos de maior risco; quatro canais de colaboração (presença, mensagens, comentários, atividade) sem evidência de uso; sem papel "só leitura".
- **Design:** alvos de toque abaixo da meta de 44 px (`btn-sm` 36, chip 32, timeline 40); `Row` clicável com `all: unset` reduz alvo e foco; estados ausentes (erro de campo, carregando, hover e pressed); duas paletas (cidade no CSS, gráfico em JS); texto funcional de 11 px; `theme_color` do manifest não combina com o cabeçalho.
- **Produto e estratégia:** sem PRD, backlog único nem pesquisa executada; roteiro T1.4 bom, mas sem critério de sucesso por tarefa, sem tarefa de uso em viagem nem de acerto, sem teste em pares; sem licença no repositório (vale "todos os direitos reservados"); login por telefone exige plano Blaze (cartão) e abre risco de fraude de SMS sem App Check; fator de ônibus 1.

Correções do Head sobre os pareceres: (1) o login por e-mail e senha existe (`useAuth.js:38-49`), ao contrário do que o parecer de produto registrou em dúvida; (2) o mapa embutido com OpenStreetMap e a geocodificação pelo Nominatim, citados como fato pelo parecer de estratégia, são código morto (`EmbeddedMap.jsx` e `geocode.js` não são importados; `Mapa.jsx:35` diz "sem mapa embutido"), então o risco de política de uso do Nominatim não vale hoje; (3) a reentrada de membro removido exige escrita direta, não é automática.

## 6. Leitura por dimensão

### 6.1 Técnico (codificação)
- **Fortes:** separação domínio/lib/store/componentes respeitada na maior parte; domínio testado; CI com emuladores; bundle sob controle; offline pronto.
- **Fracos:** o formato do dado (documento único, arrays por índice) é a dívida que gera A1 e A2; `TripProvider` concentra ~30 ações sem teste; sem tipos; sem lint; sem teste de componente; código morto e documentação defasada escondem o estado real; deploy desacoplado da qualidade.
- **Veredito:** não precisa trocar de stack. Precisa de um ADR sobre sincronização e de um mês de higiene.

### 6.2 Usuário (experiência e design)
- **Fortes:** navegação de 5 destinos coerente (Dias edita, Custos consulta); cartão por dia com swipe e alternativa por botões; diálogos acessíveis; modo escuro; impressão dedicada; textos de apoio curtos e bons; tokens e identidade neutra com cor por cidade.
- **Fracos:** convite e salvamento falham em silêncio; ações destrutivas sem rede de proteção; contraste reprovado em texto de status; dinheiro com dois conceitos de "pessoas" e acerto que não abate o pago; o participante que só acompanha (quer "hoje", "quanto devo", "quem já pagou") não tem caminho curto; a tela Mais virou gaveta.
- **Veredito:** a estrutura está certa; falta honestidade de estado, proteção contra erro e um modo de uso durante a viagem.

### 6.3 Utilidade, impacto e potencial
- **Utilidade:** resolve um problema real e concreto para um organizador de viagem em grupo, e a união roteiro + custos + divisão + colaboração em pt-BR não foi encontrada em concorrente pesquisado (Wanderlog, TripIt, Splitwise, Tricount, Nomad, Quanto Deu?). `[HIPÓTESE]` a dor que vence é "combinar e acertar contas no grupo", não "montar roteiro"; a IA generativa ataca a segunda, não a primeira.
- **Impacto hoje:** restrito ao autor e pessoas próximas; não há dado de uso nem pesquisa executada. Esse é o maior buraco de evidência.
- **Potencial:** cenário A (ferramenta pessoal bem acabada) com B-leve (licença e README) agora; C (nicho gratuito) só se 3 sinais em 90 dias confirmarem (retenção entre viagens fora do círculo, dor dominante nas entrevistas, pedido espontâneo de recurso pago); D (pago) não recomendado por ora: concorre com gratuitos bons e dispara gatilhos de pagamentos e dados de terceiros. Custo de infraestrutura é irrisório; o custo real é tempo de manutenção e conformidade (LGPD, SMS no Blaze).

## 7. Proposta de evolução

### Horizonte 1: estabilizar (0 a 30 dias; itens P salvo indicação)
1. **Mínimo seguro:** regras S-01 a S-03 com testes (convite só pelo dono, `status == 'pendente'`, `email_verified`, apagar convite ao revogar), verificação de e-mail no cadastro, conferir que as regras em produção são as do repositório; validar `href` em Documentos; deploy dependente do Qualidade e regras publicadas pelo CI; `permissions` e actions fixadas por SHA.
2. **Correções de dados:** A3 (datas pela data local, sem `toISOString`; suíte rodando também em `TZ=Europe/Lisbon` e `Asia/Tokyo`); A2 (ações e folhas por `id`, M); flush da gravação em `focusout`, `pagehide` e desmonte; preservar a edição local ao aplicar remoto bufferizado.
3. **Falhas visíveis:** ErrorBoundary na raiz e por tela; estados "Salvo", "Salvando…", "Sem conexão: salvo neste aparelho", "Erro ao salvar (tentar de novo)"; callback de erro nos listeners; `Sheet` por portal.
4. **Higiene:** configuração do ESLint e lint no CI; remover as 989 linhas mortas; `VITE_FIREBASE_*` fictícios no E2E; corrigir o E2E de convite; tirar `test-results/` do git; README atual; CHANGELOG e versão real.
5. **Produto:** instrumentar `invite_sent`, `invite_accepted`, `member_joined`, `settlement_confirmed`, `expense_added`, `save_failed`, `login_failed`; executar 5 a 8 sessões do roteiro T1.4 com critério de sucesso por tarefa, uma tarefa de uso em viagem e uma de acerto, e pares reais no convite; congelar presença, mensagens, comentários e atividade; licença e aviso de privacidade curto.

### Horizonte 2: consolidar (30 a 60 dias)
1. **ADR-0001, modelo de sincronização** (gate G2, decisão D2 abaixo): itens em mapas por id com `updateDoc` por campo, `schemaVersion: 2`, leitura dos dois formatos por duas versões. Antes, E2E com dois contextos de navegador que prove a perda hoje e proteja a mudança.
2. `useReducer` com reducer puro e testado em `src/domain/`; testes de componente para `Sheet`, `TripProvider` e `StatusChip`; cobertura com limite mínimo.
3. **Dinheiro:** acerto como lançamento de pagamento sobre saldo residual; cálculo em centavos inteiros com maior resto; invariantes de totais testados; rótulos honestos ("Total sem cancelados", "Pago R$ x de y", "Por pessoa: média de N viajantes"); avisos de qualidade ("N itens sem valor", "R$ X sem pagador").
4. **Interface:** tokens de contraste, `--on-accent`, `--fs-0` 12 px, alvos de 44 px; ícones SVG próprios; estados faltantes; `Row` clicável por inteiro; Mais reorganizado em Viagem, Exportar, Conta e Avançado; relatórios de Custos levando ao item em Dias; confirmação ou desfazer nas ações destrutivas; "Limpar" só para o dono, com versão automática antes.
5. **Convite para qualquer login:** mensagem e tela de login dizem qual e-mail usar; caminho "entrei e não vi a viagem"; vínculo de e-mail para quem entra por telefone.
6. **Operação:** presença a 60 s pausada em aba oculta; `limit` em atividade e comentários; listener único de comentários; remover o cache do Firestore no service worker; `xlsx` pelo CDN da SheetJS (ou só CSV); Dependabot; exclusão completa da viagem e limpeza de presença na revogação.

### Horizonte 3: aprofundar o núcleo (60 a 90 dias e depois)
1. Orçamento-alvo contra realizado (limite por viagem e categoria; previsto, comprometido, pago).
2. Modo "Hoje": próximo compromisso, comprovante, gasto rápido com valor e pagador em poucos toques, chave PIX no acerto.
3. Várias moedas com taxa digitada por viagem (moeda por item, conversão derivada, acerto em BRL), se a pesquisa confirmar viagens internacionais.
4. Exportar calendário `.ics`; exclusão de conta e retenção; CSP em modo relatório; JSDoc com `checkJs` e JSON Schema do estado; dividir `Dias`, `Custos` e `Mais` por pasta conforme forem tocados.

Fora do roteiro: importar reservas por e-mail, IA de roteiro, anexos hospedados, push com backend, venda de passagens.

## 8. Decisões do usuário

Cada decisão com até 3 opções; a recomendada vem primeiro.

- **D1. Rumo do produto.** (a) **Recomendada:** ferramenta pessoal bem acabada, com licença e README atual, e validação de 90 dias com entrevistas e métricas antes de abrir a terceiros. (b) Nicho gratuito já, com aviso de privacidade, exclusão de conta e parecer de LGPD antes. (c) Produto pago: não recomendado por ora.
- **D2. Modelo de sincronização (gate G2, muda o formato dos dados).** (a) **Recomendada:** O1, mapas por id com gravação por campo (esforço M, migração preguiçosa, reversível). (b) O0, só mitigar (flush, buffer menor): barato, não elimina a perda. (c) O2, subcoleção por item: G, só se o documento passar de ~300 KB ou houver permissão por item.
- **D3. Colaboração e login.** (a) **Recomendada:** congelar presença, mensagens, comentários e atividade; manter Google e e-mail/senha; decidir o telefone depois de corrigir o convite. (b) Remover os quatro canais agora. (c) Manter tudo.
- **D4. Contraste e ícones.** (a) **Recomendada:** escurecer levemente ok, warn, danger, neutral e `--text-3`, criar `--on-accent` e trocar emoji por SVG próprio (muda tons visíveis, não a identidade). (b) Só o contraste. (c) Manter como está.
- **D5. Leitura de planilha.** (a) **Recomendada:** versão do CDN da SheetJS (0.20.2 ou mais nova, mesma API, fora do `npm audit`). (b) `exceljs` (reescrever `sheetFile.js`). (c) Só CSV e colar texto.

## 9. Verificação pendente (para rodar com o repositório anexado a uma sessão ou localmente)

```
npm ci
npm test                                   # 111 testes de domínio
TZ=Europe/Lisbon npx vitest run src/domain # confirma A3 (falhas esperadas em datas e hospedagem)
TZ=Asia/Tokyo npx vitest run src/domain
npm run test:rules                         # 17 testes de regras (Java + Firebase CLI)
npm run test:e2e                           # 18 execuções (emuladores + Chromium)
env -u VITE_FIREBASE_API_KEY -u VITE_FIREBASE_PROJECT_ID npm run test:e2e   # simula o CI (A6)
npm run lint                               # esperado: falha por falta de configuração (A5)
npm run build && du -sh dist/assets        # tamanho real dos chunks e do precache
```

Também pendente: histórico do GitHub Actions e proteção do branch `main`; regras publicadas em produção iguais às do repositório; plano Blaze ativo; dois navegadores na mesma viagem editando itens diferentes (A1) e mudando o check-in de uma cidade nova (A2); comentário aberto no celular (A13); contraste com ferramenta; Lighthouse; leitor de tela; dados do Firebase Analytics.

## 10. Índice dos pareceres

| Arquivo | Papel | Conteúdo |
|---|---|---|
| `parecer-arquitetura.md` | software-architect | camadas, concorrência, opções O0 a O4, ADR-0001, custos do Firestore, 3 horizontes |
| `parecer-seguranca.md` | devsecops-engineer | regras S-01 a S-15, LGPD, CI/CD, plano de dependências, implantação e rollback |
| `parecer-frontend.md` | frontend-engineer | padrões React, desempenho, acessibilidade implementada, PWA, CSS, plano de 11 passos |
| `parecer-qa.md` | qa-engineer | cobertura por camada, pipeline, plano P1 a P3 com 22 itens, checklist manual de release |
| `parecer-dados.md` | data-bi-engineer | fichas dos indicadores I1 a I14, divisão e acerto, moeda, planilha, 10 melhorias |
| `parecer-ux.md` | ux-research | 4 jornadas, heurísticas de Nielsen, modelo mental, colaboração, personas, plano de teste com 5 tarefas |
| `parecer-design.md` | ui-product-design | tokens, estados, ícones, responsividade, contraste, design system mínimo em 7 passos |
| `parecer-produto.md` | product-manager | núcleo e acessório, lacunas L1 a L8, métricas M1 a M5, roadmap R1 a R12 com critérios de aceite |
| `parecer-estrategia.md` | business-strategy | concorrência com fontes, cenários A a D, TCO, riscos, posicionamento |

Ressalvas: os pareceres são análises estáticas; os pontos marcados `[HIPÓTESE]` precisam dos comandos da seção 9 ou de usuários. As divergências entre pareceres apontadas na seção 5 prevalecem conforme a conferência do Head.
