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
    // + o dia 04, o check-out, que é o dia da volta e faz parte da viagem por
    //   direito próprio (antes ele só existia por efeito colateral do
    //   transporte automático de Casa, que foi removido).
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

  test('divisão de despesas mostra o que cada um pagou e deve', async ({ page }) => {
    await criarViagem(page, 'Viagem Split');
    await cadastrarCidade(page, {
      cidade: 'Madri', checkin: '2030-09-01', checkout: '2030-09-03', diaria: '10000',
    });

    await page.getByRole('button', { name: 'Custos' }).click();
    await page.getByRole('button', { name: /^ver/i }).first().click();

    const dialogo = page.getByRole('dialog', { name: 'Divisão de despesas' });
    await expect(dialogo).toBeVisible();

    // Não existe mais uma "cota por pessoa" única: com rateio percentual por
    // despesa, cada participante deve um valor próprio. A tela mostra, por
    // pessoa, quanto pagou e quanto deve.
    await expect(dialogo.getByText('Total da viagem')).toBeVisible();
    await expect(dialogo.getByText(/Pagou .* · deve /).first()).toBeVisible();
    await expect(dialogo.getByRole('heading', { name: 'Acerto' })).toBeVisible();

    // e dá para expandir os gastos de um participante (lista editável)
    await dialogo.getByRole('button', { name: /ver gastos/i }).first().click();
    await expect(dialogo.getByRole('button', { name: /ocultar gastos/i })).toBeVisible();
  });

  test('anexa link a um item e ele aparece na central de anexos', async ({ page }) => {
    await criarViagem(page, 'Viagem Anexos');
    await cadastrarCidade(page, { cidade: 'Bogotá', checkin: '2030-10-01', checkout: '2030-10-03' });

    await page.getByRole('button', { name: 'Dias' }).click();
    await page.getByRole('button', { name: '+ Atração' }).click();

    const editor = page.getByRole('dialog', { name: 'Editar atração' });
    await editor.getByLabel('Atração').fill('Museu do Ouro');
    await editor.getByLabel('Link do comprovante').fill('https://exemplo.com/ingresso');
    await editor.getByLabel('Como chamar este documento').fill('Ingresso');
    await editor.getByRole('button', { name: 'Concluir' }).click();

    // o clipe aparece na linha do item
    await expect(page.getByRole('link', { name: /abrir ingresso/i })).toBeVisible();

    // e o anexo aparece na central
    await page.getByRole('button', { name: /^anexos/i }).click();
    const central = page.getByRole('dialog', { name: 'Anexos' });
    await expect(central.getByText('Ingresso')).toBeVisible();
    await expect(central.getByText('Museu do Ouro')).toBeVisible();
  });

  test('a frase da viagem aparece na tela Dias e é estável', async ({ page }) => {
    await criarViagem(page, 'Viagem Frase');
    await cadastrarCidade(page, { cidade: 'Quito', checkin: '2030-11-01', checkout: '2030-11-03' });

    await page.getByRole('button', { name: 'Dias' }).click();
    const frase = page.locator('.trip-quote');
    await expect(frase).toBeVisible();
    const texto = await frase.textContent();
    expect(texto.trim().length).toBeGreaterThan(0);

    // sair e voltar mantém a MESMA frase (é derivada do id da viagem)
    await page.getByRole('button', { name: 'Custos' }).click();
    await page.getByRole('button', { name: 'Dias' }).click();
    await expect(page.locator('.trip-quote')).toHaveText(texto);
  });

  test('importa itens colando da planilha, com prévia antes de aplicar', async ({ page }) => {
    await criarViagem(page, 'Viagem Planilha');
    await cadastrarCidade(page, { cidade: 'Lima', checkin: '2030-12-01', checkout: '2030-12-04' });

    await page.getByRole('button', { name: 'Mais' }).click();
    // rótulo específico, não posição: 7 botões da tela Mais se chamam "Abrir →"
    // visualmente, e um índice (.nth) quebra silenciosamente a cada linha nova
    // adicionada antes dele — foi o que aconteceu aqui (apontava para "Versões
    // salvas" depois que "Anexos" ganhou uma linha própria).
    await page.getByRole('button', { name: 'Abrir Planilha' }).click();

    const folha = page.getByRole('dialog', { name: 'Planilha' });
    await expect(folha).toBeVisible();
    await folha.getByRole('button', { name: 'Colar' }).click();

    await folha.getByLabel('Qual tipo de informação?').selectOption('attractions');
    await folha.getByLabel('Cole aqui').fill(
      'id\tdata\thora\tnome\tcusto\tstatus\tlink\n' +
      '\t2030-12-02\t10:00\tMachu Picchu\t300\tReservado\t\n' +
      '\t01/12/2030\t\tLinha ruim\t\t\t\n'
    );
    await folha.getByRole('button', { name: 'Conferir' }).click();

    // a prévia mostra o que será feito E o erro, sem aplicar nada ainda
    await expect(folha.getByText(/1 a criar/)).toBeVisible();
    await expect(folha.getByText(/linha 3/)).toBeVisible();
    await expect(folha.getByText(/AAAA-MM-DD/)).toBeVisible();

    await folha.getByRole('button', { name: 'Aplicar à viagem' }).click();

    // o item válido entrou; o inválido não
    await page.getByRole('button', { name: 'Dias' }).click();

    // A tela Dias mostra UM dia por vez. Como a viagem é inteiramente futura,
    // ela abre no primeiro dia (check-in, 01/12) — não no dia da atração
    // importada (02/12). Sem avançar, a única ocorrência de "Machu Picchu" no
    // DOM vem do PrintView (que existe sempre, oculto por CSS para a
    // impressão), e o Playwright corretamente reporta "hidden". Avança um dia
    // para chegar onde o item de fato está.
    await page.getByRole('button', { name: /próximo/i }).click();

    // O PrintView monta a viagem inteira o tempo todo (oculto por CSS até a
    // impressão), então QUALQUER texto de item também existe ali — sem
    // escopo, getByText encontra as duas ocorrências e o modo estrito do
    // Playwright recusa a ambiguidade. Escopar ao <main> exclui essa cópia
    // oculta. (Mesmo padrão já visto no teste de Custos, com "Hospedagem".)
    const tela = page.getByRole('main');
    await expect(tela.getByText('Machu Picchu')).toBeVisible();

    // "Linha ruim" precisa estar ausente em QUALQUER lugar — inclusive no
    // PrintView — porque ela nunca deveria ter sido criada. Aqui, ao
    // contrário, NÃO escopamos: é uma checagem de ausência total.
    await expect(page.getByText('Linha ruim')).toHaveCount(0);
  });

  test('compartilhar abre a folha de convite', async ({ page }) => {
    await criarViagem(page, 'Viagem Share');
    await page.getByRole('button', { name: 'Mais' }).click();
    await page.getByRole('button', { name: /abrir/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
