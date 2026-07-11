// store/TripProvider.jsx — estado de UMA viagem ativa (Fase 2).
// Novidades sobre a Fase 1:
//  - Tempo real: fica inscrito na viagem (onSnapshot); mudanças de outros
//    colaboradores chegam sozinhas.
//  - Proteção do campo em edição: se uma atualização remota chega enquanto o
//    usuário digita num campo, ela é BUFFERIZADA e aplicada quando o campo perde
//    o foco — a tela não "pula" nem apaga o que está sendo digitado.
//  - Presença: envia um "estou aqui" periódico e some ao sair.
//  - Versões por viagem, com "sobrescrever"; botão "Limpar".
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { blankState, normalizeState, uid } from '../domain/state.js';
import { ensureGenerated, deleteCityCascade } from '../domain/generate.js';
import { autoTitle, periodByTime } from '../domain/dates.js';
import { num } from '../domain/format.js';
import { subscribeTrip, saveTripState, heartbeatPresence, subscribePresence, clearPresence } from '../lib/tripData.js';

const TripContext = createContext(null);
export const useTrip = () => useContext(TripContext);

function withGenerated(state) {
  const copy = structuredClone(state);
  ensureGenerated(copy);
  if (!copy.settings.manualTitle) copy.settings.title = autoTitle(copy);
  return copy;
}

