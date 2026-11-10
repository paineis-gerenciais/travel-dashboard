# Parecer de segurança: travel-dashboard (main, `b5a3ce2`)

- **Demanda:** sem issue (análise consultiva da Prumo) · N2 somente leitura · **Responsável:** devsecops-engineer · **Data:** 2026-11-09
- **Escopo:** `firestore.rules` e testes, autenticação, dados pessoais, cliente/PWA, workflows do GitHub Actions e dependências. Análise estática: nenhum código do clone foi executado, e o app publicado não foi acessado.
- **Contexto de risco:** app pessoal/familiar, mas com **cadastro aberto** (qualquer pessoa cria conta por e-mail/senha). Por isso as regras do Firestore são a única barreira entre usuários.

## Resumo
1. **Alto: a autorização por convite pode ser contornada de três formas.** (a) Qualquer usuário logado cria um convite para qualquer viagem. (b) O convite aceito nunca é apagado, então um membro removido volta sozinho. (c) A regra confia no e-mail do token sem exigir que ele esteja verificado. Quem conhece o ID de uma viagem, ou o e-mail de um convidado pendente, ganha leitura e escrita nela. A correção é pequena (P): regras, cadastro e testes.
2. **Médio:** não há validação de esquema nem de tamanho nas regras; um link `javascript:` pode ser gravado e aberto em "Documentos"; viagens excluídas deixam dados pessoais órfãos; o deploy não espera os testes de regras; as regras são publicadas à mão; o xlsx vulnerável lê arquivos enviados pelo usuário.
3. Não há segredos no código nem no histórico. As chaves `VITE_FIREBASE_*` são públicas por desenho.

## Ameaças consideradas
| Ativo | Ameaça (STRIDE) | Controle existente | Lacuna |
|---|---|---|---|
| Viagem (roteiro, valores, links de documentos) | Elevação de privilégio, divulgação | `memberUids` e cláusula C | Convite forjável; revogação ineficaz; e-mail não verificado (S-01 a S-03) |
| Comentários, atividade, membros | Falsificação de identidade, repúdio | Só membro escreve | `authorUid`, `authorName` e `role` livres (S-04) |
| Sessão de outro membro | Execução de script (XSS) | JSX escapa o texto | `href` sem validação em Documentos (S-05) |
| Cota e custo do projeto | Negação de serviço | Nenhum | Cadastro aberto, sem limite de tamanho nem App Check; SMS no Blaze (S-04, S-10) |
| Publicação | Adulteração | Testes no CI, deploy por conta de serviço | Deploy não depende do CI; actions por tag mutável (S-07, S-08) |

## Achados
Esforço: P (até meio dia), M (1 a 3 dias), G (mais de 3 dias).

