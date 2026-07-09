// domain/generate.js
// Geração automática de linhas por data e exclusão em cascata de cidade.
// Estas duas funções concentram a lógica que já causou bugs no app original
// (exclusão em cascata comparando pelo campo de cidade errado), então foram
// portadas com cuidado e são cobertas por testes.

import { uid } from './state.js';
import { datesFromCities, cityForDate, periodByTime } from './dates.js';
import { getTransportOriginCity, getTransportDestCity, getTransportOrigin, getTransportDest } from './transport.js';

/** Ordena cidades por data de check-in, depois check-out, depois nome. */
export function sortCitiesByDate(state) {
  state.cities.sort((a, b) => {
    const da = a.start || '9999-12-31';
    const db = b.start || '9999-12-31';
    let cmp = da.localeCompare(db);
    if (cmp) return cmp;
    cmp = (a.end || '9999-12-31').localeCompare(b.end || '9999-12-31');
    if (cmp) return cmp;
    return String(a.city || '').localeCompare(String(b.city || ''), 'pt-BR');
  });
}

/**
 * Gera linhas-padrão de alimentação/atrações/outras despesas para cada data
 * nova, sem duplicar entradas já existentes. Reatribui a cidade de cada item
 * conforme a data e recalcula o período das atrações.
 *
 * IMPORTANTE: muta `state` no lugar (como no original). Os stores/reducers que
 * chamam esta função devem trabalhar sobre uma cópia e então persistir.
 */
export function ensureGenerated(state) {
  sortCitiesByDate(state);
  const dates = datesFromCities(state);
  dates.forEach(({ date, city }) => {
    if (!state.foodItems.some((x) => x.date === date)) {
      ['Café da manhã', 'Almoço', 'Jantar', 'Mercado', 'Outros'].forEach((type) =>
        state.foodItems.push({ id: uid(), date, city, type, place: '', cost: 0, status: 'Planejado' })
      );
    }
    if (!state.attractions.some((x) => x.date === date)) {
      state.attractions.push({
        id: uid(),
        date,
        city,
        time: '09:00',
        period: 'Manhã',
        name: '',
        cost: 0,
        status: 'Planejado',
      });
    }
    if (!state.otherExpenses.some((x) => x.date === date)) {
      state.otherExpenses.push({ id: uid(), date, city, name: '', cost: 0, status: 'Planejado' });
    }
  });
  ['foodItems', 'attractions', 'otherExpenses'].forEach((k) =>
    state[k].forEach((x) => {
      x.city = cityForDate(state, x.date) || x.city;
    })
  );
  state.attractions.forEach((x) => (x.period = periodByTime(x.time)));
  return state;
}

/**
 * Remove uma cidade pelo índice. Se `removeRelated` for true, remove também
 * alimentação/atrações/outras/transporte ligados àquela cidade — comparando
 * pelos MESMOS getters usados em todo o resto do código (a correção do bug
 * original: nunca comparar direto com um único campo legado).
 */
export function deleteCityCascade(state, index, removeRelated) {
  const c = state.cities[index];
  if (!c) return state;
  state.cities.splice(index, 1);
  if (removeRelated) {
    ['foodItems', 'attractions', 'otherExpenses'].forEach(
      (k) => (state[k] = state[k].filter((x) => x.city !== c.city))
    );
    state.transports = state.transports.filter(
      (x) =>
        !(
          getTransportOriginCity(x) === c.city ||
          getTransportDestCity(x) === c.city ||
          getTransportOrigin(x) === c.city ||
          getTransportDest(x) === c.city ||
          (x.date >= c.start && x.date < c.end)
        )
    );
  }
  return state;
}
