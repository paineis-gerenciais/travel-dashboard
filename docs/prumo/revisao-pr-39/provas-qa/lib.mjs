// Biblioteca compartilhada dos scripts de QA #38/#39. Só emuladores (127.0.0.1).
import { createRequire } from 'node:module';
export const SP = '<pasta-temporária-da-sessão>';
export const Q = SP + '/qa3839';
export function setup(WTNAME) {
  const WT = `${SP}/${WTNAME}`;
  const req = createRequire(WT + '/package.json');
  const pw = req('@playwright/test');
  const rut = req('@firebase/rules-unit-testing');
  return { WT, pw, rut };
}
export const PROJECT = 'demo-fake';
export const SENHA = 'senha-de-teste-123';
const results = [];
export const log = (m) => console.log(m);
export function rec(cen, esperado, obtido, ok) {
  results.push({ cen, ok });
  log(`[${ok ? 'PASS' : 'FAIL'}] ${cen}\n   esperado: ${esperado}\n   obtido:   ${obtido}`);
}
export async function step(cen, esperado, fn) {
  try { const obtido = await fn(); rec(cen, esperado, obtido || 'conforme', true); }
  catch (e) { rec(cen, esperado, 'ERRO: ' + String(e.message).split('\n').slice(0, 3).join(' / '), false); }
}
export function resumo() {
  const f = results.filter((r) => !r.ok);
  log(`\nTOTAL ${results.length} verificações, ${f.length} falhas${f.length ? ': ' + f.map((x) => x.cen).join('; ') : ''}`);
  return f.length;
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function ensureUser(email) {
  const base = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts';
  let r = await fetch(`${base}:signUp?key=fake`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: SENHA, returnSecureToken: true }) });
  let j = await r.json();
  if (j.error) {
    r = await fetch(`${base}:signInWithPassword?key=fake`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: SENHA, returnSecureToken: true }) });
    j = await r.json();
  }
  if (!j.localId) throw new Error('sem uid para ' + email + ': ' + JSON.stringify(j));
  return j.localId;
}
// versão simples: executa fn(db) com regras desligadas
export async function withAdmin(rut, fn) {
  const env = await rut.initializeTestEnvironment({ projectId: PROJECT, firestore: { host: '127.0.0.1', port: 8080 } });
  try { let out; await env.withSecurityRulesDisabled(async (ctx) => { out = await fn(ctx.firestore()); }); return out; }
  finally { await env.cleanup().catch(() => {}); }
}
export const clone = (o) => JSON.parse(JSON.stringify(o));
export async function seedTrip(rut, { tripId, uid, email, name, state, members }) {
  await withAdmin(rut, async (db) => {
    await db.doc(`trips/${tripId}`).set({
      ownerId: uid, ownerEmail: email, name, state: clone(state), memberUids: members || [uid],
      updatedAtMs: Date.now(),
    });
    await db.doc(`trips/${tripId}/members/${uid}`).set({ email, displayName: email, role: 'owner' });
  });
}
export const readTrip = (rut, tripId) => withAdmin(rut, async (db) => (await db.doc(`trips/${tripId}`).get()).data());
export const patchState = (rut, tripId, fn) => withAdmin(rut, async (db) => {
  const ref = db.doc(`trips/${tripId}`);
  const d = (await ref.get()).data();
  const st = clone(d.state); fn(st);
  await ref.update({ state: clone(st), updatedAtMs: Date.now() });
});
export async function login(page, base, email) {
  await page.goto(base);
  await page.waitForFunction(() => typeof window.__E2E_LOGIN__ === 'function', null, { timeout: 30000 });
  await page.evaluate((e) => window.__E2E_LOGIN__(e), email);
  await page.getByRole('heading', { name: /minhas viagens/i }).waitFor({ timeout: 20000 });
  const pular = page.getByRole('button', { name: /^pular$/i });
  if (await pular.isVisible().catch(() => false)) await pular.click();
}
export async function abrirPrimeiraViagem(page) {
  await page.getByRole('button', { name: 'Abrir', exact: true }).first().click();
  await page.getByRole('navigation', { name: /navegação principal/i }).waitFor({ timeout: 15000 });
}

export const seedComment = (rut, tripId, cid, itemKey, text, uid) => withAdmin(rut, async (db) => {
  await db.doc(`trips/${tripId}/comments/${cid}`).set({ itemKey, text, authorUid: uid, authorName: 'Fulana QA', createdAtMs: Date.now() });
});
