import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { matrizesDeJson, validarAba, FORMATO_IMPORTACAO, VERSAO_IMPORTACAO } from '../sheet.js';

const fixture = () => JSON.parse(readFileSync(resolve(process.cwd(), 'e2e/fixtures/importacao-exemplo.json'), 'utf8'));
const base = (abas) => ({ formato: FORMATO_IMPORTACAO, versao: VERSAO_IMPORTACAO, abas });

describe('matrizesDeJson', () => {
  it('fixture válida gera matrizes aceitas por validarAba', () => {
    const r = matrizesDeJson(fixture());
    expect(r.erro).toBeNull();
    expect(r.ignoradas).toEqual([]);
    const contagem = {};
    Object.entries(r.matrizes).forEach(([kind, m]) => {
      const v = validarAba(kind, m);
      expect(v.erros).toEqual([]);
      contagem[kind] = v.itens.length;
    });
        expect(contagem).toEqual({ cities: 2, transports: 1, attractions: 2, foodItems: 1, otherExpenses: 1, checklist: 1 });
  });

  it('recusa formato, versão e abas inválidos', () => {
    expect(matrizesDeJson({ ...fixture(), formato: 'outro' }).erro).toMatch(/formato/);
    expect(matrizesDeJson({ ...fixture(), versao: 2 }).erro).toMatch(/versão/);
    const { abas, ...semAbas } = fixture();
    expect(matrizesDeJson(semAbas).erro).toMatch(/abas/);
    expect(matrizesDeJson({ ...fixture(), abas: [] }).erro).toMatch(/abas/);
    expect(matrizesDeJson(null).erro).toBeTruthy();
  });

  it('aba desconhecida ou que não é lista vai para ignoradas', () => {
    const r = matrizesDeJson(base({ Foguetes: [{ a: 1 }], Cidades: 'x', Outras: [] }));
    expect(r.ignoradas.sort()).toEqual(['Cidades', 'Foguetes']);
    expect(Object.keys(r.matrizes)).toEqual(['otherExpenses']);
    expect(r.erro).toBeNull();
  });

  it('coluna extra é ignorada e linha que não é objeto vira vazia', () => {
    const r = matrizesDeJson(base({ Outras: [{ data: '2030-06-10', nome: 'X', custo: 1, status: 'Planejado', extra: 'y' }, 5, null] }));
    const [kind, m] = Object.entries(r.matrizes)[0];
    expect(m[0]).not.toContain('extra');
    expect(m).toHaveLength(4);
    expect(m[2].every((c) => c === '')).toBe(true);
    expect(validarAba(kind, m).itens).toHaveLength(1);
  });

  it('link javascript: gera erro na linha certa', () => {
    const f = fixture();
    f.abas.Atracoes[1].link = 'javascript:alert(1)';
    const r = matrizesDeJson(f);
    const v = validarAba('attractions', r.matrizes.attractions);
    expect(v.erros.some((e) => e.linha === 3 && e.coluna === 'link')).toBe(true);
    expect(v.itens).toHaveLength(1);
  });

  it('data 01/06/2030 gera erro', () => {
    const f = fixture();
    f.abas.Cidades[0].check_in = '01/06/2030';
    const r = matrizesDeJson(f);
    const v = validarAba('cities', r.matrizes.cities);
    expect(v.erros.some((e) => e.linha === 2 && e.coluna === 'check_in')).toBe(true);
  });

  it('chave __proto__ numa linha não polui nada', () => {
    const texto = '{"formato":"planilha-viagem","versao":1,"abas":{"Outras":[{"__proto__":{"polui":true},"data":"2030-06-10","nome":"X","custo":1,"status":"Planejado"}]}}';
    const r = matrizesDeJson(JSON.parse(texto));
    expect(({}).polui).toBeUndefined();
    const [kind, m] = Object.entries(r.matrizes)[0];
    expect(m[0]).not.toContain('__proto__');
    const v = validarAba(kind, m);
    expect(v.erros).toEqual([]);
    expect(v.itens[0].polui).toBeUndefined();
  });
});
