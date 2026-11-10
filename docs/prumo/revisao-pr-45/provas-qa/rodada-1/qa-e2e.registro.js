import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const D = '<pasta-temporária-da-sessão>/qa45';
const base = (abas, extra = {}) => JSON.stringify({ formato: 'planilha-viagem', versao: 1, abas, ...extra });
const arq = (nome, conteudo) => { const p = join(D, 'arq', nome); mkdirSync(join(D, 'arq'), { recursive: true }); writeFileSync(p, conteudo); return p; };

async function abrirPlanilha(page, project, nome) {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__E2E_LOGIN__ === 'function', null, { timeout: 30000 });
  await page.evaluate(async (e) => { await window.__E2E_LOGIN__(e); }, `qa45-${project}-${Date.now()}@exemplo.com`);
  await expect(page.getByRole('heading', { name: /minhas viagens/i })).toBeVisible({ timeout: 20000 });
  const pular = page.getByRole('button', { name: /^pular$/i });
  if (await pular.isVisible().catch(() => false)) await pular.click();
  await page.getByPlaceholder('Nome da viagem').fill(nome);
  await page.getByRole('button', { name: 'Criar' }).click();
  await expect(page.getByRole('navigation', { name: /navegação principal/i })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Mais' }).click();
  await page.getByRole('button', { name: 'Abrir Planilha' }).click();
  return page.getByRole('dialog', { name: 'Planilha' });
}
const toastTxt = async (page) => (await page.locator('.toast-wrap').innerText()).trim();

test('toasts de erro', async ({ page }, ti) => {
  const dlg = await abrirPlanilha(page, ti.project.name, 'QA toasts');
  const input = dlg.locator('input[type="file"]');
  const casos = {
    malformado: arq('mal.json', '{"formato":"planilha-viagem","versao":1,"abas":{"Outras":[{'),
    backup: arq('backup.json', JSON.stringify({ cities: [], transports: [] })),
    versao2: arq('v2.json', base({ Outras: [] }, { versao: 2 })),
    abasVazio: arq('vazio.json', base({})),
    abasDesconhecidas: arq('desc.json', base({ Foguetes: [{ a: 1 }] })),
    nulo: arq('nulo.json', 'null'),
    bom: arq('bom.json', '﻿' + base({ Outras: [{ data: '2030-01-01', nome: 'x' }] })),
    grande: arq('grande.json', base({ Outras: [{ data: '2030-01-01', nome: 'x'.repeat(2.1 * 1024 * 1024) }] })),
  };
  const out = {};
  for (const [k, p] of Object.entries(casos)) {
    await input.setInputFiles(p);
    await page.waitForTimeout(400);
    out[k] = { toast: await toastTxt(page), previa: await dlg.getByRole('heading', { name: 'Conferência' }).isVisible() };
    if (out[k].previa) { await page.screenshot({ path: join(D, 'shots', `${ti.project.name}-${k}.png`) }); await dlg.getByRole('button', { name: /voltar|cancelar/i }).first().click().catch(() => {}); }
    else await page.screenshot({ path: join(D, 'shots', `${ti.project.name}-${k}.png`) });
    await page.waitForTimeout(3400);
  }
  console.log(ti.project.name, JSON.stringify(out, null, 1));
  // atributos da região
  console.log('live', await page.locator('.toast-wrap').getAttribute('role'), await page.locator('.toast-wrap').getAttribute('aria-live'));
});


async function reabrir(page) {
  await page.getByRole('button', { name: 'Mais' }).click();
  await page.getByRole('button', { name: 'Abrir Planilha' }).click();
  return page.getByRole('dialog', { name: 'Planilha' });
}
const sobe = async (dlg, p) => { await dlg.locator('input[type="file"]').setInputFiles(p); await expect(dlg.getByRole('heading', { name: 'Conferência' })).toBeVisible(); return (await dlg.innerText()).replace(/\n+/g, ' | '); };

test('duas importações do mesmo arquivo e data numérica', async ({ page }, ti) => {
  let dlg = await abrirPlanilha(page, ti.project.name, 'QA duplicar');
  const erros = []; page.on('pageerror', (e) => erros.push(e.message));
  const f1 = arq('um.json', base({ Atracoes: [{ data: '2030-06-11', nome: 'Museu QA', custo: 90, status: 'Pago', link: 'https://exemplo.com/m' }], Cidades: [{ cidade: 'Lisboa', check_in: '2030-06-10', check_out: '2030-06-13', hospedagem: 'Hotel QA', custo_diaria: 650, status: 'Reservado', cafe_incluso: 'sim' }] }));
  console.log('1a prévia:', await sobe(dlg, f1));
  await dlg.getByRole('button', { name: 'Aplicar à viagem' }).click();
  await expect(dlg).toBeHidden();
  dlg = await reabrir(page);
  console.log('2a prévia:', await sobe(dlg, f1));
  await dlg.getByRole('button', { name: 'Aplicar à viagem' }).click();
  await expect(dlg).toBeHidden();
  await page.getByRole('button', { name: 'Cidades' }).click();
  console.log('Lisboa na tela de Cidades (itens):', await page.getByText('Lisboa').count());
  await page.screenshot({ path: join(D, 'shots', `${ti.project.name}-duplicou.png`), fullPage: true });

  dlg = await reabrir(page);
  console.log('prévia data numérica:', await sobe(dlg, arq('data-num.json', base({ Outras: [{ data: 20300610, nome: 'Data numérica QA' }] }))));
  await dlg.getByRole('button', { name: 'Aplicar à viagem' }).click();
  await page.waitForTimeout(1000);
  console.log('erros de página após data numérica:', JSON.stringify(erros));
  console.log('corpo visível:', (await page.locator('body').innerText()).slice(0, 300).replace(/\n+/g, ' | '));
  await page.screenshot({ path: join(D, 'shots', `${ti.project.name}-datanum.png`), fullPage: true });
});
