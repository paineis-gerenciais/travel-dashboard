import { useState, useEffect } from 'react';
import { useTrip } from '../store/TripProvider.jsx';
import { money, fmtDate } from '../domain/format.js';
import { totals } from '../domain/costs.js';
import { allPlanningDates, mainCities } from '../domain/dates.js';
import { listVersions, saveVersion, loadVersion, deleteVersion } from '../lib/tripData.js';

export default function VersionsModal({ uid, onClose }) {
  const { state, actions } = useTrip();
  const [versions, setVersions] = useState([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      setVersions(await listVersions(uid));
    } catch (e) {
      setError('Não foi possível carregar as versões: ' + e.message);
    }
  };
  useEffect(() => {
    refresh();
  }, [uid]);

  const doSave = async () => {
    if (!name.trim()) {
      setError('Dê um nome à versão antes de salvar.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const t = totals(state);
      const dates = allPlanningDates(state);
      await saveVersion(
        uid,
        {
          name: name.trim(),
          city: mainCities(state).join(', ') || '-',
          days: dates.length,
          total: t.total,
          dateText: new Date().toLocaleString('pt-BR'),
        },
        state
      );
      setName('');
      await refresh();
    } catch (e) {
      setError('Falha ao salvar: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const doLoad = async (id) => {
    setBusy(true);
    try {
      const loaded = await loadVersion(uid, id);
      actions.replaceState(loaded);
      onClose();
    } catch (e) {
      setError('Falha ao carregar: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (id) => {
    setBusy(true);
    try {
      await deleteVersion(uid, id);
      await refresh();
    } catch (e) {
      setError('Falha ao excluir: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Versões salvas</h3>
          <button className="ghost" onClick={onClose}>Fechar</button>
        </div>
        <div className="toolbar">
          <input
            className="wide"
            placeholder="Nome da nova versão"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button onClick={doSave} disabled={busy}>Salvar versão atual</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {versions.length === 0 ? (
          <p className="empty">Nenhuma versão salva ainda. Dê um nome acima e salve a primeira.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nome</th><th>Data</th><th>Cidade</th><th>Dias</th><th>Total</th><th></th></tr>
              </thead>
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
                      <button className="small-btn danger" onClick={() => doDelete(v.id)} disabled={busy}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
