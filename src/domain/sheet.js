// domain/sheet.js — importação e exportação por planilha.
//
// Semântica de MESCLAGEM (decisão registrada): a planilha **insere e atualiza**,
// nunca apaga. Item que existe no app e não está na planilha permanece intacto.
// Exclusão continua sendo manual no app — uma planilha incompleta não pode
// destruir a viagem.
//
// A coluna `id` é o que permite a ida e volta: exportar, editar em massa, e
// reimportar atualizando as mesmas linhas. Linha sem `id` vira item novo.
//
// Esta camada é pura: não conhece XLSX nem arquivos. Recebe e devolve matrizes
// de células, para que o mesmo núcleo sirva ao arquivo e ao "colar da planilha".
import { uid } from './state.js';
import { num } from './format.js';
import { STATUS_OPTIONS, CHECKLIST_STATUS_OPTIONS, PRIORITY_OPTIONS } from './state.js';
import { isValidLink, normalizeLinkInput } from './links.js';

/* ---------- Tipos de célula ---------- */

const TEXTO = 'texto';
const DATA = 'data';
const HORA = 'hora';
const DINHEIRO = 'dinheiro';
const INTEIRO = 'inteiro';
const BOOLEANO = 'booleano';
const LINK = 'link';
const STATUS = 'status';
const STATUS_CHECK = 'statusCheck';
const PRIORIDADE = 'prioridade';

/**
 * Esquema das abas. A ordem das colunas aqui é a ordem no arquivo.
 * `campo` é o caminho no objeto do domínio; `col` é o cabeçalho na planilha.
 */
export const ESQUEMA = {
  cities: {
    aba: 'Cidades',
    colunas: [
      { col: 'id', campo: 'id', tipo: TEXTO },
      { col: 'cidade', campo: 'city', tipo: TEXTO, obrigatorio: true },
      { col: 'emoji', campo: 'emoji', tipo: TEXTO },
      { col: 'check_in', campo: 'start', tipo: DATA, obrigatorio: true },
      { col: 'check_out', campo: 'end', tipo: DATA, obrigatorio: true },
      { col: 'hospedagem', campo: 'hotel', tipo: TEXTO },
      { col: 'custo_diaria', campo: 'nightly', tipo: DINHEIRO },
      { col: 'cafe_incluso', campo: 'breakfastIncluded', tipo: BOOLEANO },
      { col: 'status', campo: 'status', tipo: STATUS },
      { col: 'notas', campo: 'notes', tipo: TEXTO },
      { col: 'link', campo: 'link', tipo: LINK },
    ],
  },
  transports: {
    aba: 'Transportes',
    colunas: [
      { col: 'id', campo: 'id', tipo: TEXTO },
      { col: 'data', campo: 'date', tipo: DATA, obrigatorio: true },
      { col: 'hora', campo: 'time', tipo: HORA },
      { col: 'meio', campo: 'mode', tipo: TEXTO },
      { col: 'origem_cidade', campo: 'originCity', tipo: TEXTO },
      { col: 'origem_local', campo: 'originPlace', tipo: TEXTO },
      { col: 'destino_cidade', campo: 'destCity', tipo: TEXTO },
      { col: 'destino_local', campo: 'destPlace', tipo: TEXTO },
      { col: 'duracao_min', campo: 'duration', tipo: INTEIRO },
      { col: 'custo', campo: 'cost', tipo: DINHEIRO },
      { col: 'status', campo: 'status', tipo: STATUS },
      { col: 'notas', campo: 'notes', tipo: TEXTO },
      { col: 'link', campo: 'link', tipo: LINK },
    ],
  },
  foodItems: {
    aba: 'Alimentacao',
    colunas: [
      { col: 'id', campo: 'id', tipo: TEXTO },
      { col: 'data', campo: 'date', tipo: DATA, obrigatorio: true },
      { col: 'tipo', campo: 'type', tipo: TEXTO, obrigatorio: true },
      { col: 'local', campo: 'place', tipo: TEXTO },
      { col: 'custo', campo: 'cost', tipo: DINHEIRO },
      { col: 'status', campo: 'status', tipo: STATUS },
      { col: 'link', campo: 'link', tipo: LINK },
    ],
  },
  attractions: {
    aba: 'Atracoes',
    colunas: [
      { col: 'id', campo: 'id', tipo: TEXTO },
      { col: 'data', campo: 'date', tipo: DATA, obrigatorio: true },
      { col: 'hora', campo: 'time', tipo: HORA },
      { col: 'nome', campo: 'name', tipo: TEXTO, obrigatorio: true },
      { col: 'custo', campo: 'cost', tipo: DINHEIRO },
      { col: 'status', campo: 'status', tipo: STATUS },
      { col: 'link', campo: 'link', tipo: LINK },
    ],
  },
  otherExpenses: {
    aba: 'Outras',
    colunas: [
      { col: 'id', campo: 'id', tipo: TEXTO },
      { col: 'data', campo: 'date', tipo: DATA, obrigatorio: true },
      { col: 'nome', campo: 'name', tipo: TEXTO, obrigatorio: true },
      { col: 'custo', campo: 'cost', tipo: DINHEIRO },
      { col: 'status', campo: 'status', tipo: STATUS },
      { col: 'link', campo: 'link', tipo: LINK },
    ],
  },
  checklist: {
    aba: 'Checklist',
    colunas: [
      { col: 'id', campo: 'id', tipo: TEXTO },
      { col: 'categoria', campo: 'category', tipo: TEXTO },
      { col: 'item', campo: 'item', tipo: TEXTO, obrigatorio: true },
      { col: 'responsavel', campo: 'responsible', tipo: TEXTO },
      { col: 'prioridade', campo: 'priority', tipo: PRIORIDADE },
      { col: 'status', campo: 'status', tipo: STATUS_CHECK },
      { col: 'notas', campo: 'notes', tipo: TEXTO },
      { col: 'link', campo: 'link', tipo: LINK },
    ],
  },
};

