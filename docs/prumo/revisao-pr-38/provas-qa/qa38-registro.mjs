// QA #38 — acerto sobre saldo residual, centavos, migração do legado, no navegador (emuladores).
import { setup, SP, Q, log, step, rec, resumo, sleep, ensureUser, seedTrip, readTrip, patchState, login, abrirPrimeiraViagem } from './lib-registro.mjs';
const { WT, pw, rut } = setup('wt38');
const { chromium, expect } = pw;
const D = WT + '/src/domain/';
const { blankState, normalizeState } = await import(D + 'state.js');
const { splitSummary, settlements } = await import(D + 'split.js');
const BASE = 'http://localhost:4173/';
const AXE = SP + '/qa-tools/node_modules/axe-core/axe.min.js';
const shot = (page, n) => page.screenshot({ path: `${Q}/shots/${n}.png` }).catch(() => {});

const PE = (...ns) => ns.map((n) => ({ id: 'p-' + n.toLowerCase(), name: n }));
function estado(pessoas, despesas, extra = {}) {
  const s = blankState();
  s.settings.participants = PE(...pessoas);
  s.cities = [{ id: 'c-lisboa', city: 'Lisboa', emoji: '📍', start: '2030-06-01', end: '2030-06-03', hotel: '', nightly: 0, status: 'Planejado', notes: '', breakfastIncluded: false }];
  s.otherExpenses = despesas.map((d, i) => ({ id: 'o-' + i, date: '2030-06-02', city: 'Lisboa', name: d.name, cost: d.cost, status: 'Planejado', ...(d.paidBy ? { paidBy: 'p-' + d.paidBy.toLowerCase() } : {}), ...(d.split ? { split: d.split } : {}) }));
  Object.assign(s.settings, extra);
  return s;
}
async function abrirDivisao(page) {
  await page.getByRole('button', { name: 'Custos' }).click();
  await page.getByRole('button', { name: /^ver/i }).first().click();
  const d = page.getByRole('dialog', { name: 'Divisão de despesas' });
  await d.waitFor();
  return d;
}
const texto = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ');
async function aguardaDoc(tripId, pred, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const d = await readTrip(rut, tripId); if (pred(d.state)) return d.state; await sleep(300); }
  throw new Error('doc não atingiu o estado esperado em ' + ms + 'ms: ' + JSON.stringify((await readTrip(rut, tripId)).state.settings.payments));
}
const acertosUI = async (d) => (await d.locator('.row', { hasText: ' paga para ' }).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').replace('✓ Confirmar pagamento', '').replace('➡️', '').trim());
const pagosUI = async (d) => (await d.locator('.row', { hasText: ' pagou a ' }).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').replace('Desfazer', '').replace('✅', '').trim());

const browser = await chromium.launch();
const novoCtx = (opts = {}) => browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });

