import { useState, useEffect } from 'react';
import { useTrip } from '../store/TripProvider.jsx';
import { money } from '../domain/format.js';
import { totals } from '../domain/costs.js';
import { allPlanningDates, mainCities } from '../domain/dates.js';
import { listVersions, saveNewVersion, overwriteVersion, loadVersion, deleteVersion } from '../lib/tripData.js';
import { Row, EmptyState, Sheet } from './ui.jsx';

/** Conteúdo de "versões salvas". Renderiza dentro de um Sheet (sem chrome próprio). */
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
    try { await saveNewVersion(tripId, { name: name.trim(), ...meta() }, state); setName(''); await refresh(); }
    catch (e) { setError('Falha ao salvar: ' + e.message); }
    finally { setBusy(false); }
  };

  const doOverwrite = async (v) => {
    setBusy(true); setError('');
    try { await overwriteVersion(tripId, v.id, { name: v.name, ...meta() }, state); setConfirmOverwrite(null); await refresh(); }
    catch (e) { setError('Falha ao sobrescrever: ' + e.message); }
    finally { setBusy(false); }
  };

  const doLoad = async (id) => {
    setBusy(true);
    try { actions.replaceState(await loadVersion(tripId, id)); onClose && onClose(); }
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
    <div className="stack">
      <p className="small t2" style={{ margin: 0 }}>
        Seu trabalho é salvo automaticamente. Versões são fotos que você guarda para comparar ou voltar atrás.
      </p>

      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <input placeholder="Nome da nova versão" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary" onClick={doSaveNew} disabled={busy}>Salvar</button>
      </div>

      {error && <p className="small" style={{ color: 'var(--danger)' }} role="alert">{error}</p>}

      {versions.length === 0 ? (
        <EmptyState title="Nenhuma versão salva">Dê um nome acima e salve a primeira.</EmptyState>
      ) : (
        <div className="card card-flush">
          {versions.map((v) => (
            <Row key={v.id} icon="🗂️" title={v.name} sub={`${v.dateText} · ${v.days} dias · ${money(v.total)}`}>
              <button className="btn-sm" onClick={() => doLoad(v.id)} disabled={busy}>Carregar</button>
              <button className="btn-ghost btn-sm" onClick={() => setConfirmOverwrite(v)} disabled={busy}>Sobrescrever</button>
              <button className="btn-danger btn-sm" onClick={() => doDelete(v.id)} disabled={busy}>Excluir</button>
            </Row>
          ))}
        </div>
      )}

      {confirmOverwrite && (
        <Sheet title="Sobrescrever versão" onClose={() => setConfirmOverwrite(null)}>
          <p>
            Substituir o conteúdo de <b>{confirmOverwrite.name}</b> pelo estado atual da viagem? O
            conteúdo anterior dessa versão será perdido.
          </p>
          <div className="stack-2">
            <button className="btn-danger btn-block" onClick={() => doOverwrite(confirmOverwrite)} disabled={busy}>Sobrescrever</button>
            <button className="btn-ghost btn-block" onClick={() => setConfirmOverwrite(null)}>Cancelar</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
