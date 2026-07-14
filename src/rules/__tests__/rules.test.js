// __tests__/rules.test.js
// Testes de ISOLAMENTO das regras de segurança do Firestore (Fase 2).
// Rodam contra o EMULADOR local — não contra o banco de produção.
//
// Como rodar (precisa do emulador e do Java instalados):
//   firebase emulators:exec --only firestore "npx vitest run src/rules/__tests__/rules.test.js"
//
// Cada teste corresponde a uma linha da seção "Testes de isolamento" do plano
// da Fase 2. O objetivo é provar que dados não vazam entre usuários.

import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

let testEnv;

const DONO = { sub: 'uid_dono', email: 'dono@exemplo.com' };
const CONVIDADO = { sub: 'uid_convidado', email: 'convidado@exemplo.com' };
const ESTRANHO = { sub: 'uid_estranho', email: 'estranho@exemplo.com' };

const ctx = (u) => testEnv.authenticatedContext(u.sub, { email: u.email });

// Semeia uma viagem do DONO com um convite pendente para o CONVIDADO,
// usando contexto privilegiado (sem regras).
async function seed() {
  await testEnv.withSecurityRulesDisabled(async (admin) => {
    const db = admin.firestore();
    await setDoc(doc(db, 'trips', 'trip1'), {
      ownerId: DONO.sub,
      ownerEmail: DONO.email,
      name: 'Portugal 2026',
      state: { cities: [] },
      memberUids: [DONO.sub],
    });
    await setDoc(doc(db, 'convites', `trip1_${CONVIDADO.email}`), {
      tripId: 'trip1',
      tripName: 'Portugal 2026',
      emailConvidado: CONVIDADO.email,
      ownerUid: DONO.sub,
      status: 'pendente',
    });
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-plano-viagem',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => { await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

describe('acesso a uma viagem', () => {
  it('membro (dono) lê e escreve a própria viagem', async () => {
    const db = ctx(DONO).firestore();
    await assertSucceeds(getDoc(doc(db, 'trips', 'trip1')));
    await assertSucceeds(updateDoc(doc(db, 'trips', 'trip1'), { state: { cities: [{ id: 'a' }] } }));
  });

  it('estranho NÃO lê nem escreve a viagem', async () => {
    const db = ctx(ESTRANHO).firestore();
    await assertFails(getDoc(doc(db, 'trips', 'trip1')));
    await assertFails(updateDoc(doc(db, 'trips', 'trip1'), { state: { cities: [] } }));
  });
});

describe('auto-inclusão via convite', () => {
  it('convidado COM convite consegue se adicionar (só a si mesmo)', async () => {
    const db = ctx(CONVIDADO).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'trips', 'trip1'), { memberUids: [DONO.sub, CONVIDADO.sub] })
    );
  });

  it('estranho SEM convite NÃO consegue se adicionar', async () => {
    const db = ctx(ESTRANHO).firestore();
    await assertFails(
      updateDoc(doc(db, 'trips', 'trip1'), { memberUids: [DONO.sub, ESTRANHO.sub] })
    );
  });

  it('convidado não consegue adicionar OUTRO uid junto com o seu', async () => {
    const db = ctx(CONVIDADO).firestore();
    await assertFails(
      updateDoc(doc(db, 'trips', 'trip1'), { memberUids: [DONO.sub, CONVIDADO.sub, ESTRANHO.sub] })
    );
  });
});

describe('gestão pelo dono', () => {
  it('só o dono exclui a viagem', async () => {
    await assertFails(deleteDoc(doc(ctx(CONVIDADO).firestore(), 'trips', 'trip1')));
    await assertSucceeds(deleteDoc(doc(ctx(DONO).firestore(), 'trips', 'trip1')));
  });
});

describe('convites e privacidade', () => {
  it('convidado lê o convite destinado a ele', async () => {
    const db = ctx(CONVIDADO).firestore();
    await assertSucceeds(getDoc(doc(db, 'convites', `trip1_${CONVIDADO.email}`)));
  });

  it('estranho NÃO lê convite destinado a outro e-mail', async () => {
    const db = ctx(ESTRANHO).firestore();
    await assertFails(getDoc(doc(db, 'convites', `trip1_${CONVIDADO.email}`)));
  });
});

describe('perfil de usuário', () => {
  it('usuário lê e escreve só o próprio perfil', async () => {
    const db = ctx(DONO).firestore();
    await assertSucceeds(setDoc(doc(db, 'users', DONO.sub), { email: DONO.email }));
    await assertFails(setDoc(doc(db, 'users', CONVIDADO.sub), { email: 'hack' }));
  });
});

describe('comentários por item (Fase 5, item 5.F)', () => {
  it('membro cria e lê comentários da viagem', async () => {
    const db = ctx(DONO).firestore();
    await assertSucceeds(
      setDoc(doc(collection(db, 'trips', 'trip1', 'comments')), {
        itemKey: 'foodItems:x', text: 'oi', authorUid: DONO.sub, authorName: 'Dono',
      })
    );
    await assertSucceeds(getDocs(collection(db, 'trips', 'trip1', 'comments')));
  });

  it('estranho NÃO lê nem cria comentários de uma viagem alheia', async () => {
    const db = ctx(ESTRANHO).firestore();
    await assertFails(getDocs(collection(db, 'trips', 'trip1', 'comments')));
    await assertFails(
      setDoc(doc(collection(db, 'trips', 'trip1', 'comments')), {
        itemKey: 'foodItems:x', text: 'invasão', authorUid: ESTRANHO.sub, authorName: 'Estranho',
      })
    );
  });

  it('só o autor apaga o próprio comentário', async () => {
    await testEnv.withSecurityRulesDisabled(async (admin) => {
      const db = admin.firestore();
      await setDoc(doc(db, 'trips', 'trip1', 'comments', 'c1'), {
        itemKey: 'foodItems:x', text: 'do dono', authorUid: DONO.sub, authorName: 'Dono',
      });
    });
    await assertFails(deleteDoc(doc(ctx(CONVIDADO).firestore(), 'trips', 'trip1', 'comments', 'c1')));
    await assertSucceeds(deleteDoc(doc(ctx(DONO).firestore(), 'trips', 'trip1', 'comments', 'c1')));
  });
});

describe('feed de atividade (Fase 5, item 5.F)', () => {
  it('membro cria e lê eventos de atividade', async () => {
    const db = ctx(DONO).firestore();
    await assertSucceeds(
      setDoc(doc(collection(db, 'trips', 'trip1', 'activity')), { text: 'fez algo', authorUid: DONO.sub, authorName: 'Dono' })
    );
    await assertSucceeds(getDocs(collection(db, 'trips', 'trip1', 'activity')));
  });

  it('estranho NÃO lê nem cria eventos de atividade de viagem alheia', async () => {
    const db = ctx(ESTRANHO).firestore();
    await assertFails(getDocs(collection(db, 'trips', 'trip1', 'activity')));
    await assertFails(
      setDoc(doc(collection(db, 'trips', 'trip1', 'activity')), { text: 'espião', authorUid: ESTRANHO.sub, authorName: 'Estranho' })
    );
  });
});