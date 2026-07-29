// domain/costs.js
// Cálculos de custo, status e checklist portados do Index.html.
// Regra central herdada: itens com status "Cancelado" NUNCA entram no total
// geral, mas aparecem no gráfico de status para controle.

import { num } from './format.js';
import { daysBetween, datesFromCities, allPlanningDates, inferCityForDate } from './dates.js';
import { getTransportDate, getTransportCost, getTransportDest, getTransportOrigin } from './transport.js';
import { fmtDate } from './format.js';

export function isCanceled(x) {
  return String(x.status || '').toLowerCase() === 'cancelado';
}

/** Custo que conta para o total: 0 se cancelado, senão o valor numérico. */
export function activeCost(x) {
  return isCanceled(x) ? 0 : num(x.cost);
}

/* ----- Agregações por dia ----- */

export function dayLodging(state, date) {
  const c = state.cities.find((c) => date >= c.start && date < c.end);
  return c && c.status !== 'Cancelado' ? num(c.nightly) : 0;
}
export function dayFood(state, date) {
  return state.foodItems.filter((x) => x.date === date).reduce((s, x) => s + activeCost(x), 0);
}
export function dayAttractions(state, date) {
  return state.attractions.filter((x) => x.date === date).reduce((s, x) => s + activeCost(x), 0);
}
export function dayTransport(state, date) {
  return state.transports
    .filter((x) => getTransportDate(x) === date)
    .reduce((s, x) => s + (isCanceled(x) ? 0 : getTransportCost(x)), 0);
}
export function dayOther(state, date) {
  return state.otherExpenses.filter((x) => x.date === date).reduce((s, x) => s + activeCost(x), 0);
}
export function dayTotal(state, date) {
  return (
    dayLodging(state, date) +
    dayFood(state, date) +
    dayAttractions(state, date) +
    dayTransport(state, date) +
    dayOther(state, date)
  );
}

/** Totais por categoria + total geral (cancelados já excluídos). */
export function totals(state) {
  const lodging = datesFromCities(state).reduce((s, d) => s + dayLodging(state, d.date), 0);
  const food = state.foodItems.reduce((s, x) => s + activeCost(x), 0);
  const att = state.attractions.reduce((s, x) => s + activeCost(x), 0);
  const trans = state.transports.reduce((s, x) => s + (isCanceled(x) ? 0 : getTransportCost(x)), 0);
  const other = state.otherExpenses.reduce((s, x) => s + activeCost(x), 0);
  return { lodging, food, att, trans, other, total: lodging + food + att + trans + other };
}

/** Estatísticas do checklist (concluídos/pendentes/percentual). */
export function checklistStats(state) {
  const active = state.checklist.filter((x) => x.status !== 'Cancelado');
  const done = active.filter((x) => x.done || x.status === 'Concluído').length;
  return {
    total: state.checklist.length,
    active: active.length,
    done,
    pending: active.length - done,
    pct: active.length ? Math.round((done / active.length) * 100) : 0,
  };
}

/** Percentual de itens com custo já marcados como "Pago". */
export function paidPct(state) {
  const items = [
    ...state.transports,
    ...state.foodItems,
    ...state.attractions,
    ...state.otherExpenses,
  ];
  const active = items.filter((x) => !isCanceled(x));
  return active.length
    ? Math.round((active.filter((x) => x.status === 'Pago').length / active.length) * 100)
    : 0;
}

/**
 * Totais por status de gasto (Planejado/Reservado/Pago/Cancelado), com valor,
 * contagem e percentual. Inclui cancelados de propósito (é o painel de
 * controle onde eles aparecem).
 */