// ---------- S1: caso do parecer pela tela, confirmar e desfazer
{
  const email = 'qa38-s1@exemplo.com'; const uid = await ensureUser(email); const id = 'trip-qa38-s1';
  await seedTrip(rut, { tripId: id, uid, email, name: 'QA38 S1 parecer', state: estado(['Ana', 'Bia', 'Caio'], [{ name: 'Aluguel casa', cost: 100, paidBy: 'Ana' }]) });
  const ctx = await novoCtx(); const page = await ctx.newPage();
  const logs = []; page.on('console', (m) => { if (m.type() === 'error' && !/Installations|@firebase\/analytics|Failed to load resource: the server responded with a status of 400/.test(m.text())) logs.push(m.text()); }); page.on('pageerror', (e) => logs.push('pageerror ' + e.message));
  await login(page, BASE, email); await abrirPrimeiraViagem(page);
  const d = await abrirDivisao(page);
  await step('S1.1 inicial: 100 por 3, Ana pagou', 'Bia->Ana 33,33 e Caio->Ana 33,33; Ana "deve R$ 33,34"', async () => {
    const a = await acertosUI(d); const t = await texto(d);
    if (a.length !== 2 || !a.some((x) => /Bia paga para Ana.*R\$ 33,33/.test(x)) || !a.some((x) => /Caio paga para Ana.*R\$ 33,33/.test(x))) throw new Error('acertos: ' + JSON.stringify(a));
    if (!/Ana.*Pagou R\$ 100,00 · deve R\$ 33,34/.test(t)) throw new Error('linha da Ana: ' + t.slice(0, 400));
    return JSON.stringify(a);
  });
  await shot(page, 's1-1-inicial');
  await step('S1.2 confirmar Bia->Ana', 'vai para "Pagamentos feitos"; sobra só Caio->Ana', async () => {
    await d.locator('.row', { hasText: 'Bia paga para Ana' }).getByRole('button', { name: /Confirmar pagamento/ }).click();
    await expect(d.getByRole('heading', { name: 'Pagamentos feitos' })).toBeVisible();
    const a = await acertosUI(d); const p = await pagosUI(d);
    if (a.length !== 1 || !/Caio paga para Ana/.test(a[0])) throw new Error('acertos ' + JSON.stringify(a));
    if (p.length !== 1 || !/Bia pagou a Ana.*R\$ 33,33/.test(p[0])) throw new Error('pagos ' + JSON.stringify(p));
    return `acertos=${JSON.stringify(a)} pagos=${JSON.stringify(p)}`;
  });
  await step('S1.3 confirmar Caio->Ana', '"Ninguém deve nada a ninguém." e 2 pagamentos feitos', async () => {
    await d.locator('.row', { hasText: 'Caio paga para Ana' }).getByRole('button', { name: /Confirmar pagamento/ }).click();
    await expect(d.getByText('Ninguém deve nada a ninguém.')).toBeVisible();
    const p = await pagosUI(d); if (p.length !== 2) throw new Error('pagos ' + JSON.stringify(p));
    return JSON.stringify(p);
  });
  await step('S1.4 documento gravado com 2 payments (id, de, para, valor, data) e settlementsDone vazio', 'payments[2] com campos do contrato', async () => {
    const st = await aguardaDoc(id, (s) => (s.settings.payments || []).length === 2);
    const p = st.settings.payments;
    for (const x of p) if (!(x.id && x.de && x.para && typeof x.valor === 'number' && /^\d{4}-\d\d-\d\dT/.test(x.data))) throw new Error('formato: ' + JSON.stringify(x));
    if ((st.settings.settlementsDone || []).length) throw new Error('settlementsDone não vazio');
    return JSON.stringify(p);
  });
  await step('S1.5 colaborador acrescenta despesa de 30 paga por Bia (tempo real): acerto sobre o residual', 'Ana->Bia 10,00 e Caio->Bia 10,00; nunca 43,33/13,33', async () => {
    await patchState(rut, id, (s) => { s.otherExpenses.push({ id: 'o-30', date: '2030-06-02', city: 'Lisboa', name: 'Jantar', cost: 30, status: 'Planejado', paidBy: 'p-bia' }); });
    await expect(d.getByText('Jantar').or(d.getByText(/Ana paga para Bia/))).toBeVisible({ timeout: 8000 });
    await sleep(500);
    const a = await acertosUI(d);
    if (a.length !== 2 || !a.some((x) => /Ana paga para Bia.*R\$ 10,00/.test(x)) || !a.some((x) => /Caio paga para Bia.*R\$ 10,00/.test(x))) throw new Error('acertos ' + JSON.stringify(a));
    if (a.some((x) => x.includes('43,33') || x.includes('13,33'))) throw new Error('apareceu valor do bruto antigo');
    return JSON.stringify(a);
  });
  await shot(page, 's1-5-residual');
  await step('S1.6 desfazer o pagamento de Bia', 'sai de "Pagamentos feitos"; acerto = Bia->Ana 13,33 e Caio->Ana 10,00 (conta manual)', async () => {
    await d.locator('.row', { hasText: 'Bia pagou a Ana' }).getByRole('button', { name: 'Desfazer' }).click();
    await sleep(400);
    const a = await acertosUI(d); const p = await pagosUI(d);
    if (p.length !== 1 || /Bia pagou/.test(p[0])) throw new Error('pagos ' + JSON.stringify(p));
    if (a.length !== 2 || !a.some((x) => /Bia paga para Ana.*R\$ 13,33/.test(x)) || !a.some((x) => /Caio paga para Ana.*R\$ 10,00/.test(x))) throw new Error('acertos ' + JSON.stringify(a));
    const st = await aguardaDoc(id, (s) => (s.settings.payments || []).length === 1);
    return `acertos=${JSON.stringify(a)} doc.payments=${st.settings.payments.length}`;
  });
  await step('S1.7 sem erros de console', 'nenhum console.error / pageerror', async () => { if (logs.length) throw new Error(JSON.stringify(logs.slice(0, 3))); });
  await ctx.close();
}

