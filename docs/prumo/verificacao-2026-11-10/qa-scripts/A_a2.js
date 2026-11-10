const L = require('./lib2.js');
(async () => {
  const browser = await L.chromium.launch();
  const out = {};
  for (const vp of ['360', '1366']) {
    const ctx = await L.newCtx(browser, vp); const page = await ctx.newPage();
    await L.login(page, 'qa3-a@exemplo.com');
    await L.criarViagem(page, 'QA2 A2 ' + vp + ' ' + Date.now());
    await L.cadastrarCidade(page, { cidade: 'Lisboa', checkin: '2030-06-10', checkout: '2030-06-13' });
    const lista = () => page.evaluate(() => [...document.querySelectorAll('main .card-flush .row')].map(r => (r.querySelector('.row-title')?.textContent || '') + ' | ' + (r.querySelector('.row-sub')?.textContent || '')));
    const folha = () => page.evaluate(() => { const d = document.querySelector('[role=dialog][aria-label="Editar cidade"]'); if (!d) return null; const g = l => [...d.querySelectorAll('label')].find(x => x.textContent.trim().startsWith(l))?.querySelector('input')?.value; return { cidade: g('Cidade'), checkin: g('Check-in'), checkout: g('Check-out'), erro: d.querySelector('#city-date-error')?.textContent || null }; });
    const steps = [];
    const reg = async (nome) => steps.push({ passo: nome, folha: await folha(), lista: await lista() });
    await page.screenshot({ path: `${L.CAP}/A2_${vp}_0_antes.png` });
    await page.getByRole('button', { name: /adicionar cidade/i }).first().click();
    const d = page.getByRole('dialog', { name: 'Editar cidade' }); await d.waitFor();
    await reg('1 folha aberta (cidade nova)');
    await page.screenshot({ path: `${L.CAP}/A2_${vp}_1_folha_aberta.png` });
    await d.getByLabel('Cidade', { exact: true }).fill('Porto');
    await reg('2 apos Cidade=Porto');
    await page.screenshot({ path: `${L.CAP}/A2_${vp}_2_cidade.png` });
    await d.getByLabel('Check-in').fill('2030-06-01');
    await reg('3 apos Check-in=2030-06-01');
    await page.screenshot({ path: `${L.CAP}/A2_${vp}_3_checkin.png` });
    await d.getByLabel('Check-out').fill('2030-06-05');
    await reg('4 apos Check-out=2030-06-05');
    await page.screenshot({ path: `${L.CAP}/A2_${vp}_4_checkout.png` });
    await d.getByRole('button', { name: 'Concluir' }).click();
    await d.waitFor({ state: 'hidden' });
    await reg('5 folha fechada (lista final)');
    await page.screenshot({ path: `${L.CAP}/A2_${vp}_5_depois.png` });
    out[vp] = steps;
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error('ERRO', e); process.exit(1); });
