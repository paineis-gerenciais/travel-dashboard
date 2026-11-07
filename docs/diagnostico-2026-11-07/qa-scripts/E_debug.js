const L = require('./lib');
(async () => {
  const browser = await L.chromium.launch();
  const cb = await L.newCtx(browser, '1366'); const B = await cb.newPage();
  B.on('console', m => { if (m.type() === 'error' || m.type()==='warning') console.log('console', m.type(), m.text().slice(0, 200)); });
  await L.login(B, 'qa-b@exemplo.com'); await B.waitForTimeout(3000);
  console.log((await B.locator('body').innerText()).slice(0, 800));
  await B.screenshot({ path: L.S + '/qa-capturas/debug-B.png' });
  await browser.close();
})();