// ---------- S2: 4 pessoas, centavos que não fecham, rateio desigual; UI == domínio == conta manual
{
  const email = 'qa38-s2@exemplo.com'; const uid = await ensureUser(email); const id = 'trip-qa38-s2';
  const desp = [
    { name: 'Hotel', cost: 100.01, paidBy: 'Ana' },
    { name: 'Tour', cost: 59.99, paidBy: 'Bia', split: { 'p-ana': 50, 'p-bia': 25, 'p-caio': 25 } },
    { name: 'Taxi', cost: 7.77, paidBy: 'Caio', split: { 'p-ana': 1, 'p-davi': 2 } },
    { name: 'Mercado', cost: 1000, paidBy: 'Davi' },
  ];
  const st0 = estado(['Ana', 'Bia', 'Caio', 'Davi'], desp);
  await seedTrip(rut, { tripId: id, uid, email, name: 'QA38 S2 quatro', state: st0 });
  const esperado = settlements(splitSummary(normalizeState(JSON.parse(JSON.stringify(st0)))));
  const ctx = await novoCtx(); const page = await ctx.newPage();
  await login(page, BASE, email); await abrirPrimeiraViagem(page);
  const d = await abrirDivisao(page);
  await step('S2.1 acertos da tela == domínio', 'mesmas transferências e valores', async () => {
    const a = await acertosUI(d);
    const exp = esperado.map((x) => `${x.from} paga para ${x.to} R$ ${x.valor.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`);
    const ok = a.length === exp.length && exp.every((e, i) => a[i].startsWith(e.split(' R$ ')[0]) && a[i].endsWith('R$ ' + e.split(' R$ ')[1]));
    if (!ok) throw new Error(`UI=${JSON.stringify(a)} dominio=${JSON.stringify(exp)}`);
    return JSON.stringify(a);
  });
  await step('S2.2 confirmar todos um a um: "Ninguém deve nada" só ao final', 'enquanto sobra acerto não aparece a frase; ao final aparece', async () => {
    for (let k = 0; k < 5; k++) {
      const n = await d.getByRole('button', { name: /Confirmar pagamento/ }).count();
      if (n === 0) break;
      if (await d.getByText('Ninguém deve nada a ninguém.').count()) throw new Error('frase apareceu com acerto pendente');
      await d.getByRole('button', { name: /Confirmar pagamento/ }).first().click(); await sleep(200);
    }
    await expect(d.getByText('Ninguém deve nada a ninguém.')).toBeVisible();
    const p = await pagosUI(d); if (p.length !== esperado.length) throw new Error('pagos ' + p.length);
    const t = await texto(d); const zeros = (t.match(/\+R\$ 0,00/g) || []).length;
    if (zeros !== 4) throw new Error('saldos não são 4x +R$ 0,00: ' + t.slice(0, 600));
    return `${p.length} pagamentos; 4 saldos +R$ 0,00`;
  });
  await shot(page, 's2-quatro-quitado');
  await ctx.close();
}

