// domain/split.js — divisão de despesas entre os participantes.
//
// Modelo:
// - `settings.participants`: [{ id, name }]. O vínculo é sempre pelo `id`; o
//   nome é só exibição, então renomear alguém não quebra nenhuma despesa.
// - Cada item de custo (e cada cidade/hospedagem) pode ter:
//     `paidBy`: id de quem PAGOU;
//     `split`:  { [participantId]: percentual } — quem é RESPONSÁVEL e quanto.
//   Sem `split`, a responsabilidade é dividida igualmente entre todos.
//
// Matemática de dinheiro: mesmo rigor da regra do cancelado, tudo coberto por
// teste.
import { num } from './format.js';
import { getTransportCost } from './transport.js';
import { daysBetween, datesFromCities } from './dates.js';

/** Lista de participantes: [{ id, name }]. */
export function participants(state) {
  const list = (state.settings?.participants || []).filter((p) => p && p.id);
  if (list.length > 0) return list;
  // Sem cadastro: gera rótulos a partir do número de viajantes, com ids
  // estáveis derivados da posição (não persistidos — só para exibir).
  const n = Math.max(1, num(state.settings?.travelers) || 1);
  return Array.from({ length: n }, (_, i) => ({ id: `auto-${i + 1}`, name: `Viajante ${i + 1}` }));
}

export function participantName(state, id) {
  return participants(state).find((p) => p.id === id)?.name || '';
}

const cancelado = (x) => String(x.status || '').toLowerCase() === 'cancelado';

/** Custo ativo de um item (0 se cancelado), respeitando o campo legado do transporte. */
export function itemCost(kind, x) {
  if (cancelado(x)) return 0;
  return kind === 'transports' ? getTransportCost(x) : num(x.cost);
}

/** Quantas noites de cada cidade caem de fato no período da viagem. */
function nightsByCity(state) {
  const map = new Map();
  datesFromCities(state).forEach(({ date }) => {
    const c = state.cities.find((x) => date >= x.start && date < x.end);
    if (c) map.set(c.id, (map.get(c.id) || 0) + 1);
  });
  return map;
}

/**
 * Todas as linhas de custo da viagem, já com valor calculado — incluindo a
 * HOSPEDAGEM de cada cidade, que passou a aceitar `paidBy` e `split` como
 * qualquer outra despesa.
 */
export function allCostRows(state) {
  const noites = nightsByCity(state);
  const rows = [];

  state.cities.forEach((c) => {
    const n = noites.get(c.id) ?? daysBetween(c.start, c.end);
    const valor = cancelado(c) ? 0 : n * num(c.nightly);
    if (valor > 0 || c.paidBy) {
      rows.push({
        kind: 'cities',
        id: c.id,
        item: c,
        valor,
        rotulo: c.hotel || c.city || 'Hospedagem',
        detalhe: `${c.city || ''}${n ? ` · ${n} ${n === 1 ? 'diária' : 'diárias'}` : ''}`,
      });
    }
  });

  const simples = [
    ['transports', (x) => x.mode || 'Transporte'],
    ['foodItems', (x) => x.type || 'Refeição'],
    ['attractions', (x) => x.name || 'Atração'],
    ['otherExpenses', (x) => x.name || 'Despesa'],
  ];
  simples.forEach(([kind, rotulo]) => {
    (state[kind] || []).forEach((x) => {
      const valor = itemCost(kind, x);
      if (valor > 0 || x.paidBy) {
        rows.push({ kind, id: x.id, item: x, valor, rotulo: rotulo(x), detalhe: x.date || '' });
      }
    });
  });

  return rows;
}

/**
 * Percentuais efetivos de responsabilidade de uma linha.
 * Sem `split` definido, divide igualmente entre todos os participantes.
 * Com `split`, usa o que foi definido — normalizado para somar 100.
 */
export function effectiveSplit(state, item) {
  const people = participants(state);
  const bruto = item?.split && typeof item.split === 'object' ? item.split : null;

  if (!bruto) {
    const pct = people.length ? 100 / people.length : 0;
    return Object.fromEntries(people.map((p) => [p.id, pct]));
  }

  const validos = {};
  people.forEach((p) => {
    const v = num(bruto[p.id]);
    if (v > 0) validos[p.id] = v;
  });
  const soma = Object.values(validos).reduce((a, b) => a + b, 0);
  if (soma <= 0) {
    const pct = people.length ? 100 / people.length : 0;
    return Object.fromEntries(people.map((p) => [p.id, pct]));
  }
  // normaliza: o usuário pode ter digitado 60/30 (=90) ou 3/1 (proporcional)
  return Object.fromEntries(Object.entries(validos).map(([id, v]) => [id, (v / soma) * 100]));
}

/** Reais -> centavos inteiros. */
export function toCents(v) {
  return Math.round(num(v) * 100);
}

/**
 * Divide `cents` (inteiro) entre os participantes conforme os percentuais da
 * despesa, fechando exatamente em `cents`: método do MAIOR RESTO (D7).
 * Cada um recebe o piso da sua parte; os centavos que sobram vão, um a um, para
 * as maiores frações. Empate: vence quem vem primeiro na lista de participantes.
 * Determinístico. Só participantes cadastrados entram na conta.
 * Retorna { [participantId]: centavos }.
 */
