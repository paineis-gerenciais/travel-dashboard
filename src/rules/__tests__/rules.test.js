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

// Convites exigem e-mail verificado (contas Google já chegam verificadas).
const ctx = (u, verificado = true) =>
  testEnv.authenticatedContext(u.sub, { email: u.email, email_verified: verificado });
const MEMBRO = { sub: 'uid_membro', email: 'membro@exemplo.com' };
const CID = `trip1_${CONVIDADO.email}`;

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

describe('feedback in-app (T-1.2)', () => {
  it('usuário autenticado cria o próprio feedback', async () => {
    const db = ctx(DONO).firestore();
    await assertSucceeds(
      setDoc(doc(collection(db, 'feedback')), { category: 'ideia', text: 'oi', authorUid: DONO.sub })
    );
  });

  it('NÃO pode criar feedback em nome de outra pessoa', async () => {
    const db = ctx(DONO).firestore();
    await assertFails(
      setDoc(doc(collection(db, 'feedback')), { category: 'ideia', text: 'oi', authorUid: CONVIDADO.sub })
    );
  });

  it('ninguém lê feedback pelo cliente (nem o próprio autor)', async () => {
    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(admin.firestore(), 'feedback', 'f1'), { category: 'bug', text: 'x', authorUid: DONO.sub });
    });
    await assertFails(getDoc(doc(ctx(DONO).firestore(), 'feedback', 'f1')));
    await assertFails(getDocs(collection(ctx(DONO).firestore(), 'feedback')));
  });
});

// ---------------------------------------------------------------------------
// Convites, acesso e autoria (#17) — T1 a T11
// ---------------------------------------------------------------------------
const novoConvite = (over = {}) => ({
  tripId: 'trip1', tripName: 'Portugal 2026', emailConvidado: ESTRANHO.email,
  ownerUid: DONO.sub, status: 'pendente', ...over,
});

// Viagem com um MEMBRO (não dono) já dentro.
async function seedMembro() {
  await testEnv.withSecurityRulesDisabled(async (admin) => {
    await setDoc(doc(admin.firestore(), 'trips', 'trip1'), {
      ownerId: DONO.sub, ownerEmail: DONO.email, name: 'Portugal 2026',
      state: { cities: [] }, memberUids: [DONO.sub, MEMBRO.sub],
    });
  });
}

describe('criação de convite (T2, T3, T4)', () => {
  it('dono cria convite com id tripId_email e status pendente', async () => {
    const db = ctx(DONO).firestore();
    await assertSucceeds(setDoc(doc(db, 'convites', `trip1_${ESTRANHO.email}`), novoConvite()));
  });

  it('T2: autenticado NÃO cria convite para viagem alheia nem para o próprio e-mail', async () => {
    const db = ctx(ESTRANHO).firestore();
    await assertFails(setDoc(
      doc(db, 'convites', `trip1_${ESTRANHO.email}`),
      novoConvite({ ownerUid: ESTRANHO.sub })
    ));
  });

  it('T3: membro não-dono NÃO cria convite para terceiro', async () => {
    await seedMembro();
    const db = ctx(MEMBRO).firestore();
    await assertFails(setDoc(
      doc(db, 'convites', `trip1_${ESTRANHO.email}`),
      novoConvite({ ownerUid: MEMBRO.sub })
    ));
  });

  it('T4: id diferente de tripId_email ou status diferente de pendente é negado', async () => {
    const db = ctx(DONO).firestore();
    await assertFails(setDoc(doc(db, 'convites', 'qualquer-id'), novoConvite()));
    await assertFails(setDoc(
      doc(db, 'convites', `trip1_${ESTRANHO.email}`),
      novoConvite({ status: 'aceito' })
    ));
  });
});

describe('auto-inclusão: convite pendente, do dono, e-mail verificado (T1, T5, T11)', () => {
  const entrar = (db) => updateDoc(doc(db, 'trips', 'trip1'), { memberUids: [DONO.sub, CONVIDADO.sub] });

  it('T11: pendente + verificado entra e marca o convite como aceito', async () => {
    const db = ctx(CONVIDADO).firestore();
    await assertSucceeds(entrar(db));
    await assertSucceeds(updateDoc(doc(db, 'convites', CID), {
      status: 'aceito', acceptedByUid: CONVIDADO.sub, acceptedAt: new Date(),
    }));
  });

  it('T1: removido, com convite aceito ainda existente, NÃO volta', async () => {
    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(admin.firestore(), 'convites', CID), {
        tripId: 'trip1', emailConvidado: CONVIDADO.email, ownerUid: DONO.sub,
        status: 'aceito', acceptedByUid: CONVIDADO.sub,
      });
    });
    await assertFails(entrar(ctx(CONVIDADO).firestore()));
  });

  it('T1b: convite apagado na revogação também não deixa voltar', async () => {
    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await deleteDoc(doc(admin.firestore(), 'convites', CID));
    });
    await assertFails(entrar(ctx(CONVIDADO).firestore()));
  });

  it('T5: e-mail NÃO verificado não lê o convite nem se inclui', async () => {
    const db = ctx(CONVIDADO, false).firestore();
    await assertFails(getDoc(doc(db, 'convites', CID)));
    await assertFails(entrar(db));
  });

  it('convite pendente criado por quem não é dono da viagem NÃO vale', async () => {
    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(admin.firestore(), 'convites', CID), {
        tripId: 'trip1', emailConvidado: CONVIDADO.email, ownerUid: ESTRANHO.sub, status: 'pendente',
      });
    });
    await assertFails(entrar(ctx(CONVIDADO).firestore()));
  });
});

