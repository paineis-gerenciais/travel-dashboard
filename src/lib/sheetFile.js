// lib/sheetFile.js — a ponte entre o domínio da planilha e os formatos.
//
// O SheetJS é pesado (algumas centenas de kB) e o projeto tem só 4 dependências
// — por isso ele é carregado SOB DEMANDA (`import()` dinâmico), virando um
// pedaço separado do pacote. Quem nunca abre a importação nunca baixa a
// biblioteca.
//
// O núcleo de validação e mesclagem vive em `domain/sheet.js` e não conhece
// arquivo nenhum: por isso o mesmo código serve ao XLSX e ao texto colado.
import { planilhaDe, ESQUEMA, kindPorAba } from '../domain/sheet.js';
import { STATUS_OPTIONS, CHECKLIST_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../domain/state.js';

let xlsxPromise = null;
function carregarXLSX() {
  if (!xlsxPromise) xlsxPromise = import('xlsx');
  return xlsxPromise;
}

function baixar(blob, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/** Aba de instruções — o que evita metade dos erros de preenchimento. */
function linhasDeInstrucoes() {
  return [
    ['Como preencher esta planilha'],
    [''],
    ['1. Cada aba é um tipo de informação da viagem.'],
    ['2. NÃO apague nem renomeie as abas e a linha de cabeçalho.'],
    ['3. A coluna "id" identifica a linha:'],
    ['   • id preenchido  = atualiza o item que já existe no app'],
    ['   • id em branco   = cria um item novo'],
    ['4. A planilha NUNCA apaga: itens que existem no app e não estão aqui'],
    ['   permanecem intactos. Para excluir, use o próprio app.'],
    [''],
    ['Formatos obrigatórios'],
    ['Datas', 'AAAA-MM-DD', 'ex.: 2026-06-01'],
    ['', 'Formatos como 01/06/2026 são recusados, porque o Excel os interpreta'],
    ['', 'de forma diferente conforme o idioma do computador.'],
    ['Horas', 'HH:MM', 'ex.: 09:30'],
    ['Dinheiro', 'só números', 'ex.: 1750,50'],
    ['Sim/Não', 'sim ou não'],
    [''],
    ['Valores aceitos'],
    ['status (geral)', STATUS_OPTIONS.join(' | ')],
    ['status (checklist)', CHECKLIST_STATUS_OPTIONS.join(' | ')],
    ['prioridade', PRIORITY_OPTIONS.join(' | ')],
    ['link', 'endereço https:// completo'],
  ];
}

/**
 * Gera o arquivo .xlsx. Se receber `state`, exporta os dados atuais (é a ida e
 * volta: exportar, editar em massa, reimportar). Sem `state`, gera o modelo em
 * branco, só com cabeçalhos.
 */
export async function baixarPlanilha(state, nomeArquivo) {
  const XLSX = await carregarXLSX();
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(linhasDeInstrucoes()),
    'Instruções'
  );

  const abas = state
    ? planilhaDe(state)
    : Object.entries(ESQUEMA).map(([kind, def]) => ({
        kind,
        aba: def.aba,
        linhas: [def.colunas.map((c) => c.col)],
      }));

  abas.forEach(({ aba, linhas }) => {
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    // largura de coluna razoável, para o cabeçalho não ficar cortado
    ws['!cols'] = (linhas[0] || []).map((h) => ({ wch: Math.max(12, String(h).length + 4) }));
    XLSX.utils.book_append_sheet(wb, ws, aba);
  });

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  baixar(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nomeArquivo);
}

/**
 * Lê um arquivo .xlsx e devolve `{ [kind]: matriz }`.
 * Abas desconhecidas (inclusive "Instruções") são ignoradas em silêncio.
 */
export async function lerPlanilha(file) {
  const XLSX = await carregarXLSX();
  const buf = await file.arrayBuffer();
  // `cellDates` faz o SheetJS devolver Date em vez de número de série — o
  // domínio aceita os dois, mas Date elimina a ambiguidade de fuso na origem.
  const wb = XLSX.read(buf, { cellDates: true });

  const porKind = {};
  wb.SheetNames.forEach((nome) => {
    const kind = kindPorAba(nome);
    if (!kind) return;
    const matriz = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, blankrows: false, defval: '' });
    porKind[kind] = matriz;
  });
  return porKind;
}

/**
 * Interpreta texto colado de uma planilha. Ao copiar células, Excel, Google
 * Sheets e Numbers colocam TAB entre colunas e quebra de linha entre linhas —
 * então não é preciso biblioteca nenhuma aqui.
 *
 * Aceita também vírgula e ponto e vírgula como separador, para quem cola de um
 * CSV; a escolha é pelo separador mais frequente na primeira linha.
 */
export function lerTextoColado(texto) {
  const linhas = String(texto || '').replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (linhas.length === 0) return [];

  const primeira = linhas[0];
  const contagem = { '\t': (primeira.match(/\t/g) || []).length, ';': (primeira.match(/;/g) || []).length, ',': (primeira.match(/,/g) || []).length };
  const sep = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][0]
    : '\t';

  return linhas.map((l) => l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, '$1')));
}
