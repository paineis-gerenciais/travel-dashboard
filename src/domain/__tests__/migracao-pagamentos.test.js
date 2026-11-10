// Migração settlementsDone -> payments (issue #24): provas 1A, 1B, 2A e 2D do
// parecer de segurança. Dados fictícios.
import { describe, it, expect } from 'vitest';
import { normalizeState, migratePayments } from '../state.js';
import { splitSummary, settlements, settlementKey, paymentsList } from '../split.js';

const clone = (x) => structuredClone(x);
const ppl = [{ id: 'pa', name: 'Ana' }, { id: 'pb', name: 'Beto' }, { id: 'pc', name: 'Caio' }];
const desp = (id, cost, paidBy) => ({ id, date: '2026-12-01', city: 'X', name: id, cost, status: 'Pago', paidBy });
const legado = (others, done, participants = ppl) => ({ otherExpenses: others, settings: { participants, settlementsDone: done } });
const AT1 = '2026-11-01T10:00:00.000Z';
const saldos = (st) => splitSummary(st).rows.map((r) => `${r.id}:${r.balanceCents}`).join(' ');
const pendentes = (st) => settlements(splitSummary(st)).map(settlementKey);
const pags = (st) => paymentsList(st).map((p) => `${p.id}=${p.valor}`);

describe('conversão settlementsDone -> payments', () => {
  it('1A: dois acertos confirmados zeram os saldos e o legado fica intacto (rollback mostra CONFIRMADO)', () => {
    const done = [{ key: 'pa>pc>3333', at: AT1 }, { key: 'pb>pc>3333', at: AT1 }];
    const s = normalizeState(legado([desp('d1', 100, 'pc')], clone(done)));
    expect(pendentes(s)).toEqual([]);
    expect(saldos(s)).toBe('pa:0 pb:0 pc:0');
    expect(pags(s)).toEqual(['mig-pa>pc>3333=33.34', 'mig-pb>pc>3333=33.33']);
    expect(s.settings.settlementsDone).toEqual(done);
    // o `main` calcula "confirmado" pela chave do acerto contra settlementsDone:
    // as chaves antigas continuam lá, então o rollback mostra os dois como confirmados.
    const chaves = new Set(s.settings.settlementsDone.map((x) => x.key));
    expect(['pa>pc>3333', 'pb>pc>3333'].every((k) => chaves.has(k))).toBe(true);
    expect(Array.isArray(s.settings.payments) && s.settings.payments).toHaveLength(2);
  });

  it('1B: confirmações cumulativas do mesmo par viram um só pagamento (o valor atual)', () => {
    const done = [{ key: 'pb>pa>4500', at: AT1 }, { key: 'pb>pa>7500', at: '2026-11-02T10:00:00.000Z' }];
    const st = legado([desp('d1', 90, 'pa'), desp('d2', 60, 'pa')], done, ppl.slice(0, 2));
    const s = normalizeState(st);
    expect(pags(s)).toEqual(['mig-pb>pa>7500=75']);
    expect(pendentes(s)).toEqual([]);
    expect(saldos(s)).toBe('pa:0 pb:0');
  });

  it('2A: aba antiga que reconfirma depois da conversão não gera pagamento em dobro', () => {
    const done = [{ key: 'pa>pc>3333', at: AT1 }, { key: 'pb>pc>3333', at: AT1 }];
    const gravado = normalizeState(legado([desp('d1', 100, 'pc')], clone(done)));
    // a aba antiga vê tudo confirmado e não reconfirma; mesmo que gravasse de novo
    // o legado (com `at` novo), a marca impede nova conversão
    const velho = clone(gravado);
    velho.settings.settlementsDone.push({ key: 'pa>pc>3333', at: '2026-11-11T09:00:00.000Z' });
    const releitura = normalizeState(velho);
    expect(pags(releitura)).toEqual(['mig-pa>pc>3333=33.34', 'mig-pb>pc>3333=33.33']);
    expect(pendentes(releitura)).toEqual([]);
    expect(saldos(releitura)).toBe('pa:0 pb:0 pc:0');
  });

  it('2D: arredondamento float x maior resto não deixa centavo pendente', () => {
    const a = normalizeState(legado([desp('d1', 100, 'pc'), desp('d2', 0.1, 'pa')], [{ key: 'pb>pc>3337', at: AT1 }, { key: 'pa>pc>3327', at: AT1 }]));
    expect(pags(a)).toEqual(['mig-pb>pc>3337=33.36', 'mig-pa>pc>3327=33.28']);
    expect(pendentes(a)).toEqual([]);
    expect(saldos(a)).toBe('pa:0 pb:0 pc:0');
    const b = normalizeState(legado([desp('d1', 100, 'pa')], [{ key: 'pc>pa>3333', at: AT1 }, { key: 'pb>pa>3333', at: AT1 }], [ppl[2], ppl[1], ppl[0]]));
    expect(pags(b)).toEqual(['mig-pc>pa>3333=33.34', 'mig-pb>pa>3333=33.33']);
    expect(saldos(b)).toBe('pc:0 pb:0 pa:0');
  });

  it('"Desfazer" depois da conversão não ressuscita o pagamento na releitura', () => {
    const s = normalizeState(legado([desp('d1', 100, 'pc')], [{ key: 'pa>pc>3333', at: AT1 }, { key: 'pb>pc>3333', at: AT1 }]));
    const desfeito = clone(s);
    desfeito.settings.payments = desfeito.settings.payments.slice(1);
    const rel = normalizeState(desfeito);
    expect(rel.settings.payments).toHaveLength(1);
    expect(rel.settings.paymentsMigrated).toBe(true);
  });

  it('chave malformada fica em settlementsDone e não vira pagamento', () => {
    const lixo = [{ key: 'lixo' }, { key: 'pa>pb' }, { key: 'pa>pb>33.5' }, { key: 'pa>pb>-5' }, { key: 'pa>pb>1e3' }, { key: 'pa>pb> 250 ' }, { key: 'pa>pb>0x10' }, null, 'texto'];
    const s = { cities: [], transports: [], foodItems: [], attractions: [], otherExpenses: [desp('d', 30, 'pa')], settings: { participants: ppl, settlementsDone: clone(lixo) } };
    migratePayments(s);
    expect(s.settings.payments).toEqual([]);
    expect(s.settings.settlementsDone).toEqual(lixo);
  });
});
