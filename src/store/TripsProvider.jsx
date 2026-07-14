// store/TripsProvider.jsx — camada acima das viagens: lista as viagens do
// usuário (em tempo real), a viagem ativa, e aceita convites pendentes no login.
import { createContext, useContext, useState, useEffect } from 'react';
import {
  subscribeMyTrips, createTrip as apiCreateTrip, deleteTrip as apiDeleteTrip,
  renameTrip as apiRenameTrip, acceptPendingInvites,
} from '../lib/tripData.js';

const Ctx = createContext(null);
export const useTrips = () => useContext(Ctx);

const TRIP_KEY = 'trip_active_id';

export function TripsProvider({ user, children }) {
  const [trips, setTrips] = useState([]);
  // F5 mantém a mesma página: além da aba (App.jsx), a VIAGEM ativa também
  // é restaurada. Sem isto, recarregar sempre voltava para "Minhas viagens".
  const [activeTripId, setActiveTripId] = useState(() => {
    try { return localStorage.getItem(TRIP_KEY) || null; } catch { return null; }
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      if (activeTripId) localStorage.setItem(TRIP_KEY, activeTripId);
      else localStorage.removeItem(TRIP_KEY);
    } catch { /* ignore */ }
  }, [activeTripId]);

  useEffect(() => {
    let unsub;
    let alive = true;
    (async () => {
      try { await acceptPendingInvites(user); } catch (e) { console.error(e); }
      if (!alive) return;
      unsub = subscribeMyTrips(user.uid, (list) => {
        setTrips(list);
        // Se a viagem restaurada não existe mais (excluída ou acesso revogado),
        // volta ao seletor sem erro.
        setActiveTripId((cur) => (cur && !list.some((t) => t.id === cur) ? null : cur));
        setReady(true);
      });
    })();
    return () => { alive = false; if (unsub) unsub(); };
  }, [user.uid]);

  const actions = {
    openTrip: (id) => setActiveTripId(id),
    closeTrip: () => setActiveTripId(null),
    async createTrip(name, seedState) {
      const id = await apiCreateTrip(user, name, seedState);
      setActiveTripId(id);
      return id;
    },
    async deleteTrip(id) {
      await apiDeleteTrip(id);
      if (activeTripId === id) setActiveTripId(null);
    },
    async renameTrip(id, name) { await apiRenameTrip(id, name); },
  };

  return <Ctx.Provider value={{ trips, activeTripId, ready, user, actions }}>{children}</Ctx.Provider>;
}
