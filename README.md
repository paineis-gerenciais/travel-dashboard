# Planejamento da Viagem — React + Vite + Firebase + PWA

Migração do dashboard de planejamento de viagem, antes um único arquivo HTML
servido por Google Apps Script, agora um app React + Vite com dados no
Firestore e funcionamento offline via PWA.

Este repositório é o resultado da **Fase 1** do plano de evolução
(`plano_melhorias_graduais_v2.md`), com exceção do item 1.7 (migração dos dados
existentes), que tem seu próprio pacote em `migracao/`.

## O que já está pronto (Fase 1)

- **1.1 Framework**: React 18 + Vite 5.
- **1.2 Estrutura + CI**: projeto organizado por camadas (`domain`, `lib`,
  `store`, `components`) + workflow do GitHub Actions.
- **1.3 Firebase**: Auth (login Google) + Firestore + Hosting configurados.
- **1.4 Lógica de domínio portada e testada**: toda a lógica de datas, custos,
  geração automática, exclusão em cascata e formatação foi portada para módulos
  puros em `src/domain/`, com 22 testes em `src/domain/__tests__/` que provam
  que o comportamento validado do app original foi preservado (regra do
  cancelado, exclusão em cascata pelos getters certos, geração sem duplicar,
  etc.).
- **1.5 Interface componentizada**: as 10 telas viraram componentes React em
  `src/components/screens/`, preservando o sistema de temas de cor por seção.
- **1.6 Modelo Firestore single-user + regras**: `users/{uid}` (state atual) e
  `users/{uid}/versions/{id}` (versões salvas), com `firestore.rules` isolando
  cada usuário.
- **1.8 PWA**: manifest + service worker (via vite-plugin-pwa), com casco do app
  cacheado para uso offline e Firestore com persistência local.
- **1.9 Deploy automatizado**: `.github/workflows/deploy.yml` roda testes +
  build e publica no Firebase Hosting a cada push na `main`.

## Rodar localmente

```bash
npm install
cp .env.example .env   # preencha com as credenciais do seu projeto Firebase
npm run dev
```

Testes e build:

```bash
npm test         # roda os testes de domínio
npm run build    # gera dist/ (inclui o service worker do PWA)
npm run preview  # serve o build localmente
```

## Configuração do Firebase (uma vez)

1. Criar um projeto no [Console do Firebase](https://console.firebase.google.com/).
2. Ativar **Authentication → Google** como provedor.
3. Ativar **Firestore Database** (modo produção).
4. Publicar as regras: `firebase deploy --only firestore:rules`.
5. Registrar um app Web e copiar as credenciais para o `.env`.
6. Para o deploy automático, cadastrar no GitHub (Settings → Secrets) as
   variáveis `VITE_FIREBASE_*` e o `FIREBASE_SERVICE_ACCOUNT` (JSON da conta de
   serviço do Firebase Hosting).

## Estrutura

```
src/
  domain/          Lógica pura, portada do app original (com testes)
    format.js      num, money, fmtDate
    state.js       blankState, normalizeState, constantes de opções
    dates.js       datas, cidades, roteiro
    transport.js   getters tolerantes a esquema legado + gmaps
    costs.js       agregações, totais, status, checklist
    generate.js    ensureGenerated, deleteCityCascade
    __tests__/     22 testes que validam o porte
  lib/
    firebase.js    inicialização do Firebase (config por .env)
    tripData.js    única porta de entrada ao Firestore
  store/
    useAuth.js     hook de login Google
    TripProvider.jsx  estado central + persistência com debounce
  components/
    screens/       as 10 telas
    ui.jsx, tableHelpers.js, App.jsx, Login.jsx, VersionsModal.jsx
  styles/app.css   sistema de temas por seção + responsivo + impressão
```

## Notas de arquitetura

- **`checklist`** segue o esquema do código original
  (`{id,category,item,responsible,priority,status,notes,done}`), não o formato
  simplificado da especificação — o código foi tratado como fonte da verdade.
- **Regra do cancelado**: itens com status "Cancelado" nunca entram no total
  geral, mas aparecem no gráfico de status. Coberto por teste.
- **Chaves do Firebase não são secretas**; a segurança vem das regras do
  Firestore, não do sigilo das chaves.
- **Limite de tamanho**: o teto de ~45.000 caracteres do Sheets deixou de
  existir (Firestore permite 1 MiB por documento).

## Próximas fases

- **Fase 2**: perfis e compartilhamento (Auth já preparado, falta o modelo
  multi-usuário com colaboradores e as regras de isolamento por viagem).
- **Fase 3**: refinamento visual, modo escuro, máscara monetária,
  code-splitting do bundle, acessibilidade.
