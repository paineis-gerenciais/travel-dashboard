# Guia de implantação — Login por celular, Configurações, saudação e correções

Leva grande, com um item que **exige configuração manual sua no Console do
Firebase antes de funcionar**: o login por celular. Leia a seção dele primeiro.

## 1. Login por celular — ação manual obrigatória

**Sem isto, o botão "Entrar com celular" vai falhar** com erro de
`auth/operation-not-allowed` ou de cota.

1. Abra o [Console do Firebase](https://console.firebase.google.com/) → seu
   projeto (`plano-viagem-certa`) → **Authentication → Sign-in method**.
2. Habilite o provedor **Telefone**.
3. **Verifique o plano de cobrança.** Autenticação por telefone envia SMS de
   verdade — isso normalmente exige o projeto estar no **plano Blaze**
   (pós-pago, com cartão cadastrado), da mesma forma que o e-mail automático
   documentado em `DEPLOY-CONVITE-ENVIO.md`. O nível gratuito do Firebase inclui
   uma cota de verificações por telefone, mas ela só é liberada dentro do Blaze.
   Sem isso, o envio de SMS falha.
4. **Domínios autorizados**: em Authentication → Settings → Authorized domains,
   confirme que o domínio onde o app roda (ex.: `travel-dashboard.web.app` e o
   domínio da prévia do PR) está na lista — o reCAPTCHA invisível do login por
   celular depende disso.
5. **Opcional, recomendado para testar sem gastar SMS de verdade**: em
   Authentication → Sign-in method → Telefone → "Números de telefone para
   teste", cadastre um número fictício com um código fixo (ex.:
   `+55 11999990000` → código `123456`) para usar na prévia sem custo.

## 2. Passos de sempre

```bash
git checkout main && git pull
git checkout -b login-celular-config-melhorias
npm install
npm test          # 37 testes de domínio
npm run build     # limpo
```

```bash
git add -A
git commit -m "Login por celular, Configuracoes, saudacao, correcoes Custos/Dias/Mapa, icone PWA"
git push -u origin login-celular-config-melhorias
```

Abra o PR e teste na **prévia**.

> **Sem deploy de regras** — o campo novo `phoneNumber` no perfil trafega sem
> mudança em `firestore.rules` (a regra de `users/{uid}` já não restringe
> campos).

## 3. O que foi implementado, item por item

- **Login por celular**: tela de login ganhou "Entrar com celular" — envia
  código por SMS (reCAPTCHA invisível) e confirma. Ver seção 1 acima.
- **Configurações** (botão ⚙️ na tela inicial): editar nome; vincular celular
  (se a conta ainda não tiver um); vincular uma conta Google para ganhar um
  e-mail (se a conta só tiver celular). Mudanças refletem na hora, sem precisar
  sair e entrar de novo.
- **Saudação + frase inspiradora** na tela inicial: nome cadastrado → e-mail →
  celular → "Viajante", como fallback nessa ordem. A frase é sorteada uma vez
  por visita à tela (não muda a cada clique).
- **Custos**: legenda com bolinha colorida + percentual em cada linha da
  distribuição; **corrigido um bug real** em "Por status" (a tela lia
  `s.status`/`s.total`, mas a função devolve `s.label`/`s.value` — os valores
  apareciam como `undefined`); viajantes movido para cima da distribuição, com
  botões `−`/`+` (o campo numérico continua funcionando também).
- **Dias**: itens de um dia agora aparecem **ordenados por horário** (transporte
  e atração usam o horário real; refeição usa uma âncora aproximada por tipo —
  café da manhã ~8h, almoço ~12h, jantar ~19h; outra despesa fica por último).
  O hotel saiu da lista mesclada e ganhou um card próprio, sempre no topo.
- **Dias (iPhone)**: corrigido o botão "Excluir item" escondido atrás do
  teclado. Causa: o Safari reduz a área visível da tela com o teclado aberto,
  mas a altura do modal (calculada em `vh`) não acompanhava. Agora o modal usa
  a `VisualViewport` do navegador para se ajustar de verdade, e o rodapé de
  ações fica fixo na base da área rolável.
- **Mapa**: o hotel virou o **último** ponto da rota (antes era o primeiro) —
  faz mais sentido como o ponto de retorno do dia.
- **Ícone do PWA**: substituído pela imagem do avião que você enviou, nos
  quatro tamanhos exigidos (192, 512, 512 maskable, apple-touch-icon).

## 4. Testar na prévia

**Login por celular:**
- [ ] Com um número de teste cadastrado (seção 1.5): enviar código, confirmar,
      entrar.
- [ ] Sem número de teste, com um celular de verdade: chega o SMS, confirma,
      entra. **Se falhar aqui, confira o plano Blaze e o provedor habilitado
      antes de reportar como bug.**

**Configurações:**
- [ ] Mudar o nome → a saudação da tela inicial atualiza.
- [ ] Numa conta que entrou por Google, vincular um celular.
- [ ] Numa conta que entrou por celular, vincular uma conta Google → o e-mail
      aparece depois, sem precisar relogar.

**Tela inicial:**
- [ ] Saudação mostra o nome certo (ou o fallback certo, se não houver nome).
- [ ] A frase muda ao sair e entrar de novo na tela (não a cada clique dentro
      dela).

**Custos:**
- [ ] "Por status" agora mostra valores reais (não mais vazio/undefined).
- [ ] Setas de viajantes aumentam/diminuem; o campo numérico digitável continua
      funcionando.
- [ ] A legenda (bolinha + %) aparece em cada linha da distribuição.

**Dias:**
- [ ] Os itens do dia aparecem em ordem de horário; o hotel fica separado, no
      topo.
- [ ] **No iPhone**: abrir o editor de um item, tocar num campo de texto (teclado
      abre), rolar até o fim → o botão "Excluir item" está visível e clicável.

**Mapa:**
- [ ] O hotel aparece como último ponto da rota; o link do Google Maps reflete
      isso.

**PWA:**
- [ ] Instalar o app na tela inicial do celular → o ícone é o avião novo.

## 5. Nota de segurança sobre a vinculação de contas

Vincular celular ou Google a uma conta já usa as funções nativas do Firebase
Auth (`linkWithPhoneNumber`, `linkWithPopup`), que já impedem vincular um
telefone ou conta Google que já pertence a outro usuário (a operação falha com
erro claro nesse caso — a mensagem de erro aparece na tela de Configurações).
