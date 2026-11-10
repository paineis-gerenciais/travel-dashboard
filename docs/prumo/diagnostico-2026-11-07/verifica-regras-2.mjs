import { readFileSync } from 'fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

const DONO = { sub: 'uid_dono', email: 'dono@exemplo.com' };
const MEMBRO = { sub: 'uid_membro', email: 'membro@exemplo.com' };
const IMPOSTOR = { sub: 'uid_impostor', email: 'novo@exemplo.com', verified: false }; // cadastrou e-mail/senha com o e-mail do convidado real

const env = await initializeTestEnvironment({
  projectId: 'demo-diag2',
  firestore: { host: '127.0.0.1', port: 8181, rules: readFileSync('firestore.rules', 'utf8') },
});
const ctx = (u) => env.authenticatedContext(u.sub, { email: u.email, email_verified: u.verified !== false });
await env.clearFirestore();
await env.withSecurityRulesDisabled(async (admin) => {
  const db = admin.firestore();
  await setDoc(doc(db, 'trips', 'trip1'), { ownerId: DONO.sub, ownerEmail: DONO.email, name: 'Portugal', state: { cities: [] }, memberUids: [DONO.sub, MEMBRO.sub] });
  // como o app deixa o convite depois do aceite (tripData.js:183): status 'aceito', nunca apagado
  await setDoc(doc(db, 'convites', `trip1_${MEMBRO.email}`), { tripId: 'trip1', tripName: 'Portugal', emailConvidado: MEMBRO.email, ownerUid: DONO.sub, status: 'aceito', acceptedByUid: MEMBRO.sub });
  // convite pendente para alguém que ainda não entrou no app
  await setDoc(doc(db, 'convites', `trip1_novo@exemplo.com`), { tripId: 'trip1', tripName: 'Portugal', emailConvidado: 'novo@exemplo.com', ownerUid: DONO.sub, status: 'pendente' });
});

const linhas = [];
async function check(id, descricao, esperado, promessa) {
  let r; try { await promessa; r = 'PERMITIDO'; } catch (e) { r = (e.code === 'permission-denied' || /PERMISSION_DENIED|permission/i.test(String(e.message || e))) ? 'NEGADO' : 'ERRO: ' + e.message; }
  linhas.push(`${id} | ${descricao} | esperado ${esperado} | obtido ${r} | ${r === esperado ? 'ok' : 'FALHA DE SEGURANCA'}`);
}

// R) Dono remove o membro exatamente como o app faz (revokeMember: arrayRemove); o convite 'aceito' fica
await check('R1', 'dono remove membro (arrayRemove, como revokeMember faz)', 'PERMITIDO',
  updateDoc(doc(ctx(DONO).firestore(), 'trips', 'trip1'), { memberUids: arrayRemove(MEMBRO.sub) }));
await check('R2', 'ex-membro removido se auto-inclui de novo, sem criar convite (usa o convite aceito que ficou)', 'NEGADO',
  updateDoc(doc(ctx(MEMBRO).firestore(), 'trips', 'trip1'), { memberUids: arrayUnion(MEMBRO.sub) }));
await check('R3', 'ex-membro lê a viagem depois disso', 'NEGADO',
  getDoc(doc(ctx(MEMBRO).firestore(), 'trips', 'trip1')));

// V) Impostor: criou conta e-mail/senha com o e-mail do convidado real; e-mail NÃO verificado
const dbI = ctx(IMPOSTOR).firestore();
await check('V1', 'conta com e-mail NÃO verificado igual ao do convite pendente se auto-inclui', 'NEGADO',
  updateDoc(doc(dbI, 'trips', 'trip1'), { memberUids: arrayUnion(IMPOSTOR.sub) }));
await check('V2', 'a mesma conta marca o convite como aceito (o convidado real nunca mais entra)', 'NEGADO',
  updateDoc(doc(dbI, 'convites', 'trip1_novo@exemplo.com'), { status: 'aceito', acceptedByUid: IMPOSTOR.sub }));
await check('V3', 'a mesma conta lê a viagem', 'NEGADO', getDoc(doc(dbI, 'trips', 'trip1')));

console.log('\nRESULTADO DA VERIFICACAO DE REGRAS (parte 2)');
console.log(linhas.join('\n'));
await env.cleanup();
