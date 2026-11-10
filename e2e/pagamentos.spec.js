// e2e/pagamentos.spec.js — #24 (PR #38): confirmar e desfazer pagamento de acerto.
// Contra o EMULADOR do Firebase. Cada projeto (mobile/desktop) usa um usuário próprio.
import { test, expect } from '@playwright/test';

async function entrar(page, projectName) {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__E2E_LOGIN__ === 'function', null, { timeout: 30000 });
  const email = `e2e-pg-${projectName}@exemplo.com`;
  await page.evaluate(async (e) => { await window.__E2E_LOGIN__(e); }, email);
  await expect(page.getByRole('heading', { name: /minhas viagens/i })).toBeVisible({ timeout: 20000 });
  const pular = page.getByRole('button', { name: /^pular$/i });
  if (await pular.isVisible().catch(() => false)) await pular.click();
}

/** Data de hoje no fuso do aparelho, como a tela mostra: dd/mm/aaaa. */
function hojeLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

test.describe('pagamentos de acerto', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await entrar(page, testInfo.project.name);
  });

  test('confirmar move o acerto para "Pagamentos feitos" e desfazer o devolve', async ({ page }) => {
    // viagem com 1 diária de R$ 100,00 (a hospedagem é a despesa de R$ 100)
    await page.getByPlaceholder('Nome da viagem').fill('Viagem Pagamentos');
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByRole('navigation', { name: /navegação principal/i })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Cidades' }).click();
    await page.getByRole('button', { name: /adicionar cidade/i }).first().click();
    const cidade = page.getByRole('dialog', { name: 'Editar cidade' });
    await cidade.getByLabel('Cidade', { exact: true }).fill('Porto');
    await cidade.getByLabel('Check-in').fill('2030-10-01');
    await cidade.getByLabel('Check-out').fill('2030-10-02');
    await cidade.getByLabel('Custo por diária').fill('10000');
    await cidade.getByRole('button', { name: 'Concluir' }).click();
    await expect(cidade).toBeHidden();

    await page.getByRole('button', { name: 'Custos' }).click();
    await page.getByRole('button', { name: /^ver/i }).first().click();
    const dialogo = page.getByRole('dialog', { name: 'Divisão de despesas' });
    await expect(dialogo).toBeVisible();

    // 3 participantes
    await dialogo.getByRole('button', { name: 'Editar', exact: true }).click();
    for (const nome of ['Ana', 'Bia', 'Caio']) {
      await dialogo.getByPlaceholder('Adicionar participante').fill(nome);
      await dialogo.getByPlaceholder('Adicionar participante').press('Enter');
      await expect(dialogo.getByLabel(`Nome de ${nome}`)).toBeVisible();
    }
    await dialogo.getByRole('button', { name: 'Concluir' }).click();

    // Ana pagou a hospedagem de R$ 100,00
    const linhaAna = () => dialogo.locator('.card-flush').filter({ hasText: /Pagou R\$/ }).filter({ hasText: 'Ana' });
    const linhaBia = () => dialogo.locator('.card-flush').filter({ hasText: /Pagou R\$/ }).filter({ hasText: 'Bia' });
    await linhaAna().getByRole('button', { name: /ver gastos/i }).click();
    await linhaAna().getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByLabel('Quem pagou').selectOption({ label: 'Ana' });
    await page.getByRole('button', { name: 'Concluir' }).last().click();

    await expect(linhaAna()).toContainText('Pagou R$ 100,00 · deve R$ 33,34');
    await expect(dialogo.getByText('Bia paga para Ana')).toBeVisible();
    await expect(dialogo.getByText('Caio paga para Ana')).toBeVisible();
    await expect(dialogo.getByRole('heading', { name: 'Pagamentos feitos' })).toHaveCount(0);

    // confirma Bia -> Ana
    await dialogo.locator('.row', { hasText: 'Bia paga para Ana' })
      .getByRole('button', { name: /confirmar pagamento/i }).click();

    const feitos = dialogo.locator('.row', { hasText: 'Bia pagou a Ana' });
    await expect(dialogo.getByRole('heading', { name: 'Pagamentos feitos' })).toBeVisible();
    await expect(feitos).toContainText(hojeLocal());
    await expect(feitos).toContainText('R$ 33,33');
    await expect(dialogo.getByText('Bia paga para Ana')).toHaveCount(0);
    await expect(dialogo.getByText('Caio paga para Ana')).toBeVisible();

    // saldos mudam; "Pagou" de Ana continua R$ 100,00 e o acerto aparece à parte
    await expect(linhaAna()).toContainText('Pagou R$ 100,00 · deve R$ 33,34 · acertos −R$ 33,33');
    await expect(linhaAna()).toContainText('+R$ 33,33');
    await expect(linhaBia()).toContainText('Pagou R$ 0,00 · deve R$ 33,33 · acertos +R$ 33,33');
    await expect(linhaBia()).toContainText('+R$ 0,00');

    // desfazer devolve o acerto
    await feitos.getByRole('button', { name: 'Desfazer' }).click();
    await expect(dialogo.getByRole('heading', { name: 'Pagamentos feitos' })).toHaveCount(0);
    await expect(dialogo.getByText('Bia paga para Ana')).toBeVisible();
    await expect(linhaAna()).toContainText('Pagou R$ 100,00 · deve R$ 33,34');
    await expect(linhaAna()).not.toContainText('acertos');
    await expect(linhaBia()).toContainText('Pagou R$ 0,00 · deve R$ 33,33');
    await expect(linhaBia()).not.toContainText('acertos');
  });
});
