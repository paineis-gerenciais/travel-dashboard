// Complemento: cada chip rolado para a vista e avaliado isoladamente pelo axe (regra color-contrast)
const L = require('./lib2.js');
const ST = ['Planejado', 'Reservado', 'Pago', 'Cancelado'];
(async () => {
  const browser = await L.chromium.launch();
  const rows = [];
  for (const vp of ['360', '1366']) {
    const ctx = await L.newCtx(browser, vp); const page = await ctx.newPage();
    await L.login(page, 'qa3-a@exemplo.com');
    await L.criarViagem(page, 'QA2 C2 ' + vp + ' ' + Date.now());
    await L.cadastrarCidade(page, { cidade: 'Porto', checkin: '2030-07-01', checkout: '2030-07-03' });
    await page.getByRole('button', { name: 'Dias' }).click();
    const main = page.getByRole('main');
    for (const [i, st] of ST.entries()) {
      await page.getByRole('button', { name: '+ Atração' }).click();
      const ed = page.getByRole('dialog', { name: 'Editar atração' });
      await ed.getByLabel('Atração').fill('Item ' + st);
      await ed.getByRole('button', { name: 'Concluir' }).click(); await ed.waitFor({ state: 'hidden' });
      if (i > 0) { await main.locator('.row').filter({ hasText: 'Item ' + st }).locator('button.chip').click(); await page.getByRole('option', { name: st }).click(); }
    }
    await page.addScriptTag({ path: L.AXE });
    for (const tema of ['light', 'dark']) {
      const cur = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      if (cur !== tema) { await page.getByRole('button', { name: 'Mais' }).click(); await page.getByRole('main').locator('.row').filter({ hasText: 'Tema' }).getByRole('button', { name: 'Alternar' }).click(); await page.getByRole('button', { name: 'Dias' }).click(); }
      for (const st of ST) {
        const chip = main.locator('.row').filter({ hasText: 'Item ' + st }).locator('button.chip');
        await chip.scrollIntoViewIfNeeded();
        await chip.evaluate(el => el.setAttribute('data-qa2', '1'));
        const r = await page.evaluate(async () => {
          const res = await window.axe.run({ include: [['[data-qa2="1"]']] }, { runOnly: { type: 'rule', values: ['color-contrast'] } });
          document.querySelector('[data-qa2]').removeAttribute('data-qa2');
          const n = [...res.violations, ...res.passes, ...res.incomplete].map(x => ({ estado: res.violations.includes(x) ? 'FALHA' : res.passes.includes(x) ? 'ok' : 'incompleto', d: x.nodes[0] && (x.nodes[0].any[0] || {}).data }))[0];
          return n ? { estado: n.estado, ratio: n.d && n.d.contrastRatio, fg: n.d && n.d.fgColor, bg: n.d && n.d.bgColor, fonte: n.d && n.d.fontSize, peso: n.d && n.d.fontWeight } : { estado: 'inaplicavel' };
        });
        const op = await chip.evaluate(el => { const row = el.closest('.row'); return getComputedStyle(row).opacity + '/' + getComputedStyle(el).opacity; });
        rows.push({ vp, tema, status: st, opacidadeLinha_chip: op, ...r });
      }
    }
    await ctx.close();
  }
  console.log('vp | tema | status | estado | razao | fg | bg | fonte | peso | opac(linha/chip)');
  for (const r of rows) console.log([r.vp, r.tema, r.status, r.estado, r.ratio, r.fg, r.bg, r.fonte, r.peso, r.opacidadeLinha_chip].join(' | '));
  await browser.close();
})().catch(e => { console.error('ERRO', e); process.exit(1); });
