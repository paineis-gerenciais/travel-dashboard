// store/TripProvider.jsx
// Estado central do app via Context. Substitui as variáveis globais + funções
// mutadoras do app Apps Script (updateArrayItem, addCity, etc.) por um provider
// React. Cada mutação:
//   1. produz um novo state (imutável para o React re-renderizar),
//   2. roda ensureGenerated (regenera datas/linhas automáticas),
//   3. agenda persistência no Firestore (debounce, para não gravar a cada tecla).

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { blankState, normalizeState, uid } from '../domain/state.js';
import { ensureGenerated, deleteCityCascade } from '../domain/generate.js';
import { autoTitle } from '../domain/dates.js';
import { num } from '../domain/format.js';
import { periodByTime } from '../domain/dates.js';
import { saveCurrentState, loadCurrentState } from '../lib/tripData.js';

const TripContext = createContext(null);
export const useTrip = () => useContext(TripContext);

// Aplica ensureGenerated sobre uma cópia profunda, mantendo imutabilidade.
function withGenerated(state) {
  const copy = structuredClone(state);
  ensureGenerated(copy);
  if (!copy.settings.manualTitle) copy.settings.title = autoTitle(copy);
  return copy;
}

export function TripProvider({ uid: userId, children }) {
  const [state, setState] = useState(() => withGenerated(blankState()));
  const [dirty, setDirty] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);
  const suppressDirty = useRef(true); // evita marcar "não salvo" na carga inicial

  // Carga inicial do Firestore.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const remote = userId ? await loadCurrentState(userId) : null;
        if (alive && remote) {
          suppressDirty.current = true;
          setState(withGenerated(remote));
        }
      } catch (e) {
        console.error('Falha ao carregar do Firestore:', e);
      } finally {
        if (alive) {
          setLoaded(true);
          // libera o rastreamento de "sujo" após o primeiro ciclo de render
          setTimeout(() => (suppressDirty.current = false), 0);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  // Persistência com debounce sempre que o state muda (após carregado).
  useEffect(() => {
    if (!loaded || !userId) return;
    if (suppressDirty.current) return;
    setDirty(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveCurrentState(userId, state);
        setDirty(false);
      } catch (e) {
        console.error('Falha ao salvar no Firestore:', e);
      }
    }, 900);
    return () => clearTimeout(saveTimer.current);
  }, [state, loaded, userId]);

  // Mutador base: recebe uma função que muta um rascunho e regenera.
  const mutate = useCallback((fn) => {
    setState((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      return withGenerated(draft);
    });
  }, []);

  /* ---------- Ações de alto nível expostas às telas ---------- */

  const actions = {
    // Edição genérica de um item em um array (equivale a updateArrayItem).
    updateItem(arrName, index, key, value) {
      mutate((s) => {
        const item = s[arrName][index];
        if (!item) return;
        item[key] = key === 'cost' || key === 'nightly' ? num(value) : value;
        if (key === 'time') item.period = periodByTime(value);
      });
    },
    deleteItem(arrName, index) {
      mutate((s) => s[arrName].splice(index, 1));
    },

    // Cidades
    addCity() {
      mutate((s) =>
        s.cities.push({
          id: uid(),
          city: '',
          emoji: '📍',
          start: '',
          end: '',
          hotel: '',
          nightly: 0,
          status: 'Planejado',
          notes: '',
        })
      );
    },
    setCityField(index, key, value) {
      mutate((s) => {
        const c = s.cities[index];
        if (!c) return;
        c[key] = key === 'nightly' ? num(value) : value;
      });
    },
    // Validação real: check-out precisa ser posterior ao check-in.
    setCityStart(index, value) {
      mutate((s) => {
        const c = s.cities[index];
        if (!c) return;
        c.start = value;
        if (value && (!c.end || c.end <= value)) {
          const d = new Date(value + 'T00:00');
          d.setDate(d.getDate() + 1);
          c.end = d.toISOString().slice(0, 10);
        }
      });
    },
    setCityEnd(index, value) {
      let rejected = false;
      mutate((s) => {
        const c = s.cities[index];
        if (!c) return;
        if (value && c.start && value <= c.start) {
          rejected = true;
          return; // não aplica data inválida
        }
        c.end = value;
      });
      return !rejected;
    },
    deleteCity(index, removeRelated) {
      mutate((s) => deleteCityCascade(s, index, removeRelated));
    },

    // Adições específicas
    addTransport(firstDate) {
      mutate((s) =>
        s.transports.push({
          id: uid(),
          date: firstDate || '',
          time: '09:00',
          originCity: '',
          originPlace: '',
          destCity: '',
          destPlace: '',
          mode: '',
          duration: '',
          cost: 0,
          status: 'Planejado',
          notes: '',
        })
      );
    },
    addFoodItem(date, city) {
      mutate((s) =>
        s.foodItems.push({ id: uid(), date, city, type: 'Outros', place: '', cost: 0, status: 'Planejado' })
      );
    },
    addAttraction(date, city) {
      mutate((s) =>
        s.attractions.push({
          id: uid(),
          date,
          city,
          time: '09:00',
          period: 'Manhã',
          name: '',
          cost: 0,
          status: 'Planejado',
        })
      );
    },
    addOther(date, city) {
      mutate((s) => s.otherExpenses.push({ id: uid(), date, city, name: '', cost: 0, status: 'Planejado' }));
    },
    setOtherDate(index, date, city) {
      mutate((s) => {
        const o = s.otherExpenses[index];
        if (!o) return;
        o.date = date;
        o.city = city;
      });
    },

    // Checklist
    addChecklist(item = '') {
      mutate((s) =>
        s.checklist.push({
          id: uid(),
          category: 'Outros',
          item,
          responsible: '',
          priority: 'Média',
          status: 'Pendente',
          notes: '',
          done: false,
        })
      );
    },
    toggleChecklist(index, checked) {
      mutate((s) => {
        const c = s.checklist[index];
        if (!c) return;
        c.done = checked;
        c.status = checked ? 'Concluído' : 'Pendente';
      });
    },
    seedChecklist() {
      const seeds = [
        'Roupas leves', 'Casaco', 'Calçados confortáveis', 'Itens de higiene',
        'Adaptador de tomada', 'Passaporte', 'Seguro viagem', 'Comprovantes de hospedagem',
        'Passagens', 'Reservas de atrações', 'Remédios de uso contínuo', 'Cartão internacional',
        'Power bank', 'Carregador',
      ];
      mutate((s) =>
        seeds.forEach((item) =>
          s.checklist.push({
            id: uid(), category: 'Outros', item, responsible: '', priority: 'Média',
            status: 'Pendente', notes: '', done: false,
          })
        )
      );
    },

    // Settings
    setTravelers(v) {
      mutate((s) => (s.settings.travelers = Math.max(1, num(v) || 1)));
    },
    setCostView(view) {
      mutate((s) => (s.settings.costView = view));
    },
    setSubtitle(text) {
      mutate((s) => (s.settings.subtitle = text));
    },
    regenerateTitle() {
      mutate((s) => {
        s.settings.manualTitle = false;
        s.settings.title = autoTitle(s);
      });
    },

    // Import / substituição integral
    replaceState(newState) {
      suppressDirty.current = false;
      setState(withGenerated(normalizeState(newState)));
    },
    clearCurrent() {
      setState(withGenerated(blankState()));
    },
  };

  return (
    <TripContext.Provider value={{ state, dirty, loaded, actions }}>
      {children}
    </TripContext.Provider>
  );
}
