const L = require('./lib');
const fs = require('fs');
const over = () => {
  const w = innerWidth; const bad = [];
  document.querySelectorAll('body *').forEach(el => {
    if (el.closest('[data-testid="print-view"]')) return;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width === 0 || cs.visibility === 'hidden' || cs.display === 'none') return;
    if (r.right > w + 1 || r.left < -1) bad.push((el.tagName + '.' + String(el.className).split(' ')[0]) + ` L${Math.round(r.left)} R${Math.round(r.right)}`);
  });
  return { scrollWidth: document.documentElement.scrollWidth, innerWidth: w, hscroll: document.documentElement.scrollWidth > w, foraDaTela: bad.slice(0, 6), nForaDaTela: bad.length };
};
(async () => {
  const browser = await L.chromium.launch(); const out = {};
  for (const vp of ['360', '1366']) {
    const ctx = await L.newCtx(browser, vp); const page = await ctx.newPage(); const r = {};
    const shot = async (n) => { await page.waitForTimeout(700); await page.screenshot({ path: `${L.S}/qa-capturas/${n}-${vp}.png`, fullPage: false }); r[n] = await page.evaluate(over); };
    await L.openApp(page); await page.waitForTimeout(1500); await shot('login');
    await page.evaluate(e => window.__E2E_LOGIN__(e), `qa-resp-${vp}-${Date.now()}@exemplo.com`);
    await page.getByRole('heading', { name: /minhas viagens/i }).waitFor();
    const pular = page.getByRole('button', { name: /^pular$/i });
    if (await pular.isVisible().catch(() => false)) { await shot('onboarding'); await pular.click(); }
    await shot('minhas-viagens');
    await L.criarViagem(page, 'Viagem Responsiva com um nome bem comprido para testar quebra de linha');
    await L.cadastrarCidade(page, { cidade: 'Lisboa', checkin: '2030-06-01', checkout: '2030-06-03', diaria: '10000' });
    await L.cadastrarCidade(page, { cidade: 'Porto', checkin: '2030-06-03', checkout: '2030-06-05', diaria: '25000' });
    await page.getByRole('button', { name: 'Dias' }).click(); await shot('dias');
    await page.getByRole('button', { name: 'Cidades' }).click(); await shot('cidades');
    await page.getByRole('button', { name: 'Custos' }).click(); await shot('custos');
    await page.getByRole('button', { name: 'Mais' }).click(); await shot('mais');
    out[vp] = r; await ctx.close();
  }
  fs.writeFileSync(L.S + '/qa-scripts/C_result.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
