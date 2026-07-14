// lib/tripData.js — camada de acesso ao Firestore (Fase 2, multi-viagem).
// Única porta de entrada ao banco. Modelo:
//   users/{uid}                      -> perfil (privado)
//   trips/{tripId}                   -> { ownerId, ownerEmail, name, state, memberUids[] }
//   trips/{tripId}/versions/{id}     -> snapshots nomeados
//   trips/{tripId}/members/{uid}     -> info de exibição (nome/e-mail/papel)
//   trips/{tripId}/presence/{uid}    -> { displayName, lastSeenMs }
//   convites/{tripId_email}          -> { tripId, tripName, emailConvidado, ownerUid, status }

import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, query, where, onSnapshot,
  serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { normalizeState, blankState } from '../domain/state.js';

const lower = (s) => String(s || '').trim().toLowerCase();
const inviteId = (tripId, email) => `${tripId}_${lower(email)}`;

/* ---------- Perfil ---------- */
export async function upsertUserProfile(user) {
  await setDoc(
    doc(db, 'users', user.uid),
    { email: lower(user.email), displayName: user.displayName || user.email || 'Usuário', updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/* ---------- Viagens ---------- */
export function subscribeMyTrips(uid, cb) {
  const q = query(collection(db, 'trips'), where('memberUids', 'array-contains', uid));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || 'Viagem sem nome',
            ownerId: data.ownerId,
            ownerEmail: data.ownerEmail || '',
            memberUids: data.memberUids || [],
            updatedAtMs: data.updatedAtMs || 0,
          };
        })
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    );
  });
}

export function subscribeTrip(tripId, cb) {
  return onSnapshot(doc(db, 'trips', tripId), (snap) => {
    if (!snap.exists()) { cb({ exists: false }); return; }
    const data = snap.data();
    cb({ exists: true, name: data.name || '', ownerId: data.ownerId, memberUids: data.memberUids || [], state: data.state || null });
  });
}

