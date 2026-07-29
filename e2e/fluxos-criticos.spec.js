// e2e/fluxos-criticos.spec.js — T-1.12.
//
// Cobre os fluxos que sustentam o produto, contra o EMULADOR do Firebase
// (nunca produção). Por que E2E além dos 62 testes de domínio: o domínio prova
// a matemática, mas não prova que a tela chama a função certa. Os três bugs de
// custo desta fase eram todos "domínio certo, tela lendo errado" — exatamente
// o que um teste de integração pega e um de unidade não.
import { test, expect } from '@playwright/test';

/**
 * Entra no app usando o gancho de teste do firebase.js.
 *
 * Cada projeto (mobile/desktop) usa um usuário PRÓPRIO: eles rodam em paralelo
 * contra o mesmo emulador, e compartilhar a conta faria um ver as viagens do
 * outro, gerando falhas intermitentes difíceis de diagnosticar.
 */
async function entrar(page, projectName) {
  await page.goto('/');

  // Espera o gancho existir. Um `if (window.__E2E_LOGIN__)` aqui falharia em
  // SILÊNCIO quando o módulo ainda não tivesse carregado — foi exatamente o que
  // fez o primeiro teste do desktop expirar enquanto os seguintes passavam.
  await page.waitForFunction(() => typeof window.__E2E_LOGIN__ === 'function', null, { timeout: 30000 });

  const email = `e2e-${projectName}@exemplo.com`;
  await page.evaluate(async (e) => { await window.__E2E_LOGIN__(e); }, email);

  await expect(page.getByRole('heading', { name: /minhas viagens/i })).toBeVisible({ timeout: 20000 });

  // pula o onboarding de primeiro uso, se aparecer
  const pular = page.getByRole('button', { name: /^pular$/i });
  if (await pular.isVisible().catch(() => false)) await pular.click();
}

/** Cria uma viagem com nome único e entra nela. */
async function criarViagem(page, nome) {
  await page.getByPlaceholder('Nome da viagem').fill(nome);
  await page.getByRole('button', { name: 'Criar' }).click();
  await expect(page.getByRole('navigation', { name: /navegação principal/i })).toBeVisible({ timeout: 15000 });
}

/** Cadastra uma cidade. Tudo escopado ao diálogo, para não colidir com a aba homônima. */
async function cadastrarCidade(page, { cidade, checkin, checkout, diaria }) {
  await page.getByRole('button', { name: 'Cidades' }).click();
  await page.getByRole('button', { name: /adicionar cidade/i }).first().click();

  const dialogo = page.getByRole('dialog', { name: 'Editar cidade' });
  await expect(dialogo).toBeVisible();

  await dialogo.getByLabel('Cidade', { exact: true }).fill(cidade);
  await dialogo.getByLabel('Check-in').fill(checkin);
  await dialogo.getByLabel('Check-out').fill(checkout);
  if (diaria) await dialogo.getByLabel('Custo por diária').fill(diaria);

  await dialogo.getByRole('button', { name: 'Concluir' }).click();
  await expect(dialogo).toBeHidden();
}

test.describe('fluxos críticos', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await entrar(page, testInfo.project.name);
  });

  test('cria uma viagem e ela aparece na lista', async ({ page }) => {
    await criarViagem(page, 'Viagem E2E');
    await expect(page.getByRole('button', { name: 'Dias' })).toBeVisible();
  });

  test('cadastra cidade com datas e os dias aparecem', async ({ page }) => {
    await criarViagem(page, 'Viagem Dias');
    await cadastrarCidade(page, { cidade: 'Lisboa', checkin: '2030-06-01', checkout: '2030-06-04' });

    await page.getByRole('button', { name: 'Dias' }).click();
    await expect(page.getByText('Lisboa').first()).toBeVisible();

    // 01→04 de junho = 4 dias de planejamento, não 3:
    //   3 diárias (01, 02, 03 — as noites dormidas)
    // + o dia 04, o check-out, que entra porque o transporte automático de
    //   volta para "Casa" é datado nele (comportamento da Fase 4).
    // Conta os marcadores da linha do tempo (role=tab) em vez de casar um texto
    // como "1 / 4": testa a mesma intenção sem depender da formatação.
    await expect(page.getByRole('tab')).toHaveCount(4);
    await expect(page.getByRole('button', { name: /próximo/i })).toBeEnabled();
  });

  test('adiciona um item no dia e ele abre o editor direto (T-1.14)', async ({ page }) => {
    await criarViagem(page, 'Viagem Item');
    await cadastrarCidade(page, { cidade: 'Porto', checkin: '2030-07-01', checkout: '2030-07-03' });

    await page.getByRole('button', { name: 'Dias' }).click();
    await page.getByRole('button', { name: '+ Atração' }).click();

    // o comportamento sob teste: o editor abre sozinho, sem precisar procurar o item
    await expect(page.getByRole('dialog', { name: 'Editar atração' })).toBeVisible();
  });

  test('custos: legenda com nomes e seção por status aparecem', async ({ page }) => {
    await criarViagem(page, 'Viagem Custos');
    await cadastrarCidade(page, {
      cidade: 'Roma', checkin: '2030-08-01', checkout: '2030-08-03', diaria: '10000', // R$ 100,00
    });

    await page.getByRole('button', { name: 'Custos' }).click();

    // Escopar ao <main>: a view de impressão (PrintView) fica sempre no DOM,
    // oculta por CSS, e também contém a palavra "Hospedagem". Sem o escopo, o
    // seletor encontra 3 elementos e o modo estrito do Playwright reclama.
    const tela = page.getByRole('main');

    // T-1.13: a legenda mostra o NOME do gasto (antes vinha vazia)
    await expect(tela.getByText('Hospedagem')).toBeVisible();
    // T-C.1: a seção por status existe
    await expect(tela.getByRole('heading', { name: 'Por status' })).toBeVisible();
    // e o total reflete 2 diárias de R$ 100
    await expect(tela.getByText('R$ 200,00').first()).toBeVisible();
  });

  test('divisão de despesas abre e mostra a cota por pessoa (T-1.7)', async ({ page }) => {
    await criarViagem(page, 'Viagem Split');
    await cadastrarCidade(page, {
      cidade: 'Madri', checkin: '2030-09-01', checkout: '2030-09-03', diaria: '10000',
    });

    await page.getByRole('button', { name: 'Custos' }).click();
    await page.getByRole('button', { name: /^ver/i }).first().click();

    const dialogo = page.getByRole('dialog', { name: 'Divisão de despesas' });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByText('Cota por pessoa')).toBeVisible();
  });

  test('compartilhar abre a folha de convite', async ({ page }) => {
    await criarViagem(page, 'Viagem Share');
    await page.getByRole('button', { name: 'Mais' }).click();
    await page.getByRole('button', { name: /abrir/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
