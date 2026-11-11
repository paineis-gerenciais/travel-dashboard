import { createRequire } from 'node:module';
const WT = '<raiz-do-repositório>';
const Q = '.';
const { chromium, expect } = createRequire(WT + '/package.json')('@playwright/test');

const PROJECT = 'demo-fake';
const SENHA = 'senha-de-teste-123';
const DONO = 'dono-qa@exemplo.com';
const G1 = 'convidado-qa@exemplo.com';
const G2 = 'convidado-qa2@exemplo.com';
const VIAGEM = 'Viagem QA37';
const results = [];
const log = (m) => console.log(m);
const rec = (cen, esperado, obtido, ok) => { results.push({ cen, ok }); log(`[${ok ? 'PASS' : 'FAIL'}] ${cen}\n   esperado: ${esperado}\n   obtido:   ${obtido}`); };
async function step(cen, esperado, fn) {
  try { const obtido = await fn(); rec(cen, esperado, obtido || 'conforme', true); }
  catch (e) { rec(cen, esperado, 'ERRO: ' + String(e.message).split('\n')[0], false); }
}
const shot = (page, n) => page.screenshot({ path: `${Q}/shots/${n}.png` }).catch(() => {});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- API do emulador
async function oobCodes() {
  const r = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/oobCodes`);
  return (await r.json()).oobCodes;
}
const redact = (l) => l.map((c) => ({ email: c.email, requestType: c.requestType, oobCode: String(c.oobCode).slice(0, 4) + '…', oobLink: String(c.oobLink).replace(/oobCode=[^&]+/, 'oobCode=…').replace(/apiKey=[^&]+/, 'apiKey=…') }));
async function confirmarEmail(email) {
  const lista = await oobCodes();
  log('   oobCodes (redigido): ' + JSON.stringify(redact(lista)));
  const c = lista.filter((x) => x.email === email && x.requestType === 'VERIFY_EMAIL').pop();
  if (!c) throw new Error('sem oobCode VERIFY_EMAIL para ' + email);
  const r = await fetch(c.oobLink, { redirect: 'manual' });
  log(`   GET oobLink -> HTTP ${r.status}`);
  return c;
}
const adm = { Authorization: 'Bearer owner' };
const fs = (p) => `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/${p}`;
async function convites() {
  const r = await fetch(fs('convites'), { headers: adm });
  const j = await r.json();
  return (j.documents || []).map((d) => ({ id: d.name.split('/').pop(), email: d.fields.emailConvidado?.stringValue, status: d.fields.status?.stringValue, aceitoPor: d.fields.acceptedByUid?.stringValue?.slice(0, 6) }));
}
async function memberUids() {
  const r = await fetch(fs('trips'), { headers: adm });
  const j = await r.json();
  return (j.documents || []).map((d) => ({ nome: d.fields.name?.stringValue, n: (d.fields.memberUids?.arrayValue?.values || []).length }));
}

const browser = await chromium.launch();
const mk = async () => { const c = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const p = await c.newPage(); p.on('pageerror', (e) => log('   [pageerror] ' + e.message)); return { c, p }; };
async function hook(page) { await page.goto('http://localhost:4173/'); await page.waitForFunction(() => typeof window.__E2E_LOGIN__ === 'function', null, { timeout: 30000 }); }
async function pular(page) { const b = page.getByRole('button', { name: /^pular$/i }); if (await b.isVisible().catch(() => false)) await b.click(); }
async function abrirCompartilhar(page) {
  await page.getByRole('button', { name: 'Mais' }).click();
  await page.getByRole('button', { name: 'Abrir Compartilhar' }).click();
  const d = page.getByRole('dialog', { name: 'Compartilhar' });
  await expect(d).toBeVisible();
  return d;
}
async function cadastrar(page, nome, email) {
  await page.goto('http://localhost:4173/');
  await page.getByRole('button', { name: 'Criar uma conta' }).click();
  await page.getByPlaceholder('Como você quer ser chamado').fill(nome);
  await page.getByPlaceholder('voce@exemplo.com').fill(email);
  await page.getByPlaceholder('mínimo 6 caracteres').fill(SENHA);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('heading', { name: /minhas viagens/i })).toBeVisible({ timeout: 20000 });
  await pular(page);
}
const banner = (p) => p.getByText('Confirme seu e-mail para aceitar convites');
const viagemNaLista = (p) => p.getByText(VIAGEM).first();


// Lê o token salvo no IndexedDB (firebaseLocalStorageDb) e devolve email_verified (claim) e emailVerified (conta).
async function claimSalva(page) {
  return page.evaluate(() => new Promise((res) => {
    const rq = indexedDB.open('firebaseLocalStorageDb');
    rq.onerror = () => res('erro idb');
    rq.onsuccess = () => {
      const g = rq.result.transaction('firebaseLocalStorage').objectStore('firebaseLocalStorage').getAll();
      g.onsuccess = () => {
        const u = g.result.map((r) => r.value).find((v) => v && v.stsTokenManager);
        if (!u) return res('sem usuario');
        const pl = JSON.parse(atob(u.stsTokenManager.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        res(`claim email_verified=${pl.email_verified} | conta emailVerified=${u.emailVerified} | iat=${new Date(pl.iat * 1000).toISOString().slice(11, 19)} | duração=${pl.exp - pl.iat}s | idade=${Math.round(Date.now()/1000 - pl.iat)}s`);
      };
    };
  }));
}

const dono = await mk();
// ---------- Cenário 1
await step('C1 dono cria viagem e convida 2 e-mails', 'convites criados como pendentes para G1 e G2', async () => {
  const p = dono.p;
  await hook(p);
  await p.evaluate(async (e) => { await window.__E2E_LOGIN__(e); }, DONO);
  await expect(p.getByRole('heading', { name: /minhas viagens/i })).toBeVisible({ timeout: 20000 });
  await pular(p);
  await p.getByPlaceholder('Nome da viagem').fill(VIAGEM);
  await p.getByRole('button', { name: 'Criar' }).click();
  await expect(p.getByRole('navigation', { name: /navegação principal/i })).toBeVisible({ timeout: 15000 });
  const d = await abrirCompartilhar(p);
  for (const e of [G1, G2]) {
    await d.getByPlaceholder('email@exemplo.com').fill(e);
    await d.getByRole('button', { name: 'Convidar' }).click();
    // folha de envio abre sozinha; fecha-a e volta
    await sleep(800);
    await shot(p, `c1-apos-convidar-${e.split('@')[0]}`);
    // se abriu outro diálogo (envio), fechar
    const outro = p.getByRole('dialog').filter({ hasNot: p.getByText('Com acesso') });
    for (let i = 0; i < 3; i++) {
      const dlgs = await p.getByRole('dialog').count();
      if (dlgs <= 1) break;
      await p.getByRole('button', { name: 'Fechar' }).last().click();
      await sleep(300);
    }
  }
  const cv = await convites();
  log('   convites (admin REST): ' + JSON.stringify(cv));
  if (!(cv.length === 2 && cv.every((x) => x.status === 'pendente'))) throw new Error('convites inesperados');
  await shot(p, 'c1-dono-compartilhar');
  return 'convites pendentes: ' + cv.map((x) => x.email).join(', ');
});

// ---------- Cenário 2 + 3 (G1)
const g1 = await mk();
await step('C2 G1 cadastra pela tela; banner aparece e viagem NÃO aparece', 'banner "Confirme seu e-mail…" visível; viagem ausente', async () => {
  const p = g1.p;
  await cadastrar(p, 'Convidado QA', G1);
  await expect(banner(p)).toBeVisible({ timeout: 10000 });
  await sleep(2500); // dá tempo ao efeito de aceitar convites (que deve pular conta não verificada)
  await expect(viagemNaLista(p)).toHaveCount(0);
  const cv = await convites();
  if (cv.find((x) => x.email === G1)?.status !== 'pendente') throw new Error('convite G1 não está pendente: ' + JSON.stringify(cv));
  await shot(p, 'c2-g1-banner');
  return 'banner visível, viagem ausente, convite G1 segue pendente';
});
await step('C6a Reenviar gera novo oobCode e mostra aviso', 'aviso "Enviamos o link para o seu e-mail." e +1 código VERIFY_EMAIL', async () => {
  const p = g1.p;
  const antes = (await oobCodes()).filter((x) => x.email === G1 && x.requestType === 'VERIFY_EMAIL').length;
  await p.getByRole('button', { name: 'Reenviar' }).click();
  await expect(p.getByText('Enviamos o link para o seu e-mail.')).toBeVisible({ timeout: 10000 });
  const depois = (await oobCodes()).filter((x) => x.email === G1 && x.requestType === 'VERIFY_EMAIL').length;
  if (depois !== antes + 1) throw new Error(`códigos antes=${antes} depois=${depois}`);
  await shot(p, 'c6a-reenviar');
  return `aviso visível; códigos VERIFY_EMAIL ${antes} -> ${depois}`;
});
await step('C3a "Já confirmei" ANTES de confirmar', 'aviso "Ainda não consta como confirmado."; viagem ausente', async () => {
  const p = g1.p;
  await p.getByRole('button', { name: 'Já confirmei' }).click();
  await expect(p.getByText('Ainda não consta como confirmado.')).toBeVisible({ timeout: 10000 });
  await expect(viagemNaLista(p)).toHaveCount(0);
  await shot(p, 'c3a-ainda-nao');
  return 'aviso exibido; viagem continua ausente';
});
await step('C3 confirma e-mail pela API do emulador e clica "Já confirmei"', 'viagem aparece sem novo login; convite G1 = aceito; banner some', async () => {
  const p = g1.p;
  await confirmarEmail(G1);
  await p.getByRole('button', { name: 'Já confirmei' }).click();
  await expect(viagemNaLista(p)).toBeVisible({ timeout: 15000 });
  await expect(banner(p)).toHaveCount(0);
  const cv = await convites();
  log('   convites (admin REST): ' + JSON.stringify(cv));
  if (cv.find((x) => x.email === G1)?.status !== 'aceito') throw new Error('convite G1 não aceito');
  await shot(p, 'c3-g1-viagem');
  return 'viagem visível na mesma sessão (sem novo login), banner some, convite aceito';
});
await step('C3b dono vê G1 em "Com acesso"', 'linha do G1 com e-mail e "Editor"', async () => {
  const p = dono.p;
  // fecha e reabre
  await p.getByRole('button', { name: 'Fechar' }).last().click().catch(() => {});
  await sleep(300);
  const d = await abrirCompartilhar(p);
  await expect(d.getByText(G1).first()).toBeVisible({ timeout: 10000 });
  await shot(p, 'c3b-dono-com-acesso');
  return 'G1 listado em Com acesso';
});

// ---------- Cenário 4 (G2: recarrega em vez de clicar)
const g2 = await mk();
await step('C4 G2 cadastra, confirma e recarrega (F5)', 'antes do F5 viagem ausente; depois do F5 viagem aparece sem novo login', async () => {
  const p = g2.p;
  await cadastrar(p, 'Convidado QA 2', G2);
  await expect(banner(p)).toBeVisible({ timeout: 10000 });
  await expect(viagemNaLista(p)).toHaveCount(0);
  log('   [sonda] antes de confirmar: ' + await claimSalva(p));
  await confirmarEmail(G2);
  await sleep(1500);
  log('   [sonda] confirmado, antes do F5: ' + await claimSalva(p));
  await expect(viagemNaLista(p)).toHaveCount(0); // ainda sem F5: nada acontece sozinho
  await p.reload();
  await expect(p.getByRole('heading', { name: /minhas viagens/i })).toBeVisible({ timeout: 20000 });
  await expect(viagemNaLista(p)).toBeVisible({ timeout: 15000 });
  log('   [sonda] depois do F5: ' + await claimSalva(p));
  const cv = await convites();
  log('   convites (admin REST): ' + JSON.stringify(cv));
  if (cv.find((x) => x.email === G2)?.status !== 'aceito') throw new Error('convite G2 não aceito');
  await shot(p, 'c4-g2-apos-f5');
  return 'após F5 a viagem aparece (sem tela de login), convite G2 aceito';
});

// ---------- Cenário 6b (membro sem perfil), em G2, antes da remoção
await step('C6b "Membro sem perfil"', 'sem doc de membro, a linha mostra "Membro sem perfil"', async () => {
  const p = dono.p;
  const mj = await (await fetch(fs(`trips`), { headers: adm })).json();
  const tripId = mj.documents[0].name.split('/').pop();
  const ms = await (await fetch(fs(`trips/${tripId}/members`), { headers: adm })).json();
  const alvo = (ms.documents || []).find((d) => d.fields.email?.stringValue === G2);
  if (!alvo) throw new Error('doc de membro de G2 não encontrado');
  const del = await fetch(`http://127.0.0.1:8080/v1/${alvo.name}`, { method: 'DELETE', headers: adm });
  log('   DELETE members/<uid G2> (admin) -> HTTP ' + del.status);
  await p.getByRole('button', { name: 'Fechar' }).last().click().catch(() => {});
  await sleep(300);
  const d = await abrirCompartilhar(p);
  await sleep(1500);
  await shot(p, 'c6b-sem-perfil');
  log('   texto do diálogo: ' + (await d.innerText()).replace(/\n+/g, ' | '));
  await expect(d.getByText('Membro sem perfil')).toBeVisible({ timeout: 5000 });
  return '"Membro sem perfil" exibido para G2';
});

