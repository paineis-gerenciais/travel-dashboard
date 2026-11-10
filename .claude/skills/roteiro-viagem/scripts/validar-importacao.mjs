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
// --xlsx    grava a planilha só se a validação passar, e só dentro de importacoes/.
//
// Saída: 0 = pronto para importar; 1 = há erro (nada é gravado); 2 = uso incorreto.
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { resolve, dirname, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import {
  ESQUEMA, validarAba, mesclarPlanilha, matrizesDeJson, kindPorAba,
} from '../../../../src/domain/sheet.js';
import { normalizeState } from '../../../../src/domain/state.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const PASTA_SAIDA = resolve(RAIZ, 'importacoes');
const LIMITE_BYTES = 2 * 1024 * 1024; // o mesmo limite da tela de importação

function uso(msg) {
  if (msg) console.error(`Erro: ${msg}`);
  console.error('Uso: node .claude/skills/roteiro-viagem/scripts/validar-importacao.mjs <importacao.json> [--xlsx <saida.xlsx>] [--viagem <exportacao.xlsx|.json>]');
  process.exit(2);
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

function lerJson(caminho) {
  const tamanho = statSync(caminho).size;
  if (tamanho > LIMITE_BYTES) throw new Error(`${caminho} tem ${tamanho} bytes; o app recusa acima de 2 MB`);
  return JSON.parse(readFileSync(caminho, 'utf8'));
}

const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Chave para achar o "mesmo item" quando a linha vem sem id. */
const CHAVE = {
  cities: (x) => norm(x.city),
  transports: (x) => [x.date, norm(x.originCity), norm(x.destCity), norm(x.mode)].join('|'),
  foodItems: (x) => [x.date, norm(x.type), norm(x.place)].join('|'),
  attractions: (x) => [x.date, norm(x.name)].join('|'),
  otherExpenses: (x) => [x.date, norm(x.name)].join('|'),
  checklist: (x) => norm(x.item),
};

/** Valida matrizes por kind; devolve itens, erros e o total de linhas. */
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

/** Avisos de qualidade: não impedem a importação, mas a skill deve tratá-los. */
function avisosDeQualidade(porKind) {
  const avisos = [];
  const add = (kind, linha, msg) => avisos.push(`${ESQUEMA[kind].aba} · linha ${linha}: ${msg}`);
  Object.entries(porKind).forEach(([kind, itens]) => {
    itens.forEach((x) => {
      if (!x.id && x.status && x.status !== 'Planejado' && kind !== 'checklist') add(kind, x._linha, `status "${x.status}" num item novo; itens pesquisados entram como "Planejado"`);
      if (['cities', 'transports', 'attractions', 'otherExpenses', 'foodItems'].includes(kind)) {
        const custo = kind === 'cities' ? x.nightly : x.cost;
        if (!custo) add(kind, x._linha, 'sem custo; se não houver fonte confiável, registre isso no relatorio.md');
      }
      if (['cities', 'attractions', 'transports'].includes(kind) && !x.link) add(kind, x._linha, 'sem link de fonte');
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

/** Compara com a viagem atual: ids inexistentes e possíveis duplicatas. */
function compararComViagem(viagem, porKind) {
  const avisos = [];
  Object.entries(porKind).forEach(([kind, itens]) => {
    const atuais = viagem[kind] || [];
    const ids = new Set(atuais.map((x) => x.id).filter(Boolean));
    const chaves = new Map(atuais.map((x) => [CHAVE[kind](x), x]));
    itens.forEach((x) => {
      const aba = ESQUEMA[kind].aba;
      if (x.id && !ids.has(x.id)) avisos.push(`${aba} · linha ${x._linha}: id "${x.id}" não existe na viagem; vai virar item novo`);
      if (!x.id) {
        const igual = chaves.get(CHAVE[kind](x));
        if (igual) {
          avisos.push(igual.id
            ? `${aba} · linha ${x._linha}: parece duplicar um item que já existe (id "${igual.id}"); use esse id para atualizar em vez de criar`
            : `${aba} · linha ${x._linha}: parece duplicar um item que já existe na viagem (sem id na exportação); confira antes de importar`);
        }
      }
    });
  });
  const { resumo } = mesclarPlanilha({ ...viagem }, porKind);
  return { avisos, resumo };
}

function gravarXlsx(destino, matrizes) {
  const alvo = resolve(destino);
  const rel = relative(RAIZ, alvo);
  const dentroDoRepo = !rel.startsWith('..') && !rel.startsWith(sep) && rel !== '';
  if (dentroDoRepo && !alvo.startsWith(PASTA_SAIDA + sep)) {
    throw new Error(`grave a planilha dentro de importacoes/ (ignorada pelo git), não em ${rel}`);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Gerado pela skill roteiro-viagem'],
    [`Data: ${new Date().toISOString().slice(0, 10)}`],
    ['Importe no app em Mais → Planilha → Enviar planilha preenchida. A importação cria e atualiza; nunca apaga.'],
    ['Preços são estimativas; fontes e datas estão no relatorio.md.'],
  ]), 'Leia-me');
  Object.keys(ESQUEMA).forEach((kind) => {
    if (!matrizes[kind]) return;
    const ws = XLSX.utils.aoa_to_sheet(matrizes[kind]);
    ws['!cols'] = matrizes[kind][0].map((h) => ({ wch: Math.max(12, String(h).length + 4) }));
    XLSX.utils.book_append_sheet(wb, ws, ESQUEMA[kind].aba);
  });
  mkdirSync(dirname(alvo), { recursive: true });
  writeFileSync(alvo, XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
  return alvo;
}

function main() {
  const args = lerArgs(process.argv.slice(2));
  let obj;
  try { obj = lerJson(args.entrada); } catch (e) { console.error(`ERRO: não foi possível ler ${args.entrada}: ${e.message}`); process.exit(1); }

  const { matrizes, ignoradas, erro } = matrizesDeJson(obj);
  if (erro) { console.error(`ERRO: arquivo recusado: ${erro}`); process.exit(1); }
  if (ignoradas.length) console.log(`Aviso: abas ignoradas (nome desconhecido ou não é lista): ${ignoradas.join(', ')}`);
  if (!Object.keys(matrizes).length) { console.error('ERRO: nenhuma aba reconhecida'); process.exit(1); }

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

  if (args.viagem) {
    try {
      const { avisos, resumo } = compararComViagem(lerViagem(args.viagem), porKind);
      console.log('Simulação contra a viagem atual:');
      Object.entries(resumo).forEach(([kind, r]) => console.log(`  ${ESQUEMA[kind].aba}: ${r.criados} a criar, ${r.atualizados} a atualizar`));
      avisos.forEach((m) => console.log(`Aviso: ${m}`));
    } catch (e) { console.error(`ERRO: não foi possível ler a viagem em ${args.viagem}: ${e.message}`); process.exit(1); }
  }

  if (totalErros) {
    console.log(`RESULTADO: ${totalErros} erro(s). Corrija o JSON e rode de novo. Nada foi gravado.`);
    process.exit(1);
  }

  if (args.xlsx) {
    try { console.log(`Planilha gravada em ${relative(process.cwd(), gravarXlsx(args.xlsx, matrizes))}`); } catch (e) { console.error(`ERRO: ${e.message}`); process.exit(1); }
  }
  const linhas = Object.values(porKind).reduce((a, l) => a + l.length, 0);
  console.log(`RESULTADO: ok, ${linhas} linha(s) em ${Object.keys(porKind).length} aba(s), pronto para importar.`);
}

main();
