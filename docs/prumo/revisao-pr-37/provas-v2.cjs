// Provas da revisão #17 (somente emulador local, porta 8282, projeto demo).
const { readFileSync } = require('fs');
const path = require('path');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const {
  writeBatch, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where,
  arrayUnion, arrayRemove, serverTimestamp,
} = require('firebase/firestore');

const RULES = path.join(__dirname, 'firestore.v2.rules');
const DONO = { sub: 'uid_dono', email: 'dono@exemplo.com' };
const X = { sub: 'uid_x', email: 'x@exemplo.com' };
const Y = { sub: 'uid_y', email: 'y@exemplo.com' };
let env;
const ctx = (u, extra = {}) => env.authenticatedContext(u.sub, { email: u.email, email_verified: true, ...extra });
const results = [];
async function check(id, desc, expected, fn) {
  let got;
  try { await fn(); got = 'PERMITIDO'; } catch (e) { got = 'NEGADO'; if (!/PERMISSION_DENIED|permission/i.test(String(e))) got = 'ERRO ' + e.message; }
  results.push({ id, desc, expected, got, ok: got === expected });
  console.log(`${got === expected ? 'OK ' : 'XX '} ${id} | esperado ${expected} | obtido ${got} | ${desc}`);
}
async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (a) => {
    const db = a.firestore();
    await setDoc(doc(db, 'trips', 'trip1'), { ownerId: DONO.sub, ownerEmail: DONO.email, name: 'T', state: {}, memberUids: [DONO.sub] });
    await setDoc(doc(db, 'trips', 'trip1', 'members', DONO.sub), { email: DONO.email, role: 'owner' });
    for (const u of [X, Y]) {
      await setDoc(doc(db, 'convites', `trip1_${u.email}`), { tripId: 'trip1', tripName: 'T', emailConvidado: u.email, ownerUid: DONO.sub, ownerEmail: DONO.email, status: 'pendente' });
    }
  });
}
// Replica do cliente v2: acceptPendingInvites (3daaef7, tripData.js:168-207)
async function aceitarComoApp(u) {
  const db = ctx(u).firestore();
  const snap = await getDocs(query(collection(db, 'convites'), where('emailConvidado', '==', u.email)));
  for (const d of snap.docs) {
    const inv = d.data();
    if (inv.status && inv.status !== 'pendente') continue;
    const lote = writeBatch(db);
    lote.update(doc(db, 'trips', inv.tripId), { memberUids: arrayUnion(u.sub) });
    lote.update(d.ref, { status: 'aceito', acceptedByUid: u.sub, acceptedAt: serverTimestamp() });
    await lote.commit();
    await setDoc(doc(db, 'trips', inv.tripId, 'members', u.sub), { email: u.email, displayName: u.email, role: 'editor' }, { merge: true });
  }
}
// Replica do cliente v2: ShareModal (sem fallback para members.email) + revokeMember (tripData.js:203-210)
async function removerComoApp(uid) {
  const db = ctx(DONO).firestore();
  const invites = (await getDocs(query(collection(db, 'convites'), where('ownerUid', '==', DONO.sub)))).docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.tripId === 'trip1');
  const members = (await getDocs(collection(db, 'trips', 'trip1', 'members'))).docs.map((d) => ({ uid: d.id, ...d.data() }));
  const m = members.find((x) => x.uid === uid);
  const email = (invites.find((i) => i.acceptedByUid === uid) || {}).emailConvidado; void m;
  await updateDoc(doc(db, 'trips', 'trip1'), { memberUids: arrayRemove(uid) });
  try { await deleteDoc(doc(db, 'trips', 'trip1', 'members', uid)); } catch (e) {}
  if (email) { try { await deleteDoc(doc(db, 'convites', `trip1_${String(email).toLowerCase()}`)); } catch (e) {} }
  return email || null;
}
async function exists(p) { let r; await env.withSecurityRulesDisabled(async (a) => { r = (await getDoc(doc(a.firestore(), p))).exists(); }); return r; }
async function data(p) { let r; await env.withSecurityRulesDisabled(async (a) => { const s = await getDoc(doc(a.firestore(), p)); r = s.exists() ? s.data() : null; }); return r; }

