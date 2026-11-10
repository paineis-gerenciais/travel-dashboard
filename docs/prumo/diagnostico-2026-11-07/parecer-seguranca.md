# Parecer de segurança: travel-dashboard (diagnóstico de maturidade, somente leitura)

- **Demanda:** sem issue (o usuário vetou criar issue ou PR) · **Responsável:** devsecops-engineer · **Data:** 2026-11-07
- **Escopo analisado:** `/home/user/travel-dashboard` no commit `b5a3ce2` (Merge PR #15): `firestore.rules`, `src/lib/*`, `src/store/*`, componentes de compartilhamento, anexos e configurações, `.github/workflows/*`, `firebase.json`, `.gitignore`, `.env.example`, `DEPLOY-*.md`. Os fatos levantados pelo Head foram usados como entrada e não foram refeitos.
- **Contexto de uso:** poucas pessoas (família e amigos). Mas o cadastro é aberto: qualquer pessoa na internet pode criar conta por e-mail e senha (`src/components/Login.jsx:52-55`).

## Resumo
1. **Alto:** a remoção de um membro não funciona de verdade. Um ex-membro volta sozinho para a viagem, porque o convite antigo continua lá e a regra C só confere se ele existe. A volta fica invisível na lista "Com acesso". Um membro também pode se marcar como "Dono" e, com isso, some o botão "Remover".
2. **Alto (novo):** as regras confiam num e-mail que ninguém verificou. Uma pessoa de fora cria uma conta de e-mail e senha usando o endereço de um convidado que ainda não entrou no app. Ela entra na viagem sozinha, sem saber o tripId.
3. **Médio:** a publicação não tem trava. O CI das regras está quebrado, o deploy não depende dele, o branch main não tem proteção e as regras são publicadas à mão.
4. **Médio:** não existe backup fora do próprio Firestore. Qualquer membro pode apagar todas as versões e substituir a viagem inteira.
5. **Baixo:** lacunas de LGPD proporcionais ao uso: falta exclusão de conta, falta aviso sobre o Analytics e há retenção indefinida de convites e feedback.
6. **Baixo:** dependências. O `xlsx` tem exposição real pequena. undici e grpc não entram no bundle do navegador.

Mantenho a severidade alta para a falha do convite, sem chegar a bloqueador. O motivo: o vetor 1 exige alguém de dentro, e o vetor 2 exige saber qual e-mail foi convidado e agir antes do convidado.

## Ameaças consideradas
| Ativo | Ameaça (STRIDE) | Controle existente | Lacuna |
|---|---|---|---|
| Conteúdo da viagem (roteiro, custos, links de documentos como passaporte e seguro) | Elevação de privilégio, divulgação | `memberUids` nas regras | O convite não é consumido nem vinculado ao dono. O e-mail não é verificado |
| Lista de membros | Falsificação (spoofing), repúdio | `members/{uid}` só pelo próprio uid | O papel e o autor não são validados. A UI lista `members` em vez de `memberUids` |
| Histórico (versions) | Adulteração, negação de serviço | Leitura e escrita só para membros | Qualquer membro apaga. Não há cópia fora do banco |
| Publicação (Hosting e regras) | Adulteração | Workflow de deploy com secret de service account | Sem portão de testes, sem proteção de branch, regras publicadas à mão |
| Dados pessoais (e-mail, celular, nome, user agent) | Divulgação, retenção | Regras por dono e allowlist no Analytics | Sem exclusão, sem prazo de retenção, sem aviso |

## Achados

### A1 · Alto · A remoção de membro não funciona e há escalada de papel no fluxo de convites
- **[FATO] Entrada do Head:** os passos A1-A3, B1, C1, C2 e D1 foram PERMITIDOS no emulador.
- **[FATO] O que acrescento (leitura de código):**
  - `revokeMember` (`src/lib/tripData.js:196-199`) tira o uid de `memberUids` e apaga `members/{uid}`. Mas **não apaga o convite** `convites/{tripId}_{email}`. O convite fica com status `aceito` (`tripData.js:183`). A regra C (`firestore.rules:65`) só exige `exists()`, sem olhar o status. Por isso o ex-membro **não precisa nem criar convite novo**. Basta um `updateDoc(trips/{id}, {memberUids: arrayUnion(uid)})` pelo SDK.
  - O convidado também pode editar o próprio convite, sem restrição de campos (`firestore.rules:109-112`). Ele pode voltar o status para `pendente`. Assim o próprio app o recoloca na viagem no próximo login (`tripData.js:175-177`, chamado em `src/store/TripsProvider.jsx:36`).
  - A volta pela regra C não cria `members/{uid}`. O `ShareModal` monta "Com acesso" a partir de `listMembers` (`src/components/ShareModal.jsx:17` e `63-71`), e não de `memberUids`. Resultado: **o ex-membro volta e o dono não o vê.**
  - Com D1 (`role: 'owner'`), o botão "Remover" some, porque a condição é `isOwner && m.role !== 'owner'` (`ShareModal.jsx:67`). O membro aparece como "Dono" (`ShareModal.jsx:66`).
- **Quem é afetado e como:** o dono e os membros de qualquer viagem com alguém removido. Um ex-membro (por exemplo, depois de uma briga) continua lendo roteiro, custos e links de documentos sem aparecer na lista. Também pode editar e apagar o histórico (ver A4). C1 e C2 permitem atribuir comentários e eventos a outra pessoa.
- **Correção mínima:** o texto das regras está abaixo, sem aplicar. No cliente, `revokeMember` deve apagar o convite, e "Com acesso" deve partir de `memberUids`.
- **Esforço:** regras de 2 a 3 h · testes de regras de 3 a 4 h · cliente de 2 h · publicação manual e verificação de 1 h. **Total: cerca de 1 dia.**
- **Responsável:** frontend-engineer (regras e cliente). O devsecops confere a correção.
- **Referência:** OWASP Top 10 A01:2021 (Broken Access Control) e ASVS V4.1.3 e V4.2.1.

### A2 · Alto · O convite é aceito com base em e-mail não verificado (vetor de fora)
- **[FATO]** A tela permite criar conta por e-mail e senha com qualquer endereço (`src/store/useAuth.js:40-47` e `src/components/Login.jsx:52-55`). O provedor está documentado como habilitado (`DEPLOY-FASE1-COMPLETA.md:20-24`).
- **[FATO]** Não há `sendEmailVerification` nem checagem de `email_verified` em lugar nenhum. Comando: `grep -rn "sendEmailVerification\|emailVerified\|email_verified" src firestore.rules` → nenhuma linha, exit 1.
- **[FATO]** As regras autorizam pelo `request.auth.token.email`: na leitura do convite (`firestore.rules:105`), na edição (`:110`) e na auto-inclusão (`:65`).
- **[FATO]** No login, o app busca os convites pelo e-mail e entra sozinho (`tripData.js:168-183`). O atacante **não precisa do tripId**.
- **Quem é afetado e como:** um convidado que ainda não entrou no app. Exemplo: Ana convida `joao@...`, e quem sabe disso cadastra uma conta de e-mail e senha com `joao@...` antes dele. Essa pessoa vira membro da viagem.
  - Se João depois entra com Google usando um Gmail, o comportamento padrão do Firebase (uma conta por e-mail) tende a substituir a conta não verificada. Essa parte é **[HIPÓTESE]**, porque depende da configuração do projeto. O acesso ganho até lá, e qualquer escrita feita, já aconteceu.
  - O atacante também lê `tripName` e `ownerEmail` do convite.
- **Por que é FATO e não hipótese:** todas as condições estão no código e nas regras. **Não executei a exploração**, porque o emulador estava proibido nesta delegação. O teste que fecha a questão é o T5 da lista abaixo.
- **Correção mínima:** exigir `request.auth.token.email_verified == true` para ler, editar e usar convites (texto abaixo). No cliente, chamar `sendEmailVerification` no cadastro e avisar que o convite só vale depois de confirmar o e-mail. Contas Google já chegam verificadas.
- **Esforço:** regras de 0,5 h (junto com A1) · cliente de 2 a 3 h · testes de 1 h.
- **Decisão de produto:** ver "Decisões pendentes".
- **Referência:** OWASP A07:2021 (Identification and Authentication Failures) e ASVS V2.5 e V4.1.

### A3 · Médio · A publicação não tem trava: testes de regras fora do caminho e regras publicadas à mão
- **[FATO] Entrada do Head:**
  - O workflow Qualidade falhou 10 vezes seguidas no passo de regras.
  - O deploy roda só `npm test` (`.github/workflows/firebase-hosting-merge.yml:13`).
  - main tem `protected=false`.
  - As regras são publicadas à mão (`DEPLOY-FASE2.md:85-96` e `DEPLOY-FASE5-ESTRUTURAL.md:55-62`).
- **[FATO] O que acrescento:**
  - `firebase-hosting-merge.yml` não tem bloco `permissions:`. O `GITHUB_TOKEN` fica com o padrão do repositório, que não verifiquei.
  - A action de terceiros `FirebaseExtended/action-hosting-deploy@v0` é referenciada por tag móvel e recebe o secret da service account (`firebase-hosting-merge.yml:21-26` e `firebase-hosting-pull-request.yml:23-27`).
  - `qualidade.yml:37` instala `firebase-tools` sem fixar versão.
  - Ponto positivo: o workflow de PR só roda para branches do próprio repositório (`firebase-hosting-pull-request.yml:11`), então forks não recebem o secret.
- **Quem é afetado e como:** todos os usuários. Qualquer push em main vai para produção sem testes de regras e sem E2E (teste de ponta a ponta). E a correção de A1 e A2 **não terá validação automática** enquanto o CI de regras estiver quebrado.
- **Correção mínima:**
  1. Consertar o passo `test:rules` no CI (engenheiro; de 2 a 4 h, causa ainda não diagnosticada).
  2. Fazer o deploy depender dele, com `needs:` ou juntando os jobs (0,5 h).
  3. Pôr `permissions: contents: read` no workflow de merge (0,1 h).
  4. Proteger main exigindo o check Qualidade. É configuração do repositório e exige autorização do usuário (0,2 h).
  5. Opcional: publicar as regras pelo CI (`firebase deploy --only firestore:rules` com a mesma service account, desde que ela tenha o papel adequado; 1 a 2 h). Fixar actions por SHA (0,5 h).
- **Referência:** OWASP A08:2021 (Software and Data Integrity Failures).

### A4 · Médio · Sem backup fora do banco; qualquer membro apaga o histórico
- **O que existe:**
  - [FATO] As "versões salvas" ficam em `trips/{id}/versions`, no mesmo banco (`tripData.js:116-141`).
  - [FATO] "Exportar JSON" é manual, por viagem, e depende de alguém lembrar de fazer (`src/components/screens/Mais.jsx:42-53`).
  - [FATO] "Importar JSON" restaura, mas substitui todo o conteúdo (`Mais.jsx:55-64`).
- **O que não existe:**
  - [FATO] Nenhum export agendado ou backup do Firestore no repositório. Não há `gcloud firestore export`, nem workflow, nem documentação.
  - [FATO] A regra `versions` libera `write` (que inclui apagar) para qualquer membro (`firestore.rules:70`).
  - [FATO] "Importar JSON" não confere se a pessoa é dona. `isOwner` está calculado em `Mais.jsx:40`, mas não protege a importação.
  - [FATO] `deleteTrip` apaga as versões antes do documento (`tripData.js:91-98`). Quando o dono exclui, nada sobra.
- **Quem é afetado e como:** os donos. Um engano ou um membro mal-intencionado (inclusive pelo caminho de A1) apaga todas as versões e sobrescreve o estado. Não há como recuperar fora do que cada pessoa exportou à mão.
- **[HIPÓTESE], a confirmar no Console:** que o projeto está no plano Spark (gratuito). Backups programados e PITR (recuperação para um ponto no tempo) do Firestore exigem Blaze, segundo o critério do Head; não conferi na fonte hoje. Como confirmar: Console › Uso e faturamento.
- **Correção mínima, sem custo:**
  1. Permitir que só o dono apague versões: `allow delete: if signedIn() && tripData(tripId).ownerId == request.auth.uid;` e `allow read, create, update: if isMember(tripId);` (0,5 h mais 1 teste).
  2. Restringir "Importar JSON" ao dono, no cliente (0,5 h).
  3. Documentar uma rotina de exportação JSON periódica pelo dono e ensaiar a restauração uma vez (1 h).
- **Com custo:** se o usuário aceitar o Blaze, backups programados do Firestore (com custo de armazenamento a confirmar na fonte) cobrem o banco inteiro.
- **Referência:** ASVS V1.14 e boas práticas de recuperação.

### A5 · Baixo · LGPD: lacunas proporcionais a um app familiar
- **Inventário de dados pessoais [FATO]:**

| Onde | Dados | Quem lê | Retenção hoje |
|---|---|---|---|
| `users/{uid}` (`tripData.js:25-36`) | e-mail, celular, nome | só o próprio usuário | indefinida |
| `trips/{id}` | `ownerEmail`, conteúdo livre (roteiro, custos, links de documentos) | membros | até o dono excluir |
| `trips/{id}/members/{uid}` | e-mail, nome, papel | membros | apagado ao remover membro; fica órfão ao excluir a viagem |
| `presence`, `comments`, `activity` | nome, uid, textos | membros | ficam órfãos ao excluir a viagem; ninguém lê, porque `isMember` falha sem o documento da viagem |
| `convites/{tripId_email}` | e-mail do convidado, e-mail do dono, nome da viagem | convidado e dono | **nunca apagados** (nem ao revogar, nem ao excluir a viagem) |
| `feedback` (`tripData.js:287-300`) | e-mail, user agent, texto livre de até 4000 caracteres | ninguém pelo cliente; Console | indefinida |
| Firebase Analytics (`src/lib/analytics.js`) | eventos com allowlist (`analytics.js:13-26`); o SDK do Google coleta identificadores do aparelho | Google | padrão do GA4 (não verificado) |

- **Lacunas:**
  - Não há exclusão de conta nem forma de pedir a exclusão dos dados pela interface (`SettingsSheet.jsx` só vincula celular e Google).
  - Não há aviso de privacidade nem aviso sobre o Analytics. Comando: `grep -rn "consent\|setAnalyticsCollectionEnabled" src` → nada.
  - Convites e feedback ficam guardados para sempre.
- **Quem é afetado e como:** usuários e convidados, cujo e-mail fica guardado indefinidamente e não pode ser apagado por eles mesmos.
- **Correção mínima e proporcional:**
  1. Um parágrafo de aviso de privacidade na tela de login: o que é guardado, que o Analytics é usado e um contato para pedir exclusão (1 h).
  2. Apagar o convite ao revogar e ao excluir a viagem (já incluído em A1).
  3. Prazo de retenção para feedback, com limpeza manual pelo Console semestral (0,5 h de documentação).
  4. Exclusão de conta self-service só se o uso crescer além do círculo pessoal (1 a 2 dias, porque exige apagar dados em cascata).
- **Ressalva:** o enquadramento jurídico é com o usuário. O art. 4º, I da LGPD exclui o tratamento por pessoa natural para fins exclusivamente particulares e não econômicos. Se essa exceção se aplica aqui, com cadastro aberto e o repositório numa organização, não é parecer meu.

### A6 · Baixo · Dependências: exposição real pequena
- **[FATO]** `npm audit --omit=dev`: 12 vulnerabilidades (6 moderadas, 6 altas). Duas diretas: `xlsx` e `firebase`. O restante vem da cadeia `@firebase/*`, por `undici` e `@grpc/grpc-js`.
- **[FATO]** `grep -l "undici\|grpc-js" dist/assets/*.js` → nenhum arquivo (exit 1). O undici e o grpc não estão no bundle do navegador. São caminhos do SDK para Node. Exposição para o usuário final: praticamente nula.
- **[FATO]** `xlsx@0.18.5` (GHSA-4r6h-8v6p-xvw6 e GHSA-5pgg-2g8v-p4x9, "No fix available" no npm):
  - É carregado sob demanda (`src/lib/sheetFile.js:13-17`, chunk `dist/assets/xlsx-D_0l8YDs.js`).
  - Só lê um arquivo escolhido pelo próprio usuário (`sheetFile.js:100`).
  - Pior caso: alguém convence o usuário a importar uma planilha maliciosa. A poluição de protótipo e o ReDoS (travamento por expressão regular) acontecem na aba do próprio usuário: travar a aba ou mexer no comportamento da página naquela sessão.
  - Não há servidor envolvido.
- **Correção mínima:**
  - Trocar para a versão corrigida do SheetJS, distribuída fora do npm (CDN oficial). **[HIPÓTESE]:** versão 0.20.2 ou posterior, a confirmar em https://cdn.sheetjs.com e no advisory antes de trocar. Esforço de 1 a 2 h mais o teste de importação.
  - Atualizar `firebase` para a linha atual (o Head indicou 13.x) é dívida técnica, de 0,5 a 1 dia com regressão E2E. ESLint 8 está em fim de vida, mas só no ambiente de desenvolvimento.
- **Responsável:** frontend-engineer.

## Texto mínimo da correção em `firestore.rules` (proposta, não aplicada)
```
// novo helper, junto aos demais
function emailVerificado() {
  return signedIn() && request.auth.token.email_verified == true;
}

// trips/{tripId} — regra C (substitui as linhas 60-65)
( !(request.auth.uid in resource.data.memberUids)
  && request.resource.data.memberUids.removeAll(resource.data.memberUids) == [request.auth.uid]
  && resource.data.memberUids.removeAll(request.resource.data.memberUids).size() == 0
  && request.resource.data.ownerId == resource.data.ownerId
  && emailVerificado()
  && get(/databases/$(database)/documents/convites/$(tripId + '_' + myEmail())).data.status == 'pendente'
  && get(/databases/$(database)/documents/convites/$(tripId + '_' + myEmail())).data.ownerUid == resource.data.ownerId )

// members/{uid} (substitui as linhas 82-83)
allow create, update: if signedIn() && request.auth.uid == uid && isMember(tripId)
  && (request.resource.data.role != 'owner' || tripData(tripId).ownerId == request.auth.uid);
allow delete: if signedIn() && (request.auth.uid == uid || tripData(tripId).ownerId == request.auth.uid);

// comments (linha 89) e activity (linha 96): separar create
allow read: if isMember(tripId);
allow create: if isMember(tripId) && request.resource.data.authorUid == request.auth.uid;

// convites/{conviteId} (substitui as linhas 102-112)
allow create: if signedIn()
  && request.resource.data.ownerUid == request.auth.uid
  && tripData(request.resource.data.tripId).ownerId == request.auth.uid
  && conviteId == request.resource.data.tripId + '_' + request.resource.data.emailConvidado
  && request.resource.data.status == 'pendente';
allow read: if signedIn() && (
  (emailVerificado() && resource.data.emailConvidado == myEmail())
  || resource.data.ownerUid == request.auth.uid );
allow update: if signedIn() && (
  ( emailVerificado() && resource.data.emailConvidado == myEmail()
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status','acceptedByUid','acceptedAt'])
    && request.resource.data.status in ['aceito','recusado'] )
  || resource.data.ownerUid == request.auth.uid );
allow delete: if signedIn() && (
  (emailVerificado() && resource.data.emailConvidado == myEmail())
  || resource.data.ownerUid == request.auth.uid );
```
- **Compatibilidade com o cliente atual:**
  - `acceptPendingInvites` já atualiza a viagem **antes** de marcar `aceito` (`tripData.js:177-183`), então o status `pendente` exigido pela regra C continua funcionando.
  - `createInvite` já gera id, status e e-mail em minúsculas compatíveis (`tripData.js:144-151`).
  - Os testes existentes que usam convite precisam incluir `email_verified: true` no token simulado.
  - **[RECOMENDAÇÃO]:** antes de publicar, verificar no Console se algum membro atual usa conta de e-mail e senha não verificada. Essa pessoa perderia a capacidade de aceitar convites novos, mas não o acesso que já tem.

## Testes de regras que faltam (em `src/rules/__tests__/rules.test.js`)
| # | Caso | Esperado |
|---|---|---|
| T1 | Ex-membro removido, com convite `aceito` ainda existente, tenta se re-incluir | negado |
| T2 | Autenticado qualquer cria `convites/{tripAlheio}_{seuEmail}` com `ownerUid` = ele | negado |
| T3 | Membro não-dono cria convite para terceiro | negado |
| T4 | Convite com id diferente de `tripId_email` ou status diferente de `pendente` | negado |
| T5 | Conta com `email_verified: false` lê o convite do próprio e-mail e tenta se auto-incluir | negado nos dois |
| T6 | Convidado altera `ownerUid`/`tripId` do convite ou volta o status para `pendente` | negado |
| T7 | Membro cria comentário com `authorUid` de outra pessoa | negado |
| T8 | Membro cria evento de atividade com `authorUid` de outra pessoa | negado |
| T9 | Membro grava `members/{seuUid}` com `role: 'owner'` / dono grava o próprio como owner | negado / permitido |
| T10 | Membro não-dono apaga versão (se A4 for aceito) / dono apaga | negado / permitido |
| T11 | Regressão: convite pendente com e-mail verificado → auto-inclusão → status `aceito` | permitido |

Esforço: de 3 a 4 h para escrever e rodar no emulador. **Não rodei nenhum deles nesta delegação.**

## A confirmar (hipóteses, não são achados)
- **H1 · XSS armazenado por link de documento** (código que roda no navegador de outra pessoa).
  - [FATO] `DocumentsEditor` renderiza `href={d.url}` direto de `state.settings.documents`, sem `isValidLink` (`src/components/AttachmentsSheet.jsx:106` e `:132`).
  - [FATO] `normalizeState` não filtra esses links (`src/domain/state.js:71`).
  - [FATO] O React 18.3.1 só **avisa** sobre `javascript:` em desenvolvimento (`node_modules/react-dom/cjs/react-dom.development.js:655`) e não bloqueia em produção.
  - [FATO] Não há CSP (política de segurança de conteúdo) em `firebase.json`.
  - Caminhos de entrada: um membro gravando pelo SDK, ou "Importar JSON" de um arquivo preparado (`Mais.jsx:61-64`).
  - **O que falta saber:** se o navegador executa `javascript:` num link com `target="_blank" rel="noreferrer"` na origem do app.
  - **Teste:** numa viagem de teste, gravar `settings.documents=[{id:'x',label:'t',url:'javascript:alert(document.domain)'}]` e clicar em "Abrir" no Chrome, no Firefox e no Safari.
  - Correção barata nos dois casos: filtrar com `isValidLink` ao renderizar e em `normalizeState` (0,5 h).
- **H2:** projeto no plano Spark ou Blaze (ver A4).
- **H3:** comportamento do Firebase "uma conta por e-mail" quando o dono legítimo entra com Google depois (ver A2).

## Dependências e segredos
- `npm audit --omit=dev` → `12 vulnerabilities (6 moderate, 6 high)`. O detalhe por pacote está em A6. O audit completo (com dependências de desenvolvimento) vem do Head: 33.
- Segredos: o Head confirmou que não há `.env` nem service account no histórico. `.gitignore` cobre `.env`, `.env.local` e `service-account-key.json`. `.env.example` só tem valores de exemplo. A chave da API web do Firebase não é segredo, mas deve ter restrição de referrer (não verificado).
- O código de emulador e o gancho `__E2E_LOGIN__` (que contém uma senha fixa de teste) ficam atrás de `VITE_USE_EMULATORS` (`src/lib/firebase.js:54-66`). O CI confere que eles não vazam para o bundle (`qualidade.yml:53-59`).

## Implantação e rollback (para a correção de A1, A2 e A4)
1. **Antes de publicar:** no Console › Firestore › Regras, comparar a versão publicada com o `firestore.rules` do repositório. O histórico do Console guarda as versões anteriores. Registrar a data da versão atual.
2. Rodar `npm run test:rules` com os testes T1 a T11 passando. Depois, `npm run test:e2e`.
3. Publicar o cliente (`revokeMember` apagando o convite, verificação de e-mail no cadastro, lista a partir de `memberUids`) **junto** com as regras: `firebase deploy --only firestore:rules` mais o merge que publica o Hosting.
4. **Verificação depois da publicação:**
   - Login com Google abre as viagens.
   - O dono convida uma conta de teste verificada, que entra.
   - O dono remove essa conta, e ela não volta nem recarregando.
   - Comentar funciona.
5. **Critério de rollback:** membros legítimos recebendo `permission-denied` ao abrir ou editar viagens.
6. **Como voltar:** no Console › Firestore › Regras › histórico, republicar a versão anterior, ou rodar `firebase deploy --only firestore:rules` a partir do commit anterior. A volta leva cerca de 1 minuto para valer.

## Não verificado (e por quê)
- **Regras publicadas em produção:** não há acesso ao Console nem ao projeto daqui. A2 e A1 valem para o arquivo do repositório.
- **Exploração de A2 e os testes T1 a T11:** o emulador estava proibido nesta delegação.
- **Restrições da chave de API no Google Cloud, domínios autorizados do Auth, plano de faturamento, configuração "uma conta por e-mail" e App Check:** exigem acesso ao Console.
- **Proteção de branch e permissões padrão do `GITHUB_TOKEN`:** o dado `protected=false` veio do Head. Não consultei a API.
- **Versão corrigida do SheetJS e preço de backup do Firestore:** exigem rede externa além do npm, que não estava autorizada.
- **H1 (execução de `javascript:` com `target=_blank`):** exige navegador.
