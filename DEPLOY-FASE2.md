# Guia de implantação — Fase 2 (perfis, compartilhamento e tempo real)

Passo a passo para colocar a Fase 2 no ar sobre a base da Fase 1 já publicada.
Diferente da Fase 1, o centro aqui são as **regras de segurança**: nada vai para
produção antes dos testes de isolamento passarem no emulador. Siga na ordem.

> **Pré-requisito herdado:** a Fase 1 já está publicada e funcionando (login
> Google, Firestore, deploy automático). Este guia parte daí.
>
> **Fora do escopo:** o item 2.0 (migração dos dados antigos do modelo
> single-user) não foi implementado — se você tinha uma viagem no formato antigo
> (`users/{uid}`), ela não aparece automaticamente. Comece criando uma viagem
> nova. (A migração pode ser adicionada depois, se necessário.)

## O que muda para o usuário nesta fase

- Ao entrar, aparece a tela **"Minhas viagens"** (antes ia direto para uma única
  viagem). Você cria/abre/exclui viagens ali.
- Dentro de uma viagem: botões novos **Compartilhar**, **Limpar** e
  **← Minhas viagens**, e a versão agora pode ser **sobrescrita**.
- Edição em **tempo real**: mudanças de quem compartilha a viagem aparecem
  sozinhas, e uma faixa mostra **quem está vendo a viagem agora**.

## Pré-requisito novo: Java (para os testes de regras)

Os testes de isolamento rodam no emulador do Firestore, que precisa de **Java**
instalado (JDK 11+). Confirme:

```bash
java -version
```

Se faltar, instale um JDK (ex.: Temurin/Adoptium, ou `sudo apt install
default-jdk` no Linux). Isso é só para *testar* localmente — não afeta produção.

## Parte 1 — Preparar a branch e instalar

Todo o trabalho da Fase 2 numa branch separada, nunca direto na `main`:

```bash
git checkout -b fase-2
npm install
```

(O `npm install` traz a nova dependência de teste de regras,
`@firebase/rules-unit-testing`.)

## Parte 2 — Rodar os testes (domínio + regras) localmente

**Testes de domínio** (rápidos, não precisam de emulador) — devem continuar
passando 22/22:

```bash
npm test
```

**Testes de isolamento das regras** (o passo crítico desta fase) — rodam no
emulador:

```bash
npm run test:rules
```

Esse comando sobe o emulador do Firestore, roda os testes contra as regras de
`firestore.rules`, e derruba o emulador ao final. Todos devem passar. Eles
provam, entre outras coisas, que:

- um estranho **não** lê nem escreve uma viagem de que não participa;
- um convidado **com** convite consegue entrar, e **só** adicionando a si mesmo;
- um estranho **sem** convite **não** consegue entrar;
- só o dono exclui a viagem;
- ninguém lê convites destinados a outro e-mail.

**Não prossiga enquanto esses testes não estiverem verdes.** É a rede de
segurança que impede vazamento de dados entre perfis.

## Parte 3 — Testar o app localmente com o emulador (opcional, recomendado)

Para exercitar o fluxo de compartilhamento antes de mexer em produção, dá para
rodar o app apontando para o emulador. O jeito mais simples de validar o
comportamento visual é rodar `npm run dev` normalmente (contra o projeto de
produção) e testar com duas contas Google — mas isso já grava em produção. Se
preferir isolar, use o emulador; senão, pule para a Parte 4 e valide na prévia.

## Parte 4 — Publicar as novas regras do Firestore

As regras da Fase 2 são diferentes das da Fase 1 e precisam ir ao ar **junto**
com o código novo. Publique-as:

```bash
firebase deploy --only firestore:rules
```

> Faça isso perto do momento do deploy do código (Parte 6). Se as regras novas
> subirem muito antes do código, o app da Fase 1 (ainda em produção) continua
> funcionando, porque as regras novas são compatíveis com o acesso do próprio
> dono; mas o ideal é minimizar essa janela.

