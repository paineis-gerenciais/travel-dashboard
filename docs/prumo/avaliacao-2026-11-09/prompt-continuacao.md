# Prompt de continuação: travel-dashboard (avaliação Prumo de 2026-11-09)

> **Como usar:** cole este arquivo inteiro na primeira mensagem de uma sessão nova com o repositório `paineis-gerenciais/travel-dashboard` anexado (de preferência também `paineis-gerenciais/projetos-dev`, onde está o rastro completo). A sessão atua como **Head da Prumo** e segue a constituição do kit.

## 1. O que eu quero desta sessão

Dar sequência ao planejamento do travel-dashboard a partir da avaliação consultiva feita em 2026-11-09 (nove especialistas da Prumo, análise estática, consolidada pelo Head). Nesta ordem:

1. Ler este arquivo e, se o projetos-dev estiver anexado, o `relatorio-consolidado.md` e os pareceres (caminhos na seção 12).
2. **Rodar a verificação pendente** (seção 9) e registrar cada resultado como `[FATO]`, com comando e saída. Isso confirma ou derruba as hipóteses A1, A2, A3, A6 e A13.
3. Apresentar as decisões D1 a D5 (seção 8) e aguardar as minhas escolhas. Se eu já tiver marcado as caixas, considerar decidido.
4. Propor o rascunho das issues do horizonte 1 (seção 11), com labels e critérios de aceite, e **pedir autorização antes de criar** (linha vermelha: criar issues em lote).
5. Copiar a pasta `docs/prumo/avaliacao-2026-11-09/` do projetos-dev para o repositório do produto num branch de trabalho e abrir PR em rascunho, para o rastro ficar junto do código.
6. Só então começar a implementação do horizonte 1, um PR por assunto, com a verificação por área da seção 10.

Regras que valem: nada de merge, push no branch padrão, force-push, deploy, criação de repositórios ou segredos sem a minha autorização explícita. Branch `<tipo>/<issue>-<slug>`, Conventional Commits com descrição em pt-BR, PR em rascunho com `Closes #<issue>`. Comunicação em linguagem simples.

## 2. Contexto do projeto `[FATO]`

- **Repositório:** https://github.com/paineis-gerenciais/travel-dashboard, público, branch `main`, commit avaliado `b5a3ce2` ("Merge pull request #15 from paineis-gerenciais/fix-planilha-a11y"). 31 commits de 2 autores entre 2026-07-08 e 2026-08-18, 15 PRs. Sem LICENSE.
- **Stack:** React 18.3 + Vite 5.4 + Firebase 10.14 (Auth com Google, e-mail/senha e telefone; Firestore; Hosting, projeto `plano-viagem-certa`) + vite-plugin-pwa 0.20; `xlsx` 0.18.5; sem TypeScript; sem backend próprio. Node 22 no ambiente de avaliação. 10.401 linhas em `src/` e `e2e/`.
- **Estrutura:** `src/domain/` (lógica pura, 111 testes em `__tests__/domain.test.js`), `src/lib/` (`firebase.js`, `tripData.js` como porta única ao Firestore, `invite.js`, `analytics.js`, `logger.js`, `sheetFile.js`), `src/store/` (`TripProvider.jsx` com o estado da viagem e ~30 ações, `TripsProvider.jsx`, `useAuth.js`), `src/components/` (5 telas vivas em `screens/`: Dias, Cidades, Mapa, Custos, Mais; `ui.jsx` com Sheet/Modal/Toast), `src/styles/app.css`, `firestore.rules` + `src/rules/__tests__/rules.test.js` (17 testes), `e2e/fluxos-criticos.spec.js` (9 cenários x 2 projetos), 3 workflows em `.github/workflows/` (`qualidade.yml`, `firebase-hosting-merge.yml`, `firebase-hosting-pull-request.yml`). Quinze guias `DEPLOY-*.md` na raiz contam o histórico de fases; o README ainda descreve a Fase 1.
- **Modelo de dados:** a viagem inteira é um único campo `state` no documento `trips/{tripId}`, gravado por inteiro com debounce de 900 ms (`TripProvider.jsx:88-101`, `tripData.js:100-102`); subcoleções `versions`, `presence`, `members`, `comments`, `activity`; coleção `convites` com id `tripId_email`; coleção `feedback` só de escrita.
- **Funções:** cidades e datas, cartão por dia (transporte, hospedagem, refeições, atrações, despesas), rotas abertas no Google Maps, totais e relatórios, divisão de despesas com acerto, checklist, anexos por link, convites por e-mail avisados por WhatsApp, presença e edição em tempo real, mensagens e comentários, feed de atividade, versões, impressão, planilha, lembretes locais, feedback, diagnóstico, modo escuro, onboarding.
- **Onde está a avaliação:** repositório `paineis-gerenciais/projetos-dev`, branch `claude/prumo-travel-dashboard-review-awhaqu`, pasta `travel-dashboard/docs/prumo/avaliacao-2026-11-09/` (relatório consolidado + 9 pareceres + este arquivo). Também há `travel-dashboard/CLAUDE.md` com a tabela de verificação por área.
- **Limites da sessão anterior:** a execução de código do repositório foi bloqueada (`npm test`, `vitest`, `vite build`, `eslint`, `playwright`) e o app publicado não era alcançável. O Head rodou só `npm ci --ignore-scripts`, `npm audit`, cálculo de contraste em Python e a reprodução do defeito de fuso em Node, fora do código do repositório. Não há PRD, issues legíveis, dados de uso nem pesquisa executada no repositório.

