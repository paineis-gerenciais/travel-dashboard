// QA #38 — detalhe do contraste (axe) na folha de divisão, tema claro e escuro, 360 px.
import { setup, SP, Q, log, ensureUser, seedTrip, login, abrirPrimeiraViagem } from './lib-registro.mjs';
const { WT, pw, rut } = setup('wt38');
const AXE = SP + '/qa-tools/node_modules/axe-core/axe.min.js';
const email = 'qa38-s1@exemplo.com'; // criado pelo qa38-registro.mjs? não: o emulador reinicia a cada exec; recria
const uid = await ensureUser(email);
const { blankState } = await import(WT + '/src/domain/state.js');
const s = blankState();
s.settings.participants = [{ id: 'p-ana', name: 'Ana' }, { id: 'p-bia', name: 'Bia' }, { id: 'p-caio', name: 'Caio' }];
s.cities = [{ id: 'c1', city: 'Lisboa', emoji: '📍', start: '2030-06-01', end: '2030-06-03', hotel: '', nightly: 0, status: 'Planejado', notes: '', breakfastIncluded: false }];
s.otherExpenses = [{ id: 'o1', date: '2030-06-02', city: 'Lisboa', name: 'Aluguel', cost: 100, status: 'Planejado', paidBy: 'p-ana' }];
s.settings.payments = [{ id: 'x1', de: 'p-bia', para: 'p-ana', valor: 33.33, data: '2026-11-09T14:00:00.000Z' }];
await seedTrip(rut, { tripId: 't-axe', uid, email, name: 'axe', state: s });
const browser = await pw.chromium.launch();
for (const tema of ['claro', 'escuro']) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, colorScheme: tema === 'escuro' ? 'dark' : 'light' });
  const page = await ctx.newPage();
  await login(page, 'http://localhost:4173/', email); await abrirPrimeiraViagem(page);
  await page.getByRole('button', { name: 'Custos' }).click();
  await page.getByRole('button', { name: /^ver/i }).first().click();
  await page.getByRole('dialog', { name: 'Divisão de despesas' }).waitFor();
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(async () => (await axe.run(document.querySelector('[role=dialog]'), { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => ({ html: n.html.slice(0, 160), msg: n.any[0]?.message })) })));
  console.log('TEMA', tema, JSON.stringify(r, null, 1));
  await ctx.close();
}
await browser.close();
