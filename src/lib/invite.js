// lib/invite.js — compartilhamento do convite, 100% no navegador.
//
// Decisão registrada: o app NÃO envia e-mail sozinho. Fazer isso exigiria um
// backend (extensão "Trigger Email" do Firebase + plano Blaze + provedor de
// SMTP), com custo recorrente e chaves a gerenciar. Em vez disso, o app monta a
// mensagem e entrega ao canal que a pessoa já usa: WhatsApp, o app de e-mail do
// próprio aparelho (mailto:), o menu de compartilhar do sistema, ou a área de
// transferência. Zero infraestrutura, zero custo, e o convite sai do remetente
// de verdade — o que, na prática, tem mais chance de ser lido do que um e-mail
// automático caindo no spam.
//
// (O caminho do e-mail automático está documentado em DEPLOY-CONVITE-EMAIL.md,
// caso um dia se justifique.)

/** URL do app (a mesma para todos; o acesso é concedido ao logar com o e-mail convidado). */
export function appUrl() {
  return window.location.origin + window.location.pathname;
}

/** Texto do convite. `email` é o endereço convidado — importa, porque o acesso depende dele. */
export function inviteMessage(tripName, email, fromName) {
  const quem = fromName ? `${fromName} ` : '';
  return (
    `${quem}convidou você para planejar a viagem "${tripName}".\n\n` +
    `Abra o link e entre com a conta Google do e-mail ${email} — o acesso aparece assim que você fizer login:\n` +
    appUrl()
  );
}

export function whatsappUrl(text) {
  return 'https://wa.me/?text=' + encodeURIComponent(text);
}

export function mailtoUrl(email, tripName, text) {
  const subject = `Convite para planejar a viagem "${tripName}"`;
  return (
    'mailto:' + encodeURIComponent(email) +
    '?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(text)
  );
}

/** Menu de compartilhar do sistema (Android/iOS). Devolve false se não houver suporte. */
export async function nativeShare(tripName, text) {
  if (!navigator.share) return false;
  try {
    await navigator.share({ title: `Viagem: ${tripName}`, text });
    return true;
  } catch {
    return false; // usuário cancelou ou o navegador recusou
  }
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