## 3. Pontos fortes (manter e proteger)

Domínio puro e testado com causa-raiz documentada; porta única ao Firestore; CI com emulador de regras e E2E e trava contra vazamento de código de teste (`qualidade.yml:53-68`); analytics com allowlist sem dado pessoal (`analytics.js:13-59`); sem segredos no histórico; telas, `xlsx` e analytics carregados sob demanda; PWA com casco offline e cache persistente do Firestore; causas-raiz do histórico (foco roubado, salto de rolagem, rodapé solto, dia inicial) tratadas; diálogos acessíveis (`ui.jsx:77-125`); tokens CSS, modo escuro completo, alvo de 44 px como token, cor por cidade; participantes com id estável e migração idempotente; convite honesto (o app diz que não envia nada sozinho); nicho defensável (roteiro + custos + divisão + grupo, em pt-BR, sem anúncio) e custo de infraestrutura irrisório.

## 4. Achados de severidade Alta (nenhum Bloqueador)

| ID | Achado | Evidência | Situação | Esf. |
|---|---|---|---|---|
| A1 | Último que grava vence, no documento inteiro; buffer de foco e edição offline agravam; sem flush em `pagehide`, desmonte ou troca de viagem | `TripProvider.jsx:60,71-77,88-101`; `tripData.js:100-102` | `[FATO]` no código; efeito em produção `[HIPÓTESE]` forte, confirmar com 2 navegadores | M |
| A2 | Itens editados por índice e array reordenado a cada mutação (`ensureGenerated` chama `sortCitiesByDate`); a folha de cidade passa a editar outra cidade ao preencher a data | `generate.js:14-24,121-122`; `TripProvider.jsx:22-24,115-119`; `Cidades.jsx:15,85-89,125-185`; `Dias.jsx:52,192-198,353-371`; `Mais.jsx:187,264-268` | `[FATO]` cadeia confirmada | M |
| A3 | Datas recuam um dia em fuso UTC+ (`new Date('AAAA-MM-DDT00:00')` + `toISOString()`) | `dates.js:16-20,47-53,261-262`; `generate.js:41-48,175-179`; `TripProvider.jsx:155` | `[FATO]` reproduzido: em `TZ=Europe/Lisbon` e `Asia/Tokyo`, 2026-07-10 + 1 dia devolve 2026-07-10. Confirmar com a suíte | P |
| A4 | Convite forjável (qualquer logado cria convite para qualquer `tripId`), revogação ineficaz (convite aceito não é apagado e a cláusula C ignora `status`), e-mail não verificado aceito | `firestore.rules:60-65,102,109-112`; `tripData.js:196-199`; `useAuth.js:40-47` | `[FATO]`; a reentrada exige escrita direta, não é automática (`tripData.js:175` ignora convites aceitos) | P |
| A5 | Deploy publica em `live` sem esperar o workflow Qualidade; não existe configuração do ESLint e o lint não roda no CI | `firebase-hosting-merge.yml:13-25`; ausência de `.eslintrc*`/`eslint.config*`/`eslintConfig` | `[FATO]` | P |
| A6 | E2E pode nunca ter passado no CI: `qualidade.yml` não define `VITE_FIREBASE_*` e `firebase.js:24-29` não tem valor padrão | `qualidade.yml`; `playwright.config.js:23` só define `VITE_USE_EMULATORS` | `[HIPÓTESE]` forte; conferir no histórico do Actions | P |
| A7 | Zero testes de componente e de `TripProvider`; `npm test` cobre só `src/domain` | `package.json:11` | `[FATO]` | M |
| A8 | Falhas invisíveis: sem ErrorBoundary; falha de gravação só em `console.error` e "Salvando…" eterno; sem aviso de "sem conexão"; `onSnapshot` sem callback de erro | `TripProvider.jsx:97-99`; `App.jsx:83`; `tripData.js` | `[FATO]` | P |
| A9 | Acerto confirmado não abate o saldo: despesa nova recalcula o bruto e sugere pagar de novo, invertendo quem recebe | `split.js:212-226`; `Custos.jsx:343-358` | `[FATO]` + conta refeita em Python | M |
| A10 | Contraste reprova AA: ok 3,11; warn 3,31; danger 4,27; neutral 4,20; `--text-3` 2,95 em texto de 11 px; no escuro, branco sobre acento 3,13 | `app.css:9-27,51-63` | `[FATO]` recalculado pelo Head | P |
| A11 | Convite falha em silêncio para quem entra por telefone ou com outro e-mail; texto diz "conta Google" mas e-mail/senha também vale; convidado cai no login sem contexto | `tripData.js:168-171`; `invite.js:25`; `ShareModal.jsx:44`; `Login.jsx` | `[FATO]` | M |
| A12 | Excluir item, carregar versão e remover membro sem confirmação nem desfazer; "Limpar viagem" apaga para todos e qualquer editor pode | `Dias.jsx:371`; `VersionsModal.jsx:82`; `ShareModal.jsx:68`; `Mais.jsx:137-178` | `[FATO]` | M |
| A13 | Sheet de comentários sem portal dentro de cartão com `contain: layout paint` e `will-change` (fundo fixo recortado) | `Dias.jsx:212,273`; `app.css:421`; `ui.jsx:119` | `[HIPÓTESE]` forte; conferir no navegador | P |
| A14 | Sem várias moedas (só BRL) para público que viaja ao exterior | `format.js:37-45` | `[FATO]` | G |
| A15 | Métricas não mensuráveis: faltam eventos de convite enviado/aceito, membro entrou, acerto confirmado, falha de gravação e de login | `analytics.js`; grep `track(` | `[FATO]` | P |