| ID | Sev. | Achado e evidência | Recomendação | Esf. |
|---|---|---|---|---|
| S-01 | **Alto** | **Convite forjado.** [FATO] `firestore.rules:102`: o `create` de `convites` só exige `ownerUid == auth.uid` e não confere se quem cria é o dono de `tripId`. A cláusula C (`firestore.rules:65`) só verifica `exists(convites/{tripId}_{email})`. Sequência possível: criar `convites/{tripId}_{meu e-mail}` e depois `arrayUnion(meu uid)` em `trips/{tripId}`. O ID da viagem é aleatório, mas é conhecido por ex-membros e fica em `localStorage` (`TripsProvider.jsx:27`). ASVS V4.1/V4.2; Top 10 A01. | No `create`: exigir `get(trips/$(data.tripId)).data.ownerId == auth.uid` e `conviteId == tripId + '_' + emailConvidado`. Na cláusula C: ler o convite com `get` e exigir `status == 'pendente'` e `ownerUid == resource.data.ownerId`. | P |
| S-02 | **Alto** | **Revogação ineficaz.** [FATO] `revokeMember` (`src/lib/tripData.js:196-199`) não apaga o convite. A tela só lista convites pendentes (`ShareModal.jsx:37`), então o dono não consegue apagar um convite aceito. A cláusula C ignora `status`. Resultado: o removido se reinclui com uma escrita direta. O convidado também pode voltar o convite para `pendente`, porque `firestore.rules:109-112` permite qualquer alteração. | Apagar `convites/{tripId}_{email}` ao revogar. Exigir `status == 'pendente'` em C. Restringir o update do convidado a `status`, só de `pendente` para `aceito`/`recusado`, com `acceptedByUid == auth.uid`. | P |
| S-03 | **Alto** | **E-mail não verificado dá acesso.** [FATO] O cadastro por e-mail/senha não chama `sendEmailVerification` (`src/store/useAuth.js:40-47`). As regras usam `token.email` sem checar `email_verified` (`firestore.rules:16,65,105,110`). Quem cadastrar o e-mail de um convidado que ainda não entrou no app lê o convite (`acceptPendingInvites`, `tripData.js:168-188`) e entra na viagem. [HIPÓTESE] Se o convidado já tem conta no projeto, o Firebase recusa o cadastro duplicado; a janela é justamente o convite pendente. ASVS V2.1/V3. | Exigir `request.auth.token.email_verified == true` em C e nas leituras e escritas de convite. Enviar a verificação no cadastro e mostrar "verifique seu e-mail" antes de aceitar convites. O Google já entrega `email_verified=true`. | P |
| S-04 | Médio | **Sem validação de esquema e tamanho.** [FATO] Nenhuma regra usa `keys().hasOnly`, tipos ou `size()`. Em `comments` e `activity` (`firestore.rules:89,96`), `authorUid` e `authorName` são livres: um membro pode escrever em nome de outro. Em `members/{uid}` (`:82`), qualquer membro grava `role:'owner'` e outro e-mail no próprio registro, e a tela confia nisso (`ShareModal.jsx:65-67`). O limite de 4000 caracteres do `feedback` existe só no cliente (`tripData.js:292`); a regra `:34` aceita até 1 MiB por documento, de qualquer conta criada livremente. Em `trips` (`:40-42`), o dono pode incluir uids alheios ao criar. ASVS V5.1. | Validar chaves, tipos e tamanhos em `feedback`, `comments`, `activity`, `members` e `convites`. Exigir `authorUid == auth.uid` no `create`. Fixar `role` (dono = `ownerId`) e, no `create` de `trips`, exigir `memberUids == [auth.uid]`. | M |
| S-05 | Médio | **Link `javascript:` armazenado.** [FATO] `src/components/AttachmentsSheet.jsx:132` monta `href={d.url}` sem `isValidLink`. Os outros pontos validam (`links.js:12-21,51-53`, `LinkField.jsx:40`). `normalizeState` (`src/domain/state.js:69`) não valida `settings.documents`, e entram por ele a importação de JSON (`screens/Mais.jsx:56-66`) e a escrita direta de qualquer membro. [HIPÓTESE] O React 18.3 só avisa no console sobre `javascript:` e não bloqueia, então o script roda na origem do app quando alguém clica em "Abrir". Top 10 A03. | Renderizar só se `isValidLink(d.url)` e filtrar `documents` em `normalizeState`. Um CSP sem `unsafe-inline` (S-12) também bloqueia esse tipo de link. | P |
| S-06 | Médio | **Dados órfãos e sem retenção.** [FATO] `deleteTrip` apaga só `versions` (`tripData.js:91-98`). Ficam para sempre `comments`, `activity`, `members`, `presence` e os convites aceitos, com nomes e e-mails. `activity` não pode ser apagada por ninguém (`firestore.rules:95-97`). A presença de quem foi removido não é limpa. | Na exclusão, apagar as subcoleções enquanto o dono ainda é membro (a ordem importa, porque as regras dependem do documento da viagem) e os convites da viagem. Permitir ao dono apagar `activity`. | M |
| S-07 | Médio | **Deploy sem barreira de qualidade, e regras publicadas à mão.** [FATO] `firebase-hosting-merge.yml:13` roda só os testes de domínio e o build antes de publicar. Os testes de regras e o E2E (`qualidade.yml:61-68`) correm em paralelo e não bloqueiam nada. As regras vão ao ar com `firebase deploy --only firestore:rules` local (`DEPLOY-FASE2.md`, Parte 4), então produção pode divergir do repositório. | Juntar tudo num workflow com `needs:` (qualidade, depois deploy) ou proteger `main` exigindo o check `Qualidade`. Publicar as regras pelo CI depois de `test:rules`. | P |
| S-08 | Médio | **Endurecimento do CI.** [FATO] `firebase-hosting-merge.yml` não tem bloco `permissions` (vale o padrão do repositório) e `qualidade.yml` também não. `FirebaseExtended/action-hosting-deploy@v0` usa tag mutável e recebe a chave JSON da conta de serviço (`:21-26`). `npm install -g firebase-tools` não fixa versão (`qualidade.yml:37`). Os workflows de deploy não configuram o Node: o runner usa o padrão dele, a qualidade usa 20 e o local usa 22. Não há `dependabot.yml`. Pontos positivos: o deploy de PR usa `pull_request` (não `pull_request_target`), bloqueia forks (`firebase-hosting-pull-request.yml:11`) e tem permissões explícitas; `package-lock.json` (v3) é usado com `npm ci`. | `permissions: contents: read` no topo (o deploy de PR mantém `checks`/`pull-requests: write`). Fixar actions por SHA. Fixar a versão de `firebase-tools` e `setup-node` em todos. Adicionar Dependabot para `npm` e `github-actions`. | P |
| S-09 | Médio | **xlsx 0.18.5 lê arquivo do usuário.** [FATO] `src/lib/sheetFile.js:100` (`XLSX.read`). Advisories: GHSA-4r6h-8v6p-xvw6 (CVE-2023-30533, prototype pollution, CVSS 7.8, AV:L/UI:R, corrigido na 0.19.3) e GHSA-5pgg-2g8v-p4x9 (CVE-2024-22363, ReDoS, CVSS 7.5, corrigido na 0.20.2). As duas correções só existem no CDN da SheetJS, não no npm. Fonte: github.com/advisories, consultado em 2026-11-09. O risco é sobretudo de um arquivo malicioso aberto pelo próprio usuário. | Ver "Plano de dependências". Até lá, recusar arquivos acima de cerca de 2 MB antes do `read`. | P |
| S-10 | Médio* | **Abuso de SMS e de cota.** [FATO] O login por telefone exige Blaze (`phoneAuth.js:3-9`). Não há App Check (`grep` sem resultado). *[HIPÓTESE] É Médio se o Blaze estiver ativo (custo por SMS e risco de "SMS pumping", envio fraudulento em massa) e Baixo se não estiver. | Com Blaze: alerta de orçamento, política de regiões de SMS (só +55, se bastar) e App Check com reCAPTCHA. | P |
| S-11 | Baixo | **Dados ficam no aparelho após o logout.** [FATO] `logout` só chama `signOut` (`useAuth.js:34`). Permanecem a persistência do Firestore em IndexedDB (`firebase.js:39-41`), o cache `NetworkFirst` de `firestore.googleapis.com` no service worker por 24 h (`vite.config.js:36-45`) e o `activeTripId` (`TripsProvider.jsx:27`). O comentário em `vite.config.js:31-33` diz que o service worker cuida "só do casco", mas a regra contradiz isso. [HIPÓTESE] Cachear o canal de streaming do Firestore não traz ganho e pode atrapalhar o tempo real. | Remover a regra `runtimeCaching` do Firestore. No logout: `terminate(db)`, `clearIndexedDbPersistence(db)` e limpar as chaves do app. | P |
| S-12 | Baixo | **Sem CSP nem cabeçalhos de segurança.** [FATO] `firebase.json:15-34` só define `Cache-Control`. Faltam CSP, `frame-ancestors`/`X-Frame-Options`, `Referrer-Policy` e `X-Content-Type-Options`. | Começar com `Content-Security-Policy-Report-Only` liberando os domínios do Firebase Auth, Google, reCAPTCHA, Firestore e Analytics. Ativar depois de uma semana sem violações. | M |
| S-13 | Baixo | **Código morto com ponto de injeção de HTML.** [FATO] `EmbeddedMap.jsx:54` chama `bindPopup(c.label)`, e o Leaflet trata texto como HTML. O componente não é importado e `leaflet` não está em `package.json`. `geocode.js` só é usado por ele, então o Nominatim não é chamado hoje e a política de uso dele não está em jogo. | Remover `EmbeddedMap.jsx` e `geocode.js`. Se voltarem, usar um nó de texto no popup e conferir a política do Nominatim. | P |
| S-14 | Baixo | **Diagnóstico exportável.** [FATO] Guarda mensagem e stack em memória e só exporta por ação do usuário (`logger.js:12-24`, `DiagnosticsModal.jsx:10-18`). Nada é enviado. Mensagens do Firestore podem conter caminhos com IDs. | Avisar ao exportar que o arquivo pode conter identificadores. | P |
| S-15 | Baixo | **ESLint 8.57.1 em fim de vida, e o lint não roda no CI.** [FATO] `package.json:29`; não há passo de lint em `qualidade.yml`. | Migrar para ESLint 9 (flat config) e incluir o lint no CI. | P |