// ---------- Cenário 5
await step('C5 dono remove G1; viagem some para G1 e não volta ao recarregar', 'some (ao vivo ou após F5) e continua ausente após novo F5; convite não reaceito', async () => {
  const p = dono.p;
  const d = p.getByRole('dialog', { name: 'Compartilhar' });
  const linha = d.locator('div').filter({ hasText: G1 }).filter({ has: p.getByRole('button', { name: 'Remover' }) }).last();
  await linha.getByRole('button', { name: 'Remover' }).click();
  await sleep(1500);
  const cv = await convites();
  log('   convites após remover (admin REST): ' + JSON.stringify(cv));
  log('   trips/memberUids: ' + JSON.stringify(await memberUids()));
  const g = g1.p;
  let aoVivo = true;
  try { await expect(viagemNaLista(g)).toHaveCount(0, { timeout: 8000 }); } catch { aoVivo = false; }
  log('   some ao vivo (sem recarregar)? ' + aoVivo);
  await g.reload();
  await expect(g.getByRole('heading', { name: /minhas viagens/i })).toBeVisible({ timeout: 20000 });
  await sleep(3000);
  await expect(viagemNaLista(g)).toHaveCount(0);
  await g.reload();
  await expect(g.getByRole('heading', { name: /minhas viagens/i })).toBeVisible({ timeout: 20000 });
  await sleep(3000);
  await expect(viagemNaLista(g)).toHaveCount(0);
  log('   convites após 2 recarregamentos (admin REST): ' + JSON.stringify(await convites()));
  log('   trips/memberUids: ' + JSON.stringify(await memberUids()));
  await shot(g, 'c5-g1-removido');
  return `viagem ausente para G1 (ao vivo=${aoVivo}) e após 2 F5`;
});

await browser.close();
log('\n=== RESUMO ===');
for (const r of results) log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.cen}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