## 5. Achados Médios (resumo)

- **Arquitetura:** contexto sem memoização re-renderiza 21 consumidores e a `PrintView` inteira a cada tecla e a cada batida de presença (`TripProvider.jsx:303`); dois `structuredClone` por mutação; presença a cada 15 s (≈10 mil leituras/hora com 6 pessoas, `[HIPÓTESE]`); atividade e mensagens sem `limit`; sem `schemaVersion`; `deleteTrip` deixa `comments`, `activity`, `presence`, `members` e convites órfãos; **989 linhas de código morto** (`screens/PorDia, Resumo, Alimentacao, Transporte, Atracoes, Outras, Checklist, Roteiro`, `EmbeddedMap.jsx`, `lib/geocode.js`, `usePagination.jsx`; `EmbeddedMap` importa `leaflet`, que não está instalado); README da Fase 1; versão fixa `1.0.0`; sem ADR nem CHANGELOG.
- **Segurança:** sem validação de esquema e tamanho nas regras (`authorUid`, `authorName`, `role` livres); link `javascript:` gravável e aberto em Documentos (`AttachmentsSheet.jsx:132`); `xlsx` 0.18.5 com prototype pollution (GHSA-4r6h-8v6p-xvw6) e ReDoS (GHSA-5pgg-2g8v-p4x9), sem correção no npm, lendo arquivo do usuário (`sheetFile.js:100`); cache `NetworkFirst` do Firestore no service worker (`vite.config.js:36-45`) inútil e retém dados por 24 h; sem CSP; sem aviso de privacidade, exclusão de conta nem retenção; actions por tag mutável, sem `permissions`, sem Dependabot; login por telefone exige Blaze e não há App Check. `npm audit` em 2026-11-09: 33 vulnerabilidades (2 críticas, 15 altas, 13 moderadas, 3 baixas), quase todas em ferramentas de desenvolvimento (vitest/tinypool, vite, rules-unit-testing); em runtime pesam `xlsx` e, com exposição provavelmente baixa no navegador, `firebase` via `grpc-js`/`undici`.
- **Front-end:** 176 `style={{}}` em 27 arquivos; emoji como ícone; `registerType: 'autoUpdate'` pode recarregar durante a digitação; `xlsx` no precache do service worker; um listener do Firestore por item de comentário; nomes acessíveis repetidos ("Ver →" x5, "Editar" x N); `Timeline` como `tablist` incompleto; arrastar paradas sem alternativa por teclado; `StatusChip` sem setas; `Dias.jsx:75-89` cancela o próprio timer de destaque; `becamePaid`/`rejected` lidos de dentro do updater do `setState`.
- **QA:** E2E "compartilhar" clica em "Abrir Checklist" (`spec:240` vs `Mais.jsx:98`), falso positivo; E2E de divisão sem valores; `retries: 1` esconde flakiness; `reporter: 'github'` não gera `playwright-report/`; `test-results/.last-run.json` versionado; sem cobertura; regras sem teste para revogação (cláusula B), `members`, `presence`, `versions`, update/delete de convites.
- **Dados:** "Pago %" por contagem, sem hospedagem, com itens de custo 0; "Por pessoa" usa `settings.travelers` e a divisão usa `settings.participants`; visões por cidade e dia excluem itens sem data; partes não fecham a centavos (9,99 vs 10,00); "Ninguém deve nada" com saldos negativos quando há despesa sem pagador; importação zera status e custo se faltar coluna e dinheiro em texto vira 0 em silêncio; cascata de cidade por nome; sem orçamento-alvo.
- **UX:** Mais com 17 linhas de importância desigual; "Quem pagou" nasce vazio e tira a despesa do acerto sem aviso no item; gasto na rua exige 4+ toques e 8 campos; item novo gravado vazio ao fechar; termos técnicos (Diagnóstico, JSON, Sobrescrever); onboarding sem ação final; modelo de exemplo sem rótulo dentro da viagem; atividade com só 4 tipos de evento; 4 canais de colaboração sem evidência de uso; sem papel "só leitura".
- **Design:** alvos abaixo de 44 px (`btn-sm` 36, chip 32, timeline 40); `Row` clicável com `all: unset`; faltam estados de erro de campo, carregando, hover e pressed; duas paletas (cidade no CSS, gráfico em JS); texto funcional de 11 px; `theme_color` não combina com o cabeçalho.
- **Produto e estratégia:** sem PRD, backlog único nem pesquisa executada (roteiro `PESQUISA-ROTEIRO-T1.4.md` existe, sem registro de sessões); sem licença; fator de ônibus 1. Concorrência pesquisada (Wanderlog, TripIt, Splitwise, Tricount, Nomad, Quanto Deu?) não junta roteiro + custos + divisão + grupo em pt-BR. TCO estimado de R$ 50 a 7.300 por ano de 100 a 10.000 usuários; o gargalo gratuito é a escrita no Firestore puxada pela presença (estoura entre ~300 e ~2.500 usuários ativos, `[HIPÓTESE]`).

