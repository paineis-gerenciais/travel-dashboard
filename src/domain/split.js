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

/**
 * Resumo da divisão:
 * - `total`: soma dos custos ativos (itens + hospedagem).
 * - `unassigned`: custo sem pagador definido.
 * - `rows[]`: por participante → { id, name, paid, owed, balance }.
 *   `owed` é a responsabilidade dele segundo os percentuais de cada despesa
 *   (não mais `total / n`, que só valia na divisão igual).
 */
export function splitSummary(state) {
  const people = participants(state);
  const paid = Object.fromEntries(people.map((p) => [p.id, 0]));
  const owed = Object.fromEntries(people.map((p) => [p.id, 0]));
  let total = 0;
  let unassigned = 0;

  allCostRows(state).forEach((row) => {
    const c = row.valor;
    if (c <= 0) return;
    total += c;

    const quem = row.item.paidBy;
    if (quem && Object.prototype.hasOwnProperty.call(paid, quem)) paid[quem] += c;
    else unassigned += c;

    const pcts = effectiveSplit(state, row.item);
    Object.entries(pcts).forEach(([id, pct]) => {
      if (owed[id] !== undefined) owed[id] += (c * pct) / 100;
    });
  });

  const rows = people.map((p) => ({
    id: p.id,
    name: p.name,
    paid: paid[p.id],
    owed: owed[p.id],
    balance: paid[p.id] - owed[p.id],
  }));

  return { people, total, unassigned, rows };
}

/** Linhas de custo de um participante: as que ele pagou e/ou é responsável. */
export function rowsForParticipant(state, participantId) {
  return allCostRows(state)
    .map((row) => {
      const pcts = effectiveSplit(state, row.item);
      const pct = num(pcts[participantId]);
      return { ...row, pct, pagouEste: row.item.paidBy === participantId, parte: (row.valor * pct) / 100 };
    })
    .filter((row) => row.pagouEste || row.pct > 0);
}

/**
 * Acerto de contas: quem paga quanto a quem, minimizando transferências
 * (guloso — maior credor recebe do maior devedor). Tolerância de 1 centavo.
 */
export function settlements(summary) {
  const EPS = 0.01;
  const credores = summary.rows
    .filter((r) => r.balance > EPS)
    .map((r) => ({ id: r.id, name: r.name, valor: r.balance }))
    .sort((a, b) => b.valor - a.valor);
  const devedores = summary.rows
    .filter((r) => r.balance < -EPS)
    .map((r) => ({ id: r.id, name: r.name, valor: -r.balance }))
    .sort((a, b) => b.valor - a.valor);

  const out = [];
  let i = 0;
  let j = 0;
  while (i < devedores.length && j < credores.length) {
    const valor = Math.min(devedores[i].valor, credores[j].valor);
    if (valor > EPS) out.push({ from: devedores[i].name, to: credores[j].name, valor });
    devedores[i].valor -= valor;
    credores[j].valor -= valor;
    if (devedores[i].valor <= EPS) i += 1;
    if (credores[j].valor <= EPS) j += 1;
  }
  return out;
}
