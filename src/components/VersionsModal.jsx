import { useState, useEffect } from 'react';
import { useTrip } from '../store/TripProvider.jsx';
import { money } from '../domain/format.js';
import { totals } from '../domain/costs.js';
import { allPlanningDates, mainCities } from '../domain/dates.js';
import { listVersions, saveNewVersion, overwriteVersion, loadVersion, deleteVersion } from '../lib/tripData.js';

export default function VersionsModal({ tripId, onClose }) {
  const { state, actions } = useTrip();
  const [versions, setVersions] = useState([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmOverwrite, setConfirmOverwrite] = useState(null);

  const meta = () => {
    const t = totals(state);
    return {
      city: mainCities(state).join(', ') || '-',
      days: allPlanningDates(state).length,
      total: t.total,
      dateText: new Date().toLocaleString('pt-BR'),
    };
  };

  const refresh = async () => {
    try { setVersions(await listVersions(tripId)); }
    catch (e) { setError('Não foi possível carregar as versões: ' + e.message); }
  };
  useEffect(() => { refresh(); }, [tripId]);

  const doSaveNew = async () => {
    if (!name.trim()) { setError('Dê um nome à versão antes de salvar.'); return; }
    setBusy(true); setError('');
    try {
      await saveNewVersion(tripId, { name: name.trim(), ...meta() }, state);
      setName('');
      await refresh();
    } catch (e) { setError('Falha ao salvar: ' + e.message); }
    finally { setBusy(false); }
  };

  const doOverwrite = async (v) => {
    setBusy(true); setError('');
    try {
      await overwriteVersion(tripId, v.id, { name: v.name, ...meta() }, state);
      setConfirmOverwrite(null);
      await refresh();
    } catch (e) { setError('Falha ao sobrescrever: ' + e.message); }
    finally { setBusy(false); }
  };

  const doLoad = async (id) => {
    setBusy(true);
    try { actions.replaceState(await loadVersion(tripId, id)); onClose(); }
    catch (e) { setError('Falha ao carregar: ' + e.message); }
    finally { setBusy(false); }
  };

  const doDelete = async (id) => {
    setBusy(true);
    try { await deleteVersion(tripId, id); await refresh(); }
    catch (e) { setError('Falha ao excluir: ' + e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Versões salvas</h3>
          <button className="ghost" onClick={onClose}>Fechar</button>
        </div>
        <div className="toolbar">
          <input className="wide" placeholder="Nome da nova versão" value={name} onChange={(e) => setName(e.target.value)} />
          <button onClick={doSaveNew} disabled={busy}>Salvar nova versão</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {versions.length === 0 ? (
          <p className="empty">Nenhuma versão salva ainda. Dê um nome acima e salve a primeira.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nome</th><th>Data</th><th>Cidade</th><th>Dias</th><th>Total</th><th></th></tr></thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td data-label="Nome">{v.name}</td>
                    <td data-label="Data">{v.dateText}</td>
                    <td data-label="Cidade">{v.city}</td>
                    <td data-label="Dias">{v.days}</td>
                    <td data-label="Total">{money(v.total)}</td>
                    <td>
                      <button className="small-btn" onClick={() => doLoad(v.id)} disabled={busy}>Carregar</button>{' '}
                      <button className="small-btn ghost" onClick={() => setConfirmOverwrite(v)} disabled={busy}>Sobrescrever</button>{' '}
                      <button className="small-btn danger" onClick={() => doDelete(v.id)} disabled={busy}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {confirmOverwrite && (
          <div className="modal-backdrop" onClick={() => setConfirmOverwrite(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
              <div className="modal-head">
                <h3>Sobrescrever versão</h3>
                <button className="ghost" onClick={() => setConfirmOverwrite(null)}>Fechar</button>
              </div>
              <p>
                Substituir o conteúdo de <b>{confirmOverwrite.name}</b> pelo estado atual da viagem?
                O conteúdo anterior dessa versão será perdido.
              </p>
              <div className="toolbar">
                <button onClick={() => doOverwrite(confirmOverwrite)} disabled={busy}>Sobrescrever</button>
                <button className="ghost" onClick={() => setConfirmOverwrite(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