export async function createTrip(user, name, seedState) {
  const ref = doc(collection(db, 'trips'));
  const email = lower(user.email);
  await setDoc(ref, {
    ownerId: user.uid,
    ownerEmail: email,
    name: name || 'Nova viagem',
    state: seedState || blankState(),
    memberUids: [user.uid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });
  await setDoc(doc(db, 'trips', ref.id, 'members', user.uid), {
    email, displayName: user.displayName || email, role: 'owner', joinedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameTrip(tripId, name) {
  await updateDoc(doc(db, 'trips', tripId), { name });
}

export async function deleteTrip(tripId) {
  // best-effort: remove versões antes de apagar a viagem (client não cascateia)
  try {
    const vs = await getDocs(collection(db, 'trips', tripId, 'versions'));
    await Promise.all(vs.docs.map((d) => deleteDoc(d.ref)));
  } catch (e) { console.error('Falha ao limpar versões da viagem', e); }
  await deleteDoc(doc(db, 'trips', tripId));
}

export async function saveTripState(tripId, state) {
  await updateDoc(doc(db, 'trips', tripId), { state, updatedAt: serverTimestamp(), updatedAtMs: Date.now() });
}

/* ---------- Versões ---------- */
function versionMeta(data) {
  return {
    name: data.name || '',
    city: data.city || '',
    days: Number(data.days) || 0,
    total: Number(data.total) || 0,
    dateText: data.dateText || '',
    createdAtMs: data.createdAtMs || 0,
  };
}

export async function listVersions(tripId) {
  const snap = await getDocs(collection(db, 'trips', tripId, 'versions'));
  return snap.docs.map((d) => ({ id: d.id, ...versionMeta(d.data()) })).sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export async function saveNewVersion(tripId, meta, state) {
  const ref = doc(collection(db, 'trips', tripId, 'versions'));
  await setDoc(ref, { ...meta, createdAtMs: Date.now(), createdAt: serverTimestamp(), state });
  return ref.id;
}

export async function overwriteVersion(tripId, versionId, meta, state) {
  await setDoc(doc(db, 'trips', tripId, 'versions', versionId), {
    ...meta, createdAtMs: Date.now(), createdAt: serverTimestamp(), state,
  });
}

export async function loadVersion(tripId, versionId) {
  const s = await getDoc(doc(db, 'trips', tripId, 'versions', versionId));
  if (!s.exists()) throw new Error('Versão não encontrada (pode ter sido excluída).');
  return normalizeState(s.data().state);
}

export async function deleteVersion(tripId, versionId) {
  await deleteDoc(doc(db, 'trips', tripId, 'versions', versionId));
}

/* ---------- Convites ---------- */
export async function createInvite(tripId, tripName, ownerUser, email) {
  const e = lower(email);
  if (!e) throw new Error('Informe um e-mail.');
  await setDoc(doc(db, 'convites', inviteId(tripId, e)), {
    tripId, tripName, emailConvidado: e, ownerUid: ownerUser.uid, ownerEmail: lower(ownerUser.email),
    status: 'pendente', createdAt: serverTimestamp(),
  });
}

/** Convites que o dono criou para uma viagem (para a UI de gestão). */
export async function listInvitesForTrip(tripId, ownerUid) {
  const q = query(collection(db, 'convites'), where('ownerUid', '==', ownerUid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.tripId === tripId);
}

export async function cancelInvite(conviteId) {
  await deleteDoc(doc(db, 'convites', conviteId));
}

/**
 * No login: encontra convites pendentes para o e-mail do usuário e concede o
 * acesso (auto-inclusão na viagem + registro de membro + marca convite aceito).
 */
export async function acceptPendingInvites(user) {
  const e = lower(user.email);
  if (!e) return;
  const q = query(collection(db, 'convites'), where('emailConvidado', '==', e));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const inv = d.data();
    if (inv.status && inv.status !== 'pendente') continue;
    try {
      await updateDoc(doc(db, 'trips', inv.tripId), { memberUids: arrayUnion(user.uid) });
      await setDoc(
        doc(db, 'trips', inv.tripId, 'members', user.uid),
        { email: e, displayName: user.displayName || e, role: 'editor', joinedAt: serverTimestamp() },
        { merge: true }
      );
      await updateDoc(d.ref, { status: 'aceito', acceptedByUid: user.uid, acceptedAt: serverTimestamp() });
    } catch (err) {
      console.error('Falha ao aceitar convite da viagem', inv.tripId, err);
    }
  }
}

/* ---------- Membros ---------- */
export async function listMembers(tripId) {
  const snap = await getDocs(collection(db, 'trips', tripId, 'members'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function revokeMember(tripId, uid) {
  await updateDoc(doc(db, 'trips', tripId), { memberUids: arrayRemove(uid) });
  try { await deleteDoc(doc(db, 'trips', tripId, 'members', uid)); } catch (e) { console.error(e); }
}

/* ---------- Comentários por item (Fase 5, item 5.F) ---------- */
// Coleção própria trips/{tripId}/comments, isolada por viagem como o resto do
// app. Cada comentário se refere a um item por `itemKey` (ex.: "foodItems:abc").
export function subscribeComments(tripId, itemKey, cb) {
  const q = query(collection(db, 'trips', tripId, 'comments'), where('itemKey', '==', itemKey));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0))
    );
  });
}

export async function addComment(tripId, itemKey, user, text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return;
  await setDoc(doc(collection(db, 'trips', tripId, 'comments')), {
    itemKey,
    text: trimmed,
    authorUid: user.uid,
    authorName: user.displayName || user.email || 'Alguém',
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
  });
}

export async function deleteComment(tripId, commentId) {
  await deleteDoc(doc(db, 'trips', tripId, 'comments', commentId));
}

/* ---------- Feed de atividade (Fase 5, item 5.F) ---------- */
// Coleção própria trips/{tripId}/activity — eventos discretos e significativos
// (não cada tecla digitada): cidade criada/removida, item marcado como Pago,
// item do checklist concluído. Alimenta um resumo de "o que mudou" na viagem.
export async function logActivity(tripId, user, text) {
  try {
    await setDoc(doc(collection(db, 'trips', tripId, 'activity')), {
      text,
      authorUid: user.uid,
      authorName: user.displayName || user.email || 'Alguém',
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error('Falha ao registrar atividade', e);
  }
}

export function subscribeActivity(tripId, cb, max = 15) {
  return onSnapshot(collection(db, 'trips', tripId, 'activity'), (snap) => {
    cb(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
        .slice(0, max)
    );
  });
}
export async function heartbeatPresence(tripId, user) {
  await setDoc(
    doc(db, 'trips', tripId, 'presence', user.uid),
    { displayName: user.displayName || user.email || 'Alguém', lastSeenMs: Date.now(), lastSeen: serverTimestamp() },
    { merge: true }
  );
}

export function subscribePresence(tripId, cb) {
  return onSnapshot(collection(db, 'trips', tripId, 'presence'), (snap) => {
    const now = Date.now();
    cb(
      snap.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .filter((p) => p.displayName && now - (p.lastSeenMs || 0) < 35000)
    );
  });
}

export async function clearPresence(tripId, uid) {
  try { await deleteDoc(doc(db, 'trips', tripId, 'presence', uid)); } catch (e) { /* ignore */ }
}