## Parte 5 — Subir a branch e abrir um Pull Request (prévia)

```bash
git add .
git commit -m "Fase 2: perfis, compartilhamento, tempo real e presença"
git push -u origin fase-2
```

No GitHub, abra um **Pull Request** de `fase-2` para `main`. O workflow
`firebase-hosting-pull-request.yml` (já configurado na Fase 1) sobe uma **prévia
com URL própria**. É nessa URL que você testa a Fase 2 antes de ir para
produção.

> Lembre-se de que os secrets `VITE_FIREBASE_*` já foram cadastrados na Fase 1 e
> valem para o PR também.

## Parte 6 — Testar o compartilhamento na prévia (com DUAS contas)

Este é o teste que só a Fase 2 exige. Na URL da prévia:

1. **Conta A (dono):** faça login, crie uma viagem "Teste", adicione uma cidade.
2. Clique em **Compartilhar**, convide o e-mail da **conta B**. Deve aparecer a
   mensagem de convite criado.
3. **Conta B (convidada):** em outro navegador ou aba anônima, faça login com a
   conta B. A viagem "Teste" deve aparecer em "Minhas viagens".
4. **Tempo real:** com as duas contas na mesma viagem, edite um custo na conta A
   e veja aparecer na conta B em 1–2 segundos (e vice-versa).
5. **Presença:** confirme que cada uma vê a faixa "Fulano está vendo esta viagem
   agora".
6. **Campo em edição:** com a conta A digitando num campo, faça a conta B mudar
   outro campo — o que a A digita não pode ser apagado no meio.
7. **Isolamento (o teste de segurança):** com uma **terceira** conta (C), sem
   convite, confirme que ela **não** vê a viagem "Teste" em lugar nenhum.
8. **Revogar:** na conta A, em Compartilhar, remova a conta B e confirme que a
   B perde o acesso.

Se todos passarem, a fase está pronta para produção.

## Parte 7 — Merge para produção

No PR, faça o **merge** para `main`. O workflow `firebase-hosting-merge.yml`
publica automaticamente (testes → build → deploy), como na Fase 1.

## Checklist final de verificação (produção)

- [ ] Tela "Minhas viagens" aparece ao entrar.
- [ ] Criar, abrir, renomear e excluir viagem funcionam.
- [ ] Compartilhar por e-mail: convidado ganha acesso ao logar.
- [ ] Edição em tempo real entre duas contas.
- [ ] Faixa de presença aparece.
- [ ] Sobrescrever versão e botão Limpar funcionam.
- [ ] Conta sem convite não acessa viagem alheia.
- [ ] Revogar acesso funciona.

## Notas e limitações conhecidas (registradas de propósito)

- **Aviso à pessoa convidada é manual.** O app cria o convite mas não envia
  e-mail; o dono avisa por fora (WhatsApp, e-mail pessoal). O acesso aparece
  quando a pessoa loga com o e-mail convidado.
- **Casamento de e-mail sensível a maiúsculas.** O convite é indexado pelo
  e-mail em minúsculas; o login Google normalmente entrega o e-mail em
  minúsculas, então funciona. Se um convite não for reconhecido, confira se o
  e-mail foi digitado igual ao da conta Google da pessoa.
- **Edição simultânea = last-write-wins.** Se duas pessoas editam o mesmo campo
  no mesmo instante, a última gravação vence. Raro num grupo pequeno; a faixa de
  presença ajuda a coordenar. O refinamento "gravar por item" está registrado no
  plano para **depois da Fase 3**, só se isso incomodar na prática.
- **Item 2.0 (migração) não incluído.** Viagens do modelo antigo não aparecem
  sozinhas; comece criando uma viagem nova.
- **Bundle de ~740 KB** (quase todo Firebase) — code-splitting continua como
  dívida técnica registrada para a Fase 3.