## 6. Correções do Head sobre os pareceres

1. O login por e-mail e senha **existe** (`useAuth.js:38-49`); o parecer de produto deixou isso em dúvida.
2. O mapa embutido com OpenStreetMap e a geocodificação pelo Nominatim são **código morto** (`EmbeddedMap.jsx` e `geocode.js` não são importados; `Mapa.jsx:35` diz "sem mapa embutido"). O risco de política de uso do Nominatim citado no parecer de estratégia não vale hoje.
3. A reentrada de membro removido **não é automática**: o cliente ignora convites aceitos; exige escrita direta no Firestore.

## 7. Plano de evolução

**Horizonte 1, estabilizar (0 a 30 dias; P salvo indicação):**
1. Mínimo seguro: regras S-01 a S-03 (convite só pelo dono, `conviteId == tripId + '_' + emailConvidado`, cláusula C exige `status == 'pendente'` e `email_verified`; apagar convite ao revogar; update do convidado limitado a `status`) com testes de regras; `sendEmailVerification` no cadastro; conferir que as regras em produção são as do repositório; validar `href` em Documentos e filtrar `settings.documents` em `normalizeState`; deploy com `needs` do Qualidade e regras publicadas pelo CI; `permissions: contents: read` e actions por SHA.
2. Dados: A3 (datas pela data local, suíte também em `TZ=Europe/Lisbon` e `Asia/Tokyo`); A2 (ações e folhas por `id`, M); flush da gravação em `focusout`, `pagehide` e desmonte; preservar edição local ao aplicar remoto bufferizado.
3. Falhas visíveis: ErrorBoundary na raiz e por tela com `logError`; estados "Salvo", "Salvando…", "Sem conexão: salvo neste aparelho", "Erro ao salvar (tentar de novo)"; callback de erro nos listeners; `Sheet` por `createPortal`.
4. Higiene: ESLint configurado e no CI; remover as 989 linhas mortas; `VITE_FIREBASE_*` fictícios no job de E2E; corrigir o E2E de convite; `test-results/` e `playwright-report/` no `.gitignore`; README atual; CHANGELOG e versão real.
5. Produto: eventos `invite_sent`, `invite_accepted`, `member_joined`, `settlement_confirmed`, `expense_added`, `save_failed`, `login_failed`; 5 a 8 sessões do roteiro T1.4 com critério de sucesso por tarefa, tarefa de uso em viagem e de acerto, pares reais no convite; congelar presença, mensagens, comentários e atividade; licença e aviso de privacidade curto.