// ---------- S3: despesa sem pagador
{
  const email = 'qa38-s3@exemplo.com'; const uid = await ensureUser(email);
  const id1 = 'trip-qa38-s3a';
  await seedTrip(rut, { tripId: id1, uid, email, name: 'QA38 S3a so sem pagador', state: estado(['Ana', 'Bia', 'Caio'], [{ name: 'Passeio barco', cost: 90 }]) });
  const ctx = await novoCtx(); const page = await ctx.newPage();
  await login(page, BASE, email); await abrirPrimeiraViagem(page);
  const d = await abrirDivisao(page);
  await step('S3.1 só despesa sem pagador', 'sem "Ninguém deve nada"; aviso cita "Passeio barco (R$ 90,00)"', async () => {
    const t = await texto(d);
    if (t.includes('Ninguém deve nada')) throw new Error('mostrou "Ninguém deve nada"');
    if (!/Há despesa sem pagador definido: Passeio barco \(R\$ 90,00\)/.test(t)) throw new Error('sem aviso: ' + t.slice(0, 700));
    return 'aviso presente; saldos: ' + (t.match(/-R\$ \d+,\d\d/g) || []).join(' ');
  });
  await shot(page, 's3-sem-pagador');
  await ctx.close();
  // S3b: sem pagador + acerto
  const email2 = 'qa38-s3b@exemplo.com'; const uid2 = await ensureUser(email2);
  await seedTrip(rut, { tripId: 'trip-qa38-s3b', uid: uid2, email: email2, name: 'QA38 S3b', state: estado(['Ana', 'Bia', 'Caio'], [{ name: 'Aluguel', cost: 90, paidBy: 'Ana' }, { name: 'Passeio barco', cost: 60 }]) });
  const ctx2 = await novoCtx(); const page2 = await ctx2.newPage();
  await login(page2, BASE, email2); await abrirPrimeiraViagem(page2);
  const d2 = await abrirDivisao(page2);
  await step('S3.2 sem pagador combinado com acerto', 'acerto sobre o atribuído (Bia->Ana 40,00 e Caio->Ana 20,00?) + aviso "R$ 60,00 ainda sem pagador"; sem "Ninguém deve nada"', async () => {
    const a = await acertosUI(d2); const t = await texto(d2);
    const exp = settlements(splitSummary(normalizeState(estado(['Ana', 'Bia', 'Caio'], [{ name: 'Aluguel', cost: 90, paidBy: 'Ana' }, { name: 'Passeio barco', cost: 60 }])))).map((x) => `${x.from}>${x.to}:${x.valor}`);
    if (!/R\$ 60,00 ainda sem pagador definido/.test(t)) throw new Error('sem aviso geral');
    if (t.includes('Ninguém deve nada')) throw new Error('frase indevida');
    return `UI=${JSON.stringify(a)} dominio=${JSON.stringify(exp)}`;
  });
  await step('S3.3 confirmar todos os acertos com despesa sem pagador ainda aberta', 'não mostra "Ninguém deve nada"; mostra o aviso da despesa', async () => {
    while (await d2.getByRole('button', { name: /Confirmar pagamento/ }).count()) { await d2.getByRole('button', { name: /Confirmar pagamento/ }).first().click(); await sleep(200); }
    const t = await texto(d2);
    if (t.includes('Ninguém deve nada')) throw new Error('mostrou "Ninguém deve nada" com despesa sem pagador');
    if (!/Há despesa sem pagador definido: Passeio barco/.test(t)) throw new Error('sem aviso: ' + t.slice(0, 900));
    return 'aviso presente; sem frase de quitação';
  });
  await ctx2.close();
}

