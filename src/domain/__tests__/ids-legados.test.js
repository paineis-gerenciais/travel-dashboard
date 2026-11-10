// Ids legados (issue #25): B3 (ordem das chaves) e B4 (ids repetidos). Dados fictícios.
import { describe, it, expect } from 'vitest';
import { normalizeState, idLegado } from '../state.js';

const clone = (x) => structuredClone(x);
const at = (name, cost, extra = {}) => ({ date: '2026-12-01', city: 'X', name, cost, status: 'Planejado', ...extra });

describe('idLegado: ordem das chaves (B3)', () => {
  it('a ordem das chaves não muda o id', () => {
    expect(idLegado('attractions', { name: 'Museu', cost: 10 }, 0)).toBe(idLegado('attractions', { cost: 10, name: 'Museu' }, 0));
  });

  it('vale também para objetos aninhados (link)', () => {
    const a = { name: 'A', link: { url: 'https://x.test', label: 'x' } };
    const b = { link: { label: 'x', url: 'https://x.test' }, name: 'A' };
    expect(idLegado('foodItems', a, 2)).toBe(idLegado('foodItems', b, 2));
  });

  it('conteúdo ou posição diferentes continuam dando ids diferentes', () => {
    expect(idLegado('attractions', { name: 'A' }, 0)).not.toBe(idLegado('attractions', { name: 'B' }, 0));
    expect(idLegado('attractions', { name: 'A' }, 0)).not.toBe(idLegado('attractions', { name: 'A' }, 1));
  });
});

describe('normalizeState: ids repetidos (B4)', () => {
  const dup = () => ({ attractions: [at('A', 1, { id: 'x1' }), at('B', 2, { id: 'x1' }), at('C', 3, { id: 'x1' })], settings: {} });

  it('a 1ª ocorrência mantém o id e as seguintes ganham ids novos e distintos', () => {
    const s = normalizeState(dup());
    const ids = s.attractions.map((x) => x.id);
    expect(ids[0]).toBe('x1');
    expect(new Set(ids).size).toBe(3);
    expect(s.attractions.map((x) => x.name)).toEqual(['A', 'B', 'C']);
  });

  it('apagar por id remove só um item', () => {
    const s = normalizeState(dup());
    const alvo = s.attractions[1].id;
    expect(s.attractions.filter((x) => x.id !== alvo).map((x) => x.name)).toEqual(['A', 'C']);
    expect(s.attractions.filter((x) => x.id !== 'x1').map((x) => x.name)).toEqual(['B', 'C']);
  });

  it('o id novo não colide com um id que já existe depois na lista', () => {
    const clash = idLegado('attractions', at('B', 2, { id: 'x1' }), 1);
    const s = normalizeState({ attractions: [at('A', 1, { id: 'x1' }), at('B', 2, { id: 'x1' }), at('C', 3, { id: clash })], settings: {} });
    expect(new Set(s.attractions.map((x) => x.id)).size).toBe(3);
    expect(s.attractions[2].id).toBe(clash);
  });

  it('é idempotente: normalizar duas vezes dá os mesmos ids', () => {
    const uma = normalizeState(dup());
    const duas = normalizeState(clone(uma));
    expect(duas.attractions.map((x) => x.id)).toEqual(uma.attractions.map((x) => x.id));
    const leg = { attractions: [at('Museu', 10), at('Torre', 20), at('Museu', 10)], checklist: [{ item: 'Passaporte', done: false }], settings: {} };
    const a = normalizeState(clone(leg));
    expect(normalizeState(clone(a)).attractions.map((x) => x.id)).toEqual(a.attractions.map((x) => x.id));
    expect(normalizeState(clone(leg)).attractions.map((x) => x.id)).toEqual(a.attractions.map((x) => x.id));
  });
});