**Horizonte 2, consolidar (30 a 60 dias):** ADR-0001 do modelo de sincronização (ver D2) precedido de E2E com dois contextos de navegador; `useReducer` com reducer puro e testado; testes de componente (`Sheet`, `TripProvider`, `StatusChip`) com `@testing-library/react`; cobertura mínima; acerto como lançamento de pagamento sobre saldo residual; centavos inteiros com maior resto; invariantes de totais; rótulos honestos nos indicadores; tokens de contraste, `--on-accent`, `--fs-0` 12 px, alvos de 44 px, ícones SVG, estados faltantes, `Row` clicável por inteiro; Mais reorganizado (Viagem, Exportar, Conta, Avançado); relatórios de Custos levando ao item em Dias; confirmação ou desfazer nas ações destrutivas e "Limpar" só para o dono com versão automática; convite para qualquer login; presença a 60 s pausada em aba oculta, `limit` em atividade e comentários, listener único de comentários; remover cache do Firestore no SW; `xlsx` pelo CDN da SheetJS; Dependabot; exclusão completa da viagem.

**Horizonte 3, aprofundar o núcleo (60 a 90 dias e depois):** orçamento-alvo contra realizado; modo "Hoje" com gasto rápido e chave PIX no acerto; várias moedas com taxa digitada por viagem (se a pesquisa confirmar); exportar `.ics`; exclusão de conta e retenção; CSP em modo relatório; JSDoc com `checkJs` e JSON Schema do estado; dividir `Dias`, `Custos` e `Mais` conforme forem tocados.

Fora do roteiro: importar reservas por e-mail, IA de roteiro, anexos hospedados, push com backend, venda de passagens.

## 8. Decisões pendentes (marque a escolhida)

