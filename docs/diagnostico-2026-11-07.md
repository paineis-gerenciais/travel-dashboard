# Diagnóstico de maturidade — travel-dashboard

- **Data:** 2026-11-07 · **Commit analisado:** `b5a3ce2` (merge do PR #15, 2026-08-18) · **Modo:** somente leitura; nenhuma alteração de código, issue, PR ou publicação.
- **Método:** leitura da documentação; execução dos comandos reais do projeto; confronto documentação × realidade; pareceres em paralelo de segurança (devsecops-engineer), arquitetura (software-architect), qualidade (qa-engineer) e produto (product-manager), integrados e com cada achado alto confirmado pelo Head no emulador ou no código. Pareceres completos e scripts de verificação em `docs/diagnostico-2026-11-07/`.
- **Revisões anteriores:** nenhuma no repositório. Não há `docs/`, PRD, ADR, parecer de QA ou de segurança. O rastro são o `README.md` e 17 guias `DEPLOY-*.md` na raiz.
- **Rótulos:** `[FATO]` com comando, arquivo:linha ou captura; `[HIPÓTESE]` vai para "A confirmar", não vira achado; `[RECOMENDAÇÃO]`.

## 1. Resumo

1. O app funciona e a base técnica é boa: 111 testes de domínio, 17 de regras e 18 E2E passam localmente; build em 5 s; domínio puro, uma única porta ao Firestore, telas carregadas sob demanda.
2. O modelo de convite e acesso tem brechas confirmadas no emulador: 12 de 14 cenários que deveriam ser negados foram permitidos (achado 1, alto).
3. Remover alguém da viagem não remove de verdade: o ex-membro volta sozinho, invisível na lista "Com acesso".
4. Quem cria conta por e-mail e senha não verifica o e-mail, e as regras confiam nele: dá para assumir um convite pendente de outra pessoa.
5. O único portão automático sobre regras e jornadas (workflow "Qualidade") está vermelho desde a primeira execução, em 29/07, por Java 17 onde o firebase-tools exige 21; o deploy não depende dele e `main` não tem proteção (achado 2, alto).
6. Duas pessoas editando a mesma viagem perdem dados em silêncio: confirmado em 5 de 5 execuções com duas contas no emulador; a gravação é o documento inteiro, sem controle de concorrência (achado 3, alto).
7. Não há backup fora do Firestore, e qualquer membro apaga versões ou substitui a viagem inteira.
8. 989 linhas (9,7% do código) são telas e mapa que ninguém importa; um desses arquivos depende de uma biblioteca que não está instalada.
9. A documentação está desatualizada em pontos que enganam quem chega: contagem de testes, workflows, telas, fases "futuras" já entregues, versão fixa em 1.0.0, seis referências a arquivos que não existem.
10. Veredito: **corrigir antes de qualquer coisa** (três achados altos). Regras e portão de qualidade custam cerca de 2 dias; a concorrência, 2 a 4 dias ou uma decisão explícita de risco aceito. Depois disso o projeto fica **pronto para o uso atual**; evoluir exige antes dado de uso, que hoje não existe em lugar nenhum.

## 2. Linha de base medida

Ambiente: Node 22.23.4, npm 10.9.9, Java 21, firebase-tools 15.35.0 (instalado nesta sessão), Playwright 1.62.1. Todos os comandos rodados em `/home/user/travel-dashboard`, 2026-11-07.

| Verificação | Comando | Resultado | Tempo |
|---|---|---|---|
| Instalar | `npm ci` | 656 pacotes; 8 avisos de pacote depreciado (eslint 8, glob 7, rimraf 3…) | 9,5 s |
| Testes de domínio | `npm test` | **111/111 passaram** (1 arquivo, `src/domain/__tests__/domain.test.js`) | 1,2 s |
| Testes de regras | `npm run test:rules` | **17/17 passaram** no emulador | 6,4 s |
| E2E | `npm run test:e2e` | **18/18 passaram** (9 jornadas × Pixel 5 e Desktop Chrome), contra o bundle real e os emuladores de Auth e Firestore | 32,5 s (23,1 s de testes) |
| Build de produção | `npm run build` | `dist/` 1,6 MB; precache do PWA com 26 entradas (1.514 KiB). Chunks: firebase 565 kB (133 kB gzip), xlsx 429 kB (142 kB gzip, só sob demanda), react 141 kB (45 kB gzip), app 70 kB (23 kB gzip), CSS 15 kB (4 kB gzip) | 5,1 s |
| Código de teste no bundle | `grep "__E2E_LOGIN__\|connectAuthEmulator" dist/assets/*.js` | limpo | — |
| Lint | `npm run lint` | **falha, exit 2:** "ESLint couldn't find a configuration file". O script e os plugins existem no `package.json`, a configuração não | — |
| Auditoria | `npm audit` / `npm audit --omit=dev` | 33 vulnerabilidades (2 críticas, 15 altas, 13 moderadas, 3 baixas); só produção: 12 (6 altas, 6 moderadas). `xlsx@0.18.5`: alta, "No fix available" | — |
| Desatualizadas | `npm outdated` | firebase 10.14.1 → 13.2.0; vite 5.4 → 8.3; vitest 1.6 → 5.1; eslint 8.57 (fim de vida) → 10.14; react 18.3 → 19.3; rules-unit-testing 3.0 → 5.0 | — |
| Verificação independente das regras | `docs/diagnostico-2026-11-07/verifica-regras.mjs` e `verifica-regras-2.mjs` no emulador | 14 cenários: **12 permitidos que deveriam ser negados**, 2 controles corretos | ~10 s |
| Acessibilidade (axe 4.10.3, WCAG 2.0/2.1 A e AA) | `qa-scripts/A_axe.js`, 8 telas × 2 larguras | Login e Minhas viagens: **0 violações**; demais telas: uma regra, `color-contrast` (serious), 6 a 11 nós por tela, sempre `--text-3` `#8e97a5` (2,94:1) | — |
| Teclado | `qa-scripts/B_teclado.js` | foco visível nos 5 botões da barra; 15 Tab não saem da folha; Esc fecha e devolve o foco; **Shift+Tab logo após abrir a folha escapa para o fundo** | — |
| Responsividade 360 e 1366 px | `qa-scripts/C_resp.js` + 10 capturas | **sem rolagem horizontal** nem elemento fora da janela nas 14 combinações tela × largura | — |
| Carga (local, indicativo) | `qa-scripts/D_perf.js`; Lighthouse 13.6 | DOMContentLoaded 50–67 ms; **203 kB** transferidos no login, 222 kB em Dias (xlsx fora); Lighthouse desempenho 0,94 e acessibilidade 0,98 (login, mobile simulado) | — |
| Edição simultânea (2 contas, mesma viagem) | `qa-scripts/E_concorrencia.js`, 5 execuções | **5 de 5 com perda silenciosa de uma das duas edições** | — |
| CI (GitHub Actions) | API | Workflow **Qualidade: 10 de 10 execuções falharam**, sempre no passo "Testes de regras (emulador)"; E2E nunca rodou no CI. Workflows de deploy: sucesso em todas | — |
| Repositório | `git log`, API | 31 commits, 1 autor, 2026-07-08 a 2026-08-18 (nada desde então); 15 PRs, todos mesclados; **0 issues, 0 tags, 0 releases**; `main` sem proteção; 16 branches remotos, 15 já mesclados | — |
| Código | `wc -l` | 10.158 linhas em `src/` (js, jsx, css); **989 linhas sem importador** (8 telas antigas + `EmbeddedMap.jsx` + `geocode.js`) | — |
| Site publicado | `curl` | não verificável desta sessão (rede bloqueia hosts externos) | — |

Observações sobre a execução:
- O E2E exigiu variáveis `VITE_FIREBASE_*` fictícias no ambiente (o build de teste precisa delas; em CI vêm dos secrets, no computador do autor vêm do `.env`). Isso não está documentado.
- Na primeira tentativa o E2E falhou por diferença de build do navegador do Playwright neste ambiente, resolvida fora do repositório. Não é defeito do projeto.
- O emulador deixa `firestore-debug.log` e `ui-debug.log` na raiz e o Playwright cria `playwright-report/` e `test-results/*`, que o `.gitignore` não cobre. Foram removidos após a execução; a árvore git ficou limpa.

## 3. O que está bom e deve ser preservado

| Ponto forte | Evidência `[FATO]` |
|---|---|
| Domínio puro e bem testado | `src/domain/*.js` não importa `lib/` nem `firebase` (grep vazio); 111 testes em 1,2 s, incluindo a invariante "soma dos status não cancelados = total da viagem" (`domain.test.js:427`) |
| Porta única ao banco | `firebase/firestore` só é importado em `src/lib/tripData.js` e `src/lib/firebase.js` (mais o teste de regras) |
| Três camadas de teste que rodam | domínio (111), regras no emulador (17), E2E no bundle real em dois dispositivos (18); o E2E usa um gancho de login que só existe com `VITE_USE_EMULATORS` e o build de produção sai limpo (verificado) |
| Build enxuto e dividido | 5,1 s; telas com `lazy()` (`App.jsx:14-18`); `xlsx` em chunk próprio, carregado só quando a importação é aberta (`sheetFile.js:13-17`) |
| Migração de esquema na leitura, idempotente | `normalizeState` e `migrateParticipants` (`state.js:69-133`) convertem dados antigos sem script de migração |
| Regras negam por padrão e o feedback é só escrita | `firestore.rules:116` e `:33-36`; confirmado pelos 17 testes |
| Privacidade por construção no analytics | allowlist de 12 chaves (`analytics.js:13-26`); nada fora dela sai |
| Sem segredos no repositório | nenhum `.env` ou service account em todo o histórico (`git log --all`); workflow de PR só roda para branches do próprio repositório (`firebase-hosting-pull-request.yml:11`) |
| Limitações registradas de propósito | cada `DEPLOY-*.md` tem "Notas e limitações" com o que ficou de fora e por quê |
| Sem rolagem horizontal e foco visível | 14 combinações tela × largura (360 e 1366) sem `scrollWidth > innerWidth`; `:focus-visible` com outline de 2 px nos 5 botões da barra; Esc fecha a folha e devolve o foco ao botão de origem (`qa-scripts/B_result.json`, `C_result.json`, capturas) |
| Acessibilidade automatizada quase limpa | 0 violações axe em Login e Minhas viagens; nas demais telas uma única regra, ligada a uma variável CSS; só 2 elementos clicáveis fora de `button`, ambos fundos de dispensa |
| Carga leve | 203 kB transferidos no login e 222 kB em Dias (comprimidos); Lighthouse local: desempenho 0,94, CLS 0 |

## 4. Achados por severidade

### Alto

#### A1 · O modelo de convite e acesso tem quatro brechas; remover alguém não remove de verdade

`[FATO]` Verificado no emulador do Firestore com as regras do repositório (scripts em `docs/diagnostico-2026-11-07/`). Resultado dos 14 cenários:

| # | Cenário | Esperado | Obtido |
|---|---|---|---|
| A1 | Usuário autenticado qualquer, que conhece o `tripId`, cria `convites/{tripId}_{seu e-mail}` com `ownerUid` = ele mesmo | negado | **permitido** (`firestore.rules:102` só exige `ownerUid == request.auth.uid`) |
| A2 | …e se inclui em `memberUids` usando esse convite | negado | **permitido** (`:60-65` só exige `exists()` do convite) |
| A3 | …e lê a viagem | negado | **permitido** |
| B1 | Membro que não é dono cria convite para terceiro | negado | **permitido** (a interface esconde, as regras não barram) |
| R2 | Dono remove um membro como o app faz (`revokeMember`, `tripData.js:196-199`); o ex-membro se inclui de novo **sem criar convite** | negado | **permitido** (o convite fica com status `aceito` e nunca é apagado; a regra não olha o status) |
| R3 | …e lê a viagem | negado | **permitido** |
| V1 | Conta criada por e-mail e senha com o **e-mail de um convidado que ainda não entrou**, sem verificar o e-mail, se inclui na viagem | negado | **permitido** (`myEmail()` usa `request.auth.token.email` sem `email_verified`; `useAuth.js:40-47` nunca chama `sendEmailVerification`) |
| V2 | …e marca o convite como aceito (o convidado real nunca mais entra) | negado | **permitido** |
| V3 | …e lê a viagem | negado | **permitido** |
| C1, C2 | Membro cria comentário e evento de atividade com `authorUid` de outra pessoa | negado | **permitido** (`:88-97` não validam autoria) |
| D1 | Membro grava `members/{seu uid}` com `role: 'owner'` | negado | **permitido** (`:82`); na interface ele passa a aparecer como "Dono" e o botão "Remover" some (`ShareModal.jsx:66-67`) |
| E1, R1 | Controles: membro edita a viagem; dono remove membro | permitido | permitido |

Agravantes de interface `[FATO]`: a lista "Com acesso" é montada a partir de `members/`, não de `memberUids` (`ShareModal.jsx:17,63-71`), então o ex-membro que voltou pela regra não aparece para o dono. No cenário V1, o atacante não precisa do `tripId`: o próprio app aceita convites pendentes do e-mail no login (`TripsProvider.jsx:36`, `tripData.js:168-188`).

- **Quem é afetado e como:** o dono e os membros de qualquer viagem de onde alguém foi removido (roteiro, custos e links de documentos continuam legíveis e editáveis pelo ex-membro, sem aparecer na lista); convidados que ainda não entraram (alguém que saiba o e-mail convidado toma o lugar). O cadastro por e-mail é aberto a qualquer pessoa na internet (`Login.jsx:143-158`).
- **Severidade:** alto, não bloqueador: o vetor principal exige alguém que já esteve dentro, e o vetor V exige saber qual e-mail foi convidado e agir antes do convidado. Para um grupo familiar o risco prático é baixo hoje, mas a garantia que a própria documentação promete (`firestore.rules:6-11`: "só quem está na lista", "só se existir um convite válido", "Revogar acesso = o DONO remove") não se sustenta.
- **Correção mínima** (texto proposto das regras em `docs/diagnostico-2026-11-07/parecer-seguranca.md`, não aplicado): na regra C, exigir convite com `status == 'pendente'`, `ownerUid` igual ao dono da viagem e `email_verified == true`; criar convite só pelo dono da viagem e com id `tripId_email`; validar `authorUid` em comentários e atividade; impedir `role: 'owner'` por quem não é dono. No cliente: `revokeMember` apaga o convite; cadastro por e-mail chama `sendEmailVerification`; "Com acesso" parte de `memberUids`. Onze testes de regras novos (lista no parecer). Publicar as regras junto com o cliente.
- **Esforço:** cerca de 1 dia (regras 2–3 h, testes 3–4 h, cliente 2 h, publicação e verificação 1 h). Responsável: frontend-engineer; devsecops-engineer confere.

#### A2 · Não existe portão de qualidade: o CI de regras e E2E está vermelho desde a primeira execução e nada depende dele

- `[FATO]` O workflow `Qualidade` (`.github/workflows/qualidade.yml`) falhou nas **10 execuções**, de 2026-07-29 a 2026-08-18, sempre no passo "Testes de regras (emulador)"; os passos de E2E foram pulados em todas. O log da última execução (18/08) mostra a causa: `firebase-tools no longer supports Java version before 21`, e o workflow instala Java 17 (`qualidade.yml:29-31`). Os logs das execuções de julho já expiraram; só os passos ficaram registrados.
- `[FATO]` Os workflows que publicam (`firebase-hosting-merge.yml:13` e `firebase-hosting-pull-request.yml:15`) rodam só `npm test` (domínio) e o build, e publicaram com sucesso em todas as execuções. O deploy não tem `needs:` para o Qualidade.
- `[FATO]` `main` não tem proteção de branch (API: `protected: false`). As regras do Firestore são publicadas à mão, da máquina do único autor (`DEPLOY-FASE2.md:85-97`, `DEPLOY-FASE5-ESTRUTURAL.md:55-63`), fora de qualquer workflow.
- `[FATO]` Os três guias que mudaram regras dizem que os testes de regras são "obrigatórios antes do deploy" (`DEPLOY-FASE1-COMPLETA.md:7-8`, `DEPLOY-FASE2.md:74-75`, `DEPLOY-FASE5-ESTRUTURAL.md:10-12`). O único lugar que os roda automaticamente nunca passou.
- Detalhes menores no mesmo tema `[FATO]`: `firebase-hosting-merge.yml` não declara `permissions:`; a action `FirebaseExtended/action-hosting-deploy@v0` é referenciada por tag móvel e recebe a service account; `npm ci && npm test && npm run build` roda em duplicidade a cada PR e push (Qualidade + hosting); o build roda 4 vezes dentro do Qualidade.
- **Quem é afetado e como:** todos os usuários: qualquer push em `main` vai para produção sem teste de regras e sem E2E. E a correção do achado A1 não terá validação automática enquanto isso durar.
- **Severidade:** alto, porque é o único controle automático sobre segurança e jornadas e está inoperante, e nada impede merge ou deploy sem ele.
- **Correção mínima:** `java-version: 21` em `qualidade.yml` (1 linha); fazer o deploy depender do Qualidade (`needs:` ou um workflow só) e remover a duplicação; `permissions: contents: read` no workflow de merge; proteger `main` exigindo o check `qualidade` (configuração do repositório, linha vermelha: só com autorização do usuário). Opcional: publicar as regras pelo CI antes do Hosting, com a mesma service account, se ela tiver o papel.
- **Esforço:** 2 a 4 horas mais a autorização para proteger o branch. Responsável: devsecops-engineer; o usuário aprova a proteção.

#### A3 · Duas pessoas editando a mesma viagem perdem dados em silêncio

- `[FATO]` Reproduzido pelo qa-engineer no emulador, com duas contas na mesma viagem, em **5 de 5 execuções** (`docs/diagnostico-2026-11-07/qa-scripts/E_concorrencia.js`; logs `E_result_run1.log` e `E_result_run2_variante.log`; capturas `qa-capturas/concorrencia-*.png`). Cenário: B com o cursor no campo "Cidade"; A muda a diária de 100 para 200 e conclui; B digita " Norte" e sai do campo. Esperado sem defeito: "Lisboa Norte" e R$ 600,00 nos dois lados.
  - Variante 1 (B sai do campo logo após digitar), 2 de 2: o Firestore fica `Lisboa / 200`; o texto de B some da tela 10 ms depois do Tab, sem aviso.
  - Variante 2 (B espera 1,5 s antes de sair), 3 de 3: o Firestore fica `Lisboa Norte / 100`; a diária de A é sobrescrita; antes de recarregar, A via R$ 300,00 e B via R$ 600,00.
  - Nenhuma execução preservou as duas edições. Resultado idêntico a cada repetição: não é instabilidade de teste.
- `[FATO]` Mecanismo: `saveTripState` grava o mapa `state` completo (`tripData.js:100-102`), 900 ms depois da última mudança local (`TripProvider.jsx:88-102`), sem transação, contador de revisão ou pré-condição. Atualização remota chegando com um campo em foco fica em `pendingRemote` e é aplicada no blur, substituindo o estado local inteiro (`TripProvider.jsx:60,71-77`); fora do foco, substitui na hora, inclusive mudanças ainda dentro da janela de 900 ms (`:41-45,61`). Itens são editados pela posição na lista, não pelo id (`updateItem(arrName, index, …)`, `:123-141`; `Dias.jsx:192-198`): inserir ou remover um item em outro cliente desloca o alvo da edição. O padrão certo já existe no código (`setRowField` usa id, `:278-284`).
- `[FATO]` A documentação descreve só "mesmo campo no mesmo instante" (`DEPLOY-FASE2.md:162-165`), e o teste manual de aceite confere apenas que o texto digitado não some no meio (`:128-129`). A camada de sincronização não tem nenhum teste: `npm test` cobre só `src/domain` (`package.json:11`) e os 9 E2E usam um único usuário. O app mostra presença ("quem está vendo"), mas nenhum aviso de conflito.
- **Quem é afetado e como:** grupos de duas ou mais pessoas editando ao mesmo tempo, que é o uso que convites, presença e comentários incentivam. Com um editor por vez não ocorre (não medido). A frequência real é desconhecida: não há dado de uso.
- **Severidade:** alto (perda de dado sem aviso). Para o uso atual, com poucas pessoas, o usuário pode registrar risco aceito; nesse caso a opção (b) é o mínimo.
- **Correção mínima, três opções (decisão do usuário):** **(a) recomendada:** trocar índice por id nas ações de item e reaplicar a fila de operações locais sobre o estado remoto ("rebase") com contador `rev`, mantendo o documento único; 2 a 4 dias com teste, reaproveitando `E_concorrencia.js` como E2E de regressão com duas contas. **(b) risco aceito:** só ids, aviso na tela quando chega mudança remota durante a edição e documentação corrigida; 0,5 a 1 dia; a perda continua possível. **(c)** gravar por item em subcoleções; 1 a 2 semanas, com migração; não se justifica sem medição de uso. Responsável: frontend-engineer; ADR pelo software-architect.

### Médio

#### M1 · Sem backup fora do banco; qualquer membro apaga versões ou substitui a viagem inteira

- `[FATO]` As "versões salvas" ficam no mesmo banco (`trips/{id}/versions`) e qualquer membro pode apagá-las (`firestore.rules:70`: `allow read, write: if isMember`). "Importar JSON" e "Limpar viagem" substituem ou apagam o conteúdo e estão disponíveis a qualquer membro (`Mais.jsx:55-66,138,173`; `isOwner` é calculado em `:40` mas só protege a folha de compartilhar). Excluir a viagem apaga as versões antes do documento (`tripData.js:91-98`): não sobra nada.
- `[FATO]` Não há export agendado, backup do Firestore nem procedimento documentado de restauração. "Exportar JSON" é manual, por viagem.
- **Quem é afetado:** donos. Um engano ou um membro mal-intencionado (inclusive pelo caminho de A1) apaga o histórico; só o que alguém exportou à mão sobra.
- **Correção mínima, sem custo:** só o dono apaga versões (1 linha de regra + 1 teste, 0,5 h); "Importar JSON" e "Limpar" só para o dono, no cliente (0,5 h); rotina documentada de exportação JSON e um ensaio de restauração (1 h). Com custo: backups programados do Firestore exigem plano Blaze `[HIPÓTESE, confirmar no Console]`.

#### M2 · Dependências com alerta e sem caminho de atualização

- `[FATO]` `npm audit --omit=dev`: 12 vulnerabilidades (6 altas, 6 moderadas). `xlsx@0.18.5` (prototype pollution GHSA-4r6h-8v6p-xvw6 e ReDoS GHSA-5pgg-2g8v-p4x9) sem correção no npm. A cadeia `@firebase/*` 10.14.1 depende de `undici` e `@grpc/grpc-js` vulneráveis, mas nenhum dos dois entra no bundle do navegador (`grep` em `dist/assets` vazio): exposição nula ao usuário.
- `[FATO]` Exposição real do `xlsx`: carregado sob demanda, só lê um arquivo que o próprio usuário escolhe (`sheetFile.js:95-110`). Pior caso: planilha maliciosa trava ou altera a aba do próprio usuário. Pequena, mas sem correção disponível.
- `[FATO]` firebase 10 → 13, vite 5 → 8, vitest 1 → 5, eslint 8 em fim de vida.
- **Correção mínima:** trocar `xlsx` pela distribuição corrigida do SheetJS fora do npm (versão a confirmar na fonte, 1–2 h + teste de importação); atualizar `firebase` para a linha atual com regressão E2E (0,5–1 dia); o resto é dívida de desenvolvimento.

#### M3 · Código morto (9,7%) e dependência fantasma

- `[FATO]` Nenhum arquivo importa `Alimentacao.jsx`, `Atracoes.jsx`, `Checklist.jsx`, `Outras.jsx`, `Resumo.jsx`, `Roteiro.jsx`, `Transporte.jsx`, `PorDia.jsx` (870 linhas), `EmbeddedMap.jsx` (72) nem `lib/geocode.js` (47) desde o redesign para 5 abas (`App.jsx:14-18`). `EmbeddedMap.jsx:2` importa `leaflet`, que **não está em `package.json` nem em `node_modules`**: se alguém voltar a importar a tela, o build quebra.
- `[FATO]` A causa está registrada: as levas entravam por zip extraído por cima da pasta, e arquivos removidos voltavam (`DEPLOY-REDESIGN.md:101-102`, `qualidade.yml:5-7`).
- **Quem é afetado:** quem mantém, inclusive agentes de IA, que leem as telas mortas como vivas (o `README.md` ainda fala em "10 telas").
- **Correção mínima:** apagar os 10 arquivos, rodar build e E2E (1–2 h); entregar por branch e PR, nunca por zip.

#### M4 · Rastro de versão e documentação não acompanham o produto

- `[FATO]` `package.json` e `APP_VERSION` (`tripData.js:19`) fixos em `1.0.0` depois de 15 PRs; cada feedback chega marcado "1.0.0" (`tripData.js:295`), inútil para triagem. Sem CHANGELOG, tags, releases, `docs/`, ADR ou `CLAUDE.md`. Backlog: 0 issues; os planos citados (`plano_melhorias_graduais_v2.md`, `fase1_backlog_v2.md`, `plano_anexos_v1.md`, `migracao/`) não estão no repositório.
- `[FATO]` `npm run lint` não roda (sem configuração) e não está no CI; sem `eslint-plugin-react-hooks` ativo, dependências de `useEffect` passam sem alerta.
- `[FATO]` `test-results/.last-run.json` (artefato gerado) está versionado; `.gitignore` não cobre `test-results/` nem `playwright-report/`.
- Lista completa das divergências na seção 5.
- **Correção mínima:** README reescrito, `CHANGELOG.md` a partir dos `DEPLOY-*.md` (movidos para `docs/historico/`), `APP_VERSION` vindo do `package.json`, `CLAUDE.md` com a tabela "Verificação por área", `.eslintrc` + lint no CI, `.gitignore` ajustado. Esforço: 1 dia. Tag de versão só com autorização.

#### M5 · Produto sem problema escrito, sem dado de uso e com decisões adiadas que nunca foram reabertas

- `[FATO]` Não existe uma frase do problema que o app resolve. O `README.md` ainda descreve a "migração do Apps Script" e cita Fases 2 e 3 como futuras; o produto de hoje (coordenação de grupo e controle de dinheiro) aparece só como "aposta" em `PESQUISA-ROTEIRO-T1.4.md`.
- `[FATO]` `DEPLOY-FASE1-COMPLETA.md:189-198` diz que a pesquisa com usuários (T-1.4) "destrava a Fase 2" e que sem ela "a Fase 2 volta a ser aposta". Não há registro de que foi feita, nem leitura de analytics. Fase 2, Fase 5, redesign, rateio e anexos foram entregues assim mesmo.
- `[FATO]` Oito decisões ficaram "até ter dados" (chat × mensagens, Por dia × categorias, paleta, gravar por item, e-mail automático, push, Cloud Storage, rateio); nenhuma condição foi cumprida, e três foram superadas por entregas posteriores sem registro (tabela em `docs/diagnostico-2026-11-07/parecer-produto.md`).
- `[FATO]` Login por celular exige plano Blaze (`DEPLOY-LOGIN-CELULAR-CONFIG.md:15-18`); não há registro de ativação; a própria mensagem de erro orienta a usar e-mail (`Login.jsx:18`).
- **Quem é afetado:** o autor, que não consegue medir se uma mudança ajudou; e a intenção "evoluir", que sem linha de base é aposta.
- **Correção mínima:** escrever o problema em uma frase e uma meta de uso; ler o Firebase Analytics (eventos já instrumentados) e a coleção `feedback`; 3 entrevistas do roteiro T-1.4 com pelo menos 1 não usuário; decidir "manter, medir ou remover" para login por celular. Esforço: 1 dia de trabalho do autor, mais as entrevistas.

#### M6 · Acessibilidade medida: contraste insuficiente, Shift+Tab escapa da folha, login sem `main`

- `[FATO]` axe 4.10.3 (WCAG 2.0/2.1 A e AA) em 8 telas × 2 larguras: Login e Minhas viagens com 0 violações; em Dias, Cidades, Custos, Mais e nas folhas, uma única regra, `color-contrast` (serious), com 6 a 11 nós por tela: `--text-3` `#8e97a5` sobre branco em texto de 11 px, 2,94:1 onde a WCAG 1.4.3 exige 4,5:1 (`src/styles/app.css:16`). Nenhuma violação critical, moderate ou minor (`qa-scripts/A_result.json`).
- `[FATO]` Teclado: com a folha recém-aberta, um Shift+Tab leva o foco para a tela de fundo ("Limpar", "Sair"…), porque o laço de foco em `ui.jsx` só prende quando o foco está no primeiro ou no último item e o fundo não fica `inert` (WCAG 2.4.3). Tab para a frente (15 vezes) e Esc funcionam.
- `[FATO]` Lighthouse (login): acessibilidade 0,98; única reprovação `landmark-one-main` (sem `<main>` em `Login.jsx`).
- **Quem é afetado:** pessoas com baixa visão ou com a tela ao sol (contraste); quem navega por teclado ou leitor de tela (foco e landmark).
- **Correção mínima:** trocar `--text-3` por um tom próximo de `#687180` (cerca de 4,9:1) e conferir no tema escuro, 30 min; tratar o painel como "primeiro item" no Shift+Tab e marcar o fundo como `inert` enquanto a folha está aberta, 1 a 2 h; envolver o login em `<main>`, 15 min. Reexecutar `qa-scripts/A_axe.js` e `B_teclado.js`.

### Baixo

#### B1 · LGPD proporcional a um app familiar

- `[FATO]` Dados pessoais guardados: e-mail, celular e nome (`users/{uid}`), e-mail e nome por viagem (`members`), e-mail do convidado e do dono (`convites`, nunca apagados, nem ao revogar nem ao excluir a viagem), e-mail + user agent + texto livre (`feedback`, retenção indefinida), identificadores de aparelho via Firebase Analytics. Ao excluir a viagem, `members`, `presence`, `comments` e `activity` ficam órfãos (`tripData.js:91-98`). Não há exclusão de conta nem aviso de privacidade (`SettingsSheet.jsx` só vincula celular e Google).
- **Correção mínima:** um parágrafo de aviso na tela de login (1 h); apagar convite ao revogar e ao excluir (já em A1); retenção documentada para `feedback`. Exclusão de conta self-service só se o uso passar do círculo pessoal (1–2 dias). O enquadramento jurídico (art. 4º, I da LGPD, uso particular) é decisão do usuário.

## 5. Documentação que não bate com a realidade

| Onde | O que diz | O que é |
|---|---|---|
| `README.md:19,71` | 22 testes de domínio | 111 |
| `README.md:23-24` e `DEPLOY-REDESIGN` | "10 telas" | 5 abas desde o redesign; as 8 telas antigas ficaram no código sem uso |
| `README.md:30-31`, `DEPLOY.md:175-198,287` | workflow `.github/workflows/deploy.yml`, secret `FIREBASE_SERVICE_ACCOUNT` | não existe; os reais são `firebase-hosting-merge.yml`, `firebase-hosting-pull-request.yml` (secret `FIREBASE_SERVICE_ACCOUNT_PLANO_VIAGEM_CERTA`) e `qualidade.yml` |
| `README.md:7-9,25-27,105-112` | Fase 1 concluída, modelo `users/{uid}`, Fases 2 e 3 como próximas | Fases 2 a 5 e redesign entregues; modelo é `trips/{id}` desde a Fase 2 |
| `README.md:8-9`, `DEPLOY.md:260-266`, `src/domain/links.js:5` | `plano_melhorias_graduais_v2.md`, `fase1_backlog_v2.md`, `migracao/`, `README-migracao.md`, `plano_anexos_v1.md` | nenhum existe no repositório |
| `src/lib/invite.js:12`, `src/lib/phoneAuth.js:8` | `DEPLOY-CONVITE-EMAIL.md`, `DEPLOY-LOGIN-CELULAR.md` | não existem (os reais são `DEPLOY-CONVITE-ENVIO.md` e `DEPLOY-LOGIN-CELULAR-CONFIG.md`) |
| `firestore.rules:6-11` | "só quem está na lista lê/escreve"; "só se existir um convite válido"; "Revogar acesso = o DONO remove da lista" | brechas confirmadas (achado A1) |
| `DEPLOY-FASE1-COMPLETA.md:7-8`, `DEPLOY-FASE2.md:74-75`, `DEPLOY-FASE5-ESTRUTURAL.md:10-12` | testes de regras "obrigatórios antes do deploy" | o CI que os roda falhou sempre e o deploy não depende dele (achado A2) |
| `DEPLOY-FASE2.md:162-165` | last-write-wins só no "mesmo campo no mesmo instante" | vale para a viagem inteira; perda reproduzida em 5 de 5 execuções (achado A3) |
| `DEPLOY-FASE5-ESTRUTURAL.md` | mapa embutido OpenStreetMap (5.D) e paleta Colorido/Minimalista (5.E) como recursos | aposentados no redesign; o código ficou sem uso e sem a dependência `leaflet` |
| `package.json:4`, `tripData.js:19` | versão 1.0.0 | 15 PRs de funcionalidade depois; sem tag |
| `test-results/.last-run.json` | "passed", versionado | artefato gerado pelo Playwright; não deveria estar no git |
| `DEPLOY-PLANILHA.md:53,122,181` | 18 testes E2E devem passar | **confere:** 18 passam |
| `DEPLOY-PLANILHA.md:51` | 111 testes de domínio | **confere** |

## 6. A confirmar (hipóteses, não são achados)

| Hipótese | O que a confirmaria | Como |
|---|---|---|
| H1 · O filtro de eco (`TripProvider.jsx:57-58` compara `JSON.stringify`) falha em produção se o Firestore devolver as chaves dos mapas em ordem diferente da local; a própria gravação voltaria como "remota" e, com campo em foco, desfaria o que foi digitado após a última gravação | valor final diferente do digitado | Em produção, 1 usuário: focar um campo, digitar "abc", esperar 2 s, digitar "def", tirar o foco, recarregar; esperado "abcdef" |
| H2 · Cache `NetworkFirst` do service worker sobre `firestore.googleapis.com` (`vite.config.js:36-45`) é inútil ou prejudicial ao canal de escuta | entradas em Cache Storage `firestore-cache`; erros do canal Listen offline | DevTools → Application → Cache Storage; abrir o app offline |
| H3 · XSS armazenado por link `javascript:` em documentos gerais: `AttachmentsSheet.jsx:106,132` renderiza `href={d.url}` cru (a lista principal filtra com `isValidLink`, o editor não); a entrada normal valida `https:` (`links.js:12-17`), então o vetor exige gravação direta no Firestore por um membro ou "Importar JSON" de arquivo preparado | o navegador executa o link | Gravar `settings.documents=[{url:'javascript:alert(1)'}]` numa viagem de teste e clicar em "Abrir". Correção barata de qualquer forma: filtrar com `isValidLink` ao renderizar (0,5 h) |
| H4 · Tamanho do documento `trips/{id}.state` fica longe do limite de 1 MiB (estimativa: 75–120 kB para 30 dias e 300 itens) | medição real | `JSON.stringify(state).length` no DevTools com a maior viagem real; registrar no Diagnóstico e avisar acima de 500 kB (1–2 h) |
| H5 · Projeto no plano Spark (gratuito); backup programado e PITR exigem Blaze | plano no Console | Console → Uso e faturamento |
| H6 · Quem usa hoje é só o autor ou um círculo próximo; nenhuma viagem com 2+ pessoas editando | usuários ativos, viagens com `memberUids.length ≥ 2`, eventos `share_*`/`trip_created` | Console → Analytics e Firestore |
| H7 · Comportamento "uma conta por e-mail" do Firebase quando o convidado legítimo entra com Google depois de o impostor ter criado a conta por senha (achado A1, cenário V) | o que acontece com a conta do impostor | Configuração do Auth no Console; teste com duas contas |

## 7. O que não foi verificado e por quê

- **Regras publicadas em produção × repositório:** sem acesso ao projeto Firebase desta sessão. Como conferir: Console → Firestore → Regras, comparar com `firestore.rules` do commit `b5a3ce2` e anotar a data da publicação.
- **Site publicado (`plano-viagem-certa.web.app`):** a rede desta sessão bloqueia hosts externos (HTTP 000). Desempenho, PWA e login reais não foram medidos em produção.
- **Console do Firebase:** restrições da chave de API, domínios autorizados, plano (Spark/Blaze), "uma conta por e-mail", App Check, dados do Analytics, coleção `feedback`, número de usuários e viagens.
- **Logs das 9 primeiras execuções do CI:** expirados; só os passos ficaram (todos falham no mesmo passo). A causa Java 17 está confirmada só na execução de 18/08.
- **Permissões padrão do `GITHUB_TOKEN`** e configuração de secrets: sem acesso de administração.
- **Backup e restauração em produção:** sem acesso. O ensaio de restauração via JSON não foi feito.
- **Hipóteses H1 a H7** da seção 6, pelas razões ali indicadas.
- **QA:** produção, rede e dispositivos reais (só emulador e Chromium local); tema escuro; largura de tablet; leitor de tela; zoom de 200%; Esc no menu de status; axe nas telas Mapa, Versões e Mensagens; frequência real da perda de dados (sem dado de uso); causa exata do cancelamento da gravação na variante 1 do teste de concorrência (coerente com o código, não instrumentada).

## 8. Veredito de maturidade

**Corrigir antes de qualquer coisa.** Três achados altos em aberto: convite e acesso não cumprem o que prometem (A1, 12 cenários permitidos no emulador); o único portão automático de qualidade está inoperante e o deploy não depende dele (A2); duas pessoas editando ao mesmo tempo perdem dados sem aviso (A3, 5 de 5 execuções). Nada exige mudar a arquitetura: A1 e A2 levam cerca de 2 dias; A3, 2 a 4 dias, ou uma decisão de risco aceito registrada com quem aceitou e quando, se hoje só uma pessoa edita por vez. Resolvidos os três, o projeto fica **pronto para o uso atual; evoluir só com demanda**, porque a base técnica cobre o uso declarado. Sinais para reabrir: um segundo grupo fora do círculo do autor usando sem ajuda; pedido concreto e repetido de quem não é o autor; 3 viagens ativas com 2 ou mais pessoas em 30 dias (valor a fixar); relato de conflito de edição. Antes de qualquer funcionalidade nova: frase do problema, leitura do Analytics e 3 entrevistas do roteiro T-1.4.

## 9. Próximos passos

| # | O quê | Responsável | Como conferir |
|---|---|---|---|
| 1 | Corrigir as regras de convite e acesso e o cliente (apagar convite ao revogar, verificação de e-mail no cadastro, "Com acesso" a partir de `memberUids`), com os 11 testes de regras propostos; publicar as regras junto com o cliente | frontend-engineer implementa; devsecops-engineer revisa; Head integra e publica com autorização | `npm run test:rules` verde com os testes novos; os scripts `docs/diagnostico-2026-11-07/verifica-regras*.mjs` devolvem NEGADO em todos os cenários de ataque; Console → Regras com data igual ao commit; teste manual: dono remove uma conta de teste e ela não volta nem recarregando |
| 2 | Portão de qualidade: `java-version: 21`, deploy dependente do Qualidade, `permissions: contents: read`, proteção de `main` exigindo o check | devsecops-engineer; o usuário autoriza a proteção do branch | próximo PR com "Qualidade" verde (regras e E2E executados no CI); `GET /repos/paineis-gerenciais/travel-dashboard/branches/main/protection` lista `qualidade` em `required_status_checks` |
| 3 | Concorrência (A3): o usuário escolhe entre as opções a, b e c; implementar ids em vez de índices e, na opção a, o rebase com `rev`; transformar `E_concorrencia.js` em E2E de regressão com duas contas; corrigir a nota em `DEPLOY-FASE2.md` | usuário decide; frontend-engineer implementa; software-architect registra o ADR; qa-engineer valida | o E2E de duas contas termina com "Lisboa Norte" e R$ 600,00 nos dois lados em 5 de 5 execuções; se for risco aceito, o registro (quem e quando) está no repositório e o aviso aparece na tela |

Em seguida, nesta ordem: higiene e rastro (M3 e M4: apagar os 10 arquivos mortos, `.gitignore` para `test-results/` e `playwright-report/`, lint no CI, README, `CHANGELOG.md`, `CLAUDE.md` com "Verificação por área", `APP_VERSION` do `package.json`, `DEPLOY-*.md` para `docs/historico/`), backup e permissões de membro (M1), acessibilidade (M6), dependências (M2) e, antes de qualquer funcionalidade nova, o passo de produto (M5).

## Anexos (em `docs/diagnostico-2026-11-07/`)

- `parecer-seguranca.md` (devsecops-engineer): texto proposto das regras, 11 testes faltantes, inventário de dados pessoais, plano de implantação e rollback.
- `parecer-arquitetura.md` (software-architect): pontos a preservar, limites do documento único, roteiros dos testes H1–H4, sequência recomendada.
- `parecer-qa.md` (qa-engineer): medições de acessibilidade, teclado, responsividade, carga e o teste de edição simultânea, com comandos e saídas.
- `parecer-produto.md` (product-manager): decisões adiadas, hipóteses sobre uso e sinais para evoluir.
- `verifica-regras.mjs`, `verifica-regras-2.mjs`: os 14 cenários executados contra o emulador. Como rodar, na raiz do projeto: `firebase emulators:exec --only firestore "node --input-type=module < docs/diagnostico-2026-11-07/verifica-regras.mjs"`. O segundo script espera um emulador avulso em `127.0.0.1:8181` (`java -jar <jar do emulador> --host=127.0.0.1 --port=8181 --rules=firestore.rules`); ou troque `host`/`port` no script e use o mesmo comando do primeiro.
- `qa-scripts/`: `A_axe.js`, `B_teclado.js`, `C_resp.js`, `D_perf.js`, `E_concorrencia.js`, `lib.js` e resultados (`*_result*`). Precisam dos emuladores e do `vite preview` de pé (receita em `parecer-qa.md`), do Playwright e de `axe-core` instalado em `docs/diagnostico-2026-11-07/qa-tools` (`npm i --prefix docs/diagnostico-2026-11-07/qa-tools axe-core@4.10.3`). Rodar: `NODE_PATH=$(npm root -g) node docs/diagnostico-2026-11-07/qa-scripts/<script>`.
- `qa-capturas/`: login, Minhas viagens, Dias, Custos e Mais em 360 e 1366 px; foco por teclado na barra; estado final das duas contas na rodada 3 do teste de concorrência.
