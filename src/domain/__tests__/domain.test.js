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
  tripBounds,
  tripDayFlow,
  validateCityCoverage,
  cityColorIndex,
  nearestDayIndex,
  HOME,
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
import { ensureGenerated, deleteCityCascade, cloneTripState } from '../generate.js';
import { splitSummary, settlements, participants } from '../split.js';
import { pendingReminders } from '../../lib/reminders.js';
import { gmaps, getTransportCost, durationToMinutes, minutesToLabel } from '../transport.js';

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

/* ---------- ensureGenerated (Fase 4) ---------- */
describe('ensureGenerated', () => {
  it('NÃO pré-gera nada: o dia nasce sem refeição, atração ou despesa', () => {
    const state = normalizeState({
      cities: [{ id: 'a', city: 'Sevilha', start: '2026-04-01', end: '2026-04-03' }],
    });
    ensureGenerated(state);
    expect(state.foodItems.length).toBe(0);
    expect(state.attractions.length).toBe(0);
    expect(state.otherExpenses.length).toBe(0);
  });

  it('café da manhã cai nas manhãs seguintes: no check-out sim, no check-in não', () => {
    const state = normalizeState({
      cities: [{ id: 'a', city: 'Porto', start: '2026-05-01', end: '2026-05-03', hotel: 'Pousada', breakfastIncluded: true }],
    });
    ensureGenerated(state);
    const cafes = state.foodItems.filter((x) => x.autoBreakfast);
    const datas = cafes.map((x) => x.date).sort();
    expect(cafes.length).toBe(2);                  // uma manhã por noite dormida
    expect(datas).toEqual(['2026-05-02', '2026-05-03']);
    expect(datas).not.toContain('2026-05-01');     // check-in: chega e dorme, sem café
    expect(datas).toContain('2026-05-03');         // check-out: toma café antes de sair
    expect(cafes[0].place).toBe('Pousada');
  });

  it('café da manhã: remove ao desmarcar, mantém se editado', () => {
    const state = normalizeState({
      cities: [{ id: 'a', city: 'Porto', start: '2026-05-01', end: '2026-05-03', hotel: 'Pousada', breakfastIncluded: true }],
    });
    ensureGenerated(state);
    expect(state.foodItems.filter((x) => x.autoBreakfast).length).toBe(2);
    // usuário edita uma -> vira manual (autoBreakfast some)
    state.foodItems.find((x) => x.autoBreakfast).autoBreakfast = false;
    // desmarca o café da cidade
    state.cities[0].breakfastIncluded = false;
    ensureGenerated(state);
    // a não-editada foi removida; a editada permaneceu
    expect(state.foodItems.filter((x) => x.autoBreakfast).length).toBe(0);
    expect(state.foodItems.length).toBe(1);
  });

  it('cria 2 transportes de/para Casa com datas nas pontas da viagem', () => {
    const state = normalizeState({
      cities: [
        { id: 'a', city: 'Lisboa', start: '2026-06-01', end: '2026-06-04' },
        { id: 'b', city: 'Porto', start: '2026-06-04', end: '2026-06-07' },
      ],
    });
    ensureGenerated(state);
    const out = state.transports.find((x) => x.autoHome === 'out');
    const ret = state.transports.find((x) => x.autoHome === 'return');
    expect(out.originPlace).toBe(HOME);
    expect(out.date).toBe('2026-06-01');
    expect(out.destCity).toBe('Lisboa');
    expect(ret.destPlace).toBe(HOME);
    expect(ret.date).toBe('2026-06-07');
    expect(ret.originCity).toBe('Porto');
    // regenerar não duplica
    ensureGenerated(state);
    expect(state.transports.filter((x) => x.autoHome).length).toBe(2);
  });
});

