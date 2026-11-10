const L = require('./lib2.js');
const ST = ['Planejado', 'Reservado', 'Pago', 'Cancelado'];
async function runAxe(page) {
  await page.addScriptTag({ path: L.AXE });
  return page.evaluate(async () => {
    const r = await window.axe.run({ exclude: [['[data-testid="print-view"]']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    const info = n => { const d = (n.any[0] || n.all[0] || n.none[0] || {}); return { target: n.target.join(' '), html: n.html.slice(0, 120), data: d.data && d.data.contrastRatio ? { ratio: d.data.contrastRatio, fg: d.data.fgColor, bg: d.data.bgColor, esperado: d.data.expectedContrastRatio, fonte: d.data.fontSize, peso: d.data.fontWeight } : null, msg: d.message }; };
    return {
      violations: r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, todos: v.nodes.map(info) })),
      contrastPasses: (r.passes.find(p => p.id === 'color-contrast') || { nodes: [] }).nodes.map(info),
      incompleteContrast: (r.incomplete.find(p => p.id === 'color-contrast') || { nodes: [] }).nodes.map(info),
    };
  });
}
(async () => {
  const browser = await L.chromium.launch();
  const out = [];
  for (const vp of ['360', '1366']) {
    const ctx = await L.newCtx(browser, vp); const page = await ctx.newPage();
    await L.login(page, 'qa3-a@exemplo.com');
    await L.criarViagem(page, 'QA2 A10 ' + vp + ' ' + Date.now());
    await L.cadastrarCidade(page, { cidade: 'Porto', checkin: '2030-07-01', checkout: '2030-07-03', diaria: '10000' });
    await page.getByRole('button', { name: 'Dias' }).click();
    const main = page.getByRole('main');
    for (const [i, st] of ST.entries()) {
      await page.getByRole('button', { name: '+ Atração' }).click();
      const ed = page.getByRole('dialog', { name: 'Editar atração' });
      await ed.getByLabel('Atração').fill('Item ' + st);
      await ed.getByLabel('Custo', { exact: false }).first().fill('5000').catch(() => {});
      await ed.getByRole('button', { name: 'Concluir' }).click(); await ed.waitFor({ state: 'hidden' });
      if (i > 0) {
        const row = main.locator('.row').filter({ hasText: 'Item ' + st });
        await row.locator('button.chip').click();
        await page.getByRole('option', { name: st }).click();
      }
    }
    const chipsDias = await main.locator('.dias-card .chip').allTextContents();
    console.log(vp, 'chips visiveis em Dias:', JSON.stringify(chipsDias));
    const themeNow = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const setTheme = async (want) => {
      if ((await themeNow()) === want) return;
      await page.getByRole('button', { name: 'Mais' }).click();
      await page.getByRole('main').locator('.row').filter({ hasText: 'Tema' }).getByRole('button', { name: 'Alternar' }).click();
      console.log(vp, 'tema agora:', await themeNow());
    };
    for (const tema of ['light', 'dark']) {
      await setTheme(tema);
      // Dias
      await page.getByRole('button', { name: 'Dias' }).click();
      await page.getByRole('main').locator('.dias-card .chip').first().waitFor();
      await page.screenshot({ path: `${L.CAP}/A10_${vp}_${tema}_dias.png` });
      out.push({ vp, tema, tela: 'Dias', theme: await themeNow(), chips: await page.getByRole('main').locator('.dias-card .chip').allTextContents(), axe: await runAxe(page) });
      // Dias, menu de status aberto (mostra os 4 chips como opcoes)
      await page.getByRole('main').locator('.dias-card button.chip').first().click();
      await page.getByRole('option', { name: 'Cancelado' }).waitFor();
      await page.screenshot({ path: `${L.CAP}/A10_${vp}_${tema}_dias_menu.png` });
      out.push({ vp, tema, tela: 'Dias (menu de status aberto)', theme: await themeNow(), chips: await page.locator('.chip-menu .chip').allTextContents(), axe: await runAxe(page) });
      await page.keyboard.press('Escape'); await page.locator('.chip-backdrop').click({ position: { x: 3, y: 3 } }).catch(() => {});
      // Custos
      await page.getByRole('button', { name: 'Custos' }).click();
      await page.getByRole('heading', { name: 'Por status' }).waitFor();
      await page.screenshot({ path: `${L.CAP}/A10_${vp}_${tema}_custos.png` });
      out.push({ vp, tema, tela: 'Custos', theme: await themeNow(), chips: await page.getByRole('main').locator('.chip').allTextContents(), axe: await runAxe(page) });
    }
    await ctx.close();
  }
  require('fs').writeFileSync(L.SP + '/qa2-C_resultado.json', JSON.stringify(out, null, 1));
  console.log('ok', out.length);
  await browser.close();
})().catch(e => { console.error('ERRO', e); process.exit(1); });
