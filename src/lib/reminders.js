// lib/reminders.js — T-1.11. Lembretes LOCAIS (não push).
//
// Limitação conhecida e documentada de propósito: isto usa a Notification API
// do navegador, que dispara enquanto o app está aberto (ou pouco depois). NÃO é
// push de servidor — push real exige back-end (Cloud Functions + FCM) e está na
// Fase 2 (bloco 5.A). No iOS, notificação em PWA só funciona a partir do iOS
// 16.4 E com o app instalado na tela inicial; no Safari em aba comum, não
// funciona. Por isso tudo aqui degrada em silêncio em vez de dar erro.
import { addDaysISO } from '../domain/dates.js';
import { num } from '../domain/format.js';

const KEY = 'trip_reminders_on';

export function remindersEnabled() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
export function setRemindersEnabled(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission() {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

/** Pede permissão — chamar só quando a pessoa ATIVA os lembretes, nunca de surpresa. */
export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

/**
 * Calcula os lembretes pertinentes para hoje, a partir do estado da viagem.
 * Função pura de propósito: fácil de testar e de reaproveitar quando houver
 * push de verdade na Fase 2.
 */
export function pendingReminders(state, todayISO) {
  const out = [];
  const amanha = addDaysISO(todayISO, 1);

  state.cities.forEach((c) => {
    if (c.start === amanha) out.push({ id: `checkin:${c.id}`, texto: `Check-in amanhã em ${c.city}` });
    if (c.end === amanha) out.push({ id: `checkout:${c.id}`, texto: `Check-out amanhã em ${c.city}` });
  });

  const naoPagos = [
    ...state.transports.filter((x) => x.date === amanha),
    ...state.attractions.filter((x) => x.date === amanha),
  ].filter((x) => num(x.cost) > 0 && x.status !== 'Pago' && x.status !== 'Cancelado');

  if (naoPagos.length > 0) {
    out.push({
      id: `pendencias:${amanha}`,
      texto: `${naoPagos.length} ${naoPagos.length === 1 ? 'item ainda não pago' : 'itens ainda não pagos'} para amanhã`,
    });
  }

  return out;
}

/** Dispara os lembretes ainda não mostrados hoje (evita repetir a cada abertura). */
export function fireReminders(list, tripName) {
  if (!remindersEnabled() || notificationPermission() !== 'granted') return 0;
  const hojeKey = 'trip_reminders_shown_' + new Date().toDateString();
  let shown = [];
  try { shown = JSON.parse(localStorage.getItem(hojeKey) || '[]'); } catch { shown = []; }

  let count = 0;
  list.forEach((r) => {
    if (shown.includes(r.id)) return;
    try {
      new Notification(tripName || 'Plano de viagem', { body: r.texto, tag: r.id });
      shown.push(r.id);
      count += 1;
    } catch { /* navegador recusou — silencioso */ }
  });

  try { localStorage.setItem(hojeKey, JSON.stringify(shown)); } catch { /* ignore */ }
  return count;
}