- **D1. Rumo do produto.** [ ] (a) Recomendada: ferramenta pessoal bem acabada, com licença e README atual, e validação de 90 dias (entrevistas + métricas) antes de abrir a terceiros. [ ] (b) Nicho gratuito já, com aviso de privacidade, exclusão de conta e parecer de LGPD antes. [ ] (c) Produto pago (não recomendado por ora).
- **D2. Modelo de sincronização (gate G2, muda o formato dos dados; vira ADR-0001).** [ ] (a) Recomendada: O1, itens em mapas por id com `updateDoc` por campo, `schemaVersion: 2`, leitura dos dois formatos por duas versões (esforço M, reversível). [ ] (b) O0, só mitigar (flush, buffer menor): barato, não elimina a perda. [ ] (c) O2, subcoleção por item (G).
- **D3. Colaboração e login.** [ ] (a) Recomendada: congelar presença, mensagens, comentários e atividade; manter Google e e-mail/senha; decidir o telefone depois de corrigir o convite. [ ] (b) Remover os quatro canais agora. [ ] (c) Manter tudo.
- **D4. Contraste e ícones.** [ ] (a) Recomendada: escurecer levemente ok, warn, danger, neutral e `--text-3`, criar `--on-accent`, trocar emoji por SVG próprio (Lucide ou Phosphor copiados, sem dependência). [ ] (b) Só o contraste. [ ] (c) Manter.
- **D5. Leitura de planilha.** [ ] (a) Recomendada: versão do CDN da SheetJS (0.20.2 ou mais nova, mesma API). [ ] (b) `exceljs` (reescrever `sheetFile.js`). [ ] (c) Só CSV e colar texto.

Outras decisões que vão aparecer: quem fica com o centavo na divisão; multimoeda entra em qual fase; enquadramento na LGPD (art. 4º, I, uso particular versus cadastro aberto); confirmar se o plano Blaze está ativo e se o login por telefone deve continuar.

## 9. Verificação pendente (rodar primeiro, registrar comando e saída)

```
npm ci
npm test                                   # 111 testes de domínio
TZ=Europe/Lisbon npx vitest run src/domain # confirma A3 (falhas esperadas em datas e hospedagem)
TZ=Asia/Tokyo npx vitest run src/domain
npm run test:rules                         # 17 testes de regras (Java 17 + firebase-tools)
npm run test:e2e                           # 18 execuções (emuladores + Chromium)
env -u VITE_FIREBASE_API_KEY -u VITE_FIREBASE_PROJECT_ID npm run test:e2e   # simula o CI (A6)
npm run lint                               # esperado: falha por falta de configuração (A5)
npm run build && du -sh dist/assets        # tamanho real dos chunks e do precache
npm audit                                  # repetir e comparar com a seção 5
```

Checagens manuais ou com navegador: histórico do GitHub Actions e proteção do branch `main` (`gh api repos/paineis-gerenciais/travel-dashboard/branches/main/protection`); regras publicadas em produção iguais ao repositório; plano Blaze ativo; dois navegadores na mesma viagem editando itens diferentes (A1) e mudando o check-in de uma cidade nova (A2); comentário aberto no celular (A13); contraste com ferramenta; Lighthouse; leitor de tela; dados no Firebase Analytics.

## 10. Verificação por área (para a VERIFICAÇÃO OBRIGATÓRIA das delegações)

| Área | Verificação |
|---|---|
| `src/domain/` | `npm test`, também com `TZ=Europe/Lisbon` e `TZ=Asia/Tokyo` |
| `firestore.rules`, `src/lib/tripData.js` | `npm run test:rules` e `npm run test:e2e` |
| `src/components/`, `src/store/`, `src/styles/` | `npm run test:e2e` e `npm run build` |
| `vite.config.js`, service worker, `firebase.json`, workflows | `npm run build` e prévia do PR no Firebase Hosting |

## 11. Rascunho das issues do horizonte 1 (criar só com autorização)

