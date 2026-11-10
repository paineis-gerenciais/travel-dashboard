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
import { subscribeTrip, saveTripState, heartbeatPresence, subscribePresence, clearPresence, logActivity } from '../lib/tripData.js';
import { track } from '../lib/analytics.js';

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
    updateItem(arrName, id, key, value) {
      let becamePaid = false;
      mutate((s) => {
        const item = s[arrName].find((x) => x.id === id);
        if (!item) return;
        item[key] = key === 'cost' || key === 'nightly' ? num(value) : value;
        if (key === 'time') item.period = periodByTime(value);
        if (arrName === 'foodItems' && item.autoBreakfast && ['place', 'cost', 'type', 'status'].includes(key)) {
          item.autoBreakfast = false;
        }
        if (key === 'status' && value === 'Pago' && item.status !== 'Pago') becamePaid = true;
      });
      // 5.F — feed de atividade: só o evento discreto "marcou como Pago", não cada tecla
      if (becamePaid) {
        const atual = state[arrName].find((x) => x.id === id);
        const label = atual?.name || atual?.place || atual?.type || 'item';
        logActivity(tripId, user, `marcou "${label}" como Pago`);
      }
    },
    deleteItem(arrName, id) { mutate((s) => { s[arrName] = s[arrName].filter((x) => x.id !== id); }); },
    addCity() {
      const id = uid();
      mutate((s) => s.cities.push({ id, city: '', emoji: '📍', start: '', end: '', hotel: '', nightly: 0, status: 'Planejado', notes: '', breakfastIncluded: false }));
      logActivity(tripId, user, 'adicionou uma cidade');
      track('city_added');
      return id;
    },
    setCityField(id, key, value) {
      mutate((s) => { const c = s.cities.find((x) => x.id === id); if (!c) return; c[key] = key === 'nightly' ? num(value) : value; });
    },
    setCityStart(id, value) {
      mutate((s) => {
        const c = s.cities.find((x) => x.id === id); if (!c) return;
        c.start = value;
        if (value && (!c.end || c.end <= value)) {
          const d = new Date(value + 'T00:00'); d.setDate(d.getDate() + 1); c.end = d.toISOString().slice(0, 10);
        }
      });
    },
    setCityEnd(id, value) {
      let rejected = false;
      mutate((s) => {
        const c = s.cities.find((x) => x.id === id); if (!c) return;
        if (value && c.start && value <= c.start) { rejected = true; return; }
        c.end = value;
      });
      return !rejected;
    },
    deleteCity(id, removeRelated) {
      const name = state.cities.find((x) => x.id === id)?.city || 'uma cidade';
      mutate((s) => deleteCityCascade(s, id, removeRelated));
      logActivity(tripId, user, `removeu ${name}`);
    },
    addTransport(firstDate) {
      const id = uid();
      mutate((s) => s.transports.push({ id, date: firstDate || '', time: '09:00', originCity: '', originPlace: '', destCity: '', destPlace: '', mode: '', duration: '', cost: 0, status: 'Planejado', notes: '' }));
      return id;
    },
    addFoodItem(date, city) {
      const id = uid();
      mutate((s) => s.foodItems.push({ id, date, city, type: 'Outros', place: '', cost: 0, status: 'Planejado' }));
      return id;
    },
    removeEmptyFood() {
      // item 4.4: limpa refeições vazias legadas (sem local e custo 0), exceto café automático
      mutate((s) => {
        s.foodItems = s.foodItems.filter((x) => x.autoBreakfast || (x.place && x.place.trim()) || num(x.cost) > 0);
      });
    },
    addAttraction(date, city) {
      const id = uid();
      mutate((s) => s.attractions.push({ id, date, city, time: '09:00', period: 'Manhã', name: '', cost: 0, status: 'Planejado' }));
      return id;
    },
    addOther(date, city) {
      const id = uid();
      mutate((s) => s.otherExpenses.push({ id, date, city, name: '', cost: 0, status: 'Planejado' }));
      return id;
    },
    setOtherDate(id, date, city) { mutate((s) => { const o = s.otherExpenses.find((x) => x.id === id); if (!o) return; o.date = date; o.city = city; }); },
    addChecklist(item = '') {
      mutate((s) => s.checklist.push({ id: uid(), category: 'Outros', item, responsible: '', priority: 'Média', status: 'Pendente', notes: '', done: false }));
    },
    /**
     * Participantes da divisão de despesas: [{ id, name }].
     * Renomear preserva o `id`, então nenhuma despesa perde o vínculo — era o
     * bug do modelo antigo, que guardava o nome dentro de cada item.
     */
    setParticipants(list) {
      mutate((s) => {
        s.settings.participants = (list || [])
          .filter((p) => p && String(p.name || '').trim())
          .map((p) => ({ id: p.id || uid(), name: String(p.name).trim() }));
      });
    },
    /**
     * Materializa os participantes "automáticos" (Viajante 1, Viajante 2…) como
     * registros de verdade.
     *
     * Enquanto ninguém é cadastrado, a lista é gerada na hora a partir do
     * número de viajantes — e esses ids não existem no banco. Se alguém
     * escolhia "Viajante 1" como pagador, a referência era descartada no
     * próximo carregamento e o campo voltava vazio. Chamar isto antes de
     * atribuir um pagador resolve: os participantes passam a existir de fato,
     * mantendo os mesmos ids já exibidos na tela.
     */
    ensureParticipants(lista) {
      mutate((s) => {
        if ((s.settings.participants || []).length > 0) return;
        s.settings.participants = (lista || []).map((p) => ({ id: p.id, name: p.name }));
      });
    },
    /** Confirma um acerto: registra um pagamento { id, de, para, valor, data } que abate o saldo. */
    confirmSettlement({ fromId, toId, valor }) {
      if (!fromId || !toId || fromId === toId || !(num(valor) > 0)) return;
      mutate((s) => {
        if (!fromId || !toId || fromId === toId || !(num(valor) > 0)) return;
        s.settings.payments = [
          ...(s.settings.payments || []),
          { id: uid(), de: fromId, para: toId, valor: Math.round(num(valor) * 100) / 100, data: new Date().toISOString() },
        ];
      });
      track('settlement_confirmed', { count: (state.settings.payments || []).length + 1 });
    },
    /** Desfaz a confirmação: remove o pagamento. */
    undoPayment(id) {
      mutate((s) => {
        s.settings.payments = (s.settings.payments || []).filter((x) => x.id !== id);
      });
    },
    /* ---------- Documentos gerais da viagem (links) ---------- */
    addDocument(label, url) {
      mutate((s) => {
        if (!url) return;
        s.settings.documents = [
          ...(s.settings.documents || []),
          { id: uid(), label: String(label || '').trim(), url },
        ];
      });
    },
    setDocumentField(id, key, value) {
      mutate((s) => {
        const d = (s.settings.documents || []).find((x) => x.id === id);
        if (d) d[key] = value;
      });
    },
    removeDocument(id) {
      mutate((s) => {
        s.settings.documents = (s.settings.documents || []).filter((x) => x.id !== id);
      });
    },
    addParticipant(name) {
      mutate((s) => {
        const nome = String(name || '').trim();
        if (!nome) return;
        s.settings.participants = [...(s.settings.participants || []), { id: uid(), name: nome }];
      });
    },
    renameParticipant(id, name) {
      mutate((s) => {
        const p = (s.settings.participants || []).find((x) => x.id === id);
        if (p) p.name = String(name || '').trim();
      });
    },
    /** Remove o participante e limpa as referências a ele nas despesas. */
    removeParticipant(id) {
      mutate((s) => {
        s.settings.participants = (s.settings.participants || []).filter((p) => p.id !== id);
        ['cities', 'transports', 'foodItems', 'attractions', 'otherExpenses'].forEach((k) => {
          s[k].forEach((x) => {
            if (x.paidBy === id) x.paidBy = '';
            if (x.split && x.split[id] !== undefined) {
              const novo = { ...x.split };
              delete novo[id];
              x.split = Object.keys(novo).length ? novo : undefined;
            }
          });
        });
      });
    },
    /** Edita um campo de uma linha de custo de qualquer coleção (usado na divisão). */
    setRowField(kind, id, key, value) {
      mutate((s) => {
        const alvo = (s[kind] || []).find((x) => x.id === id);
        if (!alvo) return;
        alvo[key] = key === 'cost' || key === 'nightly' ? num(value) : value;
      });
    },
    toggleChecklist(id, checked) {
      const label = state.checklist.find((x) => x.id === id)?.item || 'um item';
      mutate((s) => { const c = s.checklist.find((x) => x.id === id); if (!c) return; c.done = checked; c.status = checked ? 'Concluído' : 'Pendente'; });
      if (checked) logActivity(tripId, user, `concluiu "${label}" no checklist`);
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
