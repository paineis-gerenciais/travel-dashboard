const L = require('./lib');
const fs = require('fs');
const desc = () => {
  const el = document.activeElement; const cs = getComputedStyle(el);
  const dlg = el.closest('[role=dialog]');
  return { tag: el.tagName, label: el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 30), cls: el.className && String(el.className).slice(0, 30),
    outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, shadow: cs.boxShadow === 'none' ? 'none' : cs.boxShadow.slice(0, 40), inDialog: !!dlg, fv: el.matches(':focus-visible') };
};
(async () => {
  const browser = await L.chromium.launch();
  const out = {};
  for (const vp of ['360', '1366']) {
    const ctx = await L.newCtx(browser, vp); const page = await ctx.newPage();
    // teclado em 360 com hasTouch: Tab ainda funciona
    await L.login(page, `qa-kbd-${vp}-${Date.now()}@exemplo.com`);
    await L.criarViagem(page, 'Viagem Teclado');
    await L.cadastrarCidade(page, { cidade: 'Lisboa', checkin: '2030-06-01', checkout: '2030-06-03' });
    await page.getByRole('button', { name: 'Dias' }).click(); await page.waitForTimeout(600);
    await page.evaluate(() => { document.activeElement.blur(); });
    // (1) percorre com Tab ate dar a volta, registrando foco
    const trail = [];
    for (let i = 0; i < 60; i++) { await page.keyboard.press('Tab'); trail.push(await page.evaluate(desc)); }
    const tabbar = await page.evaluate(() => Array.from(document.querySelectorAll('nav[aria-label="Navegação principal"] button')).map(b => b.textContent.trim()));
    const reached = {};
    for (const t of trail) if (tabbar.some(n => t.label && t.label.includes(n.split(/\s+/).pop()) ) && t.cls !== undefined) {}
    const navBtns = trail.filter(t => tabbar.includes(t.label) || tabbar.some(n => n.endsWith(t.label) && t.label.length > 2));
    // captura do foco em cada aba
    const navInfo = [];
    const n = await page.locator('nav[aria-label="Navegação principal"] button').count();
    for (let i = 0; i < n; i++) {
      const b = page.locator('nav[aria-label="Navegação principal"] button').nth(i);
      await page.evaluate(() => document.activeElement.blur());
      // chega por teclado: foca o 1o botao do nav por Tab, avancando
      await b.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); // foco via teclado => focus-visible
      const d = await page.evaluate(desc);
      const bg = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return cs.backgroundColor; });
      navInfo.push({ i, ...d, bg });
      if (i === 2) await page.screenshot({ path: L.S + `/qa-capturas/teclado-foco-aba-${vp}.png`, clip: { x: 0, y: vp === '360' ? 700 : 0, width: vp === '360' ? 360 : 1366, height: vp === '360' ? 100 : 768 } });
    }
    // (2) folha por teclado
    await page.getByRole('button', { name: 'Mais' }).click(); await page.waitForTimeout(500);
    await page.evaluate(() => document.activeElement.blur());
    let abriu = null;
    for (let i = 0; i < 80; i++) { await page.keyboard.press('Tab'); const d = await page.evaluate(desc); if (d.label === 'Abrir Compartilhar') { abriu = i + 1; break; } }
    await page.keyboard.press('Enter'); await page.waitForTimeout(500);
    const sheetOpen = await page.getByRole('dialog').count();
    const aberto = await page.evaluate(desc);
    const tabs15 = [];
    for (let i = 0; i < 15; i++) { await page.keyboard.press('Tab'); tabs15.push(await page.evaluate(desc)); }
    // shift+tab a partir do painel recém aberto
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    const aposEsc = await page.evaluate(desc);
    const dialogosAposEsc = await page.getByRole('dialog').count();
    // reabrir e testar Shift+Tab imediato
    await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    const reaberto = await page.evaluate(desc);
    const shiftTab = [];
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Shift+Tab'); shiftTab.push(await page.evaluate(desc)); }
    await page.keyboard.press('Escape');
    out[vp] = { tabbar, tabbarTabsAlcancados: navInfo, qtdTabsTrail: trail.length, passosAteAbrir: abriu, sheetOpen, aberto, tabs15, aposEsc, dialogosAposEsc, reaberto, shiftTab,
      trailResumo: trail.map(t => t.label) };
    await ctx.close();
  }
  fs.writeFileSync(L.S + '/qa-scripts/B_result.json', JSON.stringify(out, null, 1));
  for (const vp in out) {
    const o = out[vp]; console.log('=== ', vp);
    console.log('tabbar:', o.tabbar);
    for (const n of o.tabbarTabsAlcancados) console.log(' aba', n.i, n.label, '| outline', n.outline, '| shadow', n.shadow, '| focus-visible', n.fv, '| bg', n.bg);
    console.log('passos Tab ate Abrir Compartilhar:', o.passosAteAbrir, 'dialog aberto:', o.sheetOpen, 'foco ao abrir:', o.aberto.tag, o.aberto.label, 'inDialog', o.aberto.inDialog);
    console.log('15 Tabs ->', o.tabs15.map(t => (t.inDialog ? 'D:' : 'FORA:') + t.label).join(' | '));
    console.log('apos Esc: dialogos', o.dialogosAposEsc, 'foco:', o.aposEsc.tag, o.aposEsc.label);
    console.log('reaberto foco:', o.reaberto.tag, o.reaberto.label, 'inDialog', o.reaberto.inDialog);
    console.log('Shift+Tab x3 ->', o.shiftTab.map(t => (t.inDialog ? 'D:' : 'FORA:') + t.label).join(' | '));
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
