// lib/tripData.js
// Camada de acesso a dados do Firestore (item 1.6, modelo single-user).
//
// Modelo de dados desta fase (antes de perfis/compartilhamento da Fase 2):
//   users/{uid}                       -> documento do usuário (settings + state atual)
//   users/{uid}/versions/{versionId}  -> snapshots nomeados (equivale às "versões" do Sheets)
//
// A migração da Fase 2 moverá isto para uma coleção `trips` com ownerId +
// collaborators. Manter este arquivo como a ÚNICA porta de entrada ao
// Firestore facilita essa evolução (um só lugar para mudar).

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { normalizeState } from '../domain/state.js';

/** Referência ao documento principal do usuário. */
function userDocRef(uid) {
  return doc(db, 'users', uid);
}

/** Carrega o state atual do usuário (ou null se ainda não existe). */
export async function loadCurrentState(uid) {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return data.state ? normalizeState(data.state) : null;
}

/** Assina mudanças em tempo real do state do usuário. Retorna unsubscribe. */
export function subscribeCurrentState(uid, callback) {
  return onSnapshot(userDocRef(uid), (snap) => {
    if (snap.exists() && snap.data().state) {
      callback(normalizeState(snap.data().state));
    }
  });
}

/** Salva o state atual (rascunho). Sobrescreve o campo `state` do usuário. */
export async function saveCurrentState(uid, state) {
  await setDoc(
    userDocRef(uid),
    { state, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** Lista as versões salvas (metadados, sem o state completo, para ser rápido). */
export async function listVersions(uid) {
  const col = collection(db, 'users', uid, 'versions');
  const snap = await getDocs(col);
  return snap.docs
    .map((d) => {
      const v = d.data();
      return {
        id: d.id,
        name: v.name || '',
        city: v.city || '',
        days: Number(v.days) || 0,
        total: Number(v.total) || 0,
        dateText: v.dateText || '',
        createdAtMs: v.createdAtMs || 0,
      };
    })
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}

/** Salva uma nova versão nomeada (snapshot do state). */
export async function saveVersion(uid, meta, state) {
  const id = meta.id || crypto.randomUUID();
  const ref = doc(db, 'users', uid, 'versions', id);
  await setDoc(ref, {
    name: meta.name,
    city: meta.city,
    days: meta.days,
    total: meta.total,
    dateText: meta.dateText,
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
    state,
  });
  return id;
}

/** Carrega o state completo de uma versão específica. */
export async function loadVersion(uid, versionId) {
  const ref = doc(db, 'users', uid, 'versions', versionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Versão não encontrada (pode ter sido excluída).');
  return normalizeState(snap.data().state);
}

/** Exclui uma versão salva. */
export async function deleteVersion(uid, versionId) {
  await deleteDoc(doc(db, 'users', uid, 'versions', versionId));
}
