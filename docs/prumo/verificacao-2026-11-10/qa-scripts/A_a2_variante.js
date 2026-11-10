// Variante: check-out do Porto = 2030-06-20 (valido para Lisboa) -> prova a escrita na cidade errada
const L = require('./lib2.js');
(async () => {
  const browser = await L.chromium.launch();
  const ctx = await L.newCtx(browser, '360'); const page = await ctx.newPage();
  await L.login(page, 'qa3-a@exemplo.com');
  await L.criarViagem(page, 'QA2 A2 variante ' + Date.now());
  await L.cadastrarCidade(page, { cidade: 'Lisboa', checkin: '2030-06-10', checkout: '2030-06-13' });
  await page.getByRole('button', { name: /adicionar cidade/i }).first().click();
  const d = page.getByRole('dialog', { name: 'Editar cidade' }); await d.waitFor();
  await d.getByLabel('Cidade', { exact: true }).fill('Porto');
  await d.getByLabel('Check-in').fill('2030-06-01');
  await d.getByLabel('Check-out').fill('2030-06-20');
  await page.screenshot({ path: `${L.CAP}/A2_variante_360_checkout20.png` });
  await d.getByRole('button', { name: 'Concluir' }).click(); await d.waitFor({ state: 'hidden' });
  const lista = await page.evaluate(() => [...document.querySelectorAll('main .card-flush .row')].map(r => r.querySelector('.row-title').textContent + ' | ' + r.querySelector('.row-sub').textContent));
  console.log(JSON.stringify(lista, null, 1));
  await page.screenshot({ path: `${L.CAP}/A2_variante_360_depois.png` });
  await browser.close();
})().catch(e => { console.error('ERRO', e); process.exit(1); });
