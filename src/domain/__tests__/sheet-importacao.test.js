import { describe, it, expect } from 'vitest';
import {
  matrizesDeJson, validarAba, mesclarPlanilha, parseDataCelula, possiveisDuplicatas,
  FORMATO_IMPORTACAO, VERSAO_IMPORTACAO,
} from '../sheet.js';

const base = (abas) => ({ formato: FORMATO_IMPORTACAO, versao: VERSAO_IMPORTACAO, abas });
const viagem = () => ({
  cities: [{ id: 'c1', city: 'Lisboa', start: '2030-06-10', end: '2030-06-13', hotel: 'Hotel X', nightly: 650, breakfastIncluded: true, status: 'Reservado', notes: 'n' }],
  attractions: [{ id: 'a1', date: '2030-06-11', name: 'Museu Exemplo', cost: 90, status: 'Pago', time: '10:00', paidBy: 'ana' }],
  transports: [], foodItems: [], otherExpenses: [], checklist: [],
});
const importar = (state, abas) => {
  const r = matrizesDeJson(base(abas));
  const porKind = {};
  Object.entries(r.matrizes).forEach(([k, m]) => { porKind[k] = validarAba(k, m).itens; });
  return { r, porKind, ...mesclarPlanilha(state, porKind) };
};

describe('D1: coluna ausente não é coluna vazia', () => {
  it('atualiza só as colunas enviadas (JSON)', () => {
    const { state } = importar(viagem(), {
      Cidades: [{ id: 'c1', cidade: 'Lisboa', check_in: '2030-06-10', check_out: '2030-06-13', custo_diaria: 700 }],
      Atracoes: [{ id: 'a1', data: '2030-06-11', nome: 'Museu Exemplo', custo: 95 }],
    });
    expect(state.cities[0]).toMatchObject({ nightly: 700, hotel: 'Hotel X', breakfastIncluded: true, status: 'Reservado', notes: 'n' });
    expect(state.attractions[0]).toMatchObject({ cost: 95, status: 'Pago', time: '10:00', paidBy: 'ana' });
    expect(state.cities[0]._enviados).toBeUndefined();
    expect(state.cities[0]._linha).toBeUndefined();
  });

  it('matriz .xlsx sem a coluna status preserva o status', () => {
    const v = validarAba('attractions', [['id', 'data', 'nome', 'custo'], ['a1', '2030-06-11', 'Museu Exemplo', 95]]);
    const { state } = mesclarPlanilha(viagem(), { attractions: v.itens });
    expect(state.attractions[0]).toMatchObject({ cost: 95, status: 'Pago', time: '10:00' });
  });

  it('célula presente e vazia continua zerando', () => {
    const { state } = importar(viagem(), { Atracoes: [{ id: 'a1', data: '2030-06-11', nome: 'Museu Exemplo', hora: '' }] });
    expect(state.attractions[0].time).toBe('');
  });

  it('item novo sem status nasce Planejado; obrigatório ausente é erro', () => {
    const { state } = importar(viagem(), { Atracoes: [{ data: '2030-06-12', nome: 'Torre' }] });
    expect(state.attractions[1]).toMatchObject({ name: 'Torre', status: 'Planejado', cost: 0 });
    const r = matrizesDeJson(base({ Atracoes: [{ data: '2030-06-12' }] }));
    expect(validarAba('attractions', r.matrizes.attractions).erros).toEqual([{ linha: 2, coluna: 'nome', mensagem: 'obrigatório' }]);
  });
});

describe('D2: datas', () => {
  it('número fora da série do Excel dá erro; série válida passa', () => {
    expect(parseDataCelula(20300610)).toEqual({ ok: false, erro: 'data fora do intervalo' });
    expect(parseDataCelula(0).ok).toBe(false);
    expect(parseDataCelula(73051).ok).toBe(false);
    expect(parseDataCelula(47645)).toEqual({ ok: true, valor: '2030-06-11' });
  });
  it('dia inexistente dá erro', () => {
    expect(parseDataCelula('2030-02-30')).toEqual({ ok: false, erro: 'data inexistente' });
    expect(parseDataCelula('2030-02-28')).toEqual({ ok: true, valor: '2030-02-28' });
    expect(parseDataCelula('2028-02-29').ok).toBe(true);
    expect(parseDataCelula('2030-13-01').ok).toBe(false);
  });
});

