#!/usr/bin/env node
// Valida um JSON de importação com o MESMO código que o app usa na prévia
// (src/domain/sheet.js) e, se estiver tudo certo, gera a planilha .xlsx.
//
// Uso, a partir da raiz do repositório:
//   node .claude/skills/roteiro-viagem/scripts/validar-importacao.mjs <importacao.json> \
//        [--xlsx importacoes/<pasta>/importacao.xlsx] \
//        [--viagem importacoes/<pasta>/exportacao.xlsx|.json]
//
// --viagem  exportação atual da viagem (Mais → Planilha → Exportar dados atuais,
//           ou Mais → Exportar JSON). Simula a mesclagem e aponta possíveis
//           duplicatas e ids que não existem.
// --xlsx    grava a planilha só se a validação passar.
//
// Privacidade: dentro do repositório, o script só lê e grava em importacoes/
// (ignorada pelo git); a única exceção de leitura é o exemplo fictício em
// e2e/fixtures/. Fora do repositório (ex.: pasta temporária) é permitido. Os
// caminhos são comparados depois de resolver links simbólicos.
//
// Saída: 0 = pronto para importar; 1 = há erro (nada é gravado); 2 = uso incorreto.
import { readFileSync, writeFileSync, statSync, mkdirSync, realpathSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, extname, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import {
  ESQUEMA, validarAba, mesclarPlanilha, matrizesDeJson, kindPorAba, possiveisDuplicatas,
} from '../../../../src/domain/sheet.js';
import { normalizeState } from '../../../../src/domain/state.js';

const RAIZ = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../..'));
const PASTA_SAIDA = join(RAIZ, 'importacoes');
const PASTA_EXEMPLOS = join(RAIZ, 'e2e', 'fixtures');
const LIMITE_BYTES = 2 * 1024 * 1024; // o mesmo limite da tela de importação

class ErroDeUso extends Error {}

function uso(msg) {
  throw new ErroDeUso(`${msg}\nUso: node .claude/skills/roteiro-viagem/scripts/validar-importacao.mjs <importacao.json> [--xlsx <saida.xlsx>] [--viagem <exportacao.xlsx|.json>]`);
}

function lerArgs(argv) {
  const args = { entrada: null, xlsx: null, viagem: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--xlsx' || a === '--viagem') {
      if (!argv[i + 1]) uso(`${a} precisa de um caminho`);
      args[a.slice(2)] = argv[i + 1];
      i += 1;
    } else if (a.startsWith('--')) uso(`opção desconhecida: ${a}`);
    else if (!args.entrada) args.entrada = a;
    else uso(`argumento a mais: ${a}`);
  }
  if (!args.entrada) uso('informe o arquivo JSON de importação');
  return args;
}

/* ---------- Guarda de caminhos ---------- */

const dentroDe = (base, alvo) => {
  const rel = relative(base, alvo);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

/** Caminho real: resolve links simbólicos do trecho que já existe e anexa o resto. */
function caminhoReal(p) {
  let atual = resolve(p);
  const resto = [];
  while (!existsSync(atual)) {
    resto.unshift(basename(atual));
    const pai = dirname(atual);
    if (pai === atual) break;
    atual = pai;
  }
  return join(realpathSync(atual), ...resto);
}

/** Recusa caminho dentro do repositório que não esteja em importacoes/ (ou nos exemplos, para leitura). */
function conferirCaminho(p, { leitura }) {
  const real = caminhoReal(p);
  if (real !== RAIZ && !dentroDe(RAIZ, real)) return real; // fora do repositório
  if (dentroDe(PASTA_SAIDA, real)) return real;
  if (leitura && dentroDe(PASTA_EXEMPLOS, real)) return real;
  const onde = relative(RAIZ, real) || '.';
  throw new Error(leitura
    ? `${p} está no repositório fora de importacoes/ (${onde}). Mova o arquivo para importacoes/, que o git ignora.`
    : `grave dentro de importacoes/ (ignorada pelo git), não em ${onde}`);
}

/* ---------- Leitura ---------- */

function lerJson(caminho) {
  const tamanho = statSync(caminho).size;
  if (tamanho > LIMITE_BYTES) throw new Error(`${caminho} tem ${tamanho} bytes; o app recusa acima de 2 MB`);
  return JSON.parse(readFileSync(caminho, 'utf8').replace(/^﻿/, ''));
}

/** Valida matrizes por kind; devolve itens e erros. */
function validarTudo(matrizes) {
  const porKind = {};
  const errosPorKind = {};
  Object.entries(matrizes).forEach(([kind, matriz]) => {
    const r = validarAba(kind, matriz);
    if (r.itens.length) porKind[kind] = r.itens;
    if (r.erros.length) errosPorKind[kind] = r.erros;
  });
  return { porKind, errosPorKind };
}

/** Lê a exportação da viagem (.xlsx do app, JSON de cópia de segurança ou JSON de importação). */
function lerViagem(caminho) {
  const ext = extname(caminho).toLowerCase();
  if (ext === '.xlsx' || ext === '.xlsm') {
    const wb = XLSX.read(readFileSync(caminho), { cellDates: true });
    const matrizes = {};
    wb.SheetNames.forEach((nome) => {
      const kind = kindPorAba(nome);
      if (kind) matrizes[kind] = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, blankrows: false, defval: '' });
    });
    return validarTudo(matrizes).porKind;
  }
  const obj = lerJson(caminho);
  if (obj && Array.isArray(obj.cities)) return normalizeState(obj); // cópia de segurança
  const { matrizes, erro } = matrizesDeJson(obj);
  if (erro) throw new Error(`exportação não reconhecida: ${erro}`);
  return validarTudo(matrizes).porKind;
}

