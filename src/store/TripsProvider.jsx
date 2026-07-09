// store/TripsProvider.jsx — camada acima das viagens: lista as viagens do
// usuário (em tempo real), a viagem ativa, e aceita convites pendentes no login.
import { createContext, useContext, useState, useEffect } from 'react';
import {
  subscribeMyTrips, createTrip as apiCreateTrip, deleteTrip as apiDeleteTrip,
  renameTrip as apiRenameTrip, acceptPendingInvites,
} from '../lib/tripData.js';

const Ctx = createContext(null);
export const useTrips = () => useContext(Ctx);

export function TripsProvider({ user, children }) {
  const [trips, setTrips] = useState([]);
  const [activeTripId, setActiveTripId] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsub;
    let alive = true;
    (async () => {
      try { await acceptPendingInvites(user); } catch (e) { console.error(e); }
      if (!alive) return;
      unsub = subscribeMyTrips(user.uid, (list) => {
        setTrips(list);
        setReady(true);
      });
    })();
    return () => { alive = false; if (unsub) unsub(); };
  }, [user.uid]);

  const actions = {
    openTrip: (id) => setActiveTripId(id),
    closeTrip: () => setActiveTripId(null),
    async createTrip(name) {
      const id = await apiCreateTrip(user, name);
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