export function expenseStatusTotals(state) {
  const labels = ['Planejado', 'Reservado', 'Pago', 'Cancelado'];
  const values = Object.fromEntries(labels.map((l) => [l, 0]));
  const counts = Object.fromEntries(labels.map((l) => [l, 0]));
  function normStatus(s) {
    s = String(s || 'Planejado');
    return labels.includes(s) ? s : 'Planejado';
  }
  function add(status, value) {
    const st = normStatus(status);
    values[st] += num(value);
    counts[st] += 1;
  }
  // HOSPEDAGEM — T-C.1, causa-raiz nº1 do bug do "Reservado".
  // Antes: daysBetween(c.start, c.end) * nightly, cidade a cidade. Isso DIVERGIA
  // de totals(), que conta uma diária por DATA de planejamento, atribuída à
  // cidade que cobre aquela data. Com cidades sobrepostas (o app avisa, mas
  // permite), a diária era contada duas vezes aqui e uma só no total — inflando
  // o status da(s) cidade(s) envolvida(s). Agora usamos a MESMA fonte de
  // verdade do totals(), então os dois não podem mais divergir.
  const nightsByCity = new Map();
  datesFromCities(state).forEach(({ date }) => {
    const c = state.cities.find((x) => date >= x.start && date < x.end);
    if (c) nightsByCity.set(c.id, (nightsByCity.get(c.id) || 0) + 1);
  });
  state.cities.forEach((c) => {
    const nights = nightsByCity.get(c.id) || 0;
    if (nights > 0) add(c.status, nights * num(c.nightly));
  });

  // TRANSPORTE — T-C.1, causa-raiz nº2.
  // Antes lia num(x.cost) direto; totals() usa getTransportCost(), que também
  // entende os nomes de campo legados (custo/valor) vindos da versão Apps
  // Script. Transportes importados apareciam como 0 aqui e com valor no total.
  state.transports.forEach((x) => add(x.status, getTransportCost(x)));

  [...state.foodItems, ...state.attractions, ...state.otherExpenses].forEach(
    (x) => add(x.status, num(x.cost))
  );
  const total = labels.reduce((sum, l) => sum + values[l], 0);
  return labels.map((l) => ({
    label: l,
    value: values[l],
    count: counts[l],
    pct: total ? (values[l] / total) * 100 : 0,
  }));
}

/** Linhas da tabela de custos conforme a visão (categoria/cidade/dia). */
export function costRowsByView(state, view, t, dates) {
  dates = dates || allPlanningDates(state);
  if (view === 'cidade') {
    const map = {};
    dates.forEach((d) => {
      const city = d.city || inferCityForDate(state, d.date) || 'Sem cidade';
      map[city] =
        (map[city] || 0) +
        dayLodging(state, d.date) +
        dayFood(state, d.date) +
        dayAttractions(state, d.date) +
        dayOther(state, d.date);
    });
    state.transports.forEach((x) => {
      if (isCanceled(x)) return;
      const d = getTransportDate(x);
      const city =
        inferCityForDate(state, d) || getTransportDest(x) || getTransportOrigin(x) || 'Sem cidade';
      map[city] = (map[city] || 0) + getTransportCost(x);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }
  if (view === 'dia') {
    return dates
      .map((d) => ({
        name: fmtDate(d.date) + ' — ' + (d.city || inferCityForDate(state, d.date) || ''),
        value: dayTotal(state, d.date),
      }))
      .filter((r) => num(r.value) > 0 || r.name.trim());
  }
  return [
    { name: 'Hospedagem', value: t.lodging, cls: 'c1' },
    { name: 'Alimentação', value: t.food, cls: 'c2' },
    { name: 'Atrações', value: t.att, cls: 'c3' },
    { name: 'Transporte', value: t.trans, cls: 'c4' },
    { name: 'Outros', value: t.other, cls: 'c5' },
  ];
}

/** Paleta fixa de cores para gráficos (mesma do app original). */
export function palette(i) {
  return [
    '#2563eb',
    '#10b981',
    '#f59e0b',
    '#7c3aed',
    '#ef4444',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#a855f7',
    '#14b8a6',
  ][i % 10];
}