## Autenticação
- **Google:** o fluxo é adequado. O e-mail chega verificado.
- **E-mail/senha:** sem verificação obrigatória, o que leva a S-03. [HIPÓTESE] A política de senha fica no padrão do Firebase (mínimo de 6 caracteres) e a proteção contra enumeração de e-mails depende da data de criação do projeto. As duas coisas precisam ser conferidas no console. A redefinição de senha usa o fluxo nativo (`useAuth.js:49`).
- **Telefone:** depende do Blaze (S-10). Quem entra só por telefone não tem e-mail e não consegue aceitar convites, porque `myEmail()` falha e nega. É uma limitação funcional, não uma brecha. O vínculo com Google é o caminho documentado.
- **Sessões:** persistência local padrão do SDK, sem expiração por inatividade. É aceitável para o perfil do app. O logout não limpa dados locais (S-11).
- **Exclusão de conta:** não existe (`grep deleteUser` sem resultado).

## Dados pessoais (LGPD)
| Dado | Onde | Quem lê | Retenção hoje |
|---|---|---|---|
| E-mail, celular, nome | `users/{uid}` | Só o titular | Indefinida |
| E-mail do dono, uids | `trips/{id}` | Membros | Até a exclusão da viagem |
| Nome, e-mail, papel | `trips/{id}/members` | Membros | Órfão após exclusão (S-06) |
| Nome e último acesso (presença) | `trips/{id}/presence` | Membros | Órfão; não é limpo na revogação |
| Nome e texto (comentários, atividade) | `comments`, `activity` | Membros | Atividade é permanente |
| E-mail de **terceiro convidado**, e-mail do dono | `convites` | Convidado e dono | Aceitos ficam para sempre |
| Viajantes da divisão de despesas, links de documentos (passaporte, seguro) | `trips.state` e `versions` | Membros | Até a exclusão |
| E-mail, user agent, texto livre | `feedback` | Console/Admin | Indefinida |
| Identificadores de dispositivo e geolocalização aproximada por IP | Firebase Analytics (Google) | Google e dono do projeto | Padrão do GA4 |
| Log de erros | Memória e arquivo exportado pelo usuário | Usuário | Sessão |

