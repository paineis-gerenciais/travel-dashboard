import { matrizesDeJson, validarAba, mesclarPlanilha } from '<raiz-do-repositório>/src/domain/sheet.js';
const base = (abas) => ({ formato: 'planilha-viagem', versao: 1, abas });
const run = (obj) => { const r = matrizesDeJson(obj); const out = {}; for (const [k, m] of Object.entries(r.matrizes)) out[k] = validarAba(k, m); return { r, out }; };
const show = (t, x) => console.log('\n## ' + t + '\n' + JSON.stringify(x, null, 1).replace(/\n\s+/g, ' '));

show('C1 abas {}', matrizesDeJson(base({})));
show('C2 abas array', matrizesDeJson(base([])));
show('C3 linha string/numero/array/null', run(base({ Outras: ['x', 5, [1], null, { data: '2030-01-01', nome: 'ok' }] })).out);
show('C4 tipos JSON: bool, 650.5, 90.5 duracao', run(base({
  Cidades: [{ cidade: 'A', check_in: '2030-01-01', check_out: '2030-01-03', custo_diaria: 650.5, cafe_incluso: true }, { cidade: 'B', check_in: '2030-01-03', check_out: '2030-01-05', cafe_incluso: false, custo_diaria: '650,50' }],
  Transportes: [{ data: '2030-01-01', duracao_min: 90.5, custo: 1e3 }, { data: '2030-01-01', duracao_min: -5 }, { data: '2030-01-01', duracao_min: '1h30' }] })).out);
show('C5 cafe_incluso numerico 1 / 2 / "talvez"', run(base({ Cidades: [{ cidade: 'A', check_in: '2030-01-01', check_out: '2030-01-03', cafe_incluso: 1 }, { cidade: 'B', check_in: '2030-01-01', check_out: '2030-01-03', cafe_incluso: 2 }, { cidade: 'C', check_in: '2030-01-01', check_out: '2030-01-03', cafe_incluso: 'talvez' }] })).out);
show('C6 data numero (serie 47000), 20300610, 0, true, null', run(base({ Outras: [{ data: 47000, nome: 'a' }, { data: 20300610, nome: 'b' }, { data: 0, nome: 'c' }, { data: true, nome: 'd' }, { data: null, nome: 'e' }, { data: '2030-02-30', nome: 'f' }] })).out);
show('C7 aba com acento/caixa', Object.keys(matrizesDeJson(base({ 'Atrações': [{ data: '2030-01-01', nome: 'a' }], cidades: [], ' OUTRAS ': [], 'Alimentação': [], 'Outras despesas': [] })).matrizes));
show('C8 colunas com caixa diferente', run(base({ Cidades: [{ Cidade: 'Lisboa', Check_In: '2030-01-01', check_out: '2030-01-03' }] })).out);
show('C9 duas abas que normalizam para o mesmo kind (Cidades + cidades)', run(base({ Cidades: [{ cidade: 'A', check_in: '2030-01-01', check_out: '2030-01-02' }], cidades: [{ cidade: 'B', check_in: '2030-01-01', check_out: '2030-01-02' }] })).out);
show('C10 chave desconhecida (typo hospedagm) sem aviso', run(base({ Cidades: [{ cidade: 'A', check_in: '2030-01-01', check_out: '2030-01-02', hospedagm: 'X' }] })).out);

// Importar duas vezes sem id
const est = { cities: [], transports: [], attractions: [], foodItems: [], otherExpenses: [], checklist: [] };
const j = base({ Atracoes: [{ data: '2030-01-01', nome: 'Museu' }] });
const it1 = run(j).out.attractions.itens;
const s1 = mesclarPlanilha(est, { attractions: it1 });
const s2 = mesclarPlanilha(s1.state, { attractions: it1 });
show('C11 duas importacoes sem id', { resumo1: s1.resumo, resumo2: s2.resumo, total: s2.state.attractions.length });

// Update por id: só colunas enviadas
const existente = { ...est, cities: [{ id: 'c1', city: 'Lisboa', start: '2030-06-10', end: '2030-06-13', hotel: 'Hotel X', nightly: 650, breakfastIncluded: true, status: 'Reservado', notes: 'n', link: { url: 'https://a.com', label: '' }, paidBy: 'ana', split: [1] }],
  attractions: [{ id: 'a1', date: '2030-06-11', time: '10:00', name: 'Museu', cost: 90, status: 'Pago', link: { url: 'https://b.com', label: '' } }] };
const upd = run(base({ Cidades: [{ id: 'c1', cidade: 'Lisboa', check_in: '2030-06-10', check_out: '2030-06-13', custo_diaria: 700 }], Atracoes: [{ id: 'a1', data: '2030-06-11', nome: 'Museu', custo: 95 }] }));
show('C12a validacao da atualizacao parcial', upd.out);
const m = mesclarPlanilha(existente, { cities: upd.out.cities.itens, attractions: upd.out.attractions.itens });
show('C12b resultado da mesclagem (esperado: so custo muda)', { cities: m.state.cities[0], attractions: m.state.attractions[0] });
show('C12c atualizacao so com id + custo (sem obrigatorias)', run(base({ Atracoes: [{ id: 'a1', custo: 95 }] })).out);
// id id duplicado no arquivo, id numerico, id com espaço
show('C13 id numerico/espaco', run(base({ Outras: [{ id: 5, data: '2030-01-01', nome: 'a' }, { id: ' x ', data: '2030-01-01', nome: 'b' }] })).out);
// __proto__ / constructor as aba names / id
show('C14 abas __proto__/constructor', matrizesDeJson(JSON.parse('{"formato":"planilha-viagem","versao":1,"abas":{"__proto__":[{"a":1}],"constructor":[],"Outras":[{"id":"__proto__","data":"2030-01-01","nome":"x"}]}}')));
show('C15 versao string "1" / 1.0 / ausente', [matrizesDeJson({ ...base({}), versao: '1' }).erro, matrizesDeJson({ ...base({ Outras: [] }), versao: 1.0 }).erro, matrizesDeJson({ formato: 'planilha-viagem', abas: {} }).erro]);
show('C16 link: http, javascript:, sem esquema, objeto', run(base({ Outras: [{ data: '2030-01-01', nome: 'a', link: 'http://x.com' }, { data: '2030-01-01', nome: 'b', link: 'javascript:alert(1)' }, { data: '2030-01-01', nome: 'c', link: 'exemplo.com' }, { data: '2030-01-01', nome: 'd', link: { url: 'https://x.com' } }] })).out);
show('C17 texto muito longo / texto objeto', run(base({ Outras: [{ data: '2030-01-01', nome: { a: 1 } }, { data: '2030-01-01', nome: ['x', 'y'] }] })).out);
show('C18 status em minusculo sem acento', run(base({ Checklist: [{ item: 'a', status: 'concluido', prioridade: 'media' }] })).out);