// ---------- S4: legado settlementsDone -> payments, no navegador
const idLeg = 'trip-qa38-s4';
{
  const email = 'qa38-s4@exemplo.com'; const uid = await ensureUser(email);
  const legado = estado(['Ana', 'Bia', 'Caio'], [{ name: 'Aluguel casa', cost: 100, paidBy: 'Ana' }, { name: 'Jantar', cost: 30, paidBy: 'Bia' }]);
  delete legado.settings.payments; // documento antigo não tem o campo
  legado.settings.settlementsDone = [
    { key: 'p-bia>p-ana>3333', at: '2026-11-09T14:00:00.000Z' },
    { key: 'p-caio>p-ana>3333', at: '2026-11-09T14:05:00.000Z' },
    { key: 'lixo-sem-formato', at: 'x' },
  ];
  await seedTrip(rut, { tripId: idLeg, uid, email, name: 'QA38 S4 legado', state: legado });
  const pre = (await readTrip(rut, idLeg)).state;
  log('   doc inicial: settlementsDone=' + JSON.stringify(pre.settings.settlementsDone) + ' payments=' + JSON.stringify(pre.settings.payments));
  const ctx = await novoCtx(); const page = await ctx.newPage();
  await login(page, BASE, email);
  const t0 = Date.now(); await abrirPrimeiraViagem(page);
  const d = await abrirDivisao(page);
  await step('S4.0 só ABRIR a viagem (nenhuma edição): quando o documento é regravado já migrado?', 'registrar: se grava ao abrir, a conversão persiste sem ação do usuário', async () => {
    let t = null;
    while (Date.now() - t0 < 8000) { const st = (await readTrip(rut, idLeg)).state; if (st.settings.payments && !(st.settings.settlementsDone || []).length) { t = Date.now() - t0; break; } await sleep(100); }
    if (t === null) return 'NÃO regravado em 8 s: migração só em memória até haver edição';
    return `documento regravado já migrado ${t} ms depois de abrir, sem nenhuma edição do usuário`;
  });
  await step('S4.1 ao abrir (sem editar): pagamentos migrados aparecem e saldos batem', '2 em "Pagamentos feitos" (Bia e Caio pagaram a Ana 33,33); acertos Ana->Bia 10,00 e Caio->Bia 10,00', async () => {
    const p = await pagosUI(d); const a = await acertosUI(d);
    if (p.length !== 2 || !p.some((x) => /Bia pagou a Ana.*R\$ 33,33/.test(x)) || !p.some((x) => /Caio pagou a Ana.*R\$ 33,33/.test(x))) throw new Error('pagos ' + JSON.stringify(p));
    if (a.length !== 2 || !a.some((x) => /Ana paga para Bia.*R\$ 10,00/.test(x)) || !a.some((x) => /Caio paga para Bia.*R\$ 10,00/.test(x))) throw new Error('acertos ' + JSON.stringify(a));
    return `pagos=${JSON.stringify(p)} acertos=${JSON.stringify(a)}`;
  });
  await shot(page, 's4-1-legado-migrado');
  await step('S4.2 sem edição, o documento ainda é o antigo (migração só em memória até gravar)', '(registrar) estado do documento depois de 1,5 s', async () => {
    await sleep(1500);
    const s = (await readTrip(rut, idLeg)).state;
    return `settlementsDone=${(s.settings.settlementsDone || []).length} payments=${s.settings.payments === undefined ? 'ausente' : s.settings.payments.length}`;
  });
  // edição qualquer: nota da cidade
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Cidades' }).click();
  await page.getByRole('main').getByRole('button', { name: 'Editar' }).first().click();
  const ed = page.getByRole('dialog', { name: 'Editar cidade' }); await ed.waitFor();
  await ed.getByLabel('Notas').fill('nota de QA'); await ed.getByRole('button', { name: 'Concluir' }).click();
  await step('S4.3 após edição: documento salvo com payments preenchido e settlementsDone vazio', 'payments=2 com ids mig-<key>-<at>; settlementsDone=[]', async () => {
    const st = await aguardaDoc(idLeg, (s) => (s.settings.payments || []).length > 0);
    const p = st.settings.payments;
    if (p.length !== 2) throw new Error('payments ' + JSON.stringify(p));
    if ((st.settings.settlementsDone || []).length !== 0) throw new Error('settlementsDone ' + JSON.stringify(st.settings.settlementsDone));
    return JSON.stringify(p);
  });
  await step('S4.4 reabrir (recarregar): sem duplicação', 'continuam 2 pagamentos; mesmos acertos; doc com 2', async () => {
    await page.reload(); await page.waitForFunction(() => typeof window.__E2E_LOGIN__ === 'function');
    await page.getByRole('button', { name: 'Abrir', exact: true }).first().waitFor({ timeout: 15000 }).catch(() => {});
    if (await page.getByRole('button', { name: 'Abrir', exact: true }).count()) await abrirPrimeiraViagem(page);
    const d2 = await abrirDivisao(page);
    const p = await pagosUI(d2); const a = await acertosUI(d2);
    if (p.length !== 2) throw new Error('pagos ' + JSON.stringify(p));
    const st = (await readTrip(rut, idLeg)).state;
    if (st.settings.payments.length !== 2) throw new Error('doc ' + st.settings.payments.length);
    return `pagos=${p.length} acertos=${JSON.stringify(a)}`;
  });
  await step('S4.5 "aba antiga" regrava settlementsDone com as mesmas entradas (payments mantido)', 'ao abrir: continuam 2 pagamentos (ids determinísticos), settlementsDone zerado ao próximo salvamento', async () => {
    await patchState(rut, idLeg, (s) => { s.settings.settlementsDone = [{ key: 'p-bia>p-ana>3333', at: '2026-11-09T14:00:00.000Z' }, { key: 'p-caio>p-ana>3333', at: '2026-11-09T14:05:00.000Z' }]; });
    await sleep(1500);
    const d3 = page.getByRole('dialog', { name: 'Divisão de despesas' });
    const p = await pagosUI(d3);
    if (p.length !== 2) throw new Error('pagos na tela ' + p.length + ' ' + JSON.stringify(p));
    return `na tela: ${p.length} pagamentos`;
  });
  await step('S4.6 legado "obsoleto": chave com valor diferente do residual atual', 'o pagamento antigo entra pelo valor da chave (33,33), mesmo que o valor sugerido hoje seja outro (registrar)', async () => {
    return 'coberto por S4.1 (a chave 33,33 estava obsoleta frente ao novo bruto 43,33 e mesmo assim abateu) — ver parecer';
  });
  await ctx.close();
}

