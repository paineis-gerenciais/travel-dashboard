# Guia de implantação — Enviar o convite (WhatsApp, e-mail, link)

Resolve a lacuna que existia desde a Fase 2: o app criava o convite, mas não
avisava ninguém — você tinha que lembrar de mandar mensagem por fora.

## O que foi implementado (e por quê assim)

Ao convidar alguém, o app agora abre uma folha **"Avisar a pessoa"** com quatro
caminhos, todos no navegador:

- **WhatsApp** — abre o WhatsApp (app ou web) com a mensagem pronta.
- **E-mail** — abre o app de e-mail do aparelho, com destinatário, assunto e
  corpo já preenchidos (`mailto:`). Você só aperta enviar.
- **Compartilhar…** — o menu nativo do sistema (Android/iOS), que inclui
  Telegram, SMS, Mensagens, etc. Só aparece onde há suporte.
- **Copiar mensagem** — para colar onde quiser.

Nos **convites pendentes**, um botão **"Avisar"** reabre essa folha — útil se a
pessoa perdeu a mensagem.

Também há, em **Mais › Enviar link do app**, um compartilhamento simples do
endereço do app (sem convite, sem dar acesso a nada).

### A decisão de design, explícita

O app **não envia e-mail sozinho**, e isso é deliberado. Enviar automaticamente
exigiria backend (ver a seção final). O caminho escolhido não tem servidor, não
tem custo, não tem chave de API para vazar — e o convite sai **do seu número ou
do seu e-mail**, o que na prática é lido com muito mais frequência do que um
e-mail automático que cai no spam.

## Passos

```bash
git checkout main && git pull
git checkout -b convite-envio
npm install
npm test          # 37 testes de domínio
npm run build     # limpo
```

```bash
git add -A
git commit -m "Convite: avisar por WhatsApp, e-mail (mailto) ou link"
git push -u origin convite-envio
```

Abra o PR e teste na prévia.

> **Sem deploy de regras** — nada mudou no Firestore nem em `firestore.rules`.

## Testar na prévia

No **celular** (é onde importa):

- [ ] Convidar um e-mail → a folha "Avisar a pessoa" abre sozinha.
- [ ] **WhatsApp**: abre o app com a mensagem pronta, contendo o link e o e-mail
      convidado.
- [ ] **E-mail**: abre o app de e-mail com destinatário, assunto e corpo prontos.
- [ ] **Compartilhar…**: aparece e abre o menu do sistema.
- [ ] **Copiar**: cola a mensagem correta.
- [ ] Em convites pendentes, **Avisar** reabre a folha.
- [ ] **Mais › Enviar link do app** compartilha só o endereço.

No **desktop**:

- [ ] WhatsApp abre o WhatsApp Web.
- [ ] E-mail abre o cliente padrão (ou avisa que não há um configurado — normal).
- [ ] "Compartilhar…" pode não aparecer (a maioria dos navegadores de desktop
      não suporta) — é esperado; copiar continua funcionando.

**Fluxo completo, com duas contas** (o que realmente prova):

- [ ] Conta A convida o e-mail da conta B e envia por WhatsApp.
- [ ] Conta B abre o link, entra com **aquela** conta Google e vê a viagem.

## Notas

- O link é sempre o **mesmo endereço do app** — não é um link mágico de acesso.
  O que concede acesso é o convite no banco + o login com o e-mail convidado.
  Isso é proposital: um link que desse acesso sozinho poderia ser encaminhado
  para qualquer pessoa.
- Se o e-mail digitado no convite for diferente do e-mail da conta Google da
  pessoa, o acesso não aparece. A mensagem enviada já diz qual e-mail usar,
  justamente para evitar isso.
- `mailto:` depende de haver um app de e-mail configurado. Em celular, quase
  sempre há. Em desktop sem cliente configurado, o botão não faz nada — por isso
  "Copiar mensagem" existe como plano B.

---

## Opcional: e-mail automático (o app enviando sozinho)

Não implementado. Fica registrado com os custos reais, para o dia em que se
justificar.

**O que seria preciso:**

1. **Plano Blaze** no Firebase (pós-pago, exige cartão de crédito). O nível
   gratuito continua existindo dentro dele, mas a conta deixa de ser
   "impossível de gerar cobrança".
2. **Extensão "Trigger Email"** (`firestore-send-email`): observa uma coleção
   (ex.: `mail/`) e envia cada documento criado nela.
3. **Um provedor de SMTP** — SendGrid, Mailgun, Resend, ou até um Gmail com
   senha de app. Todos exigem cadastro; os gratuitos têm limites baixos.
4. **Mudança no código**: ao criar o convite, gravar também um documento em
   `mail/` com destinatário, assunto e corpo.
5. **Mudança nas regras**: permitir que um membro autenticado escreva em `mail/`
   — e isso precisa ser feito com cuidado, senão vira um relay de spam aberto.
   Exigiria testes de isolamento novos no emulador.

**Os custos honestos:**

- Cartão de crédito cadastrado e uma conta a mais para manter (o provedor SMTP).
- Configuração de domínio (SPF/DKIM) se quiser que o e-mail não caia no spam —
  e, sem isso, ele frequentemente cai.
- Uma superfície de segurança nova (a coleção `mail/`) que precisa ser protegida
  com o mesmo rigor da Fase 2.

**Para um app de viagem em família, isso é desproporcional.** Mandar o convite
por WhatsApp resolve o mesmo problema em um toque, sem nada disso. A recomendação
é ficar no caminho implementado até que exista uma razão concreta para mudar —
por exemplo, se o app um dia for usado por pessoas que você não conhece
pessoalmente.
