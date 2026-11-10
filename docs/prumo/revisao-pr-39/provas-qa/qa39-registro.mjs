// QA #39 — edição por id: folhas, reordenação remota, legado sem id e dois contextos (emuladores).
// Uso: node qa39-registro.mjs [wt39|wt38]  (wt38 = controle: código sem a #25; falhas esperadas nos passos de folha)
import { setup, SP, Q, log, step, rec, resumo, sleep, ensureUser, seedTrip, readTrip, patchState, seedComment, withAdmin, login, abrirPrimeiraViagem } from './lib.mjs';
const WTN = process.argv[2] || 'wt39';
const { WT, pw, rut } = setup(WTN);
const { chromium, expect } = pw;
const D = WT + '/src/domain/';
const { blankState, normalizeState, idLegado } = await import(D + 'state.js');
const BASE = 'http://localhost:4173/';
const TAG = WTN === 'wt39' ? '' : '[CONTROLE wt38] ';
const shot = (page, n) => page.screenshot({ path: `${Q}/shots/${WTN}-${n}.png` }).catch(() => {});
const jrt = (o) => JSON.parse(JSON.stringify(o));
const DAY = '2030-06-10';

function base(comIds = true) {
  const s = blankState();
  s.cities = [
    { id: 'c-lis', city: 'Lisboa', emoji: '📍', start: '2030-06-10', end: '2030-06-14', hotel: 'Hotel Alfa', nightly: 0, status: 'Planejado', notes: '', breakfastIncluded: false },
    { id: 'c-por', city: 'Porto', emoji: '📍', start: '2030-06-14', end: '2030-06-17', hotel: 'Hotel Beta', nightly: 0, status: 'Planejado', notes: '', breakfastIncluded: false },
    { id: 'c-sev', city: 'Sevilha', emoji: '📍', start: '2030-06-20', end: '2030-06-22', hotel: 'Hotel Gama', nightly: 0, status: 'Planejado', notes: '', breakfastIncluded: false },
  ];
  s.attractions = ['Torre de Belém', 'Castelo São Jorge', 'Oceanário'].map((n, i) => ({ id: 'a' + (i + 1), date: DAY, city: 'Lisboa', time: `0${9 + i}:00`, period: 'Manhã', name: n, cost: 10 * (i + 1), status: 'Planejado' }));
  s.foodItems = [['Almoço', 'Cervejaria Um'], ['Jantar', 'Tasca Dois'], ['Lanche', 'Padaria Três']].map(([t, p], i) => ({ id: 'f' + (i + 1), date: DAY, city: 'Lisboa', type: t, place: p, cost: 5 * (i + 1), status: 'Planejado' }));
  s.transports = ['Trem', 'Metrô', 'Ônibus'].map((m, i) => ({ id: 't' + (i + 1), date: DAY, time: `1${i}:00`, originCity: 'Orig' + (i + 1), originPlace: '', destCity: 'Dest' + (i + 1), destPlace: '', mode: m, duration: '', cost: 3 * (i + 1), status: 'Planejado', notes: '' }));
  s.otherExpenses = ['Souvenir', 'Gorjeta', 'Farmácia'].map((n, i) => ({ id: 'o' + (i + 1), date: DAY, city: 'Lisboa', name: n, cost: 2 * (i + 1), status: 'Planejado' }));
  s.checklist = ['Passaporte', 'Seguro viagem', 'Carregador'].map((n, i) => ({ id: 'k' + (i + 1), category: 'Documentos', item: n, responsible: '', priority: 'Média', status: 'Pendente', notes: '', done: false }));
  if (!comIds) ['cities', 'attractions', 'foodItems', 'transports', 'otherExpenses', 'checklist'].forEach((k) => s[k].forEach((x) => delete x.id));
  return s;
}
const nomes = (st, k, campo) => (st[k] || []).map((x) => x[campo]);
const docState = async (id) => (await readTrip(rut, id)).state;
async function aguarda(id, pred, ms = 9000) {
  const t0 = Date.now(); let st;
  while (Date.now() - t0 < ms) { st = await docState(id); if (pred(st)) return st; await sleep(250); }
  throw new Error('doc não chegou ao esperado: ' + JSON.stringify(st && null));
}
const browser = await chromium.launch();
async function abrir(email, { w = 1280, h = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage();
  const erros = []; page.on('pageerror', (e) => erros.push(e.message));
  await login(page, BASE, email); await abrirPrimeiraViagem(page);
  return { ctx, page, erros };
}
// aplica a mudança remota e espera ela aparecer na tela (se um campo está em foco, o app a segura até o blur)
async function remotoVisivel(page, id, fn, marcador) {
  await patchState(rut, id, fn);
  const visivel = async () => (typeof marcador === 'function' ? marcador() : (await page.evaluate(() => document.body.innerText)).includes(marcador));
  for (let i = 0; i < 12; i++) { if (await visivel()) return 'aplicado direto'; await sleep(250); }
  await page.getByRole('dialog').last().locator('h2, h3, [class*=title]').first().click({ force: true }).catch(() => {});
  await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
  for (let i = 0; i < 12; i++) { if (await visivel()) return 'aplicado após blur'; await sleep(250); }
  throw new Error('mudança remota não apareceu na tela');
}

// ===== T1: cidades
{
  const email = 'qa39-t1@exemplo.com'; const uid = await ensureUser(email); const id = 'trip-qa39-t1';
  await seedTrip(rut, { tripId: id, uid, email, name: 'QA39 T1 cidades', state: base() });
  const { ctx, page } = await abrir(email);
  await page.getByRole('button', { name: 'Cidades' }).click();
  const lista = () => page.getByRole('main');
  await lista().locator('.row', { hasText: 'Porto' }).getByRole('button', { name: 'Editar' }).click();
  const dlg = page.getByRole('dialog', { name: 'Editar cidade' }); await dlg.waitFor();
  await step(TAG + 'T1.1 cidades: folha aberta em Porto, colaborador insere "Faro" no início e reordena', 'a folha continua em Porto', async () => {
    await expect(dlg.getByLabel('Cidade', { exact: true })).toHaveValue('Porto');
    const how = await remotoVisivel(page, id, (s) => { s.cities.unshift({ id: 'c-faro', city: 'Faro', emoji: '📍', start: '2030-05-01', end: '2030-05-03', hotel: 'Hotel Delta', nightly: 0, status: 'Planejado', notes: '', breakfastIncluded: false }); }, 'Faro');
    await sleep(300);
    const v = await dlg.getByLabel('Cidade', { exact: true }).inputValue().catch(() => '(folha sumiu)');
    if (v !== 'Porto') throw new Error('folha mostra "' + v + '" em vez de Porto');
    return `(${how}) folha ainda em Porto`;
  });
  await step(TAG + 'T1.2 editar hospedagem na folha vai para Porto, não para outra cidade', 'só Porto muda de hotel', async () => {
    const dl = page.getByRole('dialog', { name: 'Editar cidade' });
    await dl.getByLabel('Hospedagem').fill('Hotel Porto Novo');
    const st = await aguarda(id, (s) => s.cities.some((c) => c.hotel === 'Hotel Porto Novo'));
    const outras = st.cities.filter((c) => c.hotel !== 'Hotel Porto Novo').map((c) => c.city + ':' + c.hotel).sort().join(',');
    const alvo = st.cities.find((c) => c.hotel === 'Hotel Porto Novo').city;
    if (alvo !== 'Porto') throw new Error('hotel gravado em ' + alvo + '; ' + outras);
    return 'hotel em Porto; outras: ' + outras;
  });
  await step(TAG + 'T1.3 Excluir cidade (só a cidade) pela folha remove Porto e preserva Faro, Lisboa, Sevilha', 'doc com Faro, Lisboa, Sevilha', async () => {
    const dl = page.getByRole('dialog', { name: 'Editar cidade' });
    await dl.getByRole('button', { name: 'Excluir cidade' }).click();
    await page.getByRole('dialog', { name: 'Excluir cidade' }).getByRole('button', { name: 'Excluir só a cidade' }).click();
    const st = await aguarda(id, (s) => s.cities.length === 3);
    const n = st.cities.map((c) => c.city).sort().join(',');
    if (n !== 'Faro,Lisboa,Sevilha') throw new Error('restaram: ' + n);
    return n;
  });
  await step(TAG + 'T1.4 diálogo de exclusão aberto e colaborador reordena: exclui a cidade escolhida (Lisboa), com itens ligados', 'Lisboa e só os itens de Lisboa saem', async () => {
    await page.reload(); await page.getByRole('button', { name: 'Abrir', exact: true }).first().click().catch(() => {});
    await page.getByRole('navigation', { name: /navegação principal/i }).waitFor();
    await page.getByRole('button', { name: 'Cidades' }).click();
    await lista().locator('.row', { hasText: 'Lisboa' }).getByRole('button', { name: 'Editar' }).click();
    await page.getByRole('dialog', { name: 'Editar cidade' }).getByRole('button', { name: 'Excluir cidade' }).click();
    const conf = page.getByRole('dialog', { name: 'Excluir cidade' }); await conf.waitFor();
    await patchState(rut, id, (s) => { s.cities.unshift({ id: 'c-extra', city: 'Braga', emoji: '📍', start: '2030-04-01', end: '2030-04-02', hotel: '', nightly: 0, status: 'Planejado', notes: '', breakfastIncluded: false }); });
    await sleep(1500);
    await conf.getByRole('button', { name: 'Excluir cidade e itens ligados' }).click();
    const st = await aguarda(id, (s) => !s.cities.some((c) => c.city === 'Lisboa'));
    const n = st.cities.map((c) => c.city).sort().join(',');
    if (n !== 'Braga,Faro,Sevilha') throw new Error('restaram: ' + n);
    const resto = (st.attractions || []).length + (st.foodItems || []).length;
    return `cidades=${n}; itens de Lisboa restantes (atrações+refeições)=${resto}`;
  });
  await shot(page, 't1');
  await ctx.close();
}

// ===== T2: itens do dia (4 tipos) com folha aberta e inserção remota
const KINDS = [
  { k: 'attractions', titulo: 'Editar atração', campo: 'Atração', prop: 'name', alvo: 'Castelo São Jorge', outro: 'Oceanário', novo: { id: 'a-novo', date: DAY, city: 'Lisboa', time: '08:00', period: 'Manhã', name: 'Aquário Novo', cost: 1, status: 'Planejado' }, marc: 'Aquário Novo' },
  { k: 'foodItems', titulo: 'Editar refeição', campo: 'Restaurante ou local', prop: 'place', alvo: 'Tasca Dois', outro: 'Padaria Três', novo: { id: 'f-novo', date: DAY, city: 'Lisboa', type: 'Brunch', place: 'Cafe Novo', cost: 1, status: 'Planejado' }, marc: 'Cafe Novo', rowKey: 'Jantar' },
  { k: 'transports', titulo: 'Editar transporte', campo: 'Meio de transporte', prop: 'mode', alvo: 'Metrô', outro: 'Ônibus', novo: { id: 't-novo', date: DAY, time: '07:00', originCity: 'OrigN', originPlace: '', destCity: 'DestN', destPlace: '', mode: 'Bonde', duration: '', cost: 1, status: 'Planejado', notes: '' }, marc: 'Bonde' },
  { k: 'otherExpenses', titulo: 'Editar despesa', campo: 'Descrição', prop: 'name', alvo: 'Gorjeta', outro: 'Farmácia', novo: { id: 'o-novo', date: DAY, city: 'Lisboa', name: 'Pedágio Novo', cost: 1, status: 'Planejado' }, marc: 'Pedágio Novo' },
];
for (const K of KINDS) {
  const email = `qa39-t2-${K.k}@exemplo.com`; const uid = await ensureUser(email); const id = `trip-qa39-t2-${K.k}`;
  await seedTrip(rut, { tripId: id, uid, email, name: 'QA39 T2 ' + K.k, state: base() });
  const { ctx, page, erros } = await abrir(email);
  await page.getByRole('button', { name: 'Dias' }).click();
  const tela = page.getByRole('main');
  const marcaLinha = K.rowKey || K.alvo;
  await tela.locator('.row', { hasText: marcaLinha }).getByRole('button', { name: 'Editar' }).click();
  const dlg = page.getByRole('dialog', { name: K.titulo }); await dlg.waitFor();
  await step(TAG + `T2.${K.k}.1 folha do 2º item aberta; colaborador insere item novo no INÍCIO da lista`, `a folha continua em "${K.alvo}"`, async () => {
    const how = await remotoVisivel(page, id, (s) => { s[K.k].unshift(K.novo); }, K.marc);
    await sleep(300);
    const v = await page.getByRole('dialog', { name: K.titulo }).getByLabel(K.campo, { exact: true }).inputValue().catch(() => '(folha sumiu)');
    if (v !== K.alvo) throw new Error(`folha mostra "${v}" em vez de "${K.alvo}"`);
    return `(${how})`;
  });
  await step(TAG + `T2.${K.k}.2 editar o campo grava no item certo`, `só "${K.alvo}" vira "${K.alvo} EDIT"`, async () => {
    await page.getByRole('dialog', { name: K.titulo }).getByLabel(K.campo, { exact: true }).fill(K.alvo + ' EDIT');
    const st = await aguarda(id, (s) => s[K.k].some((x) => x[K.prop] === K.alvo + ' EDIT'));
    const lista = nomes(st, K.k, K.prop).join(' | ');
    const esperado = [K.novo[K.prop], ...nomes(base(), K.k, K.prop).map((n) => (n === K.alvo ? K.alvo + ' EDIT' : n))].sort().join(' | ');
    if ([...nomes(st, K.k, K.prop)].sort().join(' | ') !== esperado) throw new Error('doc: ' + lista + ' | esperado: ' + esperado);
    return lista;
  });
  await step(TAG + `T2.${K.k}.3 "Excluir item" remove o item certo`, `fica tudo, menos "${K.alvo} EDIT"`, async () => {
    await page.getByRole('dialog', { name: K.titulo }).getByRole('button', { name: 'Excluir item' }).click();
    const st = await aguarda(id, (s) => !s[K.k].some((x) => String(x[K.prop]).startsWith(K.alvo)));
    const lista = nomes(st, K.k, K.prop).sort().join(' | ');
    const esperado = [K.novo[K.prop], ...nomes(base(), K.k, K.prop).filter((n) => n !== K.alvo)].sort().join(' | ');
    if (lista !== esperado) throw new Error('doc: ' + lista + ' | esperado: ' + esperado);
    return lista;
  });
  await step(TAG + `T2.${K.k}.4 sem erros de página`, 'nenhum pageerror', async () => { if (erros.length) throw new Error(erros.join(';')); });
  if (K.k === 'attractions') await shot(page, 't2-atr');
  await ctx.close();
}

// ===== T3: checklist (Mais)
{
  const email = 'qa39-t3@exemplo.com'; const uid = await ensureUser(email); const id = 'trip-qa39-t3';
  const st0 = base(); st0.checklist.push({ id: 'k4', category: 'Outros', item: 'Adaptador de tomada', responsible: '', priority: 'Média', status: 'Pendente', notes: '', done: false });
  await seedTrip(rut, { tripId: id, uid, email, name: 'QA39 T3 checklist', state: st0 });
  const { ctx, page } = await abrir(email);
  await page.getByRole('button', { name: 'Mais' }).click();
  await page.getByRole('button', { name: 'Abrir Checklist' }).click();
  const dlg = page.getByRole('dialog', { name: /^Checklist/ }); await dlg.waitFor();
  await step(TAG + 'T3.1 busca filtra a lista; marcar "Seguro viagem" marca o item certo (id, não posição da lista filtrada)', 'só k2 fica done', async () => {
    await dlg.getByPlaceholder('Buscar item…').fill('seguro');
    await dlg.getByRole('checkbox', { name: 'Seguro viagem' }).check();
    const st = await aguarda(id, (s) => s.checklist.some((x) => x.done));
    const feitos = st.checklist.filter((x) => x.done).map((x) => x.item).join(',');
    if (feitos !== 'Seguro viagem') throw new Error('marcados: ' + feitos);
    const stt = st.checklist.find((x) => x.item === 'Seguro viagem').status;
    return `marcado: ${feitos} (status ${stt})`;
  });
  await step(TAG + 'T3.2 colaborador insere item no início com a lista aberta; renomear "Carregador" grava no item certo', 'só Carregador muda', async () => {
    await dlg.getByPlaceholder('Buscar item…').fill('');
    await remotoVisivel(page, id, (s) => { s.checklist.unshift({ id: 'k-novo', category: 'Outros', item: 'Protetor solar', responsible: '', priority: 'Média', status: 'Pendente', notes: '', done: false }); }, async () => (await dlg.locator('input[value="Protetor solar"]').count()) > 0);
    const campo = dlg.locator('input:not([type=checkbox]):not([type=search])').filter({ hasNot: page.locator('[placeholder]') });
    const inp = dlg.locator('.row-main input').filter({ has: page.locator('xpath=self::*') });
    const alvo = dlg.locator('input[value="Carregador"]');
    await alvo.fill('Carregador EDIT'); await page.keyboard.press('Tab');
    const st = await aguarda(id, (s) => s.checklist.some((x) => x.item === 'Carregador EDIT'));
    const n = st.checklist.map((x) => x.item).sort().join(' | ');
    if (n !== ['Adaptador de tomada', 'Carregador EDIT', 'Passaporte', 'Protetor solar', 'Seguro viagem'].sort().join(' | ')) throw new Error(n);
    return n;
  });
  await step(TAG + 'T3.3 "Anexar link" do 2º item aberto; colaborador insere no início; link grava no item certo', 'link em "Passaporte"', async () => {
    const linha = dlg.locator('.row', { has: page.locator('input[value="Passaporte"]') });
    await linha.getByRole('button', { name: /Anexar link/ }).click();
    const sub = page.getByRole('dialog', { name: 'Anexar link' }); await sub.waitFor();
    await patchState(rut, id, (s) => { s.checklist.unshift({ id: 'k-novo2', category: 'Outros', item: 'Repelente', responsible: '', priority: 'Média', status: 'Pendente', notes: '', done: false }); });
    await sleep(1500);
    await sub.getByLabel('Link do comprovante').fill('https://exemplo.com/passaporte'); await page.keyboard.press('Tab');
    const st = await aguarda(id, (s) => s.checklist.some((x) => x.link && x.link.url));
    const quem = st.checklist.filter((x) => x.link && x.link.url).map((x) => x.item).join(',');
    if (quem !== 'Passaporte') throw new Error('link foi para: ' + quem);
    return 'link em ' + quem;
  });
  await step(TAG + 'T3.4 Excluir "Adaptador de tomada" remove o item certo', 'some só ele', async () => {
    await page.getByRole('dialog', { name: 'Anexar link' }).getByRole('button', { name: 'Concluir' }).click();
    await dlg.locator('.row', { has: page.locator('input[value="Adaptador de tomada"]') }).getByRole('button', { name: 'Excluir' }).click();
    const st = await aguarda(id, (s) => !s.checklist.some((x) => x.item === 'Adaptador de tomada'));
    return st.checklist.map((x) => x.item).join(' | ');
  });
  await ctx.close();
}

// ===== T4: legado sem id, dois contextos
{
  const e1 = 'qa39-t4a@exemplo.com'; const e2 = 'qa39-t4b@exemplo.com';
  const u1 = await ensureUser(e1); const u2 = await ensureUser(e2); const id = 'trip-qa39-t4';
  const leg = base(false);
  await seedTrip(rut, { tripId: id, uid: u1, email: e1, name: 'QA39 T4 legado', state: leg, members: [u1, u2] });
  await withAdmin(rut, async (db) => { await db.doc(`trips/${id}/members/${u2}`).set({ email: e2, displayName: e2, role: 'member' }); });
  const armazenado = jrt((await docState(id)));
  const norm = normalizeState(jrt(armazenado));
  const idAt = norm.attractions.map((x) => x.id); const idFo = norm.foodItems.map((x) => x.id); const idTr = norm.transports.map((x) => x.id);
  log(`   ids esperados (domínio): attractions=${idAt} foodItems=${idFo} transports=${idTr}`);
  // comentários: um no 2º item de cada tipo (chave com o id derivado) e um na chave legada "undefined"
  await seedComment(rut, id, 'c1', `attractions:${idAt[1]}`, 'comentário na atração 2', u1);
  await seedComment(rut, id, 'c2', `foodItems:${idFo[1]}`, 'comentário na refeição 2', u1);
  await seedComment(rut, id, 'c3', `transports:${idTr[1]}`, 'comentário no transporte 2', u1);
  await seedComment(rut, id, 'c4', 'attractions:undefined', 'comentário antigo (item sem id)', u1);
  const A = await abrir(e1); const B = await abrir(e2);
  for (const c of [A, B]) await c.page.getByRole('button', { name: 'Dias' }).click();
  const badges = async (page, rowText) => page.getByRole('main').locator('.row', { hasText: rowText }).locator('button[aria-label*="comentário"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  await sleep(1200);
  await step(TAG + 'T4.1 dois contextos (usuários A e B) abrem a mesma viagem legada: o comentário ligado ao id derivado aparece no mesmo item nos dois', 'badge "1 comentário(s)" só no 2º item de cada tipo, em A e em B', async () => {
    const out = [];
    for (const [nome, c] of [['A', A], ['B', B]]) {
      for (const [row, esperado] of [['Torre de Belém', 0], ['Castelo São Jorge', 1], ['Oceanário', 0], ['Almoço', 0], ['Jantar', 1], ['Lanche', 0], ['Trem', 0], ['Metrô', 1], ['Ônibus', 0]]) {
        const b = await badges(c.page, row); const n = b.some((x) => /^1 comentário/.test(x)) ? 1 : 0;
        if (n !== esperado) throw new Error(`${nome}/${row}: badge=${JSON.stringify(b)} esperado=${esperado}`);
      }
      out.push(nome + ' ok');
    }
    return out.join('; ') + ' (ids iguais nos dois e iguais aos do domínio)';
  });
  await step(TAG + 'T4.2 o comentário antigo "attractions:undefined" (item sem id) — onde aparece?', 'registrar', async () => {
    const em = [];
    for (const row of ['Torre de Belém', 'Castelo São Jorge', 'Oceanário']) { const b = await badges(A.page, row); em.push(row + '=' + JSON.stringify(b)); }
    await A.page.getByRole('button', { name: 'Mensagens' }).click();
    const dm = A.page.getByRole('dialog', { name: 'Mensagens' }); await dm.waitFor();
    await dm.getByText('Carregando…').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await sleep(500);
    const txt = (await dm.innerText()).replace(/\s+/g, ' ');
    await shot(A.page, 't4-mensagens');
    await A.page.keyboard.press('Escape');
    return `badges: ${em.join('; ')} | Mensagens: ${txt.slice(0, 420)}`;
  });
  await step(TAG + 'T4.3 A edita o 2º item; B (que abriu antes do salvamento) segue no mesmo item', 'ids gravados no doc = ids do domínio; B ainda mostra o comentário no mesmo item', async () => {
    await A.page.getByRole('main').locator('.row', { hasText: 'Castelo São Jorge' }).getByRole('button', { name: 'Editar' }).click();
    const d = A.page.getByRole('dialog', { name: 'Editar atração' });
    await d.getByLabel('Atração', { exact: true }).fill('Castelo EDITADO');
    const st = await aguarda(id, (s) => s.attractions.some((x) => x.name === 'Castelo EDITADO'));
    const ids = st.attractions.map((x) => x.id);
    if (JSON.stringify(ids) !== JSON.stringify(idAt)) throw new Error(`ids no doc ${ids} != domínio ${idAt}`);
    const semId = ['cities', 'attractions', 'foodItems', 'transports', 'otherExpenses', 'checklist'].filter((k) => st[k].some((x) => !x.id));
    if (semId.length) throw new Error('ainda sem id: ' + semId);
    await sleep(800);
    const bB = await badges(B.page, 'Castelo EDITADO');
    if (!bB.some((x) => /^1 comentário/.test(x))) throw new Error('B perdeu o comentário do item: ' + JSON.stringify(bB));
    await A.page.keyboard.press('Escape');
    return `ids no doc=${ids}; B vê o item renomeado com o comentário`;
  });
  await step(TAG + 'T4.4 B edita o 3º item e exclui o 1º; A não "troca" de item', 'doc coerente: 1º some, 3º editado, 2º intacto', async () => {
    await B.page.getByRole('main').locator('.row', { hasText: 'Oceanário' }).getByRole('button', { name: 'Editar' }).click();
    const d = B.page.getByRole('dialog', { name: 'Editar atração' });
    await d.getByLabel('Atração', { exact: true }).fill('Oceanário EDIT'); await B.page.keyboard.press('Tab');
    await aguarda(id, (s) => s.attractions.some((x) => x.name === 'Oceanário EDIT'));
    await B.page.keyboard.press('Escape');
    await B.page.getByRole('main').locator('.row', { hasText: 'Torre de Belém' }).getByRole('button', { name: 'Editar' }).click();
    await B.page.getByRole('dialog', { name: 'Editar atração' }).getByRole('button', { name: 'Excluir item' }).click();
    const st = await aguarda(id, (s) => !s.attractions.some((x) => x.name === 'Torre de Belém'));
    const n = st.attractions.map((x) => x.name).join(' | ');
    if (n !== 'Castelo EDITADO | Oceanário EDIT') throw new Error(n);
    await sleep(800);
    const txtA = (await A.page.getByRole('main').innerText()).replace(/\s+/g, ' ');
    if (txtA.includes('Torre de Belém')) throw new Error('A ainda mostra o item excluído');
    return n;
  });
  await A.ctx.close(); await B.ctx.close();
  await step(TAG + 'T4.5 [borda] folha aberta num item legado sem id gravado; o dado é alterado no doc por quem não grava ids', 'registrar o que acontece com a folha aberta', async () => {
    const e3 = 'qa39-t4c@exemplo.com'; const u3 = await ensureUser(e3); const id3 = 'trip-qa39-t4c';
    await seedTrip(rut, { tripId: id3, uid: u3, email: e3, name: 'QA39 T4c legado', state: base(false) });
    const C = await abrir(e3); await C.page.getByRole('button', { name: 'Dias' }).click();
    await C.page.getByRole('main').locator('.row', { hasText: 'Castelo São Jorge' }).getByRole('button', { name: 'Editar' }).click();
    const d = C.page.getByRole('dialog', { name: 'Editar atração' }); await d.waitFor();
    await sleep(1500); // deixa o app gravar os ids (se gravar ao abrir)
    const antes = (await docState(id3)).attractions.map((x) => x.id || '(sem id)').join(',');
    await withAdmin(rut, async (db) => { const r = db.doc(`trips/${id3}`); const dd = (await r.get()).data(); const st = jrt(dd.state); st.attractions.forEach((x) => delete x.id); st.attractions[1].name = 'Castelo (alterado fora)'; await r.update({ state: st }); });
    await sleep(1800);
    const aberta = await C.page.getByRole('dialog', { name: 'Editar atração' }).count();
    const val = aberta ? await C.page.getByRole('dialog', { name: 'Editar atração' }).getByLabel('Atração', { exact: true }).inputValue() : '(folha fechou sozinha)';
    await C.ctx.close();
    return `ids no doc depois de abrir: ${antes}; após alteração externa sem ids: folha=${val}`;
  });

}
await browser.close();
process.exit(resumo() ? 1 : 0);
