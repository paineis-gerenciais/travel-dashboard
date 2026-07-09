// __tests__/domain.test.js
// Testes que validam o porte da lógica de domínio do dashboard Apps Script.
// Cada bloco corresponde a uma regra que já foi validada (ou corrigida como
// bug) no app original. Se algum destes quebrar, o porte divergiu do original.

import { describe, it, expect } from 'vitest';
import { num, money, fmtDate } from '../format.js';
import { blankState, normalizeState } from '../state.js';
import {
  daysBetween,
  addDaysISO,
  periodByTime,
  datesFromCities,
  cityForDate,
  inferCityForDate,
  allPlanningDates,
  mainCities,
  autoTitle,
  uniqueCities,
} from '../dates.js';
import {
  isCanceled,
  activeCost,
  totals,
  dayTotal,
  checklistStats,
  expenseStatusTotals,
  costRowsByView,
  paidPct,
} from '../costs.js';
import { ensureGenerated, deleteCityCascade } from '../generate.js';
import { gmaps, getTransportCost } from '../transport.js';

/* ---------- Formatação e parsing ---------- */
describe('format', () => {
  it('num aceita formato BR e nunca é negativo', () => {
    expect(num('1.234,56')).toBeCloseTo(1234.56);
    expect(num('R$ 2.000,00')).toBeCloseTo(2000);
    expect(num('-50')).toBe(0); // nunca negativo
    expect(num('abc')).toBe(0);
    expect(num(undefined)).toBe(0);
  });
  it('money formata em R$ pt-BR', () => {
    expect(money(1234.5)).toBe('R$ 1.234,50');
    expect(money(0)).toBe('R$ 0,00');
  });
  it('fmtDate converte ISO para dd/mm/aaaa', () => {
    expect(fmtDate('2026-03-15')).toBe('15/03/2026');
    expect(fmtDate('')).toBe('');
  });
});

/* ---------- Datas ---------- */
describe('datas', () => {
  it('daysBetween conta noites e nunca é negativo', () => {
    expect(daysBetween('2026-03-01', '2026-03-04')).toBe(3);
    expect(daysBetween('2026-03-04', '2026-03-01')).toBe(0);
    expect(daysBetween('', '2026-03-04')).toBe(0);
  });
  it('addDaysISO soma dias', () => {
    expect(addDaysISO('2026-03-01', 1)).toBe('2026-03-02');
    expect(addDaysISO('2026-03-31', 1)).toBe('2026-04-01');
  });
  it('periodByTime classifica corretamente', () => {
    expect(periodByTime('08:00')).toBe('Manhã');
    expect(periodByTime('12:30')).toBe('Almoço');
    expect(periodByTime('15:00')).toBe('Tarde');
    expect(periodByTime('19:00')).toBe('Jantar');
    expect(periodByTime('23:00')).toBe('Noite');
  });
});

