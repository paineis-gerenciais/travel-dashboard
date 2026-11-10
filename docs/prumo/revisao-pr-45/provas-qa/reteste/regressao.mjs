import { planilhaDe, validarAba, mesclarPlanilha, matrizesDeJson, possiveisDuplicatas, ESQUEMA } from '<raiz-do-repositório>/src/domain/sheet.js';
import { baixarPlanilha, lerPlanilha, lerTextoColado } from '<raiz-do-repositório>/src/lib/sheetFile.js';
import * as XLSX from '<raiz-do-repositório>/node_modules/xlsx/xlsx.mjs';
const show = (t, x) => console.log('\n## ' + t + '\n' + JSON.stringify(x, null, 1).replace(/\n\s+/g, ' '));
const state = { cities: [{ id: 'c1', city: 'Lisboa', start: '2030-06-10', end: '2030-06-13', hotel: 'Hotel X', nightly: 650, breakfastIncluded: true, status: 'Reservado', notes: 'n', link: { url: 'https://a.com', label: '' } }],
  transports: [], foodItems: [],
  attractions: [{ id: 'a1', date: '2030-06-11', time: '10:00', name: 'Museu', cost: 90, status: 'Pago', link: { url: 'https://b.com', label: '' } }],
  otherExpenses: [], checklist: [] };
// exporta como o app: aoa_to_sheet(planilhaDe(state))
const wb = XLSX.utils.book_new();
planilhaDe(state).forEach(({ aba, linhas }) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), aba));
// edita: custo_diaria 700, status da atracao vazio, link da atracao vazio
const wsC = wb.Sheets['Cidades']; const wsA = wb.Sheets['Atrações'] || wb.Sheets[ESQUEMA.attractions.aba];
const hdrC = planilhaDe(state).find(a => a.kind==='cities').linhas[0]; const hdrA = planilhaDe(state).find(a => a.kind==='attractions').linhas[0];
const cell = (ws, hdr, col, v) => { const c = XLSX.utils.encode_cell({ r: 1, c: hdr.indexOf(col) }); ws[c] = { t: typeof v === 'number' ? 'n' : 's', v }; };
cell(wsC, hdrC, 'custo_diaria', 700); cell(wsC, hdrC, 'hospedagem', 'Hotel Y');
cell(wsA, hdrA, 'status', ''); cell(wsA, hdrA, 'link', ''); cell(wsA, hdrA, 'custo', 95);
const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
const porKindM = await lerPlanilha({ arrayBuffer: async () => buf });
const porKind = {}; const erros = {};
Object.entries(porKindM).forEach(([k, m]) => { const r = validarAba(k, m); porKind[k] = r.itens; erros[k] = r.erros; });
show('R1 erros xlsx', erros);
const m = mesclarPlanilha(state, porKind);
show('R2 xlsx completo reimportado: cidade (hotel Y, 700, cafe, status Reservado mantido?)', m.state.cities[0]);
show('R3 xlsx: atracao status vazio => Planejado; link vazio preserva; custo 95', m.state.attractions[0]);
show('R4 resumo', m.resumo);
// xlsx sem coluna status (cabecalho removido)
const mat = porKindM.attractions.map(l => l.filter((_, i) => porKindM.attractions[0][i] !== 'status'));
const r5 = validarAba('attractions', mat);
show('R5 xlsx sem coluna status: _enviados e status apos mesclar', { enviados: r5.itens[0]._enviados, status: mesclarPlanilha(state, { attractions: r5.itens }).state.attractions[0].status });
// Colar: linha mais curta que o cabecalho
const t = 'id\tdata\tnome\tcusto\tstatus\na1\t2030-06-11\tMuseu\t99\t';
const r6 = validarAba('attractions', lerTextoColado(t));
show('R6 colar com status vazio presente (tab final)', { env: r6.itens[0]._enviados, st: mesclarPlanilha(state, { attractions: r6.itens }).state.attractions[0].status });
const t2 = 'id\tdata\tnome\tcusto\tstatus\na1\t2030-06-11\tMuseu\t99';
const r7 = validarAba('attractions', lerTextoColado(t2));
show('R7 colar com linha curta (sem tab final)', { env: r7.itens[0]._enviados, st: mesclarPlanilha(state, { attractions: r7.itens }).state.attractions[0].status });
const t3 = 'id\tdata\tnome\tcusto\na1\t2030-06-11\tMuseu\t99';
show('R8 colar sem coluna status', mesclarPlanilha(state, { attractions: validarAba('attractions', lerTextoColado(t3)).itens }).state.attractions[0]);
// xlsx cabecalho com acento/caixa
const h = ['ID','Data','Nome','Custo','Status'];
show('R9 cabecalho xlsx maiusculo', validarAba('attractions', [h, ['a1','2030-06-11','Museu',99,'Pago']]).erros);
show('R10 cabecalho xlsx com espaco/acento "Início"', validarAba('cities', [['cidade','início','check_out'],['A','2030-01-01','2030-01-02']]).erros);
// duplicatas
const j = (abas) => ({ formato:'planilha-viagem', versao:1, abas });
const jr = matrizesDeJson(j({ Cidades:[{cidade:' lisboa ',check_in:'2030-01-01',check_out:'2030-01-02'},{cidade:'Porto',check_in:'2030-01-01',check_out:'2030-01-02'},{id:'c1',cidade:'Lisboa',check_in:'2030-01-01',check_out:'2030-01-02'},{id:'zzz',cidade:'Lisboa',check_in:'2030-01-01',check_out:'2030-01-02'}], Atracoes:[{data:'2030-06-11',nome:'MUSEU'},{data:'2030-06-12',nome:'Museu'}]}));
const pk = {}; Object.entries(jr.matrizes).forEach(([k,mm]) => pk[k] = validarAba(k, mm).itens);
show('R11 duplicatas (esperado: cidades linha 2 e 5, atracao linha 2)', possiveisDuplicatas(state, pk));
// colunas ignoradas
show('R12 avisos', (()=>{const r = matrizesDeJson(j({Cidades:[{CIDADE:'a',check_in:'2030-01-01',check_out:'2030-01-02',hospedagm:'x',Foo:1},{hospedagm:'y'}],Hospedagem:[{a:1}],Foguetes:'x'})); return {ign:r.ignoradas, col:r.colunasIgnoradas};})());
// acento em chave
show('R13 chave com acento "Início"/"Cidade " e acentuada "obrigatório"', (()=>{const r = matrizesDeJson(j({Cidades:[{' Cidade ':'A','CHECK_IN':'2030-01-01','Check_Out':'2030-01-02','Hospedagem':'x'}]})); return {col:r.colunasIgnoradas, v: validarAba('cities', r.matrizes.cities)};})());
// datas
const d = (v) => validarAba('otherExpenses', matrizesDeJson(j({Outras:[{data:v,nome:'x'}]})).matrizes.otherExpenses);
show('R14 datas', ['2030-02-30','2030-02-29','2028-02-29','0001-01-01','0099-05-05','2030-13-01','2030-00-10',1,73050,73051,0.5,-1,45000.7].map(v => { const r = d(v); return [v, r.erros[0]?.mensagem || r.itens[0].date]; }));
