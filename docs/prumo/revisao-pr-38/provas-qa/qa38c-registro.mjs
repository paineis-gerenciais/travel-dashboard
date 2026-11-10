// QA #38 — pagamento de participante que depois é removido (órfão) e clique duplo.
import { setup, Q, step, resumo, sleep, ensureUser, seedTrip, readTrip, patchState, login, abrirPrimeiraViagem } from './lib-registro.mjs';
const { WT, pw, rut } = setup('wt38');
const { blankState } = await import(WT + '/src/domain/state.js');
const email = 'qa38-s7@exemplo.com'; const uid = await ensureUser(email);
const s = blankState();
s.settings.participants = [{ id: 'p-ana', name: 'Ana' }, { id: 'p-bia', name: 'Bia' }, { id: 'p-caio', name: 'Caio' }];
s.cities = [{ id: 'c1', city: 'Lisboa', emoji: '📍', start: '2030-06-01', end: '2030-06-03', hotel: '', nightly: 0, status: 'Planejado', notes: '', breakfastIncluded: false }];
s.otherExpenses = [{ id: 'o1', date: '2030-06-02', city: 'Lisboa', name: 'Aluguel', cost: 90, status: 'Planejado', paidBy: 'p-ana' }];
s.settings.payments = [{ id: 'x1', de: 'p-bia', para: 'p-ana', valor: 30, data: '2026-11-09T14:00:00.000Z' }];
await seedTrip(rut, { tripId: 't-s7', uid, email, name: 'S7', state: s });
const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
await login(page, 'http://localhost:4173/', email); await abrirPrimeiraViagem(page);
await page.getByRole('button', { name: 'Custos' }).click();
await page.getByRole('button', { name: /^ver/i }).first().click();
const d = page.getByRole('dialog', { name: 'Divisão de despesas' }); await d.waitFor();
const txt = async () => (await d.innerText()).replace(/\s+/g, ' ');
await step('S7.1 base: Bia pagou 30 a Ana; sobra Caio->Ana 30', 'acerto Caio paga para Ana R$ 30,00', async () => {
  const t = await txt(); if (!/Caio paga para Ana.*R\$ 30,00/.test(t)) throw new Error(t.slice(0, 500)); return 'ok';
});
await step('S7.2 participante com pagamento é removido (outro colaborador edita a lista)', 'idealmente: aviso ou pagamento seguindo o id; registrar o que a tela mostra', async () => {
  await patchState(rut, 't-s7', (st) => { st.settings.participants = st.settings.participants.filter((p) => p.id !== 'p-bia'); });
  await sleep(1200);
  const t = await txt();
  const lista = (await d.locator('.row', { hasText: ' pagou a ' }).allInnerTexts()).map((x) => x.replace(/\s+/g, ' '));
  const ac = (await d.locator('.row', { hasText: ' paga para ' }).allInnerTexts()).map((x) => x.replace(/\s+/g, ' '));
  return `pagos=${JSON.stringify(lista)} acertos=${JSON.stringify(ac)}`;
});
await step('S7.3 Desfazer do pagamento órfão funciona', 'remove da lista', async () => {
  const b = d.locator('.row', { hasText: ' pagou a ' }).getByRole('button', { name: 'Desfazer' });
  if (await b.count() === 0) throw new Error('sem botão Desfazer');
  await b.click(); await sleep(300);
  if (await d.locator('.row', { hasText: ' pagou a ' }).count()) throw new Error('permaneceu'); return 'ok';
});
await browser.close();
process.exit(resumo() ? 1 : 0);
