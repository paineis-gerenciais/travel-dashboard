// domain/state.js
// Modelo de dados central (state) portado do dashboard Apps Script.
// A estrutura de `checklist` segue o CÓDIGO REAL do Index.html
// ({id,category,item,responsible,priority,status,notes,done}), que diverge
// do formato simplificado descrito na especificação — o código é a fonte da
// verdade porque foi o que passou pelas correções de bug validadas.

import { num } from './format.js';
import { isValidLink } from './links.js';
export const STATUS_OPTIONS = ['Planejado', 'Reservado', 'Pago', 'Cancelado'];
export const CHECKLIST_STATUS_OPTIONS = ['Pendente', 'Em andamento', 'Concluído', 'Cancelado'];
export const PRIORITY_OPTIONS = ['Alta', 'Média', 'Baixa'];
export const CATEGORY_OPTIONS = [
  'Bagagem',
  'Documentos',
  'Saúde',
  'Dinheiro e cartões',
  'Eletrônicos',
  'Crianças',
  'Reservas',
  'Outros',
];

export const SUBTITLES = [
  'Cada destino, uma nova história para viver.',
  'Planeje com calma, viaje com leveza.',
  'O mundo é grande, e o roteiro começa aqui.',
  'Detalhes hoje, memórias amanhã.',
];

/** Gera um id curto único (mesma lógica do app original). */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Estado vazio inicial. */
export function blankState() {
  return {
    cities: [],
    transports: [],
    foodItems: [],
    attractions: [],
    otherExpenses: [],
    checklist: [],
    settings: {
      travelers: 2,
      manualTitle: false,
      title: '',
      subtitle: SUBTITLES[0],
      currentVersionId: null,
      costView: 'categoria',
      // Participantes da divisão de despesas: [{ id, name }].
      // Vazio = usa rótulos genéricos derivados de `travelers`.
      participants: [],
      // LEGADO: acertos confirmados [{ key, at }]. Migrado para `payments` em
      // normalizeState (ver migratePayments) e esvaziado; não usar.
      settlementsDone: [],
      // Pagamentos de acerto já feitos: [{ id, de, para, valor, data }]
      // (`de` pagou `valor` reais a `para`; `data` ISO). Abatem o saldo.
      payments: [],
      // Documentos gerais da viagem (links): [{ id, label, url }].
      // Não pertencem a nenhum dia — seguro-viagem, passaporte, apólice.
      documents: [],
    },
  };
}

/**
 * Garante que um objeto qualquer tenha o formato mínimo de `state`.
 * Usado ao carregar do Firestore ou importar JSON. Preserva compatibilidade
 * com dados antigos (mescla settings, força arrays).
 */
export function normalizeState(s) {
  const b = blankState();
  s = { ...b, ...s, settings: { ...b.settings, ...(s?.settings || {}) } };
  ['cities', 'transports', 'foodItems', 'attractions', 'otherExpenses', 'checklist'].forEach(
    (k) => {
      if (!Array.isArray(s[k])) s[k] = [];
    }
  );
  migrateParticipants(s);
  migratePayments(s);
  // Documentos gerais da viagem: só links https válidos chegam à tela. Um link
  // `javascript:` gravado direto no banco ou vindo de um JSON importado seria
  // aberto na origem do app ao clicar em "Abrir" (issue #18).
  s.settings.documents = (Array.isArray(s.settings.documents) ? s.settings.documents : [])
    .filter((d) => d && isValidLink(d.url));
  return s;
}

/**
 * Migração dos participantes da divisão de despesas: de nomes soltos para
 * objetos com IDENTIFICADOR.
 *
 * Por que: antes, `paidBy` guardava o NOME do participante como texto.
 * Renomear "Ana" para "Ana Silva" órfãva silenciosamente todas as despesas
 * dela — elas sumiam da conta e viravam "sem pagador". Com o rateio por
 * percentual, o nome viraria chave em dois lugares, dobrando o problema.
 * Agora o vínculo é por `id` estável e o nome é só exibição: renomear não
 * quebra nada.
 *
 * A migração é idempotente: roda a cada carregamento, converte o que for antigo
 * e não mexe no que já está no formato novo.
 */
export function migrateParticipants(s) {
  const brutos = Array.isArray(s.settings.participants) ? s.settings.participants : [];

  // 1) normaliza a lista para [{ id, name }]
  const porNome = new Map();
  s.settings.participants = brutos
    .map((p) => {
      if (p && typeof p === 'object' && p.id) return { id: p.id, name: String(p.name || '').trim() };
      const name = String(p || '').trim();
      return name ? { id: uid(), name } : null;
    })
    .filter(Boolean);
  s.settings.participants.forEach((p) => porNome.set(p.name.toLowerCase(), p.id));

  // 2) converte referências antigas (paidBy com o nome) para o id
  const ids = new Set(s.settings.participants.map((p) => p.id));
  const resolver = (valor) => {
    const v = String(valor || '').trim();
    if (!v) return '';
    if (ids.has(v)) return v;                       // já é id
    return porNome.get(v.toLowerCase()) || '';      // era nome
  };

  ['cities', 'transports', 'foodItems', 'attractions', 'otherExpenses'].forEach((k) => {
    s[k].forEach((x) => {
      if (x.paidBy !== undefined) x.paidBy = resolver(x.paidBy);
      if (x.split && typeof x.split === 'object') {
        const novo = {};
        Object.entries(x.split).forEach(([chave, pct]) => {
          const id = resolver(chave);
          if (id) novo[id] = num(pct);
        });
        x.split = Object.keys(novo).length ? novo : undefined;
      }
    });
  });

  return s;
}

/**
 * Migração de `settlementsDone` (chave `de>para>centavos`, com `at`) para
 * `payments` ({ id, de, para, valor, data }). Idempotente: o id do pagamento
 * migrado é derivado da chave e da data, então repetir não duplica; depois de
 * migrar, `settlementsDone` fica vazio.
 */
export function migratePayments(s) {
  const atuais = Array.isArray(s.settings.payments) ? s.settings.payments.filter((x) => x && x.id) : [];
  const ids = new Set(atuais.map((x) => x.id));
  const antigos = Array.isArray(s.settings.settlementsDone) ? s.settings.settlementsDone : [];
  antigos.forEach((x) => {
    const partes = String(x?.key || '').split('>');
    if (partes.length !== 3) return;
    const [de, para, cents] = partes;
    const c = Number(cents);
    if (!de || !para || de === para || !Number.isInteger(c) || c <= 0) return;
    const id = `mig-${x.key}-${x.at || ''}`;
    if (ids.has(id)) return;
    ids.add(id);
    atuais.push({ id, de, para, valor: c / 100, data: x.at || '' });
  });
  s.settings.payments = atuais;
  s.settings.settlementsDone = [];
}
