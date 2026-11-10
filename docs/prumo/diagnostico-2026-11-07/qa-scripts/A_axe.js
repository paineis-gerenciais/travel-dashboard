const L = require('./lib');
const fs = require('fs');
(async () => {
  const browser = await L.chromium.launch();
  const out = {};
  for (const vp of ['360', '1366']) {
    const ctx = await L.newCtx(browser, vp); const page = await ctx.newPage();
    const res = {};
    await L.openApp(page);
    await page.waitForTimeout(1500);
    res['login'] = await L.axe(page);
    const email = `qa-axe-${vp}-${Date.now()}@exemplo.com`;
    await page.evaluate(e => window.__E2E_LOGIN__(e), email);
    await page.getByRole('heading', { name: /minhas viagens/i }).waitFor();
    const pular = page.getByRole('button', { name: /^pular$/i });
    if (await pular.isVisible().catch(() => false)) { res['onboarding'] = await L.axe(page); await pular.click(); }
    await page.waitForTimeout(500);
    res['minhas-viagens'] = await L.axe(page);
    await L.criarViagem(page, 'Viagem QA');
    await L.cadastrarCidade(page, { cidade: 'Lisboa', checkin: '2030-06-01', checkout: '2030-06-03', diaria: '10000' });
    await page.getByRole('button', { name: 'Dias' }).click(); await page.waitForTimeout(800);
    res['dias'] = await L.axe(page);
    res['dias-tabs'] = await page.getByRole('tab').count();
    await page.getByRole('button', { name: 'Cidades' }).click(); await page.waitForTimeout(800);
    res['cidades'] = await L.axe(page);
    await page.getByRole('button', { name: 'Custos' }).click(); await page.waitForTimeout(800);
    res['custos'] = await L.axe(page);
    await page.getByRole('button', { name: 'Mais' }).click(); await page.waitForTimeout(800);
    res['mais'] = await L.axe(page);
    await page.getByRole('button', { name: 'Abrir Compartilhar' }).click(); await page.waitForTimeout(600);
    res['folha-compartilhar'] = await L.axe(page);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Abrir Planilha' }).click(); await page.waitForTimeout(600);
    res['folha-planilha'] = await L.axe(page);
    out[vp] = res; await ctx.close();
  }
  fs.writeFileSync(L.S + '/qa-scripts/A_result.json', JSON.stringify(out, null, 1));
  for (const vp in out) for (const t in out[vp]) {
    const v = out[vp][t]; if (!Array.isArray(v)) { console.log(vp, t, v); continue; }
    console.log(`[${vp}] ${t}: ${v.length} violações`);
    for (const x of v) console.log(`   ${x.impact} ${x.id} (${x.nodes} nós) ${x.sample} :: ${x.summary}`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