export const ABAS = Object.entries(ESQUEMA).map(([kind, def]) => ({ kind, aba: def.aba }));

/** Encontra o `kind` a partir do nome da aba (sem diferenciar acento/maiúscula). */
export function kindPorAba(nome) {
  const alvo = String(nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const achado = ABAS.find(
    (a) => a.aba.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === alvo
  );
  return achado?.kind || null;
}

/* ---------- Leitura de células ---------- */

const ehVazio = (v) => v === null || v === undefined || String(v).trim() === '';

/**
 * Data. Aceita só `AAAA-MM-DD` quando vem como texto — de propósito.
 *
 * O Excel guarda data como número de série e interpreta `03/04/2026` conforme o
 * idioma do computador (3 de abril ou 4 de março). Dado o histórico de bugs de
 * data deste projeto, texto ambíguo é **recusado** em vez de adivinhado. Objetos
 * Date e números de série (quando o Excel converte sozinho) são aceitos e
 * normalizados, porque aí não há ambiguidade.
 */
export function parseDataCelula(v) {
  if (ehVazio(v)) return { ok: true, valor: '' };

  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const off = v.getTimezoneOffset();
    return { ok: true, valor: new Date(v.getTime() - off * 60000).toISOString().slice(0, 10) };
  }

  if (typeof v === 'number' && Number.isFinite(v)) {
    // série do Excel: dias desde 1899-12-30
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return { ok: false, erro: 'data inválida' };
    return { ok: true, valor: d.toISOString().slice(0, 10) };
  }

  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00');
    if (Number.isNaN(d.getTime())) return { ok: false, erro: 'data inexistente' };
    return { ok: true, valor: s };
  }
  return { ok: false, erro: `use o formato AAAA-MM-DD (recebido: "${s}")` };
}

function parseHora(v) {
  if (ehVazio(v)) return { ok: true, valor: '' };
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return { ok: true, valor: v.toTimeString().slice(0, 5) };
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return { ok: false, erro: `use HH:MM (recebido: "${s}")` };
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return { ok: false, erro: 'hora fora do intervalo' };
  return { ok: true, valor: `${String(h).padStart(2, '0')}:${m[2]}` };
}

function parseBooleano(v) {
  if (ehVazio(v)) return { ok: true, valor: false };
  const s = String(v).trim().toLowerCase();
  if (['sim', 's', 'true', 'verdadeiro', 'x', '1'].includes(s)) return { ok: true, valor: true };
  if (['nao', 'não', 'n', 'false', 'falso', '0'].includes(s)) return { ok: true, valor: false };
  return { ok: false, erro: `use "sim" ou "não" (recebido: "${s}")` };
}

function parseOpcao(v, opcoes, padrao) {
  if (ehVazio(v)) return { ok: true, valor: padrao };
  const s = String(v).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const achado = opcoes.find(
    (o) => o.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === s
  );
  if (!achado) return { ok: false, erro: `valor inválido. Use: ${opcoes.join(', ')}` };
  return { ok: true, valor: achado };
}

function parseCelula(coluna, v) {
  switch (coluna.tipo) {
    case DATA: return parseDataCelula(v);
    case HORA: return parseHora(v);
    case BOOLEANO: return parseBooleano(v);
    case STATUS: return parseOpcao(v, STATUS_OPTIONS, 'Planejado');
    case STATUS_CHECK: return parseOpcao(v, CHECKLIST_STATUS_OPTIONS, 'Pendente');
    case PRIORIDADE: return parseOpcao(v, PRIORITY_OPTIONS, 'Média');
    case DINHEIRO: return { ok: true, valor: ehVazio(v) ? 0 : num(v) };
    case INTEIRO: return { ok: true, valor: ehVazio(v) ? '' : Math.max(0, Math.round(num(v))) };
    case LINK: {
      if (ehVazio(v)) return { ok: true, valor: undefined };
      const url = normalizeLinkInput(String(v).trim());
      if (!isValidLink(url)) return { ok: false, erro: 'link inválido (use https)' };
      return { ok: true, valor: { url, label: '' } };
    }
    default: return { ok: true, valor: ehVazio(v) ? '' : String(v).trim() };
  }
}

/* ---------- Estado → linhas (exportação) ---------- */

