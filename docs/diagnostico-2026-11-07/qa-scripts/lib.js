const { chromium } = require('playwright');
const S = 'docs/diagnostico-2026-11-07';
const AXE = S + '/qa-tools/node_modules/axe-core/axe.min.js';
const BASE = 'http://localhost:4173/';
const VPS = { '360': { width: 360, height: 800 }, '1366': { width: 1366, height: 768 } };

async function newCtx(browser, vp, extra = {}) {
  return browser.newContext({ viewport: VPS[vp], deviceScaleFactor: 1, ...(vp === '360' ? { isMobile: true, hasTouch: true } : {}), ...extra });
}
async function openApp(page) {
  await page.goto(BASE);
  await page.waitForFunction(() => typeof window.__E2E_LOGIN__ === 'function', null, { timeout: 30000 });
}
async function login(page, email) {
  await openApp(page);
  await page.evaluate(e => window.__E2E_LOGIN__(e), email);
  await page.getByRole('heading', { name: /minhas viagens/i }).waitFor({ timeout: 20000 });
  const pular = page.getByRole('button', { name: /^pular$/i });
  if (await pular.isVisible().catch(() => false)) await pular.click();
}
async function criarViagem(page, nome) {
  await page.getByPlaceholder('Nome da viagem').fill(nome);
  await page.getByRole('button', { name: 'Criar' }).click();
  await page.getByRole('navigation', { name: /navegação principal/i }).waitFor({ timeout: 15000 });
}
async function cadastrarCidade(page, { cidade, checkin, checkout, diaria }) {
  await page.getByRole('button', { name: 'Cidades' }).click();
  await page.getByRole('button', { name: /adicionar cidade/i }).first().click();
  const d = page.getByRole('dialog', { name: 'Editar cidade' });
  await d.waitFor();
  await d.getByLabel('Cidade', { exact: true }).fill(cidade);
  await d.getByLabel('Check-in').fill(checkin);
  await d.getByLabel('Check-out').fill(checkout);
  if (diaria) await d.getByLabel('Custo por diária').fill(diaria);
  await d.getByRole('button', { name: 'Concluir' }).click();
  await d.waitFor({ state: 'hidden' });
}
async function axe(page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const r = await window.axe.run({ exclude: [['[data-testid="print-view"]']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0].target.join(' '), html: v.nodes[0].html.slice(0, 140), summary: (v.nodes[0].any[0] || v.nodes[0].all[0] || v.nodes[0].none[0] || {}).message }));
  });
}
module.exports = { chromium, S, BASE, VPS, newCtx, openApp, login, criarViagem, cadastrarCidade, axe };
