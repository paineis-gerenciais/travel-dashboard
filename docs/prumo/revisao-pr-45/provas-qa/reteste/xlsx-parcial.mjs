import { validarAba, mesclarPlanilha } from '<raiz-do-repositório>/src/domain/sheet.js';
import { lerPlanilha } from '<raiz-do-repositório>/src/lib/sheetFile.js';
import { readFileSync } from 'node:fs';
const buf = readFileSync('provas-qa/reteste/parcial.xlsx');
const pk = await lerPlanilha({ arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });
const state = { cities: [{ id: 'c1', city: 'Lisboa', start: '2030-06-10', end: '2030-06-13', hotel: 'Hotel X', nightly: 650, breakfastIncluded: true, status: 'Reservado', notes: 'n' }], transports: [], foodItems: [], attractions: [{ id: 'a1', date: '2030-06-11', time: '10:00', name: 'Museu', cost: 90, status: 'Pago' }], otherExpenses: [], checklist: [] };
const it = {}; Object.entries(pk).forEach(([k,m]) => it[k] = validarAba(k,m).itens);
const r = mesclarPlanilha(state, it);
console.log(JSON.stringify({ c: r.state.cities[0], a: r.state.attractions[0] }));
