// domain/generate.js
// Geração automática e exclusão em cascata. Estende a Fase 4:
//  - (4.4) NÃO pré-gera mais as 5 refeições vazias por dia.
//  - (4.3) Café da manhã automático nas cidades marcadas, com remoção ao
//          desmarcar SE a linha ainda não tiver sido editada.
//  - (4.6) Duas linhas de transporte de/para "Casa", com datas auto-ajustadas.

import { uid } from './state.js';
import { datesFromCities, cityForDate, periodByTime, foodOrder, tripBounds, HOME } from './dates.js';
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
 * Café da manhã automático (item 4.3). Para cada cidade com `breakfastIncluded`,
 * garante uma linha "Café da manhã" por dia, com o local = nome do hotel.
 * A linha carrega `autoBreakfast: true`; ao editá-la, o store limpa essa marca
 * (vira manual). Ao desmarcar o café da cidade, as linhas AINDA automáticas são
 * removidas; as que o usuário editou permanecem.
 */
function applyAutoBreakfast(state) {
  const wanted = new Map(); // date -> { hotel, city }
  state.cities.forEach((c) => {
    if (!c.breakfastIncluded || !c.start || !c.end) return;
    for (let d = new Date(c.start + 'T00:00'); d < new Date(c.end + 'T00:00'); d.setDate(d.getDate() + 1)) {
      wanted.set(d.toISOString().slice(0, 10), { hotel: c.hotel || '', city: c.city });
    }
  });

  // remove linhas AINDA automáticas cujas datas não são mais desejadas
  state.foodItems = state.foodItems.filter((x) => !(x.autoBreakfast && !wanted.has(x.date)));

  // garante/atualiza as linhas automáticas nas datas desejadas
  wanted.forEach((info, date) => {
    const auto = state.foodItems.find((x) => x.date === date && x.autoBreakfast);
    if (auto) {
      auto.place = info.hotel; // mantém sincronizado com o hotel enquanto for automático
      auto.city = info.city;
      auto.type = 'Café da manhã';
      return;
    }
    // não cria se já existe um café da manhã manual naquele dia
    const manual = state.foodItems.find((x) => x.date === date && !x.autoBreakfast && foodOrder(x.type) === 1);
    if (manual) return;
    state.foodItems.push({
      id: uid(), date, city: info.city, type: 'Café da manhã',
      place: info.hotel, cost: 0, status: 'Planejado', autoBreakfast: true,
    });
  });
}

/**
 * Transportes automáticos de/para "Casa" (item 4.6). Cria (uma vez) duas linhas
 * marcadas com `autoHome`: ida (origem Casa → primeira cidade, no primeiro dia)
 * e volta (última cidade → destino Casa, no último dia). A cada regeneração só
 * ajusta a DATA e o lado "Casa"; não sobrescreve campos que o usuário preencheu.
 */
function applyAutoHomeTransports(state) {
  const b = tripBounds(state);
  if (!b) {
    // sem cidades: não há datas-âncora; remove as linhas automáticas
    state.transports = state.transports.filter((x) => !x.autoHome);
    return;
  }

  let out = state.transports.find((x) => x.autoHome === 'out');
  if (!out) {
    out = { id: uid(), autoHome: 'out', date: '', time: '', originCity: '', originPlace: HOME, destCity: '', destPlace: '', mode: '', duration: '', cost: 0, status: 'Planejado', notes: '' };
    state.transports.push(out);
  }
  out.date = b.firstDay;                 // data auto-ajustável
  out.originPlace = HOME;                // lado "Casa" fixo (identidade da linha)
  if (!out.destCity && !out.destPlace) out.destCity = b.firstCity ? b.firstCity.city : '';

  let ret = state.transports.find((x) => x.autoHome === 'return');
  if (!ret) {
    ret = { id: uid(), autoHome: 'return', date: '', time: '', originCity: '', originPlace: '', destCity: '', destPlace: HOME, mode: '', duration: '', cost: 0, status: 'Planejado', notes: '' };
    state.transports.push(ret);
  }
  ret.date = b.lastDay;                  // data auto-ajustável
  ret.destPlace = HOME;                  // lado "Casa" fixo
  if (!ret.originCity && !ret.originPlace) ret.originCity = b.lastCity ? b.lastCity.city : '';
}

/**
 * Geração automática por data. Atrações e Outras seguem com 1 linha por dia;
 * Alimentação NÃO é mais pré-gerada (item 4.4). Depois aplica café da manhã
 * automático e os transportes de/para Casa, e reatribui cidade/período.
 * Muta `state` no lugar.
 */
export function ensureGenerated(state) {
  sortCitiesByDate(state);
  const dates = datesFromCities(state);
  dates.forEach(({ date, city }) => {
    if (!state.attractions.some((x) => x.date === date)) {
      state.attractions.push({ id: uid(), date, city, time: '09:00', period: 'Manhã', name: '', cost: 0, status: 'Planejado' });
    }
    if (!state.otherExpenses.some((x) => x.date === date)) {
      state.otherExpenses.push({ id: uid(), date, city, name: '', cost: 0, status: 'Planejado' });
    }
  });

  applyAutoBreakfast(state);
  applyAutoHomeTransports(state);

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
 * itens ligados àquela cidade — usando os MESMOS getters do resto do código.
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
        x.autoHome || // nunca remove as linhas automáticas de/para Casa aqui
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
