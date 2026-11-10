// QA #38 — verificação independente do domínio (split.js / state.js) no worktree wt38.
const WT = '<raiz-do-repositório>/src/domain/';
const { splitSummary, settlements, allSettled, paymentsList, splitCents, toCents } = await import(WT + 'split.js');
const { normalizeState, blankState } = await import(WT + 'state.js');
let falhas = 0;
const ok = (c, msg, extra = '') => { console.log(`[${c ? 'PASS' : 'FAIL'}] ${msg} ${extra}`); if (!c) falhas++; };
const P = (...ns) => ns.map((n) => ({ id: n.toLowerCase(), name: n }));
function mk(people, outras, payments = []) {
  const s = blankState();
  s.settings.participants = P(...people);
  s.otherExpenses = outras.map((o, i) => ({ id: 'o' + i, name: 'D' + i, cost: o.cost, paidBy: o.paidBy, split: o.split }));
  s.settings.payments = payments;
  return normalizeState(s);
}
const fmt = (a) => a.map((x) => `${x.from}->${x.to} ${x.valor.toFixed(2)}`).join(' | ') || '(nenhum)';

// 1. Caso do parecer de dados
{
  const base = [{ cost: 100, paidBy: 'a' }];
  const pg = [{ id: 'p1', de: 'b', para: 'a', valor: 33.33, data: '2030-01-01' }, { id: 'p2', de: 'c', para: 'a', valor: 33.33, data: '2030-01-01' }];
  const s = mk(['A', 'B', 'C'], [...base, { cost: 30, paidBy: 'b' }], pg);
  const ac = settlements(splitSummary(s));
  console.log('caso parecer ->', fmt(ac));
  const m = Object.fromEntries(ac.map((x) => [x.fromId + '>' + x.toId, x.valor]));
  ok(ac.length === 2 && m['a>b'] === 10 && m['c>b'] === 10, 'caso do parecer: A->B 10,00 e C->B 10,00 (o issue diz "C para B 10,00 e A para B 10,00")');
  // sem pagamentos: bruto
  console.log('bruto        ->', fmt(settlements(splitSummary(mk(['A', 'B', 'C'], [...base, { cost: 30, paidBy: 'b' }])))));
}
// 2. 100 por 3: soma fecha
{
  const s = mk(['A', 'B', 'C'], [{ cost: 100, paidBy: 'a' }]);
  const sm = splitSummary(s);
  const owed = sm.rows.map((r) => Math.round(r.owed * 100));
  console.log('100/3 owed(c) ->', owed.join(','), ' acerto:', fmt(settlements(sm)));
  ok(owed.reduce((a, b) => a + b, 0) === 10000, '100/3: soma das partes = 100,00', `partes=${owed}`);
  ok(JSON.stringify(owed) === '[3334,3333,3333]', '100/3: o centavo vai para o primeiro (empate pela ordem)');
  const ac = settlements(sm);
  ok(ac.reduce((a, x) => a + x.cents, 0) === 6666, 'acerto soma 66,66 (o que A tem a receber)');
}
// 3. 1750 em 3 partes
{
  const s = mk(['A', 'B', 'C'], [{ cost: 1750, paidBy: 'a' }]);
  const sm = splitSummary(s);
  const owed = sm.rows.map((r) => Math.round(r.owed * 100));
  ok(owed.reduce((a, b) => a + b, 0) === 175000, '1750/3 soma 1.750,00', `partes=${owed}`);
}
// 4. 4 pessoas, rateio desigual, despesas mistas -> acerto zera todos
{
  const s = mk(['A', 'B', 'C', 'D'], [
    { cost: 100.01, paidBy: 'a' },
    { cost: 59.99, paidBy: 'b', split: { a: 50, b: 25, c: 25 } },
    { cost: 7.77, paidBy: 'c', split: { a: 1, d: 2 } },
    { cost: 1000, paidBy: 'd' },
  ]);
  const sm = splitSummary(s);
  const ac = settlements(sm);
  console.log('4 pessoas ->', fmt(ac));
  const sal = Object.fromEntries(sm.rows.map((r) => [r.id, r.balanceCents]));
  ac.forEach((x) => { sal[x.fromId] += x.cents; sal[x.toId] -= x.cents; });
  ok(Object.values(sal).every((v) => v === 0), '4 pessoas: aplicar o acerto zera todos os saldos', JSON.stringify(sal));
  ok(ac.length <= 3, 'no máximo n-1 transferências', `n=${ac.length}`);
  ok(sm.rows.reduce((a, r) => a + r.balanceCents, 0) === 0, 'soma dos saldos = 0 sem despesa sem pagador');
}
// 5. Aplicar acerto como pagamentos -> allSettled
{
  const s = mk(['A', 'B', 'C', 'D'], [{ cost: 100, paidBy: 'a' }, { cost: 33.33, paidBy: 'c' }, { cost: 50.5, paidBy: 'b', split: { a: 1, d: 1 } }]);
  const ac = settlements(splitSummary(s));
  s.settings.payments = ac.map((x, i) => ({ id: 'q' + i, de: x.fromId, para: x.toId, valor: x.valor, data: '' }));
  const sm2 = splitSummary(s);
  ok(allSettled(sm2) && settlements(sm2).length === 0, 'confirmar todos os acertos -> allSettled e nenhum acerto');
  // desfazer um
  s.settings.payments.pop();
  ok(!allSettled(splitSummary(s)) && settlements(splitSummary(s)).length === 1, 'desfazer um pagamento -> volta 1 acerto pendente');
}
// 6. Despesa sem pagador
{
  const s = mk(['A', 'B', 'C'], [{ cost: 90, paidBy: 'a' }, { cost: 60 }]);
  const sm = splitSummary(s);
  console.log('sem pagador ->', fmt(settlements(sm)), '| unassigned', sm.unassigned, JSON.stringify(sm.unassignedItems));
  ok(sm.unassigned === 60 && sm.unassignedItems.length === 1, 'unassigned = 60 e 1 item');
  ok(!allSettled(sm), 'allSettled falso com despesa sem pagador');
  const so = splitSummary(mk(['A', 'B', 'C'], [{ cost: 60 }]));
  ok(settlements(so).length === 0 && !allSettled(so), 'só despesa sem pagador: sem acerto e allSettled falso ("Ninguém deve nada" não aparece)');
  // pagador que não é mais participante -> trata como sem pagador
  const sx = splitSummary(mk(['A', 'B'], [{ cost: 10, paidBy: 'zz' }]));
  ok(sx.unassigned === 10, 'pagador inexistente vira sem pagador (migrateParticipants zera o paidBy)');
}
// 7. Fuzz: invariantes
{
  let rng = 12345; const r = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let viol = 0;
  for (let t = 0; t < 3000; t++) {
    const n = 2 + Math.floor(r() * 4);
    const names = ['A', 'B', 'C', 'D', 'E'].slice(0, n);
    const outras = Array.from({ length: 1 + Math.floor(r() * 6) }, () => {
      const o = { cost: Math.round(r() * 100000) / 100, paidBy: names[Math.floor(r() * n)].toLowerCase() };
      if (r() < 0.4) { o.split = {}; names.forEach((nm) => { if (r() < 0.7) o.split[nm.toLowerCase()] = Math.floor(r() * 10) + 1; }); }
      return o;
    });
    const s = mk(names, outras);
    const sm = splitSummary(s);
    const totC = outras.reduce((a, o) => a + toCents(o.cost), 0);
    const owedC = sm.rows.reduce((a, x) => a + Math.round(x.owed * 100), 0);
    const sal = sm.rows.reduce((a, x) => a + x.balanceCents, 0);
    const ac = settlements(sm);
    const z = Object.fromEntries(sm.rows.map((x) => [x.id, x.balanceCents]));
    ac.forEach((x) => { z[x.fromId] += x.cents; z[x.toId] -= x.cents; });
    // pagamentos parciais aleatórios e re-cálculo
    s.settings.payments = ac.slice(0, Math.floor(r() * (ac.length + 1))).map((x, i) => ({ id: 'q' + i, de: x.fromId, para: x.toId, valor: x.valor, data: '' }));
    const sm2 = splitSummary(s); const ac2 = settlements(sm2);
    const z2 = Object.fromEntries(sm2.rows.map((x) => [x.id, x.balanceCents]));
    ac2.forEach((x) => { z2[x.fromId] += x.cents; z2[x.toId] -= x.cents; });
    const bad = owedC !== totC || sal !== 0 || Object.values(z).some((v) => v) || Object.values(z2).some((v) => v) ||
      sm2.rows.reduce((a, x) => a + x.balanceCents, 0) !== 0;
    if (bad) { viol++; if (viol < 4) console.log('violação', JSON.stringify({ names, outras }), { owedC, totC, sal }); }
  }
  ok(viol === 0, 'fuzz 3000 cenários: partes somam o total; saldos somam 0; acerto zera; pagamentos parciais + novo acerto zeram', `violações=${viol}`);
}
// 8. Pagamento com valor excedente (pagou a mais): inverte o credor
{
  const s = mk(['A', 'B'], [{ cost: 100, paidBy: 'a' }], [{ id: 'x', de: 'b', para: 'a', valor: 80, data: '' }]);
  const ac = settlements(splitSummary(s));
  console.log('pagou 80 de 50 ->', fmt(ac));
  ok(ac.length === 1 && ac[0].from === 'A' && ac[0].to === 'B' && ac[0].valor === 30, 'pagamento a maior gera acerto reverso de 30,00 (comportamento coerente)');
}
// 9. Pagamento com valor fracionário e id duplicado
{
  const s = mk(['A', 'B'], [{ cost: 100, paidBy: 'a' }], [{ id: 'x', de: 'b', para: 'a', valor: 50, data: '' }, { id: 'x', de: 'b', para: 'a', valor: 50, data: '' }]);
  console.log('ids duplicados -> payments', paymentsList(s).length, 'acerto', fmt(settlements(splitSummary(s))));
}
console.log(falhas ? `\nFALHAS: ${falhas}` : '\nTodas as verificações de domínio passaram');
process.exit(falhas ? 1 : 0);