/* ---------- Fase 4: fluxo de dia e validação de cobertura ---------- */
describe('tripBounds e tripDayFlow', () => {
  const state = normalizeState({
    cities: [
      { id: 'a', city: 'Lisboa', start: '2026-06-01', end: '2026-06-04' },
      { id: 'b', city: 'Porto', start: '2026-06-04', end: '2026-06-07' },
    ],
  });
  it('tripBounds acha primeiro/último dia e cidades', () => {
    const b = tripBounds(state);
    expect(b.firstDay).toBe('2026-06-01');
    expect(b.lastDay).toBe('2026-06-07');
    expect(b.firstCity.city).toBe('Lisboa');
    expect(b.lastCity.city).toBe('Porto');
  });
  it('primeiro dia vem de Casa; último dia vai para Casa', () => {
    expect(tripDayFlow(state, '2026-06-01')).toEqual({ from: HOME, to: 'Lisboa' });
    expect(tripDayFlow(state, '2026-06-07')).toEqual({ from: 'Porto', to: HOME });
  });
  it('dia de check-out/check-in mostra as duas cidades', () => {
    expect(tripDayFlow(state, '2026-06-04')).toEqual({ from: 'Lisboa', to: 'Porto' });
  });
  it('dia normal fica na mesma cidade', () => {
    expect(tripDayFlow(state, '2026-06-02')).toEqual({ from: 'Lisboa', to: 'Lisboa' });
  });
});

