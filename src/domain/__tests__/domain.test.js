// __tests__/domain.test.js
// Testes que validam o porte da lógica de domínio do dashboard Apps Script.
// Cada bloco corresponde a uma regra que já foi validada (ou corrigida como
// bug) no app original. Se algum destes quebrar, o porte divergiu do original.

import { describe, it, expect } from 'vitest';
import { num, money, fmtDate } from '../format.js';
import { isValidLink, normalizeLinkInput, linkLabel, collectLinks, countLinks } from '../links.js';
import { quoteForTrip } from '../../lib/quotes.js';
import {
  ESQUEMA, kindPorAba, parseDataCelula, validarAba, mesclarPlanilha, linhasDe, planilhaDe,
} from '../sheet.js';
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
import {
  splitSummary, settlements, participants, participantName,
  allCostRows, effectiveSplit, rowsForParticipant,
  settlementKey, withSettlementStatus,
} from '../split.js';
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

  it('NÃO cria transportes automáticos de/para Casa', () => {
    const state = normalizeState({
      cities: [
        { id: 'a', city: 'Lisboa', start: '2026-06-01', end: '2026-06-04' },
        { id: 'b', city: 'Porto', start: '2026-06-04', end: '2026-06-07' },
      ],
    });
    ensureGenerated(state);
    expect(state.transports.length).toBe(0);
  });

  it('MIGRAÇÃO: remove transportes automáticos antigos e intocados', () => {
    const state = normalizeState({
      cities: [{ id: 'a', city: 'Lisboa', start: '2026-06-01', end: '2026-06-04' }],
      transports: [
        { id: 't1', autoHome: 'out', date: '2026-06-01', originPlace: 'Casa', destCity: 'Lisboa', mode: '', cost: 0 },
        { id: 't2', autoHome: 'return', date: '2026-06-04', originCity: 'Lisboa', destPlace: 'Casa', mode: '', cost: 0 },
      ],
    });
    ensureGenerated(state);
    expect(state.transports.length).toBe(0);
  });

  it('MIGRAÇÃO: preserva o transporte automático que o usuário EDITOU', () => {
    const state = normalizeState({
      cities: [{ id: 'a', city: 'Lisboa', start: '2026-06-01', end: '2026-06-04' }],
      transports: [
        { id: 't1', autoHome: 'out', date: '2026-06-01', originPlace: 'Casa', destCity: 'Lisboa', mode: 'Voo', cost: 620 },
        { id: 't2', autoHome: 'return', date: '2026-06-04', originCity: 'Lisboa', destPlace: 'Casa', mode: '', cost: 0 },
      ],
    });
    ensureGenerated(state);
    expect(state.transports.length).toBe(1);
    expect(state.transports[0].id).toBe('t1');
    expect(state.transports[0].autoHome).toBeUndefined(); // virou manual
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


/* ---------- Divisão de despesas: ids, percentuais e hospedagem ---------- */
describe('divisão de despesas', () => {
  const ANA = 'p-ana';
  const BRU = 'p-bru';

  const base = (extra = {}) => normalizeState({
    settings: { participants: [{ id: ANA, name: 'Ana' }, { id: BRU, name: 'Bruno' }] },
    cities: [{ id: 'c1', city: 'Lisboa', start: '2026-06-01', end: '2026-06-03', nightly: 100, status: 'Reservado' }],
    attractions: [{ id: 'a1', date: '2026-06-02', name: 'Museu', cost: 100, status: 'Planejado', paidBy: ANA }],
    ...extra,
  });

  it('participantes vêm com id e nome', () => {
    expect(participants(base())).toEqual([{ id: ANA, name: 'Ana' }, { id: BRU, name: 'Bruno' }]);
  });

  it('gera rótulos genéricos quando não há participantes cadastrados', () => {
    const p = participants(normalizeState({ settings: { travelers: 3 } }));
    expect(p.map((x) => x.name)).toEqual(['Viajante 1', 'Viajante 2', 'Viajante 3']);
  });

  it('inclui a HOSPEDAGEM como linha de custo (2 diárias de 100)', () => {
    const rows = allCostRows(base());
    const hosp = rows.find((r) => r.kind === 'cities');
    expect(hosp.valor).toBe(200);
  });

  it('hospedagem aceita quem pagou', () => {
    const st = base();
    st.cities[0].paidBy = BRU;
    const r = splitSummary(st);
    expect(r.rows.find((x) => x.id === BRU).paid).toBe(200);
    expect(r.unassigned).toBe(0); // 200 hospedagem + 100 museu, ambos com pagador
  });

  it('sem split definido, divide igualmente', () => {
    const r = splitSummary(base());
    expect(r.total).toBe(300);
    expect(r.rows.find((x) => x.id === ANA).owed).toBe(150);
    expect(r.rows.find((x) => x.id === BRU).owed).toBe(150);
  });

  it('respeita o percentual por participante', () => {
    const st = base();
    st.attractions[0].split = { [ANA]: 80, [BRU]: 20 };
    const r = splitSummary(st);
    // museu 100 -> Ana 80 / Bruno 20 ; hospedagem 200 -> 100/100 (igual)
    expect(r.rows.find((x) => x.id === ANA).owed).toBe(180);
    expect(r.rows.find((x) => x.id === BRU).owed).toBe(120);
  });

  it('normaliza percentuais que não somam 100', () => {
    const st = base();
    st.attractions[0].split = { [ANA]: 3, [BRU]: 1 }; // proporcional 75/25
    const pct = effectiveSplit(st, st.attractions[0]);
    expect(pct[ANA]).toBe(75);
    expect(pct[BRU]).toBe(25);
  });

  it('ignora cancelados', () => {
    const st = base({ otherExpenses: [{ id: 'o1', date: '2026-06-02', name: 'X', cost: 999, status: 'Cancelado', paidBy: ANA }] });
    expect(splitSummary(st).total).toBe(300);
  });

  it('marca como não atribuído o que não tem pagador', () => {
    const st = base();
    expect(splitSummary(st).unassigned).toBe(200); // a hospedagem
  });

  it('acerto: quem deve paga a quem tem a receber', () => {
    const st = base();
    st.cities[0].nightly = 0; // só o museu de 100, pago pela Ana
    const acertos = settlements(splitSummary(st));
    expect(acertos).toHaveLength(1);
    expect(acertos[0]).toMatchObject({ fromId: BRU, toId: ANA, from: 'Bruno', to: 'Ana', valor: 50 });
  });

  it('sem dívidas, não gera acerto', () => {
    const st = base();
    st.cities[0].nightly = 0;
    st.attractions[0].split = { [ANA]: 100 }; // Ana pagou e é 100% responsável
    expect(settlements(splitSummary(st))).toEqual([]);
  });

  it('lista as linhas de um participante, com sua parte', () => {
    const st = base();
    const rows = rowsForParticipant(st, ANA);
    expect(rows.length).toBe(2); // hospedagem (responsável) + museu (pagou)
    expect(rows.find((r) => r.kind === 'attractions').parte).toBe(50);
  });
});

/* ---------- Migração: nomes -> identificadores ---------- */
describe('migrateParticipants', () => {
  it('converte lista de nomes em objetos com id', () => {
    const s = normalizeState({ settings: { participants: ['Ana', 'Bruno'] } });
    expect(s.settings.participants.every((p) => p.id && p.name)).toBe(true);
    expect(s.settings.participants.map((p) => p.name)).toEqual(['Ana', 'Bruno']);
  });

  it('converte paidBy que guardava o NOME para o id correspondente', () => {
    const s = normalizeState({
      settings: { participants: ['Ana', 'Bruno'] },
      attractions: [{ id: 'a1', date: '2026-06-02', name: 'Museu', cost: 50, paidBy: 'Bruno' }],
    });
    const bruno = s.settings.participants.find((p) => p.name === 'Bruno');
    expect(s.attractions[0].paidBy).toBe(bruno.id);
  });

  it('renomear NÃO quebra o vínculo (o id não muda)', () => {
    const s = normalizeState({
      settings: { participants: ['Ana'] },
      attractions: [{ id: 'a1', date: '2026-06-02', name: 'Museu', cost: 50, paidBy: 'Ana' }],
    });
    const id = s.settings.participants[0].id;
    s.settings.participants[0].name = 'Ana Silva';   // renomeia
    const depois = normalizeState(s);                // recarrega
    expect(depois.attractions[0].paidBy).toBe(id);   // segue apontando para ela
    expect(participantName(depois, id)).toBe('Ana Silva');
  });

  it('é idempotente (rodar de novo não altera nada)', () => {
    const a = normalizeState({ settings: { participants: ['Ana'] } });
    const idAntes = a.settings.participants[0].id;
    const b = normalizeState(a);
    expect(b.settings.participants[0].id).toBe(idAntes);
  });

  it('descarta paidBy que aponta para participante inexistente', () => {
    const s = normalizeState({
      settings: { participants: ['Ana'] },
      attractions: [{ id: 'a1', date: '2026-06-02', name: 'Museu', cost: 50, paidBy: 'Fantasma' }],
    });
    expect(s.attractions[0].paidBy).toBe('');
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
    // allPlanningDates já inclui o check-out, independente da geração
    expect(allPlanningDates(state).map((d) => d.date)).toEqual([
      '2030-06-01', '2030-06-02', '2030-06-03', '2030-06-04',
    ]);

    ensureGenerated(state);
    // O dia do check-out faz parte da viagem POR DIREITO PRÓPRIO — é o dia da
    // volta. Antes ele só existia porque o transporte automático de Casa era
    // datado nele; com a remoção desses transportes, allPlanningDates o inclui
    // diretamente.
    expect(allPlanningDates(state).map((d) => d.date)).toEqual([
      '2030-06-01', '2030-06-02', '2030-06-03', '2030-06-04',
    ]);
    expect(state.transports.length).toBe(0); // e sem nenhum transporte criado
  });
});


/* ---------- Confirmação de acerto ---------- */
describe('withSettlementStatus', () => {
  const acerto = { fromId: 'p2', toId: 'p1', from: 'Bruno', to: 'Ana', valor: 50 };

  it('acerto não confirmado aparece como pendente', () => {
    const st = normalizeState({});
    expect(withSettlementStatus(st, [acerto])[0].confirmado).toBe(false);
  });

  it('acerto confirmado aparece como confirmado', () => {
    const st = normalizeState({ settings: { settlementsDone: [{ key: settlementKey(acerto) }] } });
    expect(withSettlementStatus(st, [acerto])[0].confirmado).toBe(true);
  });

  it('se o valor da dívida muda, a confirmação antiga não vale mais', () => {
    const st = normalizeState({ settings: { settlementsDone: [{ key: settlementKey(acerto) }] } });
    const novo = { ...acerto, valor: 80 }; // surgiu uma despesa nova
    expect(withSettlementStatus(st, [novo])[0].confirmado).toBe(false);
  });
});


/* ---------- num(): números reais não podem passar pelo parser de texto ---------- */
describe('num', () => {
  it('preserva floats com muitas casas (o bug dos percentuais gigantes)', () => {
    // Antes: virava a string "33.333333333333336", o ponto era tratado como
    // separador de milhar e o resultado saía 33333333333333336.
    expect(num(100 / 3)).toBeCloseTo(33.333333333333336, 10);
    expect(num(1 / 3)).toBeCloseTo(0.3333333333333333, 10);
  });

  it('preserva números normais', () => {
    expect(num(250)).toBe(250);
    expect(num(1750.5)).toBe(1750.5);
    expect(num(0)).toBe(0);
  });

  it('continua entendendo texto no formato brasileiro', () => {
    expect(num('1.750,00')).toBe(1750);
    expect(num('R$ 1.234,56')).toBe(1234.56);
    expect(num('250')).toBe(250);
  });

  it('trata vazio, nulo e inválido como zero', () => {
    expect(num('')).toBe(0);
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num('abc')).toBe(0);
    expect(num(NaN)).toBe(0);
    expect(num(Infinity)).toBe(0);
  });
});

/* ---------- Percentuais e valores da divisão em escala correta ---------- */
describe('rateio entre 3 pessoas (caso das imagens)', () => {
  it('divisão igual entre 3 dá 33,33% e um terço do valor', () => {
    const A = 'f1'; const B = 'f2'; const C = 'f3';
    const st = normalizeState({
      settings: { participants: [{ id: A, name: 'f1' }, { id: B, name: 'f2' }, { id: C, name: 'f3' }] },
      attractions: [{ id: 'a1', date: '2026-08-08', name: 'Outros', cost: 210, status: 'Planejado' }],
    });
    const pct = effectiveSplit(st, st.attractions[0]);
    expect(pct[A]).toBeCloseTo(33.3333, 3);
    expect(pct[A]).toBeLessThan(34);              // e não 3,3 × 10¹⁶
    const parte = (210 * pct[A]) / 100;
    expect(parte).toBeCloseTo(70, 6);             // R$ 70,00 — não R$ 70 quatrilhões
  });

  it('percentuais iguais a 1 cada normalizam para 33,33% (não somam errado)', () => {
    const A = 'f1'; const B = 'f2'; const C = 'f3';
    const st = normalizeState({
      settings: { participants: [{ id: A, name: 'f1' }, { id: B, name: 'f2' }, { id: C, name: 'f3' }] },
      cities: [{ id: 'c1', city: 'Rio', start: '2026-08-01', end: '2026-08-08', nightly: 250 }],
    });
    st.cities[0].split = { [A]: 1, [B]: 1, [C]: 1 };
    const pct = effectiveSplit(st, st.cities[0]);
    expect(pct[A]).toBeCloseTo(33.3333, 3);
    const total = pct[A] + pct[B] + pct[C];
    expect(total).toBeCloseTo(100, 6);
  });

  it('a soma das partes bate com o valor total da despesa', () => {
    const A = 'f1'; const B = 'f2'; const C = 'f3';
    const st = normalizeState({
      settings: { participants: [{ id: A, name: 'f1' }, { id: B, name: 'f2' }, { id: C, name: 'f3' }] },
      attractions: [{ id: 'a1', date: '2026-08-08', name: 'X', cost: 100, status: 'Planejado' }],
    });
    const r = splitSummary(st);
    const soma = r.rows.reduce((acc, x) => acc + x.owed, 0);
    expect(soma).toBeCloseTo(r.total, 6);
  });
});


/* ---------- Caminho A: anexos como links externos ---------- */
describe('links externos', () => {
  it('aceita só https', () => {
    expect(isValidLink('https://drive.google.com/x')).toBe(true);
    expect(isValidLink('http://drive.google.com/x')).toBe(false);
    expect(isValidLink('drive.google.com/x')).toBe(false);
    expect(isValidLink('')).toBe(false);
    expect(isValidLink(null)).toBe(false);
  });

  it('normaliza o que foi colado, sem rebaixar para http', () => {
    expect(normalizeLinkInput('drive.google.com/x')).toBe('https://drive.google.com/x');
    expect(normalizeLinkInput('http://drive.google.com/x')).toBe('https://drive.google.com/x');
    expect(normalizeLinkInput('https://a.com')).toBe('https://a.com');
    expect(normalizeLinkInput('  ')).toBe('');
  });

  it('usa o domínio como rótulo quando não há um', () => {
    expect(linkLabel({ url: 'https://www.drive.google.com/x' })).toBe('drive.google.com');
    expect(linkLabel({ url: 'https://a.com', label: 'Voucher' })).toBe('Voucher');
  });

  it('coleta anexos de todas as origens, com documentos gerais no topo', () => {
    const st = normalizeState({
      settings: { documents: [{ id: 'd1', label: 'Seguro', url: 'https://a.com/seguro' }] },
      cities: [{ id: 'c1', city: 'Lisboa', start: '2026-06-01', end: '2026-06-03', link: { url: 'https://a.com/hotel', label: 'Voucher' } }],
      attractions: [{ id: 'a1', date: '2026-06-02', name: 'Museu', link: { url: 'https://a.com/ingresso' } }],
      transports: [{ id: 't1', date: '2026-06-01', mode: 'Voo' }], // sem link
    });
    const links = collectLinks(st);
    expect(links.length).toBe(3);
    expect(links[0].kind).toBe('documents');       // documento geral primeiro
    expect(links[1].origem).toBe('Lisboa');        // depois por data
    expect(links[2].origem).toBe('Museu');
  });

  it('ignora links inválidos na coleta', () => {
    const st = normalizeState({
      attractions: [{ id: 'a1', date: '2026-06-02', name: 'X', link: { url: 'não é link' } }],
    });
    expect(collectLinks(st).length).toBe(0);
  });

  it('conta os anexos da viagem', () => {
    const st = normalizeState({
      checklist: [{ id: 'k1', item: 'Visto', link: { url: 'https://a.com/visto' } }],
    });
    expect(countLinks(st)).toBe(1);
  });
});

/* ---------- Frase estável por viagem ---------- */
describe('quoteForTrip', () => {
  it('a mesma viagem sempre recebe a mesma frase', () => {
    expect(quoteForTrip('trip-abc')).toBe(quoteForTrip('trip-abc'));
  });
  it('viagens diferentes tendem a receber frases diferentes', () => {
    const amostra = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(quoteForTrip));
    expect(amostra.size).toBeGreaterThan(1);
  });
  it('sem id, devolve uma frase válida em vez de quebrar', () => {
    expect(typeof quoteForTrip('')).toBe('string');
    expect(quoteForTrip(undefined).length).toBeGreaterThan(0);
  });
});