export function TripProvider({ tripId, user, children }) {
  const [state, setState] = useState(() => withGenerated(blankState()));
  const [tripName, setTripName] = useState('');
  const [dirty, setDirty] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [presence, setPresence] = useState([]);

  const saveTimer = useRef(null);
  const suppress = useRef(true);        // evita marcar "não salvo" ao aplicar estado remoto/inicial
  const editing = useRef(false);        // usuário está digitando num campo?
  const pendingRemote = useRef(null);   // atualização remota bufferizada durante edição
  const lastSyncedJson = useRef(null);  // evita eco: ignorar o snapshot da própria gravação

  const applyRemote = useCallback((remote) => {
    suppress.current = true;
    setState(withGenerated(remote));
    setTimeout(() => { suppress.current = false; }, 0);
  }, []);

  // Inscrição em tempo real na viagem ativa.
  useEffect(() => {
    setLoaded(false);
    suppress.current = true;
    lastSyncedJson.current = null;
    const unsub = subscribeTrip(tripId, (data) => {
      if (!data.exists) { setLoaded(true); return; }
      setTripName(data.name || '');
      if (!data.state) { setLoaded(true); return; }
      const remote = normalizeState(data.state);
      const json = JSON.stringify(remote);
      if (json === lastSyncedJson.current) { setLoaded(true); return; } // eco da própria escrita
      lastSyncedJson.current = json;
      if (editing.current) { pendingRemote.current = remote; setLoaded(true); return; } // buffer
      applyRemote(remote);
      setLoaded(true);
    });
    return () => unsub && unsub();
  }, [tripId, applyRemote]);

  // Rastreio de foco: enquanto um campo está em edição, remotos ficam em espera.
  useEffect(() => {
    const isField = (el) => el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
    const onIn = (e) => { if (isField(e.target)) editing.current = true; };
    const onOut = () => {
      editing.current = false;
      if (pendingRemote.current) {
        const r = pendingRemote.current;
        pendingRemote.current = null;
        applyRemote(r);
      }
    };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, [applyRemote]);

  // Persistência com debounce (ignora escritas causadas por estado remoto).
  useEffect(() => {
    if (!loaded || suppress.current) return;
    setDirty(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        lastSyncedJson.current = JSON.stringify(state);
        await saveTripState(tripId, state);
        setDirty(false);
      } catch (e) {
        console.error('Falha ao salvar no Firestore:', e);
      }
    }, 900);
    return () => clearTimeout(saveTimer.current);
  }, [state, loaded, tripId]);

  // Presença: bate um "estou aqui" a cada 15s e some ao sair.
  useEffect(() => {
    let alive = true;
    const beat = () => { if (alive) heartbeatPresence(tripId, user).catch(() => {}); };
    beat();
    const iv = setInterval(beat, 15000);
    const unsub = subscribePresence(tripId, (list) => setPresence(list.filter((p) => p.uid !== user.uid)));
    return () => { alive = false; clearInterval(iv); if (unsub) unsub(); clearPresence(tripId, user.uid); };
  }, [tripId, user]);

  const mutate = useCallback((fn) => {
    setState((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      return withGenerated(draft);
    });
  }, []);

  const actions = {
    updateItem(arrName, index, key, value) {
      mutate((s) => {
        const item = s[arrName][index];
        if (!item) return;
        item[key] = key === 'cost' || key === 'nightly' ? num(value) : value;
        if (key === 'time') item.period = periodByTime(value);
        // item 4.3: editar a linha de café automático "adota" ela (vira manual)
        if (arrName === 'foodItems' && item.autoBreakfast && ['place', 'cost', 'type', 'status'].includes(key)) {
          item.autoBreakfast = false;
        }
      });
    },
    deleteItem(arrName, index) { mutate((s) => s[arrName].splice(index, 1)); },
    addCity() {
      mutate((s) => s.cities.push({ id: uid(), city: '', emoji: '📍', start: '', end: '', hotel: '', nightly: 0, status: 'Planejado', notes: '', breakfastIncluded: false }));
    },
    setCityField(index, key, value) {
      mutate((s) => { const c = s.cities[index]; if (!c) return; c[key] = key === 'nightly' ? num(value) : value; });
    },
    setCityStart(index, value) {
      mutate((s) => {
        const c = s.cities[index]; if (!c) return;
        c.start = value;
        if (value && (!c.end || c.end <= value)) {
          const d = new Date(value + 'T00:00'); d.setDate(d.getDate() + 1); c.end = d.toISOString().slice(0, 10);
        }
      });
    },
    setCityEnd(index, value) {
      let rejected = false;
      mutate((s) => {
        const c = s.cities[index]; if (!c) return;
        if (value && c.start && value <= c.start) { rejected = true; return; }
        c.end = value;
      });
      return !rejected;
    },
    deleteCity(index, removeRelated) { mutate((s) => deleteCityCascade(s, index, removeRelated)); },
    addTransport(firstDate) {
      mutate((s) => s.transports.push({ id: uid(), date: firstDate || '', time: '09:00', originCity: '', originPlace: '', destCity: '', destPlace: '', mode: '', duration: '', cost: 0, status: 'Planejado', notes: '' }));
    },
    addFoodItem(date, city) { mutate((s) => s.foodItems.push({ id: uid(), date, city, type: 'Outros', place: '', cost: 0, status: 'Planejado' })); },
    removeEmptyFood() {
      // item 4.4: limpa refeições vazias legadas (sem local e custo 0), exceto café automático
      mutate((s) => {
        s.foodItems = s.foodItems.filter((x) => x.autoBreakfast || (x.place && x.place.trim()) || num(x.cost) > 0);
      });
    },
    addAttraction(date, city) { mutate((s) => s.attractions.push({ id: uid(), date, city, time: '09:00', period: 'Manhã', name: '', cost: 0, status: 'Planejado' })); },
    addOther(date, city) { mutate((s) => s.otherExpenses.push({ id: uid(), date, city, name: '', cost: 0, status: 'Planejado' })); },
    setOtherDate(index, date, city) { mutate((s) => { const o = s.otherExpenses[index]; if (!o) return; o.date = date; o.city = city; }); },
    addChecklist(item = '') {
      mutate((s) => s.checklist.push({ id: uid(), category: 'Outros', item, responsible: '', priority: 'Média', status: 'Pendente', notes: '', done: false }));
    },
    toggleChecklist(index, checked) {
      mutate((s) => { const c = s.checklist[index]; if (!c) return; c.done = checked; c.status = checked ? 'Concluído' : 'Pendente'; });
    },
    seedChecklist() {
      const seeds = ['Roupas leves', 'Casaco', 'Calçados confortáveis', 'Itens de higiene', 'Adaptador de tomada', 'Passaporte', 'Seguro viagem', 'Comprovantes de hospedagem', 'Passagens', 'Reservas de atrações', 'Remédios de uso contínuo', 'Cartão internacional', 'Power bank', 'Carregador'];
      mutate((s) => seeds.forEach((item) => s.checklist.push({ id: uid(), category: 'Outros', item, responsible: '', priority: 'Média', status: 'Pendente', notes: '', done: false })));
    },
    setTravelers(v) { mutate((s) => (s.settings.travelers = Math.max(1, num(v) || 1))); },
    setCostView(view) { mutate((s) => (s.settings.costView = view)); },
    setSubtitle(text) { mutate((s) => (s.settings.subtitle = text)); },
    regenerateTitle() { mutate((s) => { s.settings.manualTitle = false; s.settings.title = autoTitle(s); }); },
    replaceState(newState) { suppress.current = false; setState(withGenerated(normalizeState(newState))); },
    clearCurrent() { suppress.current = false; setState(withGenerated(blankState())); },
  };

  return (
    <TripContext.Provider value={{ state, tripName, dirty, loaded, presence, actions }}>
      {children}
    </TripContext.Provider>
  );
}