// ---------- S5: data do pagamento perto da meia-noite (UTC x fuso do Brasil)
{
  const email = 'qa38-s5@exemplo.com'; const uid = await ensureUser(email); const id = 'trip-qa38-s5';
  await seedTrip(rut, { tripId: id, uid, email, name: 'QA38 S5 data', state: estado(['Ana', 'Bia'], [{ name: 'Aluguel', cost: 100, paidBy: 'Ana' }]) });
  const ctx = await novoCtx({ timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' }); const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-11-10T23:30:00-03:00'));
  await login(page, BASE, email); await abrirPrimeiraViagem(page);
  const d = await abrirDivisao(page);
  await step('S5.1 confirmar às 23:30 de 10/11 (Brasília): data exibida', '"10/11/2026" (dia local do usuário)', async () => {
    await d.getByRole('button', { name: /Confirmar pagamento/ }).first().click();
    await sleep(500);
    const p = await pagosUI(d);
    const st = await aguardaDoc(id, (s) => (s.settings.payments || []).length === 1);
    const iso = st.settings.payments[0].data;
    if (!/10\/11\/2026/.test(p[0])) throw new Error(`tela="${p[0]}" data gravada=${iso}`);
    return `tela="${p[0]}" data gravada=${iso}`;
  });
  await ctx.close();
}

// ---------- S6: responsivo 360 px, axe e eventos
{
  const email = 'qa38-s1@exemplo.com';
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const reqs = []; page.on('request', (r) => { if (/google-analytics|googletagmanager|firebase.*analytics|collect\?/.test(r.url())) reqs.push(r.url().slice(0, 140)); });
  await login(page, BASE, email); await abrirPrimeiraViagem(page);
  const d = await abrirDivisao(page);
  await d.getByRole('heading', { name: 'Pagamentos feitos' }).scrollIntoViewIfNeeded();
  await shot(page, 's6-mobile-360');
  await step('S6.1 360 px: sem rolagem horizontal na folha', 'scrollWidth <= clientWidth', async () => {
    const r = await page.evaluate(() => { const el = document.querySelector('[role=dialog]'); return { sw: el.scrollWidth, cw: el.clientWidth, dw: document.documentElement.scrollWidth, vw: innerWidth }; });
    if (r.sw > r.cw + 1 || r.dw > r.vw + 1) throw new Error(JSON.stringify(r));
    return JSON.stringify(r);
  });
  await step('S6.2 axe na folha (WCAG A/AA)', 'sem violações serious/critical', async () => {
    await page.addScriptTag({ path: AXE });
    const r = await page.evaluate(async () => (await axe.run(document.querySelector('[role=dialog]'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length })));
    const graves = r.filter((v) => ['serious', 'critical'].includes(v.impact));
    if (graves.length) throw new Error(JSON.stringify(graves));
    return 'violações: ' + JSON.stringify(r);
  });
  await step('S6.3 nomes acessíveis dos botões repetidos "Desfazer"/"Confirmar pagamento"', 'cada botão identifica o pagamento (aria-label) — registrar se genérico', async () => {
    const nomes = await d.getByRole('button', { name: /Desfazer|Confirmar pagamento/ }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || e.textContent.trim()));
    if (nomes.length > 1 && new Set(nomes).size < nomes.length) throw new Error('nomes repetidos e sem contexto: ' + JSON.stringify(nomes));
    return JSON.stringify(nomes);
  });
  rec('S6.4 evento settlement_confirmed em runtime', 'requisição de analytics com o evento', reqs.length ? JSON.stringify(reqs) : 'nenhuma requisição de analytics capturada (emulador/sem measurementId): verificado só por leitura do código', true);
  await ctx.close();
}
await browser.close();
process.exit(resumo() ? 1 : 0);
