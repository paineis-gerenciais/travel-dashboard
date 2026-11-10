const D = '<raiz-do-repositório>/src/domain/';
const { splitSummary } = await import(D + 'split.js'); const { blankState, normalizeState } = await import(D + 'state.js');
const s = blankState(); s.settings.participants = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bia' }, { id: 'c', name: 'Caio' }];
s.otherExpenses = [{ id: 'o', name: 'Aluguel', cost: 100, paidBy: 'a' }];
s.settings.payments = [{ id: '1', de: 'b', para: 'a', valor: 33.33, data: '' }, { id: '2', de: 'c', para: 'a', valor: 33.33, data: '' }];
console.log(splitSummary(normalizeState(s)).rows.map((r) => `${r.name}: Pagou ${r.paid} · deve ${r.owed} · saldo ${r.balance}`).join('\n'));
