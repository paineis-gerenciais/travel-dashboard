const L = require('./lib');
const fs = require('fs');
const t0 = Date.now(); const log = [];
const ev = (m) => { const s = `+${String(Date.now() - t0).padStart(6)} ms  ${m}`; log.push(s); console.log(s); };
const EMAIL_A = 'qa-a@exemplo.com', EMAIL_B = 'qa-b@exemplo.com';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function lerCidade(page, nome) {
  await page.getByRole('button', { name: 'Cidades' }).click();
  await page.waitForTimeout(800);
  const main = page.getByRole('main');
  const txt = await main.innerText();
  const linhas = txt.split('\n').map(s => s.trim()).filter(Boolean);
  const i = linhas.findIndex(l => l.startsWith('Lisboa'));
  return { cidadeLinha: linhas[i], sub: linhas[i + 1], valor: linhas.slice(i, i + 6).filter(l => /R\$/.test(l))[0] };
}
async function abrirViagem(page, nome) {
  await page.getByText(nome, { exact: true }).first().waitFor({ timeout: 15000 });
  await page.evaluate((nm) => {
    let el = Array.from(document.querySelectorAll('*')).find(e => e.children.length === 0 && e.textContent.trim() === nm);
    while (el && !Array.from(el.querySelectorAll('button')).some(b => b.textContent.trim().startsWith('Abrir'))) el = el.parentElement;
    Array.from(el.querySelectorAll('button')).find(b => b.textContent.trim().startsWith('Abrir')).click();
  }, nome);
  await page.getByRole('navigation', { name: /navegação principal/i }).waitFor({ timeout: 15000 });
}
async function docFirestore(nome) {
  const r = await fetch('http://localhost:8080/v1/projects/plano-viagem-certa/databases/(default)/documents/trips', { headers: { Authorization: 'Bearer owner' } });
  const j = await r.json();
  const d = (j.documents || []).find(x => x.fields?.name?.stringValue === nome);
  if (!d) return null;
  const cities = d.fields.state.mapValue.fields.cities.arrayValue.values || [];
  return cities.map(c => ({ city: c.mapValue.fields.city?.stringValue, nightly: c.mapValue.fields.nightly?.stringValue ?? c.mapValue.fields.nightly?.integerValue ?? c.mapValue.fields.nightly?.doubleValue }));
}

