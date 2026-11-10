// e2e/importacao-json.spec.js — importação de roteiro por arquivo JSON (#41).
// Dados fictícios: e2e/fixtures/importacao-exemplo.json.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FIXTURE = 'e2e/fixtures/importacao-exemplo.json';
const SCRIPT = '.claude/skills/roteiro-viagem/scripts/validar-importacao.mjs';

/** Entra pelo gancho de teste do firebase.js; usuário próprio por projeto. */
async function entrar(page, projectName) {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__E2E_LOGIN__ === 'function', null, { timeout: 30000 });
  const email = `e2e-json-${projectName}@exemplo.com`;
  await page.evaluate(async (e) => { await window.__E2E_LOGIN__(e); }, email);
  await expect(page.getByRole('heading', { name: /minhas viagens/i })).toBeVisible({ timeout: 20000 });
  const pular = page.getByRole('button', { name: /^pular$/i });
  if (await pular.isVisible().catch(() => false)) await pular.click();
}

async function criarViagem(page, nome) {
  await page.getByPlaceholder('Nome da viagem').fill(nome);
  await page.getByRole('button', { name: 'Criar' }).click();
  await expect(page.getByRole('navigation', { name: /navegação principal/i })).toBeVisible({ timeout: 15000 });
}

test.describe('importação por JSON', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await entrar(page, testInfo.project.name);
  });

  test('Planilha aceita o JSON, mostra a conferência e aplica', async ({ page }) => {
    await criarViagem(page, 'Viagem JSON');
    await page.getByRole('button', { name: 'Mais' }).click();
    await page.getByRole('button', { name: 'Abrir Planilha' }).click();

    const dialogo = page.getByRole('dialog', { name: 'Planilha' });
    await expect(dialogo).toBeVisible();
    await dialogo.locator('input[type="file"]').setInputFiles(FIXTURE);

    await expect(dialogo.getByRole('heading', { name: 'Conferência' })).toBeVisible();
    await expect(dialogo.getByText('Cidades', { exact: true })).toBeVisible();
    await expect(dialogo.getByText('2 a criar · 0 a atualizar').first()).toBeVisible();
    await expect(dialogo.getByText('Atracoes', { exact: true })).toBeVisible();

    await dialogo.getByRole('button', { name: 'Aplicar à viagem' }).click();
    await expect(dialogo).toBeHidden();

    await page.getByRole('button', { name: 'Cidades' }).click();
    await expect(page.getByText('Lisboa').first()).toBeVisible();
    await expect(page.getByText('Porto').first()).toBeVisible();
  });

  test('planilha gerada pelo script da skill é aceita pela mesma conferência', async ({ page }, testInfo) => {
    // O script só grava dentro de importacoes/ ou fora do repositório: usa a pasta temporária do sistema.
    const pasta = mkdtempSync(join(tmpdir(), `skill-${testInfo.project.name}-`));
    const xlsx = join(pasta, 'importacao.xlsx');
    execFileSync(process.execPath, [SCRIPT, FIXTURE, '--xlsx', xlsx], { stdio: 'pipe' });

    await criarViagem(page, 'Viagem XLSX da skill');
    await page.getByRole('button', { name: 'Mais' }).click();
    await page.getByRole('button', { name: 'Abrir Planilha' }).click();

    const dialogo = page.getByRole('dialog', { name: 'Planilha' });
    await dialogo.locator('input[type="file"]').setInputFiles(xlsx);

    await expect(dialogo.getByRole('heading', { name: 'Conferência' })).toBeVisible();
    await expect(dialogo.getByText('linha(s) com problema')).toHaveCount(0);
    await expect(dialogo.getByText('Checklist', { exact: true })).toBeVisible();
    await dialogo.getByRole('button', { name: 'Aplicar à viagem' }).click();
    await expect(dialogo).toBeHidden();

    await page.getByRole('button', { name: 'Cidades' }).click();
    await expect(page.getByText('Porto').first()).toBeVisible();
    rmSync(pasta, { recursive: true, force: true });
  });

  test('"Importar JSON" recusa o arquivo de importação e não substitui a viagem', async ({ page }) => {
    await criarViagem(page, 'Viagem JSON Recusa');
    await page.getByRole('button', { name: 'Mais' }).click();

    const avisos = [];
    page.on('dialog', async (d) => { avisos.push({ tipo: d.type(), msg: d.message() }); await d.dismiss(); });

    await page.locator('input[type="file"][accept="application/json"]').setInputFiles(FIXTURE);

    await expect.poll(() => avisos.length).toBe(1);
    expect(avisos[0].tipo).toBe('alert');
    expect(avisos[0].msg).toContain('arquivo de importação de roteiro');
    expect(avisos[0].msg).toContain('Enviar planilha preenchida');
  });
});
