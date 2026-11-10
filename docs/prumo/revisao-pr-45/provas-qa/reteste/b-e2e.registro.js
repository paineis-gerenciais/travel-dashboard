import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const D = '<pasta-temporária-da-sessão>/qa45b';
const base = (abas, extra = {}) => JSON.stringify({ formato: 'planilha-viagem', versao: 1, abas, ...extra });
const arq = (nome, c) => { const p = join(D, 'arq', nome); mkdirSync(join(D, 'arq'), { recursive: true }); writeFileSync(p, c); return p; };
async function abrir(page, project, nome) {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__E2E_LOGIN__ === 'function', null, { timeout: 30000 });
  await page.evaluate(async (e) => { await window.__E2E_LOGIN__(e); }, `qa45b-${project}-${Date.now()}@exemplo.com`);
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
const toast = async (page) => (await page.locator('.toast-wrap').innerText()).trim();
test('mensagens e banners', async ({ page }, ti) => {
  const p = ti.project.name;
  const dlg = await abrir(page, p, 'QA reteste');
  const input = dlg.locator('input[type="file"]');
  const casos = {
    backup: arq('backup.json', JSON.stringify({ cities: [], transports: [] })),
    semVersao: arq('sv.json', JSON.stringify({ formato: 'planilha-viagem', abas: {} })),
    versaoTexto: arq('vt.json', base({ Outras: [] }, { versao: '1' })),
    abasVazio: arq('vazio.json', base({})),
    datanum: arq('dn.json', base({ Outras: [{ data: 20300610, nome: 'x' }] })),
    d30: arq('d30.json', base({ Outras: [{ data: '2030-02-30', nome: 'x' }] })),
    bom: arq('bom.json', '﻿' + base({ Outras: [{ data: '2030-01-01', nome: 'x' }] })),
    avisos: arq('avisos.json', base({ cidades: [{ Cidade: 'Lisboa', CHECK_IN: '2030-06-10', check_out: '2030-06-13', hospedagm: 'x' }], Hospedagem: [{ a: 1 }], Foguetes: [{ a: 1 }] })),
  };
  for (const [k, f] of Object.entries(casos)) {
    await input.setInputFiles(f);
    await page.waitForTimeout(500);
    const previa = await dlg.getByRole('heading', { name: 'Conferência' }).isVisible();
    console.log(p, k, '| toast:', JSON.stringify(await toast(page).catch(() => '')), '| previa:', previa, previa ? '| ' + (await dlg.innerText()).replace(/\n+/g, ' | ').slice(0, 420) : '');
    await page.screenshot({ path: join(D, 'shots', `${p}-${k}.png`) });
    if (previa) await dlg.getByRole('button', { name: /voltar|cancelar/i }).first().click().catch(() => {});
    await page.waitForTimeout(3400);
  }
  // duplicata: aplica 1 atracao, reimporta
  const un = arq('un.json', base({ Atracoes: [{ data: '2030-01-01', nome: 'Museu' }], Cidades: [{ cidade: 'Lisboa', check_in: '2030-01-01', check_out: '2030-01-03' }] }));
  await input.setInputFiles(un);
  await expect(dlg.getByRole('heading', { name: 'Conferência' })).toBeVisible();
  await dlg.getByRole('button', { name: /aplicar/i }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Mais' }).click();
  await page.getByRole('button', { name: 'Abrir Planilha' }).click();
  const d2 = page.getByRole('dialog', { name: 'Planilha' });
  await d2.locator('input[type="file"]').setInputFiles(un);
  await expect(d2.getByRole('heading', { name: 'Conferência' })).toBeVisible();
  console.log(p, 'duplicata:', (await d2.innerText()).replace(/\n+/g, ' | ').slice(0, 500));
  await page.screenshot({ path: join(D, 'shots', `${p}-duplicata.png`) });
});