describe('edição do convite (T6)', () => {
  it('convidado NÃO altera ownerUid/tripId nem volta o status para pendente', async () => {
    const db = ctx(CONVIDADO).firestore();
    await assertFails(updateDoc(doc(db, 'convites', CID), { ownerUid: CONVIDADO.sub }));
    await assertFails(updateDoc(doc(db, 'convites', CID), { tripId: 'outra' }));
    await assertFails(updateDoc(doc(db, 'convites', CID), { status: 'pendente' }));
  });

  it('convidado recusa o próprio convite; estranho não mexe', async () => {
    await assertFails(updateDoc(doc(ctx(ESTRANHO).firestore(), 'convites', CID), { status: 'recusado' }));
    await assertSucceeds(updateDoc(doc(ctx(CONVIDADO).firestore(), 'convites', CID), { status: 'recusado' }));
  });

  it('dono cancela (apaga) o convite que criou; estranho não', async () => {
    await assertFails(deleteDoc(doc(ctx(ESTRANHO).firestore(), 'convites', CID)));
    await assertSucceeds(deleteDoc(doc(ctx(DONO).firestore(), 'convites', CID)));
  });
});

describe('autoria em comentários e atividade (T7, T8)', () => {
  it('T7: membro NÃO cria comentário em nome de outra pessoa', async () => {
    const db = ctx(DONO).firestore();
    await assertFails(setDoc(doc(collection(db, 'trips', 'trip1', 'comments')), {
      itemKey: 'foodItems:x', text: 'falso', authorUid: CONVIDADO.sub, authorName: 'Outro',
    }));
  });

  it('T8: membro NÃO cria evento de atividade em nome de outra pessoa', async () => {
    const db = ctx(DONO).firestore();
    await assertFails(setDoc(doc(collection(db, 'trips', 'trip1', 'activity')), {
      text: 'falso', authorUid: CONVIDADO.sub, authorName: 'Outro',
    }));
  });
});

describe('registro de membros (T9)', () => {
  it('membro não-dono NÃO grava role owner; grava editor', async () => {
    await seedMembro();
    const db = ctx(MEMBRO).firestore();
    await assertFails(setDoc(doc(db, 'trips', 'trip1', 'members', MEMBRO.sub), { email: MEMBRO.email, role: 'owner' }));
    await assertSucceeds(setDoc(doc(db, 'trips', 'trip1', 'members', MEMBRO.sub), { email: MEMBRO.email, role: 'editor' }));
  });

  it('dono grava o próprio registro como owner', async () => {
    const db = ctx(DONO).firestore();
    await assertSucceeds(setDoc(doc(db, 'trips', 'trip1', 'members', DONO.sub), { email: DONO.email, role: 'owner' }));
  });

  it('membro apaga o próprio registro, mas não o de outro; dono apaga qualquer um', async () => {
    await seedMembro();
    await testEnv.withSecurityRulesDisabled(async (admin) => {
      const db = admin.firestore();
      await setDoc(doc(db, 'trips', 'trip1', 'members', MEMBRO.sub), { email: MEMBRO.email, role: 'editor' });
      await setDoc(doc(db, 'trips', 'trip1', 'members', DONO.sub), { email: DONO.email, role: 'owner' });
    });
    await assertFails(deleteDoc(doc(ctx(MEMBRO).firestore(), 'trips', 'trip1', 'members', DONO.sub)));
    await assertSucceeds(deleteDoc(doc(ctx(MEMBRO).firestore(), 'trips', 'trip1', 'members', MEMBRO.sub)));
    await assertSucceeds(deleteDoc(doc(ctx(DONO).firestore(), 'trips', 'trip1', 'members', DONO.sub)));
  });
});

describe('versões (T10)', () => {
  beforeEach(async () => {
    await seedMembro();
    await testEnv.withSecurityRulesDisabled(async (admin) => {
      await setDoc(doc(admin.firestore(), 'trips', 'trip1', 'versions', 'v1'), { name: 'v1', state: {} });
    });
  });

  it('membro lê, cria e atualiza versões', async () => {
    const db = ctx(MEMBRO).firestore();
    await assertSucceeds(getDoc(doc(db, 'trips', 'trip1', 'versions', 'v1')));
    await assertSucceeds(setDoc(doc(db, 'trips', 'trip1', 'versions', 'v2'), { name: 'v2', state: {} }));
    await assertSucceeds(updateDoc(doc(db, 'trips', 'trip1', 'versions', 'v1'), { name: 'novo' }));
  });

  it('T10: membro não-dono NÃO apaga versão; dono apaga', async () => {
    await assertFails(deleteDoc(doc(ctx(MEMBRO).firestore(), 'trips', 'trip1', 'versions', 'v1')));
    await assertSucceeds(deleteDoc(doc(ctx(DONO).firestore(), 'trips', 'trip1', 'versions', 'v1')));
  });
});
