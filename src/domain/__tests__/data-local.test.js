// D1 do parecer de QA do #38: a data de "Pagamentos feitos" é a LOCAL do aparelho.
// Os testes de instante fixo dependem do fuso do processo: rode com
// `TZ=America/Sao_Paulo npx vitest run src/domain` e `TZ=Asia/Tokyo ...`.
import { describe, it, expect } from 'vitest';
import { dataLocalDeIso } from '../dates.js';

const TZ = process.env.TZ;

describe('dataLocalDeIso (#38, D1)', () => {
  it('em qualquer fuso: 23h30 locais continuam no mesmo dia local', () => {
    const iso = new Date(2026, 10, 10, 23, 30).toISOString();
    expect(dataLocalDeIso(iso)).toBe('2026-11-10');
  });

  it('em qualquer fuso: 00h10 locais continuam no mesmo dia local', () => {
    const iso = new Date(2026, 10, 10, 0, 10).toISOString();
    expect(dataLocalDeIso(iso)).toBe('2026-11-10');
  });

  it('entradas inválidas devolvem texto vazio', () => {
    expect(dataLocalDeIso('')).toBe('');
    expect(dataLocalDeIso(undefined)).toBe('');
    expect(dataLocalDeIso('não é data')).toBe('');
  });

  it.runIf(TZ === 'America/Sao_Paulo')('Brasília: 02h30 UTC de 11/11 ainda é dia 10', () => {
    expect(dataLocalDeIso('2026-11-11T02:30:00.000Z')).toBe('2026-11-10');
  });

  it.runIf(TZ === 'Asia/Tokyo')('Tóquio: 16h30 UTC de 10/11 já é dia 11', () => {
    expect(dataLocalDeIso('2026-11-10T16:30:00.000Z')).toBe('2026-11-11');
  });

  it.runIf(TZ === 'Europe/Lisbon')('Lisboa (UTC em novembro): igual à data UTC', () => {
    expect(dataLocalDeIso('2026-11-10T23:30:00.000Z')).toBe('2026-11-10');
  });
});