export function splitCents(state, item, cents) {
  const people = participants(state);
  const pcts = effectiveSplit(state, item);
  let pesos = people.map((p) => Math.max(0, num(pcts[p.id])));
  let soma = pesos.reduce((a, b) => a + b, 0);
  if (soma <= 0) {
    pesos = people.map(() => 1);
    soma = people.length;
  }
  const exatas = pesos.map((w) => (cents * w) / soma);
  const pisos = exatas.map((x) => Math.floor(x + 1e-9));
  let resto = cents - pisos.reduce((a, b) => a + b, 0);
  const ordem = exatas
    .map((x, i) => ({ i, frac: Math.round((x - pisos[i]) * 1e6) / 1e6 }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; resto > 0 && k < ordem.length; k += 1, resto -= 1) pisos[ordem[k].i] += 1;
  return Object.fromEntries(people.map((p, i) => [p.id, pisos[i]]));
}

/**
 * Pagamentos de acerto já feitos: `settings.payments` = [{ id, de, para, valor, data }]
 * (`de` pagou `valor` reais a `para`; `data` em ISO). Ignora entradas inválidas.
 */
export function paymentsList(state) {
  const list = Array.isArray(state.settings?.payments) ? state.settings.payments : [];
  return list.filter((x) => x && x.id && x.de && x.para && x.de !== x.para && toCents(x.valor) > 0);
}

/**
 * Resumo da divisão (valores em reais, calculados em centavos inteiros):
 * - `total`: soma dos custos ativos (itens + hospedagem).
 * - `unassigned`: custo sem pagador definido.
 * - `unassignedItems[]`: as despesas sem pagador ({ kind, id, rotulo, valor }).
 * - `rows[]`: por participante → { id, name, paid, settled, owed, balance, balanceCents }.
 *   `paid` é só o que ele pagou em DESPESAS. `owed` é a responsabilidade dele
 *   segundo os percentuais de cada despesa, com as partes fechando em centavos
 *   (maior resto). `settled` é o efeito líquido dos pagamentos de acerto: positivo
 *   para quem pagou (`de`), negativo para quem recebeu (`para`).
 *   O saldo é `paid + settled - owed`.
 */
export function splitSummary(state) {
  const people = participants(state);
  const paid = Object.fromEntries(people.map((p) => [p.id, 0]));
  const owed = Object.fromEntries(people.map((p) => [p.id, 0]));
  let total = 0;
  let unassigned = 0;
  const unassignedItems = [];

  allCostRows(state).forEach((row) => {
    const c = toCents(row.valor);
    if (c <= 0) return;
    total += c;

    const quem = row.item.paidBy;
    if (quem && Object.prototype.hasOwnProperty.call(paid, quem)) paid[quem] += c;
    else {
      unassigned += c;
      unassignedItems.push({ kind: row.kind, id: row.id, rotulo: row.rotulo, valor: c / 100 });
    }

    const partes = splitCents(state, row.item, c);
    Object.entries(partes).forEach(([id, v]) => { owed[id] += v; });
  });

  const settled = Object.fromEntries(people.map((p) => [p.id, 0]));
  paymentsList(state).forEach((pg) => {
    const v = toCents(pg.valor);
    if (settled[pg.de] === undefined || settled[pg.para] === undefined) return;
    settled[pg.de] += v;
    settled[pg.para] -= v;
  });

  const rows = people.map((p) => ({
    id: p.id,
    name: p.name,
    paid: paid[p.id] / 100,
    settled: settled[p.id] / 100,
    owed: owed[p.id] / 100,
    balance: (paid[p.id] + settled[p.id] - owed[p.id]) / 100,
    balanceCents: paid[p.id] + settled[p.id] - owed[p.id],
  }));

  return { people, total: total / 100, unassigned: unassigned / 100, unassignedItems, rows };
}

/** Linhas de custo de um participante: as que ele pagou e/ou é responsável. */
export function rowsForParticipant(state, participantId) {
  return allCostRows(state)
    .map((row) => {
      const pcts = effectiveSplit(state, row.item);
      const pct = num(pcts[participantId]);
      const parte = num(splitCents(state, row.item, toCents(row.valor))[participantId]) / 100;
      return { ...row, pct, pagouEste: row.item.paidBy === participantId, parte };
    })
    .filter((row) => row.pagouEste || row.pct > 0);
}

/**
 * Acerto de contas sobre o SALDO RESIDUAL (já descontados os pagamentos
 * confirmados): quem paga quanto a quem, minimizando transferências (guloso:
 * maior credor recebe do maior devedor). Em centavos inteiros, sem tolerância.
 * Empates seguem a ordem da lista de participantes.
 */
export function settlements(summary) {
  const credores = summary.rows
    .filter((r) => r.balanceCents > 0)
    .map((r) => ({ id: r.id, name: r.name, c: r.balanceCents }))
    .sort((a, b) => b.c - a.c);
  const devedores = summary.rows
    .filter((r) => r.balanceCents < 0)
    .map((r) => ({ id: r.id, name: r.name, c: -r.balanceCents }))
    .sort((a, b) => b.c - a.c);

  const out = [];
  let i = 0;
  let j = 0;
  while (i < devedores.length && j < credores.length) {
    const c = Math.min(devedores[i].c, credores[j].c);
    out.push({
      fromId: devedores[i].id,
      toId: credores[j].id,
      from: devedores[i].name,
      to: credores[j].name,
      valor: c / 100,
      cents: c,
    });
    devedores[i].c -= c;
    credores[j].c -= c;
    if (devedores[i].c === 0) i += 1;
    if (credores[j].c === 0) j += 1;
  }
  return out;
}

/** True só quando todos os saldos estão zerados (em centavos). */
export function allSettled(summary) {
  return summary.rows.every((r) => r.balanceCents === 0);
}

/** Chave de um acerto: quem paga, para quem, e quanto (em centavos). Também é o formato legado de `settlementsDone`. */
export function settlementKey(s) {
  return `${s.fromId}>${s.toId}>${Math.round(s.valor * 100)}`;
}