/* ---------- Avisos e erros extras ---------- */

/** Avisos de qualidade: não impedem a importação, mas a skill deve tratá-los. */
function avisosDeQualidade(porKind) {
  const avisos = [];
  const add = (kind, linha, msg) => avisos.push(`${ESQUEMA[kind].aba} · linha ${linha}: ${msg}`);
  Object.entries(porKind).forEach(([kind, itens]) => {
    itens.forEach((x) => {
      if (!x.id && x.status && x.status !== 'Planejado' && kind !== 'checklist') add(kind, x._linha, `status "${x.status}" num item novo; itens pesquisados entram como "Planejado"`);
      if (!x.id && ['cities', 'transports', 'attractions', 'otherExpenses', 'foodItems'].includes(kind)) {
        const custo = kind === 'cities' ? x.nightly : x.cost;
        if (!custo) add(kind, x._linha, 'sem custo; se não houver fonte confiável, registre isso no relatorio.md');
      }
      if (!x.id && ['cities', 'attractions', 'transports'].includes(kind) && !x.link) add(kind, x._linha, 'sem link de fonte');
    });
  });
  return avisos;
}

/** Erros de coerência que a validação por célula não pega. */
function errosDeCoerencia(porKind) {
  const erros = [];
  (porKind.cities || []).forEach((c) => {
    if (c.start && c.end && c.end <= c.start) erros.push(`Cidades · linha ${c._linha}: check_out (${c.end}) precisa ser depois do check_in (${c.start})`);
  });
  return erros;
}

/** Compara com a viagem atual: ids inexistentes, possíveis duplicatas e o resumo da mesclagem. */
function compararComViagem(viagem, porKind) {
  const avisos = [];
  Object.entries(porKind).forEach(([kind, itens]) => {
    const ids = new Set((viagem[kind] || []).map((x) => x.id).filter(Boolean));
    itens.forEach((x) => {
      if (x.id && !ids.has(x.id)) avisos.push(`${ESQUEMA[kind].aba} · linha ${x._linha}: id "${x.id}" não existe na viagem; vai virar item novo`);
    });
  });
  possiveisDuplicatas(viagem, porKind).forEach(({ kind, linha, idExistente }) => {
    avisos.push(idExistente
      ? `${ESQUEMA[kind].aba} · linha ${linha}: parece repetir um item que já existe (id "${idExistente}"); use esse id para atualizar em vez de criar`
      : `${ESQUEMA[kind].aba} · linha ${linha}: parece repetir um item que já existe na viagem (sem id na exportação); confira antes de importar`);
  });
  const { resumo } = mesclarPlanilha(viagem, porKind);
  return { avisos, resumo };
}

/* ---------- Gravação ---------- */

/**
 * Prepara a aba da planilha sem apagar nada por engano. No JSON, coluna ausente
 * numa linha é "não enviada" e não altera o item; na planilha, que tem um
 * cabeçalho só, ela viraria célula vazia e o app a trataria como "enviada e
 * vazia" (status volta a "Planejado", hospedagem some). Por isso a aba leva só
 * id, obrigatórias e colunas com valor em alguma linha, e linha com id sem uma
 * dessas colunas impede gerar a planilha.
 */
function abaSegura(kind, matriz) {
  const def = ESQUEMA[kind];
  const [cab, ...corpo] = matriz;
  const usar = cab.map((col, i) => col === 'id'
    || def.colunas.some((c) => c.col === col && c.obrigatorio)
    || corpo.some((l) => l[i] !== undefined));
  const iId = cab.indexOf('id');
  const problemas = [];
  corpo.forEach((l, n) => {
    const id = l[iId];
    if (id === undefined || id === null || String(id).trim() === '') return; // item novo: vazio = padrão
    const faltam = cab.filter((col, i) => usar[i] && l[i] === undefined);
    if (faltam.length) problemas.push(`${def.aba} · linha ${n + 2} (id "${id}"): sem ${faltam.map((c) => `"${c}"`).join(', ')}`);
  });
  const linhas = matriz.map((l) => l.filter((_, i) => usar[i]).map((v) => (v === undefined ? '' : v)));
  return { linhas, problemas };
}