describe('D4 e D7: nomes de coluna e abas', () => {
  it('colunas casam sem caixa, acento e espaços', () => {
    const r = matrizesDeJson(base({ Cidades: [{ Cidade: 'Lisboa', CHECK_IN: '2030-01-01', ' check_out ': '2030-01-03' }] }));
    const v = validarAba('cities', r.matrizes.cities);
    expect(v.erros).toEqual([]);
    expect(v.itens[0]).toMatchObject({ city: 'Lisboa', start: '2030-01-01', end: '2030-01-03' });
    expect(r.colunasIgnoradas).toEqual([]);
  });
  it('abas Cidades e cidades somam as linhas', () => {
    const r = matrizesDeJson(base({
      Cidades: [{ cidade: 'A', check_in: '2030-01-01', check_out: '2030-01-02' }],
      cidades: [{ cidade: 'B', check_in: '2030-01-03', check_out: '2030-01-04' }],
    }));
    expect(validarAba('cities', r.matrizes.cities).itens.map((i) => i.city)).toEqual(['A', 'B']);
  });
  it('coluna desconhecida vai para colunasIgnoradas, sem repetição', () => {
    const r = matrizesDeJson(base({ Outras: [{ data: '2030-01-01', nome: 'x', hospedagm: 1 }, { data: '2030-01-02', nome: 'y', hospedagm: 2 }] }));
    expect(r.colunasIgnoradas).toEqual([{ aba: 'Outras', coluna: 'hospedagm' }]);
  });
});

describe('D9: mensagens', () => {
  it('versão ausente, em texto e backup', () => {
    expect(matrizesDeJson({ formato: FORMATO_IMPORTACAO, abas: {} }).erro).toBe('campo "versao" ausente');
    expect(matrizesDeJson({ formato: FORMATO_IMPORTACAO, versao: '1', abas: {} }).erro).toBe('versão "1" está em texto; use o número 1');
    expect(matrizesDeJson({ formato: FORMATO_IMPORTACAO, versao: 2, abas: {} }).erro).toBe('versão 2 não suportada (esperada: 1)');
    expect(matrizesDeJson({ cities: [], attractions: [] }).erro).toMatch(/cópia de segurança.*Mais → Importar JSON/);
  });
});

describe('D3: possiveisDuplicatas', () => {
  const dup = (abas, state = viagem()) => {
    const { porKind } = importar(state, abas);
    return possiveisDuplicatas(state, porKind);
  };
  it('acha repetição sem diferenciar caixa e espaços', () => {
    expect(dup({ Atracoes: [{ data: '2030-06-11', nome: ' museu  exemplo ' }] })).toEqual([{ kind: 'attractions', linha: 2, idExistente: 'a1' }]);
    expect(dup({ Cidades: [{ cidade: 'LISBOA', check_in: '2030-07-01', check_out: '2030-07-02' }] })[0]).toMatchObject({ kind: 'cities', idExistente: 'c1' });
  });
  it('ignora item com id existente; vazio sem repetição; data diferente não repete', () => {
    expect(dup({ Atracoes: [{ id: 'a1', data: '2030-06-11', nome: 'Museu Exemplo' }] })).toEqual([]);
    expect(dup({ Atracoes: [{ data: '2030-06-12', nome: 'Museu Exemplo' }] })).toEqual([]);
  });
  it('id inexistente conta como novo', () => {
    expect(dup({ Atracoes: [{ id: 'zzz', data: '2030-06-11', nome: 'Museu Exemplo' }] })).toHaveLength(1);
  });
});

describe('link vazio na atualização (#41)', () => {
  it('célula de link vazia não apaga o link que o item já tem', () => {
    const state = { attractions: [{ id: 'a1', date: '2030-06-11', name: 'Museu', link: { url: 'https://exemplo.com/m', label: '' } }] };
    const { itens } = validarAba('attractions', [['id', 'data', 'nome', 'link'], ['a1', '2030-06-11', 'Museu', '']]);
    const { state: novo } = mesclarPlanilha(state, { attractions: itens });
    expect(novo.attractions[0].link).toEqual({ url: 'https://exemplo.com/m', label: '' });
    expect(novo.attractions[0]._enviados).toBeUndefined();
    expect(novo.attractions[0]._linha).toBeUndefined();
  });
});