/* ---------- Planilha: validação e mesclagem ---------- */
describe('planilha — leitura de células', () => {
  it('aceita AAAA-MM-DD', () => {
    expect(parseDataCelula('2026-06-01')).toEqual({ ok: true, valor: '2026-06-01' });
  });

  it('RECUSA data ambígua em vez de adivinhar', () => {
    // 03/04/2026 é 3 de abril ou 4 de março, conforme o idioma do Excel.
    const r = parseDataCelula('03/04/2026');
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/AAAA-MM-DD/);
  });

  it('converte número de série do Excel', () => {
    // 45809 = 2025-06-01 na contagem do Excel
    const r = parseDataCelula(45809);
    expect(r.ok).toBe(true);
    expect(r.valor).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('aceita objeto Date', () => {
    const r = parseDataCelula(new Date('2026-06-01T12:00:00'));
    expect(r.ok).toBe(true);
    expect(r.valor).toBe('2026-06-01');
  });

  it('vazio é vazio, não erro', () => {
    expect(parseDataCelula('')).toEqual({ ok: true, valor: '' });
  });
});

describe('planilha — validação de aba', () => {
  const head = ESQUEMA.attractions.colunas.map((c) => c.col);

  it('lê linhas válidas', () => {
    const m = [head, ['', '2026-06-02', '09:00', 'Museu', '50', 'Reservado', '']];
    const { itens, erros } = validarAba('attractions', m);
    expect(erros).toEqual([]);
    expect(itens[0]).toMatchObject({ date: '2026-06-02', name: 'Museu', cost: 50, status: 'Reservado' });
  });

  it('aponta a linha e a coluna do erro', () => {
    const m = [head, ['', '01/06/2026', '', 'Museu', '', '', '']];
    const { erros } = validarAba('attractions', m);
    expect(erros[0]).toMatchObject({ linha: 2, coluna: 'data' });
  });

  it('exige campos obrigatórios', () => {
    const m = [head, ['', '2026-06-02', '', '', '', '', '']];
    const { erros } = validarAba('attractions', m);
    expect(erros.some((e) => e.coluna === 'nome' && e.mensagem === 'obrigatório')).toBe(true);
  });

  it('recusa status inválido, listando os válidos', () => {
    const m = [head, ['', '2026-06-02', '', 'Museu', '', 'Talvez', '']];
    const { erros } = validarAba('attractions', m);
    expect(erros[0].mensagem).toMatch(/Planejado/);
  });

  it('ignora linhas totalmente vazias', () => {
    const m = [head, ['', '', '', '', '', '', ''], ['', '2026-06-02', '', 'Museu', '', '', '']];
    const { itens, erros } = validarAba('attractions', m);
    expect(itens.length).toBe(1);
    expect(erros).toEqual([]);
  });

  it('reclama de coluna obrigatória ausente', () => {
    const { erros } = validarAba('attractions', [['id', 'data'], ['', '2026-06-02']]);
    expect(erros[0].mensagem).toMatch(/ausente/);
  });
});

describe('planilha — mesclagem', () => {
  const base = () => normalizeState({
    // participante cadastrado: sem ele, normalizeState limpa o paidBy órfão
    settings: { participants: [{ id: 'p1', name: 'Ana' }] },
    attractions: [
      { id: 'a1', date: '2026-06-02', name: 'Museu', cost: 50, status: 'Planejado', paidBy: 'p1' },
      { id: 'a2', date: '2026-06-03', name: 'Parque', cost: 20, status: 'Planejado' },
    ],
  });

  it('atualiza pelo id e PRESERVA campos que a planilha não conhece', () => {
    const { state, resumo } = mesclarPlanilha(base(), {
      attractions: [{ id: 'a1', date: '2026-06-02', name: 'Museu Nacional', cost: 80, status: 'Pago' }],
    });
    const item = state.attractions.find((x) => x.id === 'a1');
    expect(item.name).toBe('Museu Nacional');
    expect(item.cost).toBe(80);
    expect(item.paidBy).toBe('p1');            // não estava na planilha, foi preservado
    expect(resumo.attractions).toEqual({ criados: 0, atualizados: 1 });
  });

  it('linha sem id cria item novo', () => {
    const { state, resumo } = mesclarPlanilha(base(), {
      attractions: [{ date: '2026-06-04', name: 'Praia', cost: 0, status: 'Planejado' }],
    });
    expect(state.attractions.length).toBe(3);
    expect(resumo.attractions.criados).toBe(1);
  });

  it('NÃO apaga o que existe no app e não está na planilha', () => {
    const { state } = mesclarPlanilha(base(), {
      attractions: [{ id: 'a1', date: '2026-06-02', name: 'Museu', cost: 50, status: 'Planejado' }],
    });
    expect(state.attractions.find((x) => x.id === 'a2')).toBeTruthy();
  });

  it('não muta o estado original', () => {
    const orig = base();
    const antes = JSON.stringify(orig);
    mesclarPlanilha(orig, { attractions: [{ id: 'a1', name: 'X', date: '2026-06-02' }] });
    expect(JSON.stringify(orig)).toBe(antes);
  });
});

describe('planilha — ida e volta', () => {
  it('exportar e reimportar não altera os dados', () => {
    const st = normalizeState({
      attractions: [{ id: 'a1', date: '2026-06-02', name: 'Museu', cost: 50, status: 'Reservado' }],
    });
    const matriz = linhasDe(st, 'attractions');
    const { itens, erros } = validarAba('attractions', matriz);
    expect(erros).toEqual([]);
    const { state, resumo } = mesclarPlanilha(st, { attractions: itens });
    expect(resumo.attractions).toEqual({ criados: 0, atualizados: 1 });
    expect(state.attractions[0]).toMatchObject({ id: 'a1', name: 'Museu', cost: 50, status: 'Reservado' });
  });

  it('gera uma aba por tipo', () => {
    expect(planilhaDe(normalizeState({})).map((x) => x.aba)).toEqual([
      'Cidades', 'Transportes', 'Alimentacao', 'Atracoes', 'Outras', 'Checklist',
    ]);
  });

  it('reconhece a aba mesmo sem acento ou com outra caixa', () => {
    expect(kindPorAba('alimentacao')).toBe('foodItems');
    expect(kindPorAba('ATRACOES')).toBe('attractions');
    expect(kindPorAba('Inexistente')).toBe(null);
  });
});