describe('validateCityCoverage', () => {
  it('não acusa nada em check-out/check-in no mesmo dia', () => {
    const state = normalizeState({
      cities: [
        { id: 'a', city: 'Lisboa', start: '2026-06-01', end: '2026-06-04' },
        { id: 'b', city: 'Porto', start: '2026-06-04', end: '2026-06-07' },
      ],
    });
    const r = validateCityCoverage(state);
    expect(r.overlaps.length).toBe(0);
    expect(r.gaps.length).toBe(0);
  });
  it('acusa buraco quando falta cidade num dia', () => {
    const state = normalizeState({
      cities: [
        { id: 'a', city: 'Lisboa', start: '2026-06-01', end: '2026-06-03' },
        { id: 'b', city: 'Porto', start: '2026-06-05', end: '2026-06-07' },
      ],
    });
    const r = validateCityCoverage(state);
    expect(r.gaps).toContain('2026-06-03');
    expect(r.gaps).toContain('2026-06-04');
  });
  it('acusa sobreposição real (duas cidades no mesmo dia)', () => {
    const state = normalizeState({
      cities: [
        { id: 'a', city: 'Lisboa', start: '2026-06-01', end: '2026-06-05' },
        { id: 'b', city: 'Porto', start: '2026-06-03', end: '2026-06-07' },
      ],
    });
    const r = validateCityCoverage(state);
    expect(r.overlaps.length).toBeGreaterThan(0);
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

/* ---------- Duração de transporte (horas/minutos) ---------- */
describe('duração de transporte', () => {
  it('durationToMinutes tolera formatos legados', () => {
    expect(durationToMinutes(150)).toBe(150);
    expect(durationToMinutes('2:30')).toBe(150);
    expect(durationToMinutes('2h30')).toBe(150);
    expect(durationToMinutes('2h 30min')).toBe(150);
    expect(durationToMinutes('1h')).toBe(60);
    expect(durationToMinutes('45min')).toBe(45);
    expect(durationToMinutes('')).toBe(0);
  });
  it('minutesToLabel formata curto', () => {
    expect(minutesToLabel(150)).toBe('2h30');
    expect(minutesToLabel(60)).toBe('1h');
    expect(minutesToLabel(45)).toBe('45min');
    expect(minutesToLabel(0)).toBe('');
  });
});
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

/* ---------- Cor por cidade (redesign: cor é informação, não decoração) ---------- */
describe('cityColorIndex', () => {
  it('mesma cidade sempre recebe a mesma cor', () => {
    expect(cityColorIndex('Lisboa')).toBe(cityColorIndex('Lisboa'));
    expect(cityColorIndex('lisboa')).toBe(cityColorIndex('  Lisboa  '));
  });
  it('devolve um índice válido de paleta', () => {
    const i = cityColorIndex('Porto');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(8);
  });
  it('Casa e vazio não recebem cor', () => {
    expect(cityColorIndex(HOME)).toBe(-1);
    expect(cityColorIndex('')).toBe(-1);
  });
});


/* ---------- T-C.1 / T-C.2: totais por status ---------- */
describe('expenseStatusTotals (T-C.1)', () => {
  const val = (rows, label) => rows.find((r) => r.label === label).value;

  it('INVARIANTE: soma dos status não-cancelados = total da viagem', () => {
    const state = normalizeState({
      cities: [
        { id: 'a', city: 'Lisboa', start: '2026-06-01', end: '2026-06-04', nightly: 100, status: 'Reservado' },
        { id: 'b', city: 'Porto', start: '2026-06-04', end: '2026-06-06', nightly: 200, status: 'Pago' },
      ],
      transports: [{ id: 't1', date: '2026-06-01', cost: 50, status: 'Pago' }],
      attractions: [{ id: 'x1', date: '2026-06-02', name: 'Museu', cost: 30, status: 'Planejado' }],
      otherExpenses: [{ id: 'o1', date: '2026-06-02', name: 'Táxi', cost: 20, status: 'Cancelado' }],
    });
    ensureGenerated(state);
    const rows = expenseStatusTotals(state);
    const soma = val(rows, 'Planejado') + val(rows, 'Reservado') + val(rows, 'Pago');
    expect(soma).toBe(totals(state).total);
  });

  it('hospedagem não é contada duas vezes quando as cidades se sobrepõem', () => {
    const state = normalizeState({
      cities: [
        { id: 'a', city: 'Lisboa', start: '2026-06-01', end: '2026-06-05', nightly: 100, status: 'Reservado' },
        { id: 'b', city: 'Porto', start: '2026-06-03', end: '2026-06-06', nightly: 100, status: 'Reservado' },
      ],
    });
    const rows = expenseStatusTotals(state);
    // 5 noites reais no período (01..05), não 4+3=7
    expect(val(rows, 'Reservado')).toBe(totals(state).lodging);
  });

  it('transporte com campo de custo legado (custo/valor) entra no status certo', () => {
    const state = normalizeState({
      cities: [{ id: 'a', city: 'Lisboa', start: '2026-06-01', end: '2026-06-02', nightly: 0, status: 'Planejado' }],
      transports: [{ id: 't1', date: '2026-06-01', custo: 90, status: 'Reservado' }],
    });
    const rows = expenseStatusTotals(state);
    expect(val(rows, 'Reservado')).toBe(90);
  });

  it('cada status devolve label, value e count (contrato que a tela consome)', () => {
    const rows = expenseStatusTotals(normalizeState({}));
    expect(rows.map((r) => r.label)).toEqual(['Planejado', 'Reservado', 'Pago', 'Cancelado']);
    rows.forEach((r) => {
      expect(typeof r.value).toBe('number');
      expect(typeof r.count).toBe('number');
    });
  });
});

describe('café da manhã automático herda o status da hospedagem (T-C.2)', () => {
  it('nasce com o status da cidade e acompanha a mudança', () => {
    const state = normalizeState({
      cities: [{ id: 'a', city: 'Porto', start: '2026-05-01', end: '2026-05-03', hotel: 'Pousada', nightly: 100, status: 'Reservado', breakfastIncluded: true }],
    });
    ensureGenerated(state);
    let cafes = state.foodItems.filter((x) => x.autoBreakfast);
    expect(cafes.length).toBe(2);
    cafes.forEach((c) => expect(c.status).toBe('Reservado'));

    state.cities[0].status = 'Pago';
    ensureGenerated(state);
    cafes = state.foodItems.filter((x) => x.autoBreakfast);
    cafes.forEach((c) => expect(c.status).toBe('Pago'));
  });

  it('café editado (manual) NÃO é mais afetado pelo status da cidade', () => {
    const state = normalizeState({
      cities: [{ id: 'a', city: 'Porto', start: '2026-05-01', end: '2026-05-03', hotel: 'Pousada', nightly: 100, status: 'Reservado', breakfastIncluded: true }],
    });
    ensureGenerated(state);
    const adotado = state.foodItems.find((x) => x.autoBreakfast);
    adotado.autoBreakfast = false;      // usuário editou -> virou manual
    adotado.status = 'Planejado';
    state.cities[0].status = 'Pago';
    ensureGenerated(state);
    expect(state.foodItems.find((x) => x.id === adotado.id).status).toBe('Planejado');
  });
});


/* ---------- T-1.15: dia inicial da tela Dias ---------- */
describe('nearestDayIndex', () => {
  const dates = [
    { date: '2026-06-01' }, { date: '2026-06-02' }, { date: '2026-06-03' },
  ];
  it('viagem em curso: vai para o dia de hoje', () => {
    expect(nearestDayIndex(dates, '2026-06-02')).toBe(1);
  });
  it('viagem futura: vai para o primeiro dia', () => {
    expect(nearestDayIndex(dates, '2026-01-01')).toBe(0);
  });
  it('viagem passada: vai para o último dia', () => {
    expect(nearestDayIndex(dates, '2027-01-01')).toBe(2);
  });
  it('lista vazia não quebra', () => {
    expect(nearestDayIndex([], '2026-06-02')).toBe(0);
  });
});


/* ---------- T-1.6: duplicar viagem ---------- */
describe('cloneTripState', () => {
  const base = () => normalizeState({
    cities: [{ id: 'a', city: 'Lisboa', start: '2026-06-01', end: '2026-06-04', nightly: 100, status: 'Reservado' }],
    attractions: [{ id: 'x1', date: '2026-06-02', name: 'Museu', cost: 30, status: 'Planejado' }],
    checklist: [{ id: 'c1', item: 'Passaporte', done: true, status: 'Concluído' }],
  });

  it('gera IDs novos (nada compartilhado com a original)', () => {
    const orig = base();
    const copy = cloneTripState(orig);
    expect(copy.cities[0].id).not.toBe(orig.cities[0].id);
    expect(copy.attractions[0].id).not.toBe(orig.attractions[0].id);
    expect(copy.checklist[0].id).not.toBe(orig.checklist[0].id);
  });

  it('preserva o conteúdo e as datas quando não há deslocamento', () => {
    const copy = cloneTripState(base());
    expect(copy.cities[0].city).toBe('Lisboa');
    expect(copy.cities[0].start).toBe('2026-06-01');
    expect(copy.attractions[0].name).toBe('Museu');
  });

  it('desloca todas as datas quando pedido', () => {
    const copy = cloneTripState(base(), { shiftDays: 30 });
    expect(copy.cities[0].start).toBe('2026-07-01');
    expect(copy.cities[0].end).toBe('2026-07-04');
    expect(copy.attractions[0].date).toBe('2026-07-02');
  });

  it('não altera o estado original', () => {
    const orig = base();
    const antes = JSON.stringify(orig);
    cloneTripState(orig, { shiftDays: 10 });
    expect(JSON.stringify(orig)).toBe(antes);
  });
});


/* ---------- T-1.7: divisão de despesas ---------- */
describe('splitSummary / settlements', () => {
  const state = () => normalizeState({
    settings: { travelers: 2, participants: ['Ana', 'Bruno'] },
    attractions: [
      { id: 'a1', date: '2026-06-02', name: 'Museu', cost: 100, status: 'Planejado', paidBy: 'Ana' },
      { id: 'a2', date: '2026-06-02', name: 'Passeio', cost: 60, status: 'Planejado', paidBy: 'Bruno' },
    ],
    otherExpenses: [
      { id: 'o1', date: '2026-06-02', name: 'Táxi', cost: 40, status: 'Planejado' }, // sem paidBy
      { id: 'o2', date: '2026-06-02', name: 'Cancelado', cost: 999, status: 'Cancelado', paidBy: 'Ana' },
    ],
  });

  it('usa os participantes cadastrados', () => {
    expect(participants(state())).toEqual(['Ana', 'Bruno']);
  });

  it('cai em rótulos genéricos quando não há participantes cadastrados', () => {
    const s = normalizeState({ settings: { travelers: 3 } });
    expect(participants(s)).toEqual(['Viajante 1', 'Viajante 2', 'Viajante 3']);
  });

  it('ignora itens cancelados (mesma regra do resto do app)', () => {
    const r = splitSummary(state());
    expect(r.total).toBe(200); // 100 + 60 + 40, sem os 999 cancelados
  });

  it('separa o que já tem pagador do que ainda não tem', () => {
    const r = splitSummary(state());
    expect(r.unassigned).toBe(40);
    expect(r.rows.find((x) => x.person === 'Ana').paid).toBe(100);
    expect(r.rows.find((x) => x.person === 'Bruno').paid).toBe(60);
  });

  it('calcula o saldo de cada um (pago − devido)', () => {
    const r = splitSummary(state());
    expect(r.share).toBe(100);   // 200 / 2
    expect(r.rows.find((x) => x.person === 'Ana').balance).toBe(0);
    expect(r.rows.find((x) => x.person === 'Bruno').balance).toBe(-40);
  });

  it('inclui a hospedagem no total do grupo como não atribuída', () => {
    const r = splitSummary(state(), 300);
    expect(r.total).toBe(500);
    expect(r.unassigned).toBe(340);
  });

  it('acerto: quem deve paga a quem tem a receber', () => {
    const s = normalizeState({
      settings: { participants: ['Ana', 'Bruno'] },
      attractions: [{ id: 'a1', date: '2026-06-02', name: 'Tudo', cost: 200, status: 'Planejado', paidBy: 'Ana' }],
    });
    const acertos = settlements(splitSummary(s));
    expect(acertos).toEqual([{ from: 'Bruno', to: 'Ana', valor: 100 }]);
  });

  it('sem dívidas, não gera acerto', () => {
    const s = normalizeState({
      settings: { participants: ['Ana', 'Bruno'] },
      attractions: [
        { id: 'a1', date: '2026-06-02', name: 'X', cost: 50, status: 'Planejado', paidBy: 'Ana' },
        { id: 'a2', date: '2026-06-02', name: 'Y', cost: 50, status: 'Planejado', paidBy: 'Bruno' },
      ],
    });
    expect(settlements(splitSummary(s))).toEqual([]);
  });
});


/* ---------- T-1.11: lembretes locais ---------- */
describe('pendingReminders', () => {
  it('avisa de check-in e check-out de amanhã', () => {
    const state = normalizeState({
      cities: [
        { id: 'a', city: 'Lisboa', start: '2026-06-02', end: '2026-06-05' },
        { id: 'b', city: 'Porto', start: '2026-06-05', end: '2026-06-08' },
      ],
    });
    const r = pendingReminders(state, '2026-06-01');
    expect(r.some((x) => x.texto.includes('Check-in amanhã em Lisboa'))).toBe(true);
  });

  it('avisa de itens não pagos para amanhã', () => {
    const state = normalizeState({
      cities: [{ id: 'a', city: 'Lisboa', start: '2026-06-01', end: '2026-06-05' }],
      attractions: [{ id: 'x', date: '2026-06-02', name: 'Museu', cost: 50, status: 'Reservado' }],
    });
    const r = pendingReminders(state, '2026-06-01');
    expect(r.some((x) => x.texto.includes('não pago'))).toBe(true);
  });

  it('não avisa de item já pago nem cancelado', () => {
    const state = normalizeState({
      cities: [{ id: 'a', city: 'Lisboa', start: '2026-06-01', end: '2026-06-05' }],
      attractions: [
        { id: 'x', date: '2026-06-02', name: 'Pago', cost: 50, status: 'Pago' },
        { id: 'y', date: '2026-06-02', name: 'Cancelado', cost: 50, status: 'Cancelado' },
      ],
    });
    expect(pendingReminders(state, '2026-06-01').length).toBe(0);
  });
});


/* ---------- Dias de planejamento incluem o dia de volta para Casa ---------- */
describe('allPlanningDates após ensureGenerated', () => {
  it('inclui o dia do check-out, por causa do transporte de volta para Casa', () => {
    const state = normalizeState({
      cities: [{ id: 'a', city: 'Lisboa', start: '2030-06-01', end: '2030-06-04' }],
    });
    // sem geração automática: só as noites dormidas
    expect(allPlanningDates(state).map((d) => d.date)).toEqual([
      '2030-06-01', '2030-06-02', '2030-06-03',
    ]);

    ensureGenerated(state);
    // com geração: o transporte automático de volta cai no check-out, e aquele
    // dia passa a fazer parte da viagem (comportamento da Fase 4, item 4.5/4.6)
    expect(allPlanningDates(state).map((d) => d.date)).toEqual([
      '2030-06-01', '2030-06-02', '2030-06-03', '2030-06-04',
    ]);
  });
});