async function rodada(browser, n, variante) {
  const nome = `Concorrência ${n}-${t0 % 100000}`;
  ev(`=== RODADA ${n} (${variante}) viagem "${nome}"`);
  const ca = await L.newCtx(browser, '1366'); const cb = await L.newCtx(browser, '1366');
  const A = await ca.newPage(), B = await cb.newPage();
  await L.login(A, EMAIL_A); ev('A logada');
  await L.criarViagem(A, nome);
  await L.cadastrarCidade(A, { cidade: 'Lisboa', checkin: '2030-05-01', checkout: '2030-05-04', diaria: '10000' });
  ev('A criou viagem + cidade Lisboa (diária 10000)'); await A.waitForTimeout(2500);
  // convite
  await A.getByRole('button', { name: 'Mais' }).click();
  await A.getByRole('button', { name: 'Abrir Compartilhar' }).click();
  const dlg = A.getByRole('dialog', { name: 'Compartilhar' });
  await dlg.locator('input[type=email]').fill(EMAIL_B);
  await dlg.getByRole('button', { name: 'Convidar' }).click();
  await A.waitForTimeout(1500);
  ev('A convidou B; dialogs abertos: ' + JSON.stringify(await A.getByRole('dialog').evaluateAll(es => es.map(e => e.getAttribute('aria-label')))));
  // fecha todas as folhas
  for (let i = 0; i < 3 && await A.getByRole('dialog').count(); i++) { await A.keyboard.press('Escape'); await A.waitForTimeout(300); }
  await L.login(B, EMAIL_B); ev('B logado');
  await B.waitForTimeout(1500);
  await abrirViagem(B, nome); ev('B abriu a viagem');
  // A volta para Cidades
  await A.getByRole('button', { name: 'Cidades' }).click();
  // (1) B edita cidade e fica com foco em Cidade
  await B.getByRole('button', { name: 'Cidades' }).click();
  await B.getByRole('button', { name: 'Editar', exact: true }).first().click();
  const dB = B.getByRole('dialog', { name: 'Editar cidade' }); await dB.waitFor();
  const campoB = dB.getByLabel('Cidade', { exact: true });
  await campoB.focus();
  ev(`(1) B com foco em Cidade; valor="${await campoB.inputValue()}", activeElement=${await B.evaluate(() => document.activeElement.tagName + ':' + document.activeElement.id)}`);
  // (2) A muda a diária
  await A.getByRole('button', { name: 'Editar', exact: true }).first().click();
  const dA = A.getByRole('dialog', { name: 'Editar cidade' }); await dA.waitFor();
  await dA.getByLabel('Custo por diária').fill('20000');
  ev('(2) A preencheu Custo por diária = 20000');
  await dA.getByRole('button', { name: 'Concluir' }).click();
  ev('(2) A clicou Concluir; aguardando 3 s'); await sleep(3000);
  ev('    Firestore após A: ' + JSON.stringify(await docFirestore(nome)));
  ev(`    B ainda no campo Cidade, valor="${await campoB.inputValue()}"; diária no dialog de B = ${await dB.getByLabel('Custo por diária').inputValue().catch(() => '?')}`);
  // (3) B digita " Norte"
  await campoB.focus();
  await B.keyboard.press('End'); await B.keyboard.type(' Norte');
  ev(`(3) B digitou " Norte"; valor local="${await campoB.inputValue()}"`);
  if (variante === 'B espera 1,5 s antes do Tab') { await sleep(1500); ev('    B esperou 1,5 s com foco no campo (save de 900 ms já devia ter disparado)'); ev('    Firestore: ' + JSON.stringify(await docFirestore(nome))); }
  await B.keyboard.press('Tab');
  ev(`(3) B tirou o foco (Tab); valor local do campo="${await campoB.inputValue().catch(() => '?')}"`);
  await sleep(3000);
  ev('    Firestore após 3 s: ' + JSON.stringify(await docFirestore(nome)));
  // fecha dialogs
  await B.keyboard.press('Escape'); await A.waitForTimeout(100);
  const antesB = await lerCidade(B, nome).catch(e => ({ erro: String(e).slice(0, 80) }));
  const antesA = await lerCidade(A, nome).catch(e => ({ erro: String(e).slice(0, 80) }));
  ev('    Tela ANTES do reload  A: ' + JSON.stringify(antesA)); ev('    Tela ANTES do reload  B: ' + JSON.stringify(antesB));
  // (4) reload
  await A.reload(); await B.reload();
  for (const [P, nm] of [[A, 'A'], [B, 'B']]) {
    await P.waitForTimeout(2500);
    if (!(await P.getByRole('navigation', { name: /navegação principal/i }).count())) { await abrirViagem(P, nome); }
  }
  const dA2 = await lerCidade(A, nome); const dB2 = await lerCidade(B, nome);
  ev('(4) APÓS reload  A: ' + JSON.stringify(dA2)); ev('(4) APÓS reload  B: ' + JSON.stringify(dB2));
  await B.screenshot({ path: `${L.S}/qa-capturas/concorrencia-B-rodada${n}.png` });
  await A.screenshot({ path: `${L.S}/qa-capturas/concorrencia-A-rodada${n}.png` });
  const ok = /Norte/.test(dA2.cidadeLinha || '') && /Norte/.test(dB2.cidadeLinha || '') && /200,00/.test(dA2.valor || '') && /200,00/.test(dB2.valor || '');
  ev(`RESULTADO rodada ${n}: ${ok ? 'sem perda' : 'PERDA DE DADOS (esperado: nome com Norte E diária 20000 (R$ 600,00 = 3 x 200,00) nos dois)'}`);
  await ca.close(); await cb.close();
}
(async () => {
  const browser = await L.chromium.launch();
  const plan = process.env.PLAN === 'var' ? [[4, 'B espera 1,5 s antes do Tab'], [5, 'B espera 1,5 s antes do Tab']] : [[1, 'cenário do Head'], [2, 'cenário do Head'], [3, 'B espera 1,5 s antes do Tab']];
  for (const [n, v] of plan) { try { await rodada(browser, n, v); } catch (e) { ev('ERRO rodada ' + n + ': ' + String(e).slice(0, 400)); } }
  fs.writeFileSync(L.S + '/qa-scripts/E_result.log', log.join('\n'));
  await browser.close();
})();
