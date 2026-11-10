const L = require('./lib');
const fs = require('fs');
const collect = () => {
  const n = performance.getEntriesByType('navigation')[0];
  const res = performance.getEntriesByType('resource');
  const by = {}; let total = 0;
  for (const r of res) { const t = r.initiatorType + ':' + (r.name.match(/\.(js|css|png|svg|woff2?|json|webmanifest)(\?|$)/) || [, 'outro'])[1]; by[t] = by[t] || { n: 0, kB: 0 }; by[t].n++; by[t].kB += r.transferSize / 1024; total += r.transferSize; }
  const js = res.filter(r => /\.js(\?|$)/.test(r.name)).map(r => ({ f: r.name.split('/').pop(), kB: +(r.transferSize / 1024).toFixed(1), enc: +(r.encodedBodySize / 1024).toFixed(1) }));
  for (const k in by) by[k].kB = +by[k].kB.toFixed(1);
  const paint = performance.getEntriesByType('paint').map(p => `${p.name}=${Math.round(p.startTime)}`);
  return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), paint, totalKB: +(total / 1024).toFixed(1), by, js };
};
(async () => {
  const browser = await L.chromium.launch(); const out = { login: [], dias: [] };
  const email = `qa-perf-${Date.now()}@exemplo.com`;
  // prepara conta com viagem
  const c0 = await L.newCtx(browser, '1366', { serviceWorkers: 'block' }); const p0 = await c0.newPage();
  await L.login(p0, email); await L.criarViagem(p0, 'Viagem Perf');
  await L.cadastrarCidade(p0, { cidade: 'Lisboa', checkin: '2030-06-01', checkout: '2030-06-03' });
  await p0.waitForTimeout(2500);
  const state = await c0.storageState({ indexedDB: true }); fs.writeFileSync(L.S + '/qa-scripts/D_state.json', JSON.stringify(state)); await c0.close();
  // login (nao logado): contexto limpo, 3 repeticoes
  for (let i = 0; i < 3; i++) {
    const c = await L.newCtx(browser, '1366', { serviceWorkers: 'block' }); const p = await c.newPage();
    await p.goto(L.BASE); await p.getByRole('button').first().waitFor(); await p.waitForTimeout(1500);
    out.login.push(await p.evaluate(collect)); await c.close();
  }
  // Dias: contexto com sessao salva
  for (let i = 0; i < 3; i++) {
    const c = await L.newCtx(browser, '1366', { serviceWorkers: 'block', storageState: state }); const p = await c.newPage();
    await p.goto(L.BASE); await p.waitForTimeout(3000);
    const heading = await p.evaluate(() => document.querySelector('h1,h2')?.textContent);
    if (i === 0) {
      // entra na viagem se estiver em Minhas viagens
      const tel = await p.getByRole('navigation', { name: /navegação principal/i }).count();
      out.nav = { heading, temTabbar: tel };
    }
    if (!(await p.getByRole('navigation', { name: /navegação principal/i }).count())) {
      await p.getByText('Viagem Perf').first().click(); await p.getByRole('navigation', { name: /navegação principal/i }).waitFor();
    }
    await p.getByRole('button', { name: 'Dias' }).click(); await p.waitForTimeout(2000);
    const o = await p.evaluate(collect); o.tabs = await p.getByRole('tab').count(); out.dias.push(o); await c.close();
  }
  fs.writeFileSync(L.S + '/qa-scripts/D_result.json', JSON.stringify(out, null, 1));
  const med = a => a.sort((x, y) => x - y)[1];
  for (const k of ['login', 'dias']) {
    console.log(k, 'DCL ms', out[k].map(o => o.dcl), 'load ms', out[k].map(o => o.load), 'total kB', out[k].map(o => o.totalKB), 'paint', out[k][0].paint);
    console.log(k, 'por tipo (run 1):', JSON.stringify(out[k][0].by));
    console.log(k, 'JS (run 1):', JSON.stringify(out[k][0].js));
  }
  console.log(JSON.stringify(out.nav), 'tabs Dias', out.dias.map(o => o.tabs));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