- **Minimização:** a allowlist do analytics é um bom controle (`analytics.js:13-59`). [HIPÓTESE] Não confirmei se o Analytics está ativo: não há `measurementId` em `firebase.js:23-30`, e o SDK pode buscá-lo sozinho. Links de documentos no Drive com "qualquer pessoa com o link" expõem o documento se o link vazar; vale um aviso na interface.
- **Aviso de privacidade:** não existe. **Exclusão de conta e de dados:** não existe. **Retenção:** não está definida.
- **Base legal:** é enquadramento jurídico e fica com o usuário. Ponto de atenção: o art. 4º, I, da LGPD exclui o tratamento por pessoa natural para fins exclusivamente particulares e não econômicos. Com cadastro aberto ao público, essa exclusão fica menos clara.
- **Classificação sóbria:** risco **Médio** de privacidade. Não há dados sensíveis (art. 5º, II) por desenho, e o volume é pequeno. Os pontos são falta de transparência, falta de exclusão e retenção indefinida.
- **Testes:** usam só dados fictícios (`rules.test.js:22-24`, projeto `demo-`). Está correto.

## Testes de regras: o que cobrem e o que não cobrem
- **Cobrem** (`src/rules/__tests__/rules.test.js`): estranho não lê nem escreve a viagem; convidado com convite se inclui; sem convite não entra; ninguém inclui outro uid; só o dono exclui; convite lido só pelo destinatário; perfil próprio; acesso a comentários e atividade; só o autor apaga o próprio comentário; feedback só de escrita, sem falsificação de autor.
- **Não cobrem:** convite criado por quem não é dono (S-01); reentrada de membro removido (S-02); `email_verified=false` (S-03); convite aceito ou recusado; leitura de convites pelo dono; update e delete de convites; `members` e `presence` (papel falso, escrita após a revogação); `versions`; membro tentando mudar `ownerId`/`memberUids` (cláusula A); falsificação de `authorUid` em comentários e atividade; update e delete de atividade; tamanho e esquema; criação de viagem com uids alheios.
- [FATO] Os testes rodam no CI (`qualidade.yml:61-62`), mas não bloqueiam o deploy (S-07).

## Plano de dependências (33 vulnerabilidades, `npm audit` do Head em 2026-11-09)
**Runtime (vai para o navegador):**
1. **xlsx 0.18.5 (S-09).** Opções:
   - **a) Recomendada:** versão do CDN da SheetJS (0.20.2 ou mais nova). Mesma API, esforço P. Contras: fica fora do registro npm, então o Dependabot e o `npm audit` não a acompanham; a integridade fica registrada no lockfile. [NÃO VERIFICADO] Não consegui acessar o `cdn.sheetjs.com` desta sessão para confirmar a versão atual.
   - **b) exceljs:** API diferente; reescrever `sheetFile.js` (cerca de 130 linhas); esforço M; pacote maior.
   - **c) Só CSV ou colar:** `lerTextoColado` já existe (`sheetFile.js:120-131`); perde a ida e volta em .xlsx; esforço P.
