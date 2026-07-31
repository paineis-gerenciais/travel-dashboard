// domain/generate.js
// Geração automática e exclusão em cascata. Estende a Fase 4:
//  - (4.4) NÃO pré-gera mais as 5 refeições vazias por dia.
//  - (4.3) Café da manhã automático nas cidades marcadas, com remoção ao
//          desmarcar SE a linha ainda não tiver sido editada.
//  - (4.6) Duas linhas de transporte de/para "Casa", com datas auto-ajustadas.

import { uid } from './state.js';
import { num } from './format.js';
import { cityForDate, periodByTime, foodOrder, tripBounds, HOME } from './dates.js';
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
 * Café da manhã automático (item 4.3, corrigido).
 * Você dorme a noite do check-in e toma café na MANHÃ SEGUINTE. Logo, o café
 * cai nos dias `start+1 .. end` — ou seja, **não** há café no dia do check-in
 * (você chega e dorme) e **há** café no dia do check-out (você toma antes de
 * sair). O número de cafés continua igual ao número de diárias.
 * A linha carrega `autoBreakfast: true`; ao editá-la, o store limpa essa marca
 * (vira manual). Ao desmarcar o café da cidade, as linhas AINDA automáticas são
 * removidas; as que o usuário editou permanecem.
 */
function applyAutoBreakfast(state) {
  const wanted = new Map(); // date -> { hotel, city, status }
  state.cities.forEach((c) => {
    if (!c.breakfastIncluded || !c.start || !c.end) return;
    // uma manhã por noite dormida: começa no dia SEGUINTE ao check-in e vai até o check-out
    const first = new Date(c.start + 'T00:00');
    first.setDate(first.getDate() + 1);
    const last = new Date(c.end + 'T00:00');
    for (let d = first; d <= last; d.setDate(d.getDate() + 1)) {
      // T-C.2: o café automático espelha o STATUS da hospedagem. Sem isto ele
      // nascia sempre 'Planejado' e distorcia os totais por status quando o
      // hotel estava Reservado/Pago.
      wanted.set(d.toISOString().slice(0, 10), { hotel: c.hotel || '', city: c.city, status: c.status || 'Planejado' });
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
      auto.status = info.status; // T-C.2: segue o status da hospedagem enquanto for automático
      return;
    }
    // não cria se já existe um café da manhã manual naquele dia
    const manual = state.foodItems.find((x) => x.date === date && !x.autoBreakfast && foodOrder(x.type) === 1);
    if (manual) return;
    state.foodItems.push({
      id: uid(), date, city: info.city, type: 'Café da manhã',
      place: info.hotel, cost: 0, status: info.status, autoBreakfast: true,
    });
  });
}

/**
 * Transportes automáticos de/para "Casa" (item 4.6). Cria (uma vez) duas linhas
 * marcadas com `autoHome`: ida (origem Casa → primeira cidade, no primeiro dia)
 * e volta (última cidade → destino Casa, no último dia). A cada regeneração só
 * ajusta a DATA e o lado "Casa"; não sobrescreve campos que o usuário preencheu.
 */
/**
 * Remove os transportes de/para "Casa" que versões anteriores criavam
 * automaticamente no primeiro e no último dia.
 *
 * Decisão: eles atrapalhavam mais do que ajudavam — apareciam sem o usuário
 * pedir, e obrigavam a editar ou apagar algo que não foi criado por ele. Quem
 * quiser registrar a ida e a volta agora adiciona manualmente, como qualquer
 * outro transporte.
 *
 * Esta função é também a MIGRAÇÃO: viagens já salvas têm essas linhas no
 * Firestore, e elas precisam desaparecer ao abrir. Só remove as automáticas e
 * ainda intocadas — se a pessoa editou a linha (preencheu meio, custo ou
 * horário), ela é preservada como transporte manual, apenas perdendo a marca de
 * automático. Nunca apagamos trabalho do usuário sem aviso.
 */
function removeAutoHomeTransports(state) {
  state.transports = state.transports.filter((x) => {
    if (!x.autoHome) return true;
    const editado =
      String(x.mode || '').trim() !== '' ||
      String(x.time || '').trim() !== '' ||
      num(x.cost) > 0 ||
      String(x.duration || '').trim() !== '' ||
      String(x.notes || '').trim() !== '';
    if (editado) {
      delete x.autoHome; // vira um transporte manual comum
      return true;
    }
    return false;
  });
}

/**
 * Geração automática por data. Nada de itens vazios: o dia nasce limpo e a
 * pessoa adiciona o que quiser com os botões "+" (nem atração, nem outra
 * despesa, nem refeição são pré-criadas). O que é gerado automaticamente tem
 * razão de ser: o café da manhã incluso na hospedagem e os transportes de/para
 * "Casa". Depois, reatribui cidade/período dos itens existentes.
 * Muta `state` no lugar.
 */
export function ensureGenerated(state) {
  sortCitiesByDate(state);

  applyAutoBreakfast(state);
  removeAutoHomeTransports(state);

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


/**
 * Clona o estado de uma viagem para criar outra (T-1.6).
 * - Gera IDs novos para todos os itens (nada compartilhado com a original).
 * - Opcionalmente desloca todas as datas em N dias (para reaproveitar um
 *   roteiro num novo período).
 * - NÃO copia membros, versões, comentários nem atividade — isso vive fora do
 *   estado da viagem, e copiar seria vazamento de contexto entre viagens.
 * - Reexecuta a geração automática, para que café da manhã e transportes de
 *   Casa nasçam coerentes com as datas novas.
 */
export function cloneTripState(state, { shiftDays = 0 } = {}) {
  const shift = (iso) => {
    if (!iso || !shiftDays) return iso;
    const d = new Date(iso + 'T00:00');
    d.setDate(d.getDate() + shiftDays);
    return d.toISOString().slice(0, 10);
  };

  const copy = JSON.parse(JSON.stringify(state));

  copy.cities = (copy.cities || []).map((c) => ({ ...c, id: uid(), start: shift(c.start), end: shift(c.end) }));
  ['foodItems', 'attractions', 'otherExpenses'].forEach((k) => {
    copy[k] = (copy[k] || []).map((x) => ({ ...x, id: uid(), date: shift(x.date) }));
  });
  copy.transports = (copy.transports || []).map((x) => ({ ...x, id: uid(), date: shift(x.date) }));
  copy.checklist = (copy.checklist || []).map((x) => ({ ...x, id: uid() }));

  ensureGenerated(copy);
  return copy;
}
