// domain/split.js — T-1.7. Divisão de despesas entre os viajantes.
//
// Regra: cada item de custo pode ter um `paidBy` (quem pagou). Itens sem
// `paidBy` são despesas do grupo ainda não atribuídas — entram no total, mas
// não contam para ninguém como "pago por". A divisão é IGUAL entre os
// participantes (o caso mais comum numa família); divisão por percentual ou por
// item fica para a Fase 2, e o formato de dados já comporta.
//
// Este arquivo é matemática de dinheiro — mesmo rigor da regra do cancelado.
import { num } from './format.js';
import { activeCost } from './costs.js';
import { getTransportCost } from './transport.js';

/** Custo ativo de um item, respeitando o campo de custo legado do transporte. */
function itemCost(kind, x) {
  if (String(x.status || '').toLowerCase() === 'cancelado') return 0;
  return kind === 'transports' ? getTransportCost(x) : num(x.cost);
}

/** Todos os itens de custo de uma viagem, com sua origem. */
export function allCostItems(state) {
  return [
    ...state.transports.map((item) => ({ kind: 'transports', item })),
    ...state.foodItems.map((item) => ({ kind: 'foodItems', item })),
    ...state.attractions.map((item) => ({ kind: 'attractions', item })),
    ...state.otherExpenses.map((item) => ({ kind: 'otherExpenses', item })),
  ];
}

/**
 * Lista de participantes da divisão. Usa os nomes cadastrados em
 * `settings.participants` (T-1.7); se estiver vazio, cai no número de
 * viajantes, gerando rótulos genéricos.
 */
export function participants(state) {
  const list = (state.settings?.participants || []).map((p) => String(p).trim()).filter(Boolean);
  if (list.length > 0) return list;
  const n = Math.max(1, num(state.settings?.travelers) || 1);
  return Array.from({ length: n }, (_, i) => `Viajante ${i + 1}`);
}

/**
 * Resumo da divisão:
 * - `total`: soma dos custos ativos (inclui hospedagem, que é do grupo).
 * - `share`: quanto cada pessoa deveria pagar (divisão igual).
 * - `paid`: quanto cada pessoa efetivamente pagou (itens com `paidBy`).
 * - `unassigned`: custo ainda sem responsável de pagamento.
 * - `balance`: pago − devido. Positivo = tem a receber; negativo = deve.
 */
export function splitSummary(state, lodgingTotal = 0) {
  const people = participants(state);
  const paid = Object.fromEntries(people.map((p) => [p, 0]));
  let itemsTotal = 0;
  let unassigned = 0;

  allCostItems(state).forEach(({ kind, item }) => {
    const c = itemCost(kind, item);
    if (c <= 0) return;
    itemsTotal += c;
    const who = item.paidBy;
    if (who && Object.prototype.hasOwnProperty.call(paid, who)) paid[who] += c;
    else unassigned += c;
  });

  // A hospedagem não é um "item" com paidBy; entra no total do grupo e, por
  // padrão, como despesa ainda não atribuída.
  const total = itemsTotal + num(lodgingTotal);
  unassigned += num(lodgingTotal);

  const share = people.length ? total / people.length : 0;

  const rows = people.map((p) => ({
    person: p,
    paid: paid[p],
    share,
    balance: paid[p] - share,
  }));

  return { people, total, share, unassigned, rows };
}

/**
 * Acerto de contas: quem paga quanto a quem, minimizando o número de
 * transferências (guloso — maior credor recebe do maior devedor).
 * Tolerância de 1 centavo para não gerar acertos irrelevantes.
 */
export function settlements(summary) {
  const EPS = 0.01;
  const credores = summary.rows
    .filter((r) => r.balance > EPS)
    .map((r) => ({ person: r.person, valor: r.balance }))
    .sort((a, b) => b.valor - a.valor);
  const devedores = summary.rows
    .filter((r) => r.balance < -EPS)
    .map((r) => ({ person: r.person, valor: -r.balance }))
    .sort((a, b) => b.valor - a.valor);

  const out = [];
  let i = 0;
  let j = 0;
  while (i < devedores.length && j < credores.length) {
    const valor = Math.min(devedores[i].valor, credores[j].valor);
    if (valor > EPS) out.push({ from: devedores[i].person, to: credores[j].person, valor });
    devedores[i].valor -= valor;
    credores[j].valor -= valor;
    if (devedores[i].valor <= EPS) i += 1;
    if (credores[j].valor <= EPS) j += 1;
  }
  return out;
}
