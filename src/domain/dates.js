// domain/dates.js
// Lógica de datas, cidades e derivação de roteiro portada do Index.html.
// Estas funções são puras: recebem `state` como argumento em vez de ler uma
// variável global. Isso as torna testáveis e reutilizáveis nos componentes.

import { getTransportDate, getTransportDestCity, getTransportOriginCity, getTransportDest, getTransportOrigin } from './transport.js';

/** Nº de noites entre duas datas ISO (nunca negativo). */
export function daysBetween(a, b) {
  if (!a || !b) return 0;
  const diff = Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 86400000);
  return Math.max(0, diff);
}

/** Soma `days` a uma data ISO, retornando nova data ISO. */
export function addDaysISO(date, days) {
  const d = new Date(date + 'T00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Classifica um horário "HH:MM" em período do dia. */
export function periodByTime(t) {
  const h = Number((t || '00:00').slice(0, 2));
  if (h >= 5 && h < 12) return 'Manhã';
  if (h >= 12 && h < 14) return 'Almoço';
  if (h >= 14 && h < 18) return 'Tarde';
  if (h >= 18 && h < 21) return 'Jantar';
  return 'Noite';
}

/** Ordem canônica das refeições (para ordenar a tabela de alimentação). */
export function foodOrder(t) {
  const v = String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  return { 'cafe da manha': 1, almoco: 2, jantar: 3, mercado: 4, outros: 5, outro: 5 }[v] || 99;
}

/** Lista de datas (uma por noite) geradas a partir dos check-in/check-out. */
export function datesFromCities(state) {
  const arr = [];
  state.cities.forEach((c) => {
    if (!c.start || !c.end) return;
    const s = new Date(c.start + 'T00:00');
    const e = new Date(c.end + 'T00:00');
    for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) {
      arr.push({ date: d.toISOString().slice(0, 10), city: c.city });
    }
  });
  return arr.sort((a, b) => a.date.localeCompare(b.date));
}

/** Cidade cujo intervalo [start, end) contém a data. */
export function cityForDate(state, date) {
  const c = state.cities.find((x) => date >= x.start && date < x.end);
  return c ? c.city : '';
}

/** Registro de cidade para a data, incluindo fallback para o dia de check-out. */
export function cityRecordForDate(state, date) {
  if (!date) return null;
  const strict = state.cities.find((c) => date >= c.start && date < c.end);
  if (strict) return strict;
  const checkout = state.cities
    .slice()
    .sort((a, b) => (b.end || '').localeCompare(a.end || ''))
    .find((c) => date === c.end);
  return checkout || null;
}

/** Melhor palpite de cidade para uma data, cruzando todas as fontes. */
export function inferCityForDate(state, date) {
  const c = cityRecordForDate(state, date);
  if (c && c.city) return c.city;
  const item =
    state.foodItems.find((x) => x.date === date && x.city) ||
    state.attractions.find((x) => x.date === date && x.city) ||
    state.otherExpenses.find((x) => x.date === date && x.city);
  if (item && item.city) return item.city;
  const tr = state.transports.find((x) => getTransportDate(x) === date);
  if (tr)
    return (
      getTransportDestCity(tr) ||
      getTransportOriginCity(tr) ||
      getTransportDest(tr) ||
      getTransportOrigin(tr) ||
      ''
    );
  return '';
}

/** Lista de nomes únicos de cidades cadastradas (sem vazios). */
export function uniqueCities(state) {
  return [...new Set(state.cities.map((c) => c.city).filter(Boolean).map((c) => c.trim()))];
}

/**
 * Todas as datas relevantes do planejamento, cruzando cidades + itens soltos
 * (alimentação/atrações/outros/transporte podem ter datas fora dos intervalos).
 */
export function allPlanningDates(state) {
  const map = new Map();
  datesFromCities(state).forEach((d) => map.set(d.date, d.city));
  [...state.foodItems, ...state.attractions, ...state.otherExpenses].forEach((x) => {
    if (x.date && !map.has(x.date)) map.set(x.date, x.city || inferCityForDate(state, x.date) || '');
  });
  state.transports.forEach((x) => {
    const d = getTransportDate(x);
    if (d && !map.has(d))
      map.set(d, inferCityForDate(state, d) || getTransportDest(x) || getTransportOrigin(x) || '');
  });
  return [...map.entries()]
    .map(([date, city]) => ({ date, city: city || inferCityForDate(state, date) || '' }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Cidade(s) com maior nº de noites (empate → várias). */
export function mainCities(state) {
  let max = 0;
  let names = [];
  state.cities.forEach((c) => {
    const d = daysBetween(c.start, c.end);
    if (d > max) {
      max = d;
      names = [c.city];
    } else if (d === max && d > 0 && !names.includes(c.city)) {
      names.push(c.city);
    }
  });
  return names.filter(Boolean);
}

/** Título automático derivado das cidades principais. */
export function autoTitle(state) {
  const names = mainCities(state);
  return names.length ? 'Planejamento da Viagem - ' + names.join(', ') : 'Planejamento da Viagem';
}

/** Dias do mini calendário de uma cidade (números de dia formatados). */
export function calendarDays(c) {
  const arr = [];
  if (!c.start || !c.end) return arr;
  const s = new Date(c.start + 'T00:00');
  const e = new Date(c.end + 'T00:00');
  for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) {
    arr.push(String(d.getDate()).padStart(2, '0'));
  }
  return arr;
}