| # | Título proposto | Labels | Sev. | Esf. |
|---|---|---|---|---|
| 1 | fix(rules): convite só pelo dono, status pendente, e-mail verificado e revogação efetiva (S-01 a S-03) | tipo:bug, nivel:N2, severidade:alta, area:seguranca | Alto | P a M |
| 2 | ci: deploy depende do workflow Qualidade; regras publicadas pelo CI; permissions e actions por SHA (QA-01, S-07, S-08) | tipo:infra, nivel:N1, severidade:alta, area:ci | Alto | P |
| 3 | fix(domain): datas independentes de fuso horário, com matriz TZ no CI (A3) | tipo:bug, nivel:N1, severidade:alta, area:dados | Alto | P |
| 4 | refactor(store): ações e folhas de edição por id em vez de índice (A2) | tipo:bug, nivel:N2, severidade:alta, area:frontend | Alto | M |
| 5 | fix(store): gravar ao perder foco, em pagehide e no desmonte; preservar edição local ao aplicar remoto (A1 mitigação) | tipo:bug, nivel:N2, severidade:alta, area:frontend | Alto | M |
| 6 | feat(ui): ErrorBoundary, estados de erro e offline no salvamento, erro nos listeners, Sheet por portal (A8, A13) | tipo:melhoria, nivel:N2, severidade:alta, area:frontend | Alto | P |
| 7 | chore: ESLint configurado e no CI; remover 989 linhas de código morto; test-results fora do git (A5) | tipo:manutencao, nivel:N1, severidade:media, area:frontend | Médio | P |
| 8 | test(e2e): VITE_FIREBASE_* fictícios no CI; corrigir teste de convite; valores na divisão (A6, QA-06, QA-07) | tipo:teste, nivel:N1, severidade:alta, area:qa | Alto | P |
| 9 | fix(domain): acerto confirmado abate o saldo (lançamento de pagamento) e centavos fecham (A9, D-16) | tipo:bug, nivel:N2, severidade:alta, area:dados | Alto | M |
| 10 | feat(analytics): eventos de convite, membro, acerto, despesa e falhas (A15) | tipo:melhoria, nivel:N1, severidade:media, area:produto | Médio | P |
| 11 | docs: README atual, CHANGELOG, versão real, licença, aviso de privacidade curto; guias DEPLOY para docs/historico | tipo:docs, nivel:N1, severidade:media, area:docs | Médio | P |
| 12 | fix(a11y): tokens de contraste e nomes acessíveis únicos (A10, A11-2) | tipo:bug, nivel:N1, severidade:alta, area:design | Alto | P |
| 13 | fix(ux): convite funciona para e-mail/senha e explica qual e-mail usar; caminho "entrei e não vi a viagem" (A11) | tipo:bug, nivel:N2, severidade:alta, area:ux | Alto | M |
| 14 | fix(ux): confirmação ou desfazer em excluir, carregar versão e remover membro; Limpar só para o dono (A12) | tipo:melhoria, nivel:N2, severidade:alta, area:ux | Alto | M |

Os nomes das labels seguem o padrão do kit (`tipo:`, `nivel:`, `severidade:`, `area:`); ajustar aos que existirem no repositório (`scripts/setup_labels.sh` do kit cria o conjunto padrão).

## 12. Onde está cada documento

No projetos-dev, branch `claude/prumo-travel-dashboard-review-awhaqu`, pasta `travel-dashboard/docs/prumo/avaliacao-2026-11-09/`:

| Arquivo | Conteúdo |
|---|---|
| `relatorio-consolidado.md` | visão integrada: fortes, Altos A1 a A15, Médios, 3 horizontes, decisões, verificação, índice |
| `parecer-arquitetura.md` | camadas, concorrência D1 a D9, opções O0 a O4, ADR-0001, custos, horizontes |
| `parecer-seguranca.md` | S-01 a S-15, LGPD, CI/CD, plano de dependências, implantação e rollback das regras |
| `parecer-frontend.md` | R-1 a R-9, D-1 a D-7, A11-1 a A11-9, P-1, PW-1 a PW-4, plano de 11 passos |
| `parecer-qa.md` | cobertura por camada, QA-01 a QA-17, plano P1 a P3 (22 itens), checklist manual de release |
| `parecer-dados.md` | fichas I1 a I14, divisão e acerto, moeda, planilha P-1 a P-8, 10 melhorias |
| `parecer-ux.md` | jornadas J1 a J4, heurísticas, modelo mental, colaboração, personas, teste com 5 tarefas |
| `parecer-design.md` | tokens, estados, ícones, responsividade, contraste, design system em 7 passos |
| `parecer-produto.md` | núcleo e acessório, lacunas L1 a L8, métricas M1 a M5, roadmap R1 a R12 com critérios Dado/Quando/Então |
| `parecer-estrategia.md` | concorrência com fontes, cenários A a D, TCO, riscos R1 a R12, posicionamento |
| `prompt-continuacao.md` | este arquivo |

Link direto: https://github.com/paineis-gerenciais/projetos-dev/tree/claude/prumo-travel-dashboard-review-awhaqu/travel-dashboard/docs/prumo/avaliacao-2026-11-09
