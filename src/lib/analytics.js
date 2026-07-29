// lib/analytics.js — T-1.1. Instrumentação de uso, com privacidade por construção.
//
// REQUISITO (não recomendação): nenhum dado pessoal sai daqui. Nomes de cidade,
// hotéis, valores em dinheiro, e-mails, telefones e textos livres NUNCA viram
// parâmetro de evento. A allowlist abaixo é a garantia: qualquer chave fora dela
// é descartada silenciosamente, mesmo que alguém a passe por engano no futuro.
//
// Ferramenta: Firebase Analytics (já temos Firebase; custo zero). O wrapper
// isola a dependência — trocar de ferramenta depois mexe só neste arquivo.
import { app } from './firebase.js';

/** Chaves permitidas: só categorias e contagens, jamais conteúdo do usuário. */
const ALLOWED_KEYS = new Set([
  'method',     // google | phone
  'kind',       // transports | foodItems | attractions | otherExpenses | ...
  'context',    // tela/origem da ação
  'view',       // categoria | cidade | dia
  'area',       // checklist | report | ...
  'category',   // bug | ideia | outro
  'step',       // passo do onboarding
  'count',      // números agregados
  'days',       // duração em dias
  'members',    // nº de membros
  'result',     // granted | denied | ok | error
  'role',       // owner | member
]);

let analytics = null;
let debug = false;

/** Liga o log no console (útil na prévia para conferir os eventos). */
export function setAnalyticsDebug(on) {
  debug = !!on;
}

async function getAnalyticsSafe() {
  if (analytics !== null) return analytics;
  try {
    const mod = await import('firebase/analytics');
    const supported = await mod.isSupported();
    analytics = supported ? mod.getAnalytics(app) : false;
  } catch {
    analytics = false; // ambiente sem suporte (SSR, navegador antigo, bloqueador)
  }
  return analytics;
}

/** Remove qualquer chave fora da allowlist e normaliza valores. */
function sanitize(params) {
  const out = {};
  Object.entries(params || {}).forEach(([k, v]) => {
    if (!ALLOWED_KEYS.has(k)) return;
    if (v === null || v === undefined) return;
    // valores só podem ser string curta ou número — nada de objetos/arrays
    if (typeof v === 'number') out[k] = v;
    else out[k] = String(v).slice(0, 40);
  });
  return out;
}

/**
 * Registra um evento. Nomenclatura: area_acao em snake_case.
 * Nunca lança — analytics quebrada jamais pode derrubar a aplicação.
 */
export function track(event, params) {
  const clean = sanitize(params);
  if (debug) console.info('[analytics]', event, clean);
  getAnalyticsSafe()
    .then(async (a) => {
      if (!a) return;
      const { logEvent } = await import('firebase/analytics');
      logEvent(a, event, clean);
    })
    .catch(() => { /* silencioso de propósito */ });
}
