// lib/logger.js — log de erros estruturado (Fase 3, item 3.7).
// Substitui o "print de console do Apps Script" por um registro client-side:
// mantém os últimos erros em memória (e no console), sem criar coleção nova no
// Firestore (respeita o critério de aceite: não mexer no modelo de dados).

const MAX = 50;
const entries = [];
const listeners = new Set();

function emit() { listeners.forEach((fn) => fn([...entries])); }

export function logError(context, error) {
  const entry = {
    time: new Date().toISOString(),
    context: String(context || ''),
    message: error?.message || String(error),
    stack: error?.stack || '',
  };
  entries.unshift(entry);
  if (entries.length > MAX) entries.length = MAX;
  // eslint-disable-next-line no-console
  console.error(`[${entry.context}]`, error);
  emit();
}

export function getErrors() { return [...entries]; }
export function subscribeErrors(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function clearErrors() { entries.length = 0; emit(); }

// Captura erros globais e promessas rejeitadas não tratadas.
export function installGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => logError('window.error', e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => logError('unhandledrejection', e.reason));
}