function gravarXlsx(destino, matrizes) {
  const alvo = conferirCaminho(destino, { leitura: false });
  const abas = Object.keys(ESQUEMA).filter((kind) => matrizes[kind]).map((kind) => ({ kind, ...abaSegura(kind, matrizes[kind]) }));
  const problemas = abas.flatMap((a) => a.problemas);
  if (problemas.length) {
    throw new Error([
      'a planilha não foi gerada: nestas atualizações por id, colunas que vêm em outras linhas ficariam vazias e apagariam o valor atual no app:',
      ...problemas.map((m) => `  ${m}`),
      'O importacao.json está válido e não tem esse problema: importe o .json, ou mande essas colunas em todas as linhas com id.',
    ].join('\n'));
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Gerado pela skill roteiro-viagem'],
    [`Data: ${new Date().toISOString().slice(0, 10)}`],
    ['Importe no app em Mais → Planilha → Enviar planilha preenchida. A importação cria e atualiza; nunca apaga.'],
    ['Preços são estimativas; fontes e datas estão no relatorio.md.'],
  ]), 'Leia-me');
  abas.forEach(({ kind, linhas }) => {
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws['!cols'] = linhas[0].map((h) => ({ wch: Math.max(12, String(h).length + 4) }));
    XLSX.utils.book_append_sheet(wb, ws, ESQUEMA[kind].aba);
  });
  mkdirSync(dirname(alvo), { recursive: true });
  writeFileSync(alvo, XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
  return alvo;
}

/* ---------- Principal ---------- */

function main() {
  const args = lerArgs(process.argv.slice(2));
  const entrada = conferirCaminho(args.entrada, { leitura: true });
  const viagemArq = args.viagem ? conferirCaminho(args.viagem, { leitura: true }) : null;

  let obj;
  try { obj = lerJson(entrada); } catch (e) { throw new Error(`não foi possível ler ${args.entrada}: ${e.message}`); }

  const { matrizes, ignoradas, colunasIgnoradas = [], erro } = matrizesDeJson(obj);
  if (erro) throw new Error(`arquivo recusado: ${erro}`);
  if (ignoradas.length) console.log(`Aviso: abas ignoradas (nome desconhecido ou não é lista): ${ignoradas.join(', ')}`);
  colunasIgnoradas.forEach(({ aba, coluna }) => console.log(`Aviso: ${aba}: coluna "${coluna}" desconhecida, ignorada`));
  if (!Object.keys(matrizes).length) throw new Error('nenhuma aba reconhecida');

  const { porKind, errosPorKind } = validarTudo(matrizes);
  const coerencia = errosDeCoerencia(porKind);

  console.log('Abas:');
  Object.keys(ESQUEMA).forEach((kind) => {
    if (!matrizes[kind]) return;
    const ok = (porKind[kind] || []).length;
    const ruins = (errosPorKind[kind] || []).length;
    console.log(`  ${ESQUEMA[kind].aba}: ${ok} linha(s) válida(s)${ruins ? `, ${ruins} erro(s)` : ''}`);
  });

  const totalErros = Object.values(errosPorKind).reduce((a, l) => a + l.length, 0) + coerencia.length;
  Object.entries(errosPorKind).forEach(([kind, lista]) => lista.forEach((e) => {
    console.log(`ERRO ${ESQUEMA[kind].aba} · linha ${e.linha} · coluna "${e.coluna}": ${e.mensagem}`);
  }));
  coerencia.forEach((m) => console.log(`ERRO ${m}`));
  avisosDeQualidade(porKind).forEach((m) => console.log(`Aviso: ${m}`));

  if (viagemArq) {
    let viagem;
    try { viagem = lerViagem(viagemArq); } catch (e) { throw new Error(`não foi possível ler a viagem em ${args.viagem}: ${e.message}`); }
    const { avisos, resumo } = compararComViagem(viagem, porKind);
    console.log('Simulação contra a viagem atual:');
    Object.entries(resumo).forEach(([kind, r]) => console.log(`  ${ESQUEMA[kind].aba}: ${r.criados} a criar, ${r.atualizados} a atualizar`));
    avisos.forEach((m) => console.log(`Aviso: ${m}`));
  }

  const linhas = Object.values(porKind).reduce((a, l) => a + l.length, 0);
  if (totalErros) {
    console.log(`RESULTADO: ${totalErros} erro(s). Corrija o JSON e rode de novo. Nada foi gravado.`);
    return 1;
  }
  if (!linhas) {
    console.log('RESULTADO: nenhuma linha para importar. Nada foi gravado.');
    return 1;
  }
  if (args.xlsx) console.log(`Planilha gravada em ${relative(process.cwd(), gravarXlsx(args.xlsx, matrizes)) || args.xlsx}`);
  console.log(`RESULTADO: ok, ${linhas} linha(s) em ${Object.keys(porKind).length} aba(s), pronto para importar.`);
  return 0;
}

try {
  process.exitCode = main();
} catch (e) {
  console.error(`ERRO: ${e.message}`);
  process.exitCode = e instanceof ErroDeUso ? 2 : 1;
}