function celulaParaPlanilha(coluna, item) {
  const v = item[coluna.campo];
  if (coluna.tipo === LINK) return v?.url || '';
  if (coluna.tipo === BOOLEANO) return v ? 'sim' : 'não';
  if (coluna.tipo === DINHEIRO) return num(v) || 0;
  return v === undefined || v === null ? '' : v;
}

/** Linhas de uma aba, como matriz (primeira linha = cabeçalho). */
export function linhasDe(state, kind) {
  const def = ESQUEMA[kind];
  const head = def.colunas.map((c) => c.col);
  const body = (state[kind] || []).map((item) => def.colunas.map((c) => celulaParaPlanilha(c, item)));
  return [head, ...body];
}

/** Todas as abas, prontas para virar arquivo. */
export function planilhaDe(state) {
  return Object.keys(ESQUEMA).map((kind) => ({
    kind,
    aba: ESQUEMA[kind].aba,
    linhas: linhasDe(state, kind),
  }));
}

/* ---------- Linhas → itens validados (importação) ---------- */

/**
 * Valida uma aba. Recebe matriz de células (com cabeçalho) e devolve
 * `{ itens, erros }`. Erros trazem linha e coluna, para a prévia mostrar
 * exatamente onde está o problema.
 */
export function validarAba(kind, matriz) {
  const def = ESQUEMA[kind];
  if (!def) return { itens: [], erros: [{ linha: 0, coluna: '', mensagem: `aba desconhecida` }] };
  if (!matriz || matriz.length < 2) return { itens: [], erros: [] };

  const head = matriz[0].map((h) => String(h || '').trim().toLowerCase());
  const idx = {};
  def.colunas.forEach((c) => { idx[c.col] = head.indexOf(c.col); });

  const faltando = def.colunas.filter((c) => c.obrigatorio && idx[c.col] < 0).map((c) => c.col);
  if (faltando.length) {
    return { itens: [], erros: [{ linha: 1, coluna: faltando.join(', '), mensagem: 'coluna obrigatória ausente' }] };
  }

  const itens = [];
  const erros = [];

  matriz.slice(1).forEach((linha, i) => {
    const numeroLinha = i + 2; // 1-based, contando o cabeçalho
    const vazia = def.colunas.every((c) => idx[c.col] < 0 || ehVazio(linha[idx[c.col]]));
    if (vazia) return;

    const item = {};
    let temErro = false;

    def.colunas.forEach((c) => {
      const bruto = idx[c.col] >= 0 ? linha[idx[c.col]] : '';
      if (c.obrigatorio && ehVazio(bruto)) {
        erros.push({ linha: numeroLinha, coluna: c.col, mensagem: 'obrigatório' });
        temErro = true;
        return;
      }
      const r = parseCelula(c, bruto);
      if (!r.ok) {
        erros.push({ linha: numeroLinha, coluna: c.col, mensagem: r.erro });
        temErro = true;
        return;
      }
      if (r.valor !== undefined) item[c.campo] = r.valor;
    });

    if (!temErro) itens.push({ ...item, _linha: numeroLinha });
  });

  return { itens, erros };
}

/* ---------- Mesclagem ---------- */

/**
 * Mescla os itens validados no estado.
 *
 * - Linha COM `id` que existe → atualiza **só as colunas da planilha**. Campos
 *   que a planilha não conhece (quem pagou, rateio, café automático) são
 *   preservados — é a vantagem de mesclar em vez de substituir.
 * - Linha sem `id`, ou com `id` inexistente → item novo, com id gerado.
 * - Item do app ausente na planilha → **intocado**. A planilha nunca apaga.
 *
 * Devolve `{ state, resumo: { criados, atualizados } }`. Não muta o original.
 */
export function mesclarPlanilha(state, porKind) {
  const novo = JSON.parse(JSON.stringify(state));
  const resumo = {};

  Object.entries(porKind).forEach(([kind, itens]) => {
    if (!ESQUEMA[kind] || !Array.isArray(itens)) return;
    const alvo = novo[kind] || (novo[kind] = []);
    const porId = new Map(alvo.map((x) => [x.id, x]));
    let criados = 0;
    let atualizados = 0;

    itens.forEach((bruto) => {
      const { _linha, ...campos } = bruto;
      const existente = campos.id ? porId.get(campos.id) : null;

      if (existente) {
        Object.entries(campos).forEach(([k, v]) => {
          if (k === 'id') return;
          if (k === 'link' && v === undefined) { delete existente.link; return; }
          existente[k] = v;
        });
        atualizados += 1;
      } else {
        const item = { ...campos, id: campos.id || uid() };
        if (item.link === undefined) delete item.link;
        alvo.push(item);
        porId.set(item.id, item);
        criados += 1;
      }
    });

    resumo[kind] = { criados, atualizados };
  });

  return { state: novo, resumo };
}

/** Total de linhas e de erros, para o resumo da prévia. */
export function resumoValidacao(porKind, errosPorKind) {
  const linhas = Object.values(porKind).reduce((a, arr) => a + arr.length, 0);
  const erros = Object.values(errosPorKind).reduce((a, arr) => a + arr.length, 0);
  return { linhas, erros };
}
