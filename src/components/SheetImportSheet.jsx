import { useState, useRef } from 'react';
import { useTrip } from '../store/TripProvider.jsx';
import { ESQUEMA, validarAba, mesclarPlanilha, kindPorAba } from '../domain/sheet.js';
import { baixarPlanilha, lerPlanilha, lerTextoColado } from '../lib/sheetFile.js';
import { mainCities } from '../domain/dates.js';
import { track } from '../lib/analytics.js';
import { logError } from '../lib/logger.js';
import { Sheet, Row, Banner, Field, useToast } from './ui.jsx';

/**
 * Importação e exportação por planilha.
 *
 * Duas entradas para o mesmo núcleo de validação: arquivo .xlsx (fluxo completo,
 * melhor no desktop) e colar células (rápido, funciona no celular).
 *
 * A PRÉVIA é obrigatória: nada é aplicado sem o usuário ver quantas linhas serão
 * criadas, quantas atualizadas e quais têm erro — com linha e coluna. Sem isso,
 * um erro de digitação numa data corromperia a viagem em silêncio.
 */
export default function SheetImportSheet({ onClose }) {
  const { state, actions } = useTrip();
  const notify = useToast();
  const fileRef = useRef(null);

  const [modo, setModo] = useState('inicio');   // inicio | colar | previa
  const [aba, setAba] = useState('cities');
  const [texto, setTexto] = useState('');
  const [previa, setPrevia] = useState(null);   // { porKind, erros, resumo }
  const [ocupado, setOcupado] = useState(false);

  const nomeArquivo = (sufixo) => {
    const cidade = (mainCities(state)[0] || 'viagem').replace(/\s+/g, '-');
    return `planilha-${cidade}-${sufixo}.xlsx`;
  };

  const baixarModelo = async () => {
    setOcupado(true);
    try {
      await baixarPlanilha(null, nomeArquivo('modelo'));
      track('sheet_template_downloaded');
    } catch (e) { logError('baixarModelo', e); notify('Não foi possível gerar o modelo.', 'error'); }
    finally { setOcupado(false); }
  };

  const exportarAtual = async () => {
    setOcupado(true);
    try {
      await baixarPlanilha(state, nomeArquivo('dados'));
      track('sheet_exported');
    } catch (e) { logError('exportarPlanilha', e); notify('Não foi possível exportar.', 'error'); }
    finally { setOcupado(false); }
  };

  /** Roda a validação e monta a prévia — nunca aplica direto. */
  const preparar = (matrizesPorKind) => {
    const porKind = {};
    const erros = {};
    Object.entries(matrizesPorKind).forEach(([kind, matriz]) => {
      const r = validarAba(kind, matriz);
      if (r.itens.length) porKind[kind] = r.itens;
      if (r.erros.length) erros[kind] = r.erros;
    });

    const simulado = mesclarPlanilha(state, porKind);
    setPrevia({ porKind, erros, resumo: simulado.resumo });
    setModo('previa');
  };

  const escolherArquivo = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    setOcupado(true);
    try {
      const matrizes = await lerPlanilha(file);
      if (Object.keys(matrizes).length === 0) {
        notify('Nenhuma aba reconhecida. Use o modelo do app.', 'error');
        return;
      }
      preparar(matrizes);
      track('sheet_file_read');
    } catch (e) {
      logError('lerPlanilha', e);
      notify('Não foi possível ler o arquivo.', 'error');
    } finally { setOcupado(false); }
  };

  const prepararColado = () => {
    const matriz = lerTextoColado(texto);
    if (matriz.length < 2) {
      notify('Cole o cabeçalho e ao menos uma linha.', 'error');
      return;
    }
    preparar({ [aba]: matriz });
    track('sheet_pasted');
  };

  const aplicar = () => {
    const { state: novo, resumo } = mesclarPlanilha(state, previa.porKind);
    actions.replaceState(novo);
    const criados = Object.values(resumo).reduce((a, r) => a + r.criados, 0);
    const atualizados = Object.values(resumo).reduce((a, r) => a + r.atualizados, 0);
    track('sheet_imported', { count: criados + atualizados });
    notify(`${criados} criado(s) e ${atualizados} atualizado(s).`);
    onClose();
  };

  const totalErros = previa ? Object.values(previa.erros).reduce((a, e) => a + e.length, 0) : 0;
  const totalItens = previa ? Object.values(previa.porKind).reduce((a, i) => a + i.length, 0) : 0;

  return (
    <Sheet title="Planilha" onClose={onClose}>
      <div className="stack">
        {modo === 'inicio' && (
          <>
            <p className="small t2" style={{ margin: 0 }}>
              Monte a viagem numa planilha e traga tudo de uma vez — ou exporte, edite em massa e
              reimporte.
            </p>

            <Banner kind="info">
              A planilha <b>nunca apaga</b>: ela cria e atualiza. Itens que existem no app e não
              estão na planilha continuam intactos.
            </Banner>

            <div className="card card-flush">
              <Row icon="⬇️" title="Baixar modelo em branco" sub="Abas por tipo, com instruções"
                value={<button className="btn-sm" onClick={baixarModelo} disabled={ocupado}>Baixar</button>} />
              <Row icon="📤" title="Exportar dados atuais" sub="Mesmo formato — edite e reimporte"
                value={<button className="btn-sm" onClick={exportarAtual} disabled={ocupado}>Exportar</button>} />
              <Row icon="📥" title="Enviar planilha preenchida" sub="Arquivo .xlsx"
                value={<button className="btn-primary btn-sm" onClick={() => fileRef.current.click()} disabled={ocupado}>Enviar</button>} />
              <Row icon="📋" title="Colar da planilha" sub="Copie as células e cole aqui"
                value={<button className="btn-sm" onClick={() => setModo('colar')}>Colar</button>} />
            </div>

            <p className="tiny t3" style={{ margin: 0 }}>
              Datas devem estar no formato <b>AAAA-MM-DD</b>. Formatos como 01/06/2026 são recusados,
              porque o Excel os interpreta de forma diferente conforme o idioma do computador.
            </p>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }}
              onChange={escolherArquivo}
            />
          </>
        )}

        {modo === 'colar' && (
          <>
            <Field label="Qual tipo de informação?">
              <select value={aba} onChange={(e) => setAba(e.target.value)}>
                {Object.entries(ESQUEMA).map(([kind, def]) => (
                  <option key={kind} value={kind}>{def.aba}</option>
                ))}
              </select>
            </Field>

            <p className="tiny t3" style={{ margin: 0 }}>
              Cole incluindo a <b>linha de cabeçalho</b>. Colunas esperadas:{' '}
              {ESQUEMA[aba].colunas.map((c) => c.col).join(', ')}.
            </p>

            <Field label="Cole aqui">
              <textarea
                rows={8}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={ESQUEMA[aba].colunas.map((c) => c.col).join('\t')}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            </Field>

            <div className="sheet-footer stack-2">
              <button className="btn-primary btn-block" onClick={prepararColado}>Conferir</button>
              <button className="btn-ghost btn-block" onClick={() => setModo('inicio')}>Voltar</button>
            </div>
          </>
        )}

        {modo === 'previa' && previa && (
          <>
            <h3 style={{ margin: 0 }}>Conferência</h3>

            {totalErros > 0 && (
              <Banner kind="warn">
                <b>{totalErros} linha(s) com problema</b> serão ignoradas. Corrija na planilha e
                envie de novo, ou aplique só as válidas.
              </Banner>
            )}

            {totalItens === 0 ? (
              <Banner kind="danger">Nenhuma linha válida para importar.</Banner>
            ) : (
              <div className="card card-flush">
                {Object.entries(previa.resumo).map(([kind, r]) => (
                  (r.criados || r.atualizados) ? (
                    <Row
                      key={kind}
                      icon="📄"
                      title={ESQUEMA[kind].aba}
                      sub={`${r.criados} a criar · ${r.atualizados} a atualizar`}
                    />
                  ) : null
                ))}
              </div>
            )}

            {totalErros > 0 && (
              <div className="card card-flush">
                {Object.entries(previa.erros).map(([kind, lista]) =>
                  lista.slice(0, 12).map((e, i) => (
                    <Row
                      key={`${kind}-${i}`}
                      icon="⚠️"
                      title={`${ESQUEMA[kind]?.aba || kind} · linha ${e.linha}`}
                      sub={`coluna "${e.coluna}": ${e.mensagem}`}
                    />
                  ))
                )}
              </div>
            )}

            <div className="sheet-footer stack-2">
              <button className="btn-primary btn-block" onClick={aplicar} disabled={totalItens === 0}>
                Aplicar à viagem
              </button>
              <button className="btn-ghost btn-block" onClick={() => { setPrevia(null); setModo('inicio'); }}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