(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-rev37-v2', firestore: { host: '127.0.0.1', port: 8282, rules: readFileSync(RULES, 'utf8') } });

  // ---------- Ponto 1: e-mail exibido em members ----------
  await seed(); await aceitarComoApp(X);
  await check('P1a', 'membro troca o proprio members.email para o de outra pessoa', 'PERMITIDO', () => updateDoc(doc(ctx(X).firestore(), 'trips/trip1/members', X.sub), { email: DONO.email, displayName: 'Dono' }));
  await check('P1b', 'convidado apaga o proprio convite ja aceito', 'PERMITIDO', () => deleteDoc(doc(ctx(X).firestore(), 'convites', `trip1_${X.email}`)));
  await check('P1c', 'membro aponta members.email para o e-mail do convite pendente de Y', 'PERMITIDO', () => updateDoc(doc(ctx(X).firestore(), 'trips/trip1/members', X.sub), { email: Y.email }));
  const usado = await removerComoApp(X.sub);
  console.log(`     P1d: remocao de X pelo fluxo do app (X apagou o proprio convite) usou o e-mail "${usado}"; convite pendente de Y existe depois? ${await exists(`convites/trip1_${Y.email}`)}`);
  await check('P1e', 'X removido (convite dele apagado) tenta voltar', 'NEGADO', () => updateDoc(doc(ctx(X).firestore(), 'trips', 'trip1'), { memberUids: arrayUnion(X.sub) }));

  // R1: auto-inclusao manual sem marcar o convite como aceito -> revogacao pelo app nao apaga o convite
  await seed();
  await check('R1a', 'X se inclui pelo SDK sem marcar o convite no mesmo lote', 'NEGADO', () => updateDoc(doc(ctx(X).firestore(), 'trips', 'trip1'), { memberUids: arrayUnion(X.sub) }));
  const usado2 = await removerComoApp(X.sub);
  console.log(`     R1b: remocao pelo app usou o e-mail "${usado2}"; convite de X ainda existe? ${await exists(`convites/trip1_${X.email}`)} status=${(await data(`convites/trip1_${X.email}`) || {}).status}`);
  await check('R1c', 'X removido volta sozinho (convite pendente nao apagado)', 'NEGADO', () => updateDoc(doc(ctx(X).firestore(), 'trips', 'trip1'), { memberUids: arrayUnion(X.sub) }));
  // R1 variante: X cria members com e-mail falso
  await seed();
  await aceitarComoApp(X);
  await setDoc(doc(ctx(X).firestore(), 'trips/trip1/members', X.sub), { email: 'qualquer@exemplo.com', displayName: 'Fulano', role: 'editor' });
  const usado3 = await removerComoApp(X.sub);
  await check('R1d', `X com members.email falso removido (app usou "${usado3}") volta sozinho`, 'NEGADO', () => updateDoc(doc(ctx(X).firestore(), 'trips', 'trip1'), { memberUids: arrayUnion(X.sub) }));

  // acceptedByUid livre
  await seed();
  await check('R2', 'convidado grava acceptedByUid de OUTRA pessoa ao aceitar', 'NEGADO', () => updateDoc(doc(ctx(X).firestore(), 'convites', `trip1_${X.email}`), { status: 'aceito', acceptedByUid: Y.sub }));
  await check('R2b', 'lote: entra na viagem + convite aceito com acceptedByUid alheio', 'NEGADO', () => { const db = ctx(X).firestore(); const b = writeBatch(db); b.update(doc(db, 'trips', 'trip1'), { memberUids: arrayUnion(X.sub) }); b.update(doc(db, 'convites', `trip1_${X.email}`), { status: 'aceito', acceptedByUid: Y.sub }); return b.commit(); });
  await check('R2c', 'lote: entra na viagem + convite recusado', 'NEGADO', () => { const db = ctx(X).firestore(); const b = writeBatch(db); b.update(doc(db, 'trips', 'trip1'), { memberUids: arrayUnion(X.sub) }); b.update(doc(db, 'convites', `trip1_${X.email}`), { status: 'recusado' }); return b.commit(); });
  await check('R2d', 'cliente antigo: entra (sem lote) e depois marca aceito', 'NEGADO', () => updateDoc(doc(ctx(X).firestore(), 'trips', 'trip1'), { memberUids: arrayUnion(X.sub) }));
  await check('R2e', 'lote: entra na viagem de Y usando o convite de Y (e-mail alheio)', 'NEGADO', () => { const db = ctx(X).firestore(); const b = writeBatch(db); b.update(doc(db, 'trips', 'trip1'), { memberUids: arrayUnion(X.sub) }); b.update(doc(db, 'convites', `trip1_${Y.email}`), { status: 'aceito', acceptedByUid: X.sub }); return b.commit(); });
  await check('R2f', 'lote: entra + membro cria members no mesmo lote (deve falhar: isMember le estado anterior)', 'NEGADO', () => { const db = ctx(X).firestore(); const b = writeBatch(db); b.update(doc(db, 'trips', 'trip1'), { memberUids: arrayUnion(X.sub) }); b.update(doc(db, 'convites', `trip1_${X.email}`), { status: 'aceito', acceptedByUid: X.sub }); b.set(doc(db, 'trips/trip1/members', X.sub), { email: X.email, role: 'editor' }); return b.commit(); });
  await check('R2g', 'X apos aceitar pelo app apaga o proprio convite, e removido nao volta', 'NEGADO', async () => { await aceitarComoApp(X); await deleteDoc(doc(ctx(X).firestore(), 'convites', `trip1_${X.email}`)); await updateDoc(doc(ctx(DONO).firestore(), 'trips', 'trip1'), { memberUids: arrayRemove(X.sub) }); await updateDoc(doc(ctx(X).firestore(), 'trips', 'trip1'), { memberUids: arrayUnion(X.sub) }); });

  console.log(`     R2h: depois de R2g, convite de X existe? ${await exists(`convites/trip1_${X.email}`)}; memberUids=${JSON.stringify((await data('trips/trip1')).memberUids)}`);
  // ---------- Ponto 2: sem e-mail (telefone) ----------
  await seed();
  await env.withSecurityRulesDisabled(async (a) => {
    const fdb = a.firestore(); for (const id of ['trip1_null', 'trip1_undefined', 'trip1_']) await setDoc(doc(fdb, 'convites', id), { tripId: 'trip1', emailConvidado: '', ownerUid: DONO.sub, status: 'pendente' });
  });
  const FONE = { sub: 'uid_fone' };
  let _fone; const fone = () => (_fone ||= env.authenticatedContext(FONE.sub, { phone_number: '+5531999990000' }).firestore());
  await check('P2a', 'login por telefone (sem email no token) se auto-inclui com convites trip1_null/_undefined/_ plantados', 'NEGADO', () => updateDoc(doc(fone(), 'trips', 'trip1'), { memberUids: arrayUnion(FONE.sub) }));
  await check('P2b', 'login por telefone le convite de e-mail vazio', 'NEGADO', () => getDoc(doc(fone(), 'convites', 'trip1_')));
  await check('P2c', 'token com email mas sem claim email_verified se auto-inclui', 'NEGADO', () => updateDoc(doc(env.authenticatedContext('uid_x2', { email: X.email }).firestore(), 'trips', 'trip1'), { memberUids: arrayUnion('uid_x2') }));
  // dono só com telefone
  await env.withSecurityRulesDisabled(async (a) => {
    await setDoc(doc(a.firestore(), 'trips', 'tripF'), { ownerId: FONE.sub, ownerEmail: '', name: 'F', memberUids: [FONE.sub] });
  });
  await check('P2d', 'dono por telefone cria convite', 'PERMITIDO', () => setDoc(doc(fone(), 'convites', `tripF_${X.email}`), { tripId: 'tripF', tripName: 'F', emailConvidado: X.email, ownerUid: FONE.sub, ownerEmail: '', status: 'pendente' }));
  await check('P2e', 'dono por telefone lista os convites (where ownerUid ==)', 'PERMITIDO', () => getDocs(query(collection(fone(), 'convites'), where('ownerUid', '==', FONE.sub))));
  await check('P2f', 'dono por telefone reenvia convite (setDoc no mesmo id)', 'PERMITIDO', () => setDoc(doc(fone(), 'convites', `tripF_${X.email}`), { tripId: 'tripF', tripName: 'F', emailConvidado: X.email, ownerUid: FONE.sub, ownerEmail: '', status: 'pendente' }));

  // ---------- Ponto 3: reenviar / remover e convidar de novo ----------
  await seed(); await aceitarComoApp(X);
  // remoção sem apagar convite (simula falha no delete): convite fica 'aceito'
  await updateDoc(doc(ctx(DONO).firestore(), 'trips', 'trip1'), { memberUids: arrayRemove(X.sub) });
  await check('P3a', 'removido com convite aceito remanescente tenta voltar', 'NEGADO', () => updateDoc(doc(ctx(X).firestore(), 'trips', 'trip1'), { memberUids: arrayUnion(X.sub) }));
  await check('P3b', 'convidado volta o proprio convite aceito para pendente', 'NEGADO', () => updateDoc(doc(ctx(X).firestore(), 'convites', `trip1_${X.email}`), { status: 'pendente' }));
  await check('P3c', 'dono reenvia (setDoc sem merge) sobre convite aceito', 'PERMITIDO', () => setDoc(doc(ctx(DONO).firestore(), 'convites', `trip1_${X.email}`), { tripId: 'trip1', tripName: 'T', emailConvidado: X.email, ownerUid: DONO.sub, ownerEmail: DONO.email, status: 'pendente', createdAt: serverTimestamp() }));
  await check('P3d', 'apos reenvio do dono, X volta pelo fluxo do app', 'PERMITIDO', () => aceitarComoApp(X));
  await check('P3e', 'dono muda tripId do convite no update', 'NEGADO', () => updateDoc(doc(ctx(DONO).firestore(), 'convites', `trip1_${X.email}`), { tripId: 'trip2', status: 'pendente' }));
  await check('P3f', 'dono marca convite como aceito no update', 'NEGADO', () => updateDoc(doc(ctx(DONO).firestore(), 'convites', `trip1_${X.email}`), { status: 'aceito' }));
  await check('P3g', 'dono troca emailConvidado no update', 'NEGADO', () => updateDoc(doc(ctx(DONO).firestore(), 'convites', `trip1_${X.email}`), { emailConvidado: Y.email, status: 'pendente' }));
  // fluxo completo: remover pelo app e convidar de novo
  await seed(); await aceitarComoApp(X);
  const usado4 = await removerComoApp(X.sub);
  console.log(`     P3h: remocao pelo app usou "${usado4}"; convite apagado? ${!(await exists(`convites/trip1_${X.email}`))}`);
  await check('P3i', 'X removido nao volta', 'NEGADO', () => updateDoc(doc(ctx(X).firestore(), 'trips', 'trip1'), { memberUids: arrayUnion(X.sub) }));
  await check('P3j', 'dono convida X de novo (createInvite = create)', 'PERMITIDO', () => setDoc(doc(ctx(DONO).firestore(), 'convites', `trip1_${X.email}`), { tripId: 'trip1', tripName: 'T', emailConvidado: X.email, ownerUid: DONO.sub, ownerEmail: DONO.email, status: 'pendente', createdAt: serverTimestamp() }));
  await check('P3k', 'X aceita de novo pelo fluxo do app', 'PERMITIDO', () => aceitarComoApp(X));
  const m = (await data('trips/trip1')).memberUids;
  console.log(`     P3l: memberUids final = ${JSON.stringify(m)}`);
  // reenvio enquanto X ainda é membro apaga acceptedByUid
  await check('P3m', 'dono reenvia convite de quem AINDA e membro (acceptedByUid some)', 'PERMITIDO', () => setDoc(doc(ctx(DONO).firestore(), 'convites', `trip1_${X.email}`), { tripId: 'trip1', tripName: 'T', emailConvidado: X.email, ownerUid: DONO.sub, ownerEmail: DONO.email, status: 'pendente' }));
  console.log(`     P3n: convite de X depois do reenvio: ${JSON.stringify(await data(`convites/trip1_${X.email}`))}`);

  // ---------- Ponto 4: queries ----------
  await seed();
  await check('P4a', 'dono: where ownerUid == dono', 'PERMITIDO', () => getDocs(query(collection(ctx(DONO).firestore(), 'convites'), where('ownerUid', '==', DONO.sub))));
  await check('P4b', 'convidado verificado: where emailConvidado == proprio', 'PERMITIDO', () => getDocs(query(collection(ctx(X).firestore(), 'convites'), where('emailConvidado', '==', X.email))));
  await check('P4c', 'convidado NAO verificado: where emailConvidado == proprio', 'NEGADO', () => getDocs(query(collection(env.authenticatedContext('uid_x3', { email: X.email, email_verified: false }).firestore(), 'convites'), where('emailConvidado', '==', X.email))));
  await check('P4d', 'verificado: where emailConvidado == alheio', 'NEGADO', () => getDocs(query(collection(ctx(X).firestore(), 'convites'), where('emailConvidado', '==', Y.email))));
  await check('P4e', 'estranho: where ownerUid == dono', 'NEGADO', () => getDocs(query(collection(ctx(Y).firestore(), 'convites'), where('ownerUid', '==', DONO.sub))));

  // ---------- Ponto 5: deleteTrip ----------
  await seed(); await aceitarComoApp(X);
  await env.withSecurityRulesDisabled(async (a) => {
    const vdb = a.firestore(); for (const v of ['v1', 'v2']) await setDoc(doc(vdb, 'trips/trip1/versions', v), { name: v });
  });
  await check('P5a', 'membro nao-dono executa deleteTrip (apaga versoes)', 'NEGADO', () => deleteDoc(doc(ctx(X).firestore(), 'trips/trip1/versions', 'v1')));
  await check('P5b', 'dono: deleteTrip (lista versoes, apaga todas, apaga viagem)', 'PERMITIDO', async () => {
    const db = ctx(DONO).firestore();
    const vs = await getDocs(collection(db, 'trips', 'trip1', 'versions'));
    await Promise.all(vs.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(db, 'trips', 'trip1'));
  });
  console.log(`     P5c: depois: versions/v1 existe? ${await exists('trips/trip1/versions/v1')}; trip existe? ${await exists('trips/trip1')}; members/${X.sub} orfao? ${await exists(`trips/trip1/members/${X.sub}`)}; convite X orfao? ${await exists(`convites/trip1_${X.email}`)}`);

  await env.cleanup();
  const bad = results.filter((r) => !r.ok);
  console.log(`\nTOTAL ${results.length} | conforme esperado ${results.length - bad.length} | divergentes ${bad.length}: ${bad.map((b) => b.id).join(', ')}`);
  process.exit(0);
})().catch((e) => { console.error('FALHA', e); console.error(e.stack); process.exit(1); });