2. **firebase 10.14.1** (alta via `@grpc/grpc-js` 1.9.16 e `undici` 6.19.7, do lockfile). [HIPÓTESE] Esses dois pacotes são da versão Node do SDK e não entram no bundle web, o que deixa a exposição real Baixa. Passos: `npm audit fix` sem `--force`; se as vulnerabilidades persistirem, subir para a major atual do `firebase` num branch, junto com `@firebase/rules-unit-testing`, e rodar toda a suíte.

**Só desenvolvimento (não vão para o navegador):** vite 5.4.21 (só o servidor de desenvolvimento; não usar `--host` em rede não confiável), vitest 1.6.1/tinypool, vite-plugin-pwa 0.20.5, `@firebase/rules-unit-testing` 3.0.4 e eslint 8. Atualizar num único PR de ferramentas (vite, plugin PWA, vitest e plugin React compatíveis entre si). Prioridade abaixo do runtime. As versões de destino devem ser confirmadas no registro no dia da atualização.

**Segredos:** [FATO] buscas no histórico completo (`git log --all -p`) e na árvore por chaves de API do Google, chaves privadas, tokens do GitHub e do Slack não acharam nada. `.env` e `service-account-key.json` estão no `.gitignore` (`.gitignore:4,9`). Só `.env.example` aparece no histórico, com valores de exemplo.

## Mínimo seguro (fazer já; condição para a próxima release)
1. S-01, S-02 e S-03 nas regras, mais a verificação de e-mail no cadastro e testes de regras para cada um. Dono: backend/frontend. Esforço P a M.
2. S-05: validar `href` em Documentos e filtrar em `normalizeState`. P.
3. S-07: deploy dependente da qualidade e regras publicadas pelo CI. P.
4. S-08: bloco `permissions` e actions fixadas por SHA. P.
5. Conferir no console se as regras em produção são iguais às do repositório e republicar se não forem.

## Recomendado (por prioridade, com custo)
S-04 validação de esquema (M) · S-09 xlsx pelo CDN (P) · S-06 limpeza em cascata e retenção (M) · aviso de privacidade curto e caminho de exclusão de conta, mesmo que manual por e-mail no início (P a M) · S-10 se houver Blaze (P) · S-11 (P) · Dependabot (P) · S-12 CSP em Report-Only (M) · S-13 a S-15 (P) · atualização das dependências de desenvolvimento (M) · backup do Firestore: hoje só existe a exportação JSON manual por viagem; exportação agendada exige Blaze (M, custo recorrente baixo) · Workload Identity Federation no lugar da chave JSON (M).

## Implantação e rollback (para a correção das regras)
1. No branch: `npm run test:rules` verde, com os testes novos de S-01 a S-03.
2. As regras valem para o projeto inteiro: a prévia do PR **não as isola**. Publicar com `firebase deploy --only firestore:rules` (ou pelo CI) no mesmo momento do deploy do front-end que envia a verificação de e-mail.
3. Impacto conhecido: contas de e-mail/senha não verificadas deixam de aceitar convites até verificar. Membros que já estão em `memberUids` não são afetados.
4. Verificação depois de publicar: com duas contas de teste, convidar, aceitar, remover e confirmar que a removida não volta; tentar criar convite para uma viagem alheia e ver a negação.
5. Rollback: Console do Firebase, Firestore, Regras, histórico, republicar a versão anterior; ou `git revert` e novo deploy das regras. Hosting: histórico de versões, "Reverter". Critério: falha no aceite de convites legítimos ou erro de permissão em fluxo essencial.

## Não verificado
Regras em produção iguais ao repositório · plano Blaze ativo · domínios autorizados · papéis da conta de serviço do deploy · permissão padrão do `GITHUB_TOKEN` e proteção de `main` · Analytics ativo · política de senha e proteção contra enumeração · HSTS do Hosting · ausência de grpc/undici no bundle (`grep` em `dist/`) · resultado dos testes (execução bloqueada nesta sessão) · comportamento do React 18 com `javascript:` · versão atual do CDN da SheetJS e política do Nominatim (domínios fora da rede da sessão).
