# Guia de implantação — Fase 1

Passo a passo para levar o app de "código na pasta" até "no ar", com deploy
automático a cada push. Siga as partes na ordem: cada uma depende da anterior.

Tempo estimado na primeira vez: 40–60 minutos, a maior parte esperando o
Firebase provisionar coisas.

---

## Pré-requisitos

Antes de começar, tenha:

- **Node.js 20+** e **npm** instalados (`node -v` deve mostrar v20 ou maior).
- Uma **conta Google** (será o dono do projeto Firebase e a primeira conta de
  login do app).
- Uma **conta GitHub** (para o repositório e o deploy automático).
- O **Firebase CLI**:
  ```bash
  npm install -g firebase-tools
  firebase --version
  ```

---

## Visão geral do que vai acontecer

1. Colocar o código no seu computador e num repositório GitHub.
2. Criar o projeto no Firebase e ligar Authentication + Firestore.
3. Rodar localmente para confirmar que tudo funciona antes de publicar.
4. Publicar as regras de segurança do Firestore.
5. Fazer o primeiro deploy manual (para garantir que o Hosting existe).
6. Ligar o deploy automático via GitHub Actions.
7. Checklist final de verificação.

---

## Parte 1 — Código no seu computador

Se ainda não estiver versionado, entre na pasta do projeto e inicialize o git:

```bash
cd travel-dashboard
git init
git add .
git commit -m "Fase 1: app React + Vite + Firebase + PWA"
```

Crie um repositório **vazio** no GitHub (sem README, sem .gitignore — o projeto
já tem os dois) e conecte:

```bash
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/travel-dashboard.git
git push -u origin main
```

> O `.gitignore` já exclui `node_modules`, `dist`, `.env` e
> `service-account-key.json`. Confirme que o `.env` **não** foi para o commit
> (`git status` não deve listá-lo).

---

## Parte 2 — Criar e configurar o projeto Firebase

### 2.1 Criar o projeto

1. Acesse <https://console.firebase.google.com/> e clique em **Adicionar
   projeto**.
2. Dê um nome (ex.: `plano-viagens`). Anote o **ID do projeto** que o Firebase
   gerar (algo como `plano-viagens-1a2b3`) — você vai usá-lo várias vezes.
3. Pode desativar o Google Analytics (não é necessário para este app).

### 2.2 Ativar o login com Google (Authentication)

1. No menu lateral: **Criar → Authentication → Vamos começar**.
2. Aba **Sign-in method** → escolha **Google** → **Ativar**.
3. Defina um e-mail de suporte e salve.

### 2.3 Criar o banco Firestore

1. No menu lateral: **Criar → Firestore Database → Criar banco de dados**.
2. Escolha o local do servidor (ex.: `southamerica-east1` para o Brasil — não
   dá para mudar depois).
3. Comece em **modo de produção** (as regras que garantem a segurança já estão
   no projeto e serão publicadas na Parte 4).

### 2.4 Registrar o app Web e pegar as credenciais

1. Em **Configurações do projeto** (ícone de engrenagem, no topo do menu) →
   aba **Geral** → role até **Seus apps** → clique no ícone **Web** (`</>`).
2. Dê um apelido (ex.: `dashboard-web`) e registre. **Não** marque "Firebase
   Hosting" nesse passo (faremos por CLI).
3. O Firebase vai mostrar um objeto `firebaseConfig` com as chaves. Deixe essa
   tela aberta — os valores vão para o `.env` no próximo passo.

---

## Parte 3 — Rodar e testar localmente

Ainda na pasta do projeto:

```bash
npm install
cp .env.example .env
```

Abra o `.env` e preencha com os valores do `firebaseConfig` da tela anterior:

```
VITE_FIREBASE_API_KEY=...           (apiKey)
VITE_FIREBASE_AUTH_DOMAIN=...       (authDomain)
VITE_FIREBASE_PROJECT_ID=...        (projectId)
VITE_FIREBASE_STORAGE_BUCKET=...    (storageBucket)
VITE_FIREBASE_MESSAGING_SENDER_ID=...  (messagingSenderId)
VITE_FIREBASE_APP_ID=...            (appId)
```

Rode os testes e suba o app em modo desenvolvimento:

```bash
npm test        # deve passar 22/22
npm run dev
```

