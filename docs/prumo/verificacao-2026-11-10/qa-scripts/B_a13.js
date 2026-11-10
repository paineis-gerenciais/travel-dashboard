const L = require('./lib2.js');
(async () => {
  const browser = await L.chromium.launch();
  const out = {};
  for (const vp of ['360', '1366']) {
    const ctx = await L.newCtx(browser, vp); const page = await ctx.newPage();
    await L.login(page, 'qa3-a@exemplo.com');
    await L.criarViagem(page, 'QA2 A13 ' + vp + ' ' + Date.now());
    await L.cadastrarCidade(page, { cidade: 'Porto', checkin: '2030-07-01', checkout: '2030-07-03' });
    await page.getByRole('button', { name: 'Dias' }).click();
    await page.getByRole('button', { name: '+ Atração' }).click();
    const ed = page.getByRole('dialog', { name: 'Editar atração' });
    await ed.getByLabel('Atração').fill('Torre dos Clerigos');
    await ed.getByRole('button', { name: 'Concluir' }).click(); await ed.waitFor({ state: 'hidden' });
    await page.screenshot({ path: `${L.CAP}/A13_${vp}_0_antes.png` });
    await page.getByRole('main').getByRole('button', { name: 'Comentar' }).first().click();
    const dlg = page.getByRole('dialog', { name: 'Comentários' }); await dlg.waitFor();
    await page.waitForTimeout(600); // fim da animacao
    const m = await page.evaluate(() => {
      const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), right: +b.right.toFixed(1), bottom: +b.bottom.toFixed(1) }; };
      const bd = document.querySelector('.sheet-backdrop'); const sh = document.querySelector('.sheet');
      const card = document.querySelector('.dias-card');
      const cs = bd && getComputedStyle(bd);
      const hit = (x, y) => { const e = document.elementFromPoint(x, y); return e ? (e.className || e.tagName) + '' : null; };
      return {
        viewport: { innerWidth, innerHeight, vvW: visualViewport.width, vvH: visualViewport.height },
        backdrop: r(bd), sheet: r(sh), diasCard: r(card),
        backdropPosition: cs && cs.position,
        backdropDentroDoCartao: !!(card && bd && card.contains(bd)),
        cartaoContain: getComputedStyle(card).contain, cartaoWillChange: getComputedStyle(card).willChange,
        scroll: { y: scrollY, mainScroll: document.querySelector('main')?.scrollTop },
        cobreTela: bd ? (bd.getBoundingClientRect().width >= innerWidth && bd.getBoundingClientRect().height >= innerHeight) : null,
        hit: { topLeft: hit(2, 2), topRight: hit(innerWidth - 3, 2), bottomLeft: hit(2, innerHeight - 3), bottomRight: hit(innerWidth - 3, innerHeight - 3), centro: hit(innerWidth / 2, innerHeight / 2) },
        inputVisivel: (() => { const i = document.querySelector('.sheet input'); if (!i) return null; const b = i.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, dentroDaTela: b.top >= 0 && b.bottom <= innerHeight }; })(),
      };
    });
    await page.screenshot({ path: `${L.CAP}/A13_${vp}_1_comentarios.png` });
    out[vp] = m;
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error('ERRO', e); process.exit(1); });
