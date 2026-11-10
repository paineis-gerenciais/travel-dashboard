// Verificação independente das regras (diagnóstico, somente leitura do repositório).
// Roda contra o emulador via: firebase emulators:exec --only firestore "node --input-type=module < este-arquivo"
import { readFileSync } from 'fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, collection } from 'firebase/firestore';
import { arrayUnion } from 'firebase/firestore';

const DONO = { sub: 'uid_dono', email: 'dono@exemplo.com' };
const MEMBRO = { sub: 'uid_membro', email: 'membro@exemplo.com' };
const ESTRANHO = { sub: 'uid_estranho', email: 'estranho@exemplo.com' };

const env = await initializeTestEnvironment({
  projectId: 'demo-diag',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') },
});
const ctx = (u) => env.authenticatedContext(u.sub, { email: u.email });
await env.clearFirestore();
await env.withSecurityRulesDisabled(async (admin) => {
  const db = admin.firestore();
  await setDoc(doc(db, 'trips', 'trip1'), {
    ownerId: DONO.sub, ownerEmail: DONO.email, name: 'Portugal', state: { cities: [] },
    memberUids: [DONO.sub, MEMBRO.sub],
  });
});

const linhas = [];
async function check(id, descricao, esperado, promessa) {
  let resultado;
  try { await promessa; resultado = 'PERMITIDO'; } catch (e) { resultado = (e.code === 'permission-denied' || /PERMISSION_DENIED|permission/i.test(String(e.message || e))) ? 'NEGADO' : 'ERRO: ' + e.message; }
  const ok = resultado === esperado ? 'ok' : 'FALHA DE SEGURANCA';
  linhas.push(`${id} | ${descricao} | esperado ${esperado} | obtido ${resultado} | ${ok}`);
}

// A) Estranho autenticado que conhece o tripId (ex.: ex-membro removido) fabrica um convite para si
const dbE = ctx(ESTRANHO).firestore();
await check('A1', 'estranho cria convites/trip1_<seu e-mail> com ownerUid = ele mesmo', 'NEGADO',
  setDoc(doc(dbE, 'convites', `trip1_${ESTRANHO.email}`), {
    tripId: 'trip1', tripName: 'Portugal', emailConvidado: ESTRANHO.email, ownerUid: ESTRANHO.sub, status: 'pendente',
  }));
await check('A2', 'estranho se auto-inclui em trips/trip1.memberUids usando esse convite', 'NEGADO',
  updateDoc(doc(dbE, 'trips', 'trip1'), { memberUids: arrayUnion(ESTRANHO.sub) }));
await check('A3', 'estranho lê trips/trip1 depois disso', 'NEGADO',
  getDoc(doc(dbE, 'trips', 'trip1')));

// B) Membro (não dono) convida um terceiro — a UI esconde, as regras deveriam barrar
const dbM = ctx(MEMBRO).firestore();
await check('B1', 'membro não-dono cria convite para terceiro na viagem', 'NEGADO',
  setDoc(doc(dbM, 'convites', 'trip1_terceiro@exemplo.com'), {
    tripId: 'trip1', tripName: 'Portugal', emailConvidado: 'terceiro@exemplo.com', ownerUid: MEMBRO.sub, status: 'pendente',
  }));

// C) Autoria falsificada em comentários/atividade
await check('C1', 'membro cria comentário com authorUid de outra pessoa (dono)', 'NEGADO',
  setDoc(doc(collection(dbM, 'trips', 'trip1', 'comments')), { itemKey: 'x', text: 'falso', authorUid: DONO.sub, authorName: 'Dono', createdAtMs: 1 }));
await check('C2', 'membro cria evento de atividade com authorUid de outra pessoa', 'NEGADO',
  setDoc(doc(collection(dbM, 'trips', 'trip1', 'activity')), { text: 'falso', authorUid: DONO.sub, authorName: 'Dono', createdAtMs: 1 }));

// D) Membro se promove a "owner" no doc de exibição
await check('D1', 'membro grava members/<seu uid> com role owner', 'NEGADO',
  setDoc(doc(dbM, 'trips', 'trip1', 'members', MEMBRO.sub), { email: MEMBRO.email, displayName: 'M', role: 'owner' }));

// E) Controle: o que DEVE funcionar
await check('E1', 'membro edita state da viagem', 'PERMITIDO',
  updateDoc(dbM && doc(dbM, 'trips', 'trip1'), { state: { cities: [{ id: 'a' }] } }));

console.log('\nRESULTADO DA VERIFICACAO DE REGRAS');
console.log(linhas.join('\n'));
await env.cleanup();
