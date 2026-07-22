// lib/phoneAuth.js — login/vínculo por número de celular (SMS + reCAPTCHA).
//
// Decisão registrada: autenticação por telefone é um recurso do Firebase Auth
// que verifica o número por SMS. Para funcionar em produção (fora dos números
// de teste cadastrados no console), o projeto Firebase precisa estar no plano
// Blaze (pós-pago) — é o mesmo tipo de decisão de infraestrutura já registrado
// para e-mail automático em DEPLOY-CONVITE-ENVIO.md. Sem isso, o envio de SMS
// falha com erro de cota. Ver DEPLOY-LOGIN-CELULAR.md para o passo a passo
// completo (incluindo o que habilitar no Console do Firebase).
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  linkWithPhoneNumber,
} from 'firebase/auth';
import { auth } from './firebase.js';

let verifier = null;

/** Cria (uma única vez) o reCAPTCHA invisível preso ao container informado. */
function getVerifier(containerId) {
  if (verifier) return verifier;
  verifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  return verifier;
}

function resetVerifier() {
  try { verifier?.clear(); } catch { /* ignore */ }
  verifier = null;
}

/** Login por celular (usuário ainda não autenticado). Devolve o confirmationResult. */
export async function sendLoginCode(phoneE164, containerId) {
  const v = getVerifier(containerId);
  try {
    return await signInWithPhoneNumber(auth, phoneE164, v);
  } catch (e) {
    resetVerifier();
    throw e;
  }
}

/** Vincular um celular a uma conta já logada (Configurações). Devolve o confirmationResult. */
export async function sendLinkCode(phoneE164, containerId) {
  const v = getVerifier(containerId);
  try {
    return await linkWithPhoneNumber(auth.currentUser, phoneE164, v);
  } catch (e) {
    resetVerifier();
    throw e;
  }
}

/** Confirma o código de 6 dígitos recebido por SMS, para login OU vínculo. */
export async function confirmCode(confirmationResult, code) {
  return confirmationResult.confirm(code);
}

/** Validação simples de formato E.164 (+55 11 999998888, sem espaços ao enviar). */
export function isValidE164(phone) {
  return /^\+[1-9]\d{7,14}$/.test(phone.replace(/[\s-]/g, ''));
}

export function normalizePhone(phone) {
  return phone.replace(/[\s-]/g, '');
}