Abra o endereço que o Vite mostrar (normalmente <http://localhost:5173>),
clique em **Entrar com Google** e faça login. Cadastre uma cidade com datas e
confirme que as outras telas se preenchem. Se o login e o salvamento
funcionarem localmente, a configuração do Firebase está correta.

> `localhost` já vem autorizado no Authentication, então o login funciona em
> desenvolvimento sem ajuste extra.

---

## Parte 4 — Publicar as regras de segurança do Firestore

As regras (`firestore.rules`) são o que garante que cada usuário só acessa os
próprios dados. Publique-as:

```bash
firebase login
firebase use SEU-PROJECT-ID
firebase deploy --only firestore:rules
```

(`firebase use SEU-PROJECT-ID` associa esta pasta ao projeto certo; use o ID
anotado no passo 2.1.)

---

## Parte 5 — Primeiro deploy manual (Hosting)

Faça um deploy manual uma vez, tanto para confirmar que tudo publica quanto
para criar o site de Hosting que o deploy automático vai usar depois:

```bash
npm run build
firebase deploy --only hosting
```

Ao final, o CLI mostra a **URL do site** (algo como
`https://SEU-PROJECT-ID.web.app`). Abra, faça login e repita o teste rápido da
Parte 3, agora no site publicado.

> O domínio `.web.app` já vem autorizado para login. Se você usar um domínio
> **próprio** depois, precisará adicioná-lo em **Authentication → Settings →
> Domínios autorizados**, senão o popup de login falha.

---

## Parte 6 — Deploy automático (GitHub Actions)

O workflow em `.github/workflows/deploy.yml` roda os testes, faz o build e
publica no Hosting a cada push na `main` — barrando qualquer deploy que quebre
os testes. Falta dar a ele as credenciais.

### 6.1 Gerar as credenciais de deploy

A forma mais confiável é deixar o próprio Firebase criar a conta de serviço com
as permissões certas e guardá-la como secret no GitHub:

```bash
firebase init hosting:github
```

Responda:
- **Repositório**: `SEU-USUARIO/travel-dashboard`.
- Quando perguntar se quer configurar um workflow / sobrescrever arquivos:
  responda **não** para não sobrescrever o `deploy.yml` que já existe.

Esse comando cria um secret no seu repositório com um nome como
`FIREBASE_SERVICE_ACCOUNT_SEU_PROJECT_ID`. **Anote esse nome exato.**

### 6.2 Alinhar o nome do secret no workflow

O `deploy.yml` referencia o secret como `FIREBASE_SERVICE_ACCOUNT`. Abra o
arquivo e troque essa linha pelo nome que o comando anterior criou:

```yaml
firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_SEU_PROJECT_ID }}
```

### 6.3 Cadastrar as variáveis do Firebase como secrets

No GitHub: **Settings → Secrets and variables → Actions → New repository
secret**. Crie um secret para cada variável do seu `.env`, com o **mesmo nome e
valor**:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

(O workflow usa `VITE_FIREBASE_PROJECT_ID` também como o `projectId` do deploy,
então ele precisa existir como secret.)

### 6.4 Disparar o primeiro deploy automático

Faça qualquer alteração pequena, commit e push:

```bash
git commit -am "Configura deploy automático" --allow-empty
git push
```

Na aba **Actions** do GitHub, acompanhe o workflow: ele roda os testes, o build
e o deploy. Se ficar verde, todo push na `main` a partir de agora publica
sozinho.

---

## Parte 7 — Checklist de verificação final

Abra a URL publicada e confirme, um a um:

- [ ] **Login com Google** funciona no site publicado.
- [ ] **Cadastrar cidade com datas** gera automaticamente as linhas de
      alimentação/atrações/outras.
- [ ] **Editar um custo** e recarregar a página: o valor persiste (salvou no
      Firestore).
- [ ] **Salvar uma versão** (botão Versões), recarregar, e **carregar** essa
      versão de volta.
- [ ] **Exportar JSON** baixa o arquivo; **Importar JSON** substitui os dados.
- [ ] **Modo offline**: com o app aberto, desligue a internet, edite algo,
      religue — a mudança sincroniza (persistência offline do Firestore + PWA).
- [ ] **Instalar como app** (ícone de instalar do navegador no desktop, ou
      "Adicionar à tela inicial" no celular).
- [ ] **Imprimir** (botão Imprimir) gera um PDF legível pelo "Salvar como PDF"
      do navegador.
- [ ] Entrar com **outra conta Google** mostra um dashboard vazio (isolamento
      entre usuários funcionando).

---

## Depois: migração dos dados existentes (item 1.7)

Se você já tinha versões salvas na planilha do Google Sheets da versão Apps
Script, use o pacote separado `migracao/` para trazê-las ao Firestore. Ele só
deve rodar **depois** que cada usuário fizer login pelo menos uma vez no app
novo (é assim que o script encontra o UID de cada e-mail). O passo a passo está
no `README-migracao.md` daquele pacote.

---

## Problemas comuns

**O login abre o popup e fecha sem entrar (no site publicado).**
O domínio não está autorizado. Vá em **Authentication → Settings → Domínios
autorizados** e confirme que o domínio do site está lá (os `.web.app` e
`.firebaseapp.com` já vêm; domínios próprios precisam ser adicionados).

**Tela branca no site publicado, mas funciona local.**
Quase sempre é secret faltando ou com nome errado no GitHub — o build sai sem as
variáveis `VITE_FIREBASE_*` e o Firebase não inicializa. Confira os secrets na
Parte 6.3 e rode o workflow de novo.

**"Missing or insufficient permissions" ao salvar.**
As regras do Firestore não foram publicadas, ou o usuário não está logado.
Rode `firebase deploy --only firestore:rules` (Parte 4) e confirme que fez
login no app.

**O workflow do GitHub falha no passo de deploy com erro de credencial.**
O nome do secret da conta de serviço no `deploy.yml` (Parte 6.2) não bate com o
nome que o `firebase init hosting:github` criou. Alinhe os dois nomes.

**`firebase use` reclama que não há projeto.**
Rode `firebase login` primeiro e confirme que a conta logada é a dona do
projeto Firebase.
