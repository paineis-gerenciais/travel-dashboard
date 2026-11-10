// Regressão do #41 (reteste de QA, R1): a planilha .xlsx gerada pelo script da
// skill não pode apagar campos numa atualização por id. O teste percorre o mesmo
// caminho do app: script → .xlsx → leitura como em lerPlanilha → validarAba →
// mesclarPlanilha. Dados fictícios; arquivos só na pasta temporária do sistema.
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import XLSX from 'xlsx';
import { kindPorAba, validarAba, mesclarPlanilha } from '../sheet.js';

const SCRIPT = resolve(__dirname, '../../../.claude/skills/roteiro-viagem/scripts/validar-importacao.mjs');
const pasta = mkdtempSync(join(tmpdir(), 'skill-planilha-'));
afterAll(() => rmSync(pasta, { recursive: true, force: true }));

function rodar(nome, abas) {
  const json = join(pasta, `${nome}.json`);
  const xlsx = join(pasta, `${nome}.xlsx`);
  writeFileSync(json, JSON.stringify({ formato: 'planilha-viagem', versao: 1, abas }));
  const r = spawnSync(process.execPath, [SCRIPT, json, '--xlsx', xlsx], { encoding: 'utf8' });
  return { codigo: r.status, saida: `${r.stdout}${r.stderr}`, xlsx };
}

/** Lê o .xlsx como o app (lerPlanilha) e devolve itens validados por kind. */
function lerComoApp(arquivo) {
  const wb = XLSX.read(readFileSync(arquivo), { cellDates: true });
  const porKind = {};
  const cabecalhos = {};
  wb.SheetNames.forEach((nome) => {
    const kind = kindPorAba(nome);
    if (!kind) return;
    const matriz = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, blankrows: false, defval: '' });
    cabecalhos[kind] = matriz[0];
    const { itens, erros } = validarAba(kind, matriz);
    expect(erros).toEqual([]);
    porKind[kind] = itens;
  });
  return { porKind, cabecalhos };
}

const viagem = () => ({
  cities: [{ id: 'c1', city: 'Lisboa', start: '2030-06-10', end: '2030-06-13', hotel: 'Hotel Exemplo', nightly: 650, breakfastIncluded: true, status: 'Reservado', notes: 'quarto duplo' }],
  attractions: [{ id: 'a1', date: '2030-06-11', time: '10:00', name: 'Museu', cost: 90, status: 'Pago' }],
});

describe('planilha gerada pelo script da skill', () => {
  it('atualização parcial por id muda só o que veio e preserva o resto', () => {
    const r = rodar('parcial', {
      Cidades: [{ id: 'c1', cidade: 'Lisboa', check_in: '2030-06-10', check_out: '2030-06-13', custo_diaria: 700 }],
      Atracoes: [{ id: 'a1', data: '2030-06-11', nome: 'Museu', custo: 95 }],
    });
    expect(r.codigo).toBe(0);
    const { porKind, cabecalhos } = lerComoApp(r.xlsx);
    expect(cabecalhos.cities).toEqual(['id', 'cidade', 'check_in', 'check_out', 'custo_diaria']);
    const { state } = mesclarPlanilha(viagem(), porKind);
    expect(state.cities[0]).toMatchObject({ nightly: 700, hotel: 'Hotel Exemplo', breakfastIncluded: true, status: 'Reservado', notes: 'quarto duplo' });
    expect(state.attractions[0]).toMatchObject({ cost: 95, time: '10:00', status: 'Pago' });
  });

  it('recusa gerar a planilha quando uma linha com id ficaria com célula vazia', () => {
    const r = rodar('misto', {
      Cidades: [
        { id: 'c1', cidade: 'Lisboa', check_in: '2030-06-10', check_out: '2030-06-13', custo_diaria: 700 },
        { id: 'c2', cidade: 'Porto', check_in: '2030-06-13', check_out: '2030-06-16', hospedagem: 'Pousada Exemplo' },
      ],
    });
    expect(r.codigo).toBe(1);
    expect(r.saida).toContain('a planilha não foi gerada');
    expect(r.saida).toContain('Cidades · linha 2 (id "c1"): sem "hospedagem"');
    expect(r.saida).toContain('Cidades · linha 3 (id "c2"): sem "custo_diaria"');
    expect(existsSync(r.xlsx)).toBe(false);
  });

  it('itens novos com colunas diferentes geram a planilha e nascem com os padrões', () => {
    const r = rodar('novos', {
      Cidades: [
        { cidade: 'Lisboa', check_in: '2030-06-10', check_out: '2030-06-13', custo_diaria: 650 },
        { cidade: 'Porto', check_in: '2030-06-13', check_out: '2030-06-16', hospedagem: 'Pousada Exemplo' },
      ],
    });
    expect(r.codigo).toBe(0);
    const { porKind } = lerComoApp(r.xlsx);
    expect(porKind.cities.map((c) => [c.city, c.status, c.nightly, c.hotel])).toEqual([
      ['Lisboa', 'Planejado', 650, ''],
      ['Porto', 'Planejado', 0, 'Pousada Exemplo'],
    ]);
  });
});