/* ---------- Geração de datas a partir de cidades ---------- */
describe('datesFromCities e cidade por data', () => {
  const state = normalizeState({
    cities: [
      { id: 'a', city: 'Lisboa', start: '2026-03-01', end: '2026-03-04' },
      { id: 'b', city: 'Porto', start: '2026-03-04', end: '2026-03-06' },
    ],
  });
  it('gera uma data por noite, ordenadas', () => {
    const d = datesFromCities(state).map((x) => x.date);
    expect(d).toEqual(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05']);
  });
  it('cityForDate usa intervalo [start, end)', () => {
    expect(cityForDate(state, '2026-03-01')).toBe('Lisboa');
    expect(cityForDate(state, '2026-03-04')).toBe('Porto'); // check-out de Lisboa = check-in de Porto
    expect(cityForDate(state, '2026-03-10')).toBe('');
  });
  it('uniqueCities e mainCities', () => {
    expect(uniqueCities(state)).toEqual(['Lisboa', 'Porto']);
    expect(mainCities(state)).toEqual(['Lisboa']); // 3 noites > 2 noites
    expect(autoTitle(state)).toBe('Planejamento da Viagem - Lisboa');
  });
});

/* ---------- Regra do cancelado (a mais importante) ---------- */
describe('itens cancelados não entram no total', () => {
  it('activeCost zera cancelados', () => {
    expect(activeCost({ cost: 100, status: 'Pago' })).toBe(100);
    expect(activeCost({ cost: 100, status: 'Cancelado' })).toBe(0);
    expect(isCanceled({ status: 'cancelado' })).toBe(true); // case-insensitive
  });
  it('totals exclui cancelados mas expenseStatusTotals os mostra', () => {
    const state = normalizeState({
      cities: [{ id: 'a', city: 'Roma', start: '2026-05-01', end: '2026-05-03', nightly: 200, status: 'Pago' }],
      attractions: [
        { id: 'x', date: '2026-05-01', cost: 50, status: 'Pago' },
        { id: 'y', date: '2026-05-01', cost: 999, status: 'Cancelado' },
      ],
    });
    const t = totals(state);
    expect(t.lodging).toBe(400); // 2 noites * 200
    expect(t.att).toBe(50); // cancelado (999) NÃO entra
    expect(t.total).toBe(450);

    const status = expenseStatusTotals(state);
    const cancelado = status.find((s) => s.label === 'Cancelado');
    expect(cancelado.value).toBe(999); // aparece no painel de status
  });
});

/* ---------- Totais por dia e por visão ---------- */
describe('custos por dia e por visão', () => {
  const state = normalizeState({
    cities: [{ id: 'a', city: 'Nice', start: '2026-06-01', end: '2026-06-03', nightly: 100, status: 'Planejado' }],
    foodItems: [{ id: 'f', date: '2026-06-01', cost: 30, status: 'Planejado' }],
    transports: [{ id: 't', date: '2026-06-01', cost: 60, status: 'Planejado' }],
  });
  it('dayTotal soma hospedagem + comida + transporte do dia', () => {
    expect(dayTotal(state, '2026-06-01')).toBe(190); // 100 + 30 + 60
    expect(dayTotal(state, '2026-06-02')).toBe(100); // só hospedagem
  });
  it('costRowsByView por categoria', () => {
    const t = totals(state);
    const rows = costRowsByView(state, 'categoria', t);
    expect(rows.find((r) => r.name === 'Hospedagem').value).toBe(200);
    expect(rows.find((r) => r.name === 'Alimentação').value).toBe(30);
    expect(rows.find((r) => r.name === 'Transporte').value).toBe(60);
  });
});

/* ---------- Checklist ---------- */
describe('checklistStats', () => {
  it('conta concluídos por done OU status, ignora cancelados no ativo', () => {
    const state = normalizeState({
      checklist: [
        { id: '1', status: 'Concluído', done: true },
        { id: '2', status: 'Pendente', done: false },
        { id: '3', status: 'Cancelado', done: false },
      ],
    });
    const cs = checklistStats(state);
    expect(cs.total).toBe(3);
    expect(cs.active).toBe(2); // cancelado fora
    expect(cs.done).toBe(1);
    expect(cs.pct).toBe(50);
  });
});

/* ---------- ensureGenerated ---------- */
describe('ensureGenerated', () => {
  it('gera 5 refeições + 1 atração + 1 outra por data nova, sem duplicar', () => {
    const state = normalizeState({
      cities: [{ id: 'a', city: 'Sevilha', start: '2026-04-01', end: '2026-04-03' }],
    });
    ensureGenerated(state);
    // 2 datas * 5 refeições
    expect(state.foodItems.length).toBe(10);
    expect(state.attractions.length).toBe(2);
    expect(state.otherExpenses.length).toBe(2);
    // rodar de novo não duplica
    ensureGenerated(state);
    expect(state.foodItems.length).toBe(10);
  });
});

/* ---------- Exclusão em cascata (bug corrigido no original) ---------- */
describe('deleteCityCascade', () => {
  it('sem removeRelated, remove só a cidade', () => {
    const state = normalizeState({
      cities: [{ id: 'a', city: 'Kyoto', start: '2026-07-01', end: '2026-07-03' }],
      foodItems: [{ id: 'f', date: '2026-07-01', city: 'Kyoto', cost: 10 }],
    });
    deleteCityCascade(state, 0, false);
    expect(state.cities.length).toBe(0);
    expect(state.foodItems.length).toBe(1); // preservado
  });
  it('com removeRelated, remove itens ligados pela cidade e transportes no intervalo', () => {
    const state = normalizeState({
      cities: [{ id: 'a', city: 'Kyoto', start: '2026-07-01', end: '2026-07-03' }],
      foodItems: [
        { id: 'f1', date: '2026-07-01', city: 'Kyoto', cost: 10 },
        { id: 'f2', date: '2026-07-01', city: 'Osaka', cost: 10 },
      ],
      transports: [{ id: 't', date: '2026-07-01', originCity: 'Kyoto', destCity: 'Osaka', cost: 50 }],
    });
    deleteCityCascade(state, 0, true);
    expect(state.foodItems.map((x) => x.city)).toEqual(['Osaka']); // Kyoto removido
    expect(state.transports.length).toBe(0); // transporte de/para Kyoto removido
  });
});

/* ---------- gmaps (regra de ouro: concatenação) ---------- */
describe('gmaps', () => {
  it('1 ponto → busca simples', () => {
    expect(gmaps(['Lisboa'])).toContain('/maps/search/?api=1&query=Lisboa');
  });
  it('2+ pontos → rota com origin/destination e waypoints', () => {
    const url = gmaps(['A', 'B', 'C']);
    expect(url).toContain('origin=A');
    expect(url).toContain('destination=C');
    expect(url).toContain('waypoints=B');
  });
});

/* ---------- normalizeState / blankState ---------- */
describe('normalizeState', () => {
  it('preenche arrays faltantes e mescla settings', () => {
    const s = normalizeState({ cities: [{ id: 'a' }], settings: { travelers: 4 } });
    expect(Array.isArray(s.transports)).toBe(true);
    expect(s.settings.travelers).toBe(4);
    expect(s.settings.costView).toBe('categoria'); // default preservado
  });
  it('blankState tem a forma esperada', () => {
    const b = blankState();
    expect(b.cities).toEqual([]);
    expect(b.settings.travelers).toBe(2);
  });
});

/* ---------- allPlanningDates e inferCityForDate ---------- */
describe('allPlanningDates cruza fontes', () => {
  it('inclui datas de itens fora dos intervalos de cidade', () => {
    const state = normalizeState({
      cities: [{ id: 'a', city: 'Praga', start: '2026-08-01', end: '2026-08-02' }],
      otherExpenses: [{ id: 'o', date: '2026-08-05', city: 'Viena', cost: 20 }],
    });
    const dates = allPlanningDates(state).map((d) => d.date);
    expect(dates).toContain('2026-08-01');
    expect(dates).toContain('2026-08-05'); // data solta incluída
    expect(inferCityForDate(state, '2026-08-05')).toBe('Viena');
  });
});
