import { useState, useRef } from 'react';
import { useTrip } from '../../store/TripProvider.jsx';
import { useTrips } from '../../store/TripsProvider.jsx';
import { money, fmtDate, num } from '../../domain/format.js';
import { totals, checklistStats } from '../../domain/costs.js';
import { allPlanningDates, uniqueCities, mainCities } from '../../domain/dates.js';
import { normalizeState } from '../../domain/state.js';
import { logError } from '../../lib/logger.js';
import { Row, Sheet, Metric, EmptyState, StatusChip, CHECKLIST_STATUS } from '../ui.jsx';
import VersionsModal from '../VersionsModal.jsx';
import ShareModal from '../ShareModal.jsx';
import DiagnosticsModal from '../DiagnosticsModal.jsx';
import ActivityFeed from '../ActivityFeed.jsx';

/**
 * MAIS — resumo da viagem, checklist e todas as ações que antes viviam num menu
 * de 16 botões. Tudo alcançável em no máximo 2 toques. (Fase R2.)
 */
export default function Mais({ user, tripId, theme, toggleTheme, onLogout }) {
  const { state, actions } = useTrip();
  const { activeTripId, trips, actions: tripsActions } = useTrips();
  const [sheet, setSheet] = useState(null);
  const fileRef = useRef(null);

  const t = totals(state);
  const dates = allPlanningDates(state);
  const cs = checklistStats(state);
  const trav = Math.max(1, num(state.settings.travelers) || 1);
  const activeTrip = trips.find((x) => x.id === activeTripId);
  const isOwner = activeTrip ? activeTrip.ownerId === user.uid : true;

  const exportJSON = () => {
    try {
      const cityName = (mainCities(state)[0] || 'viagem').replace(/\s+/g, '-');
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `dados-viagem-${cityName}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } catch (e) { logError('exportJSON', e); }
  };

  const importJSON = (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || !Array.isArray(obj.cities)) throw new Error('Estrutura inválida');
        if (confirm('Importar dados e substituir o conteúdo desta viagem?')) {
          actions.replaceState(normalizeState(obj));
        }
      } catch (e) { logError('importJSON', e); alert('Arquivo JSON inválido.'); }
    };
    reader.readAsText(file);
    ev.target.value = '';
  };

  return (
    <div className="screen">
      <div className="container stack">
        <h2>Mais</h2>

        {dates.length > 0 && (
          <>
            <div className="grid-2">
              <Metric label="Dias" value={dates.length} />
              <Metric label="Cidades" value={uniqueCities(state).length} />
              <Metric label="Total" value={money(t.total)} />
              <Metric label="Por pessoa" value={money(t.total / trav)} />
            </div>
            <div className="card">
              <p style={{ margin: 0 }}>
                A viagem passa por <b>{uniqueCities(state).join(', ')}</b>, de{' '}
                {fmtDate(dates[0].date)} a {fmtDate(dates.at(-1).date)}.
              </p>
            </div>
          </>
        )}

        <ActivityFeed tripId={tripId} />

        <div className="card card-flush">
          <Row icon="✅" title="Checklist" sub={`${cs.done} de ${cs.total} concluídos`}
            value={<button className="btn-ghost btn-sm" onClick={() => setSheet('checklist')}>Abrir →</button>} />
          <Row icon="🤝" title="Compartilhar" sub="Convidar pessoas para a viagem"
            value={<button className="btn-ghost btn-sm" onClick={() => setSheet('share')}>Abrir →</button>} />
          <Row icon="🗂️" title="Versões salvas" sub="Guardar ou voltar a um ponto anterior"
            value={<button className="btn-ghost btn-sm" onClick={() => setSheet('versions')}>Abrir →</button>} />
        </div>

        <div className="card card-flush">
          <Row icon="🎨" title="Tema" sub={theme === 'dark' ? 'Escuro' : 'Claro'}
            value={<button className="btn-ghost btn-sm" onClick={toggleTheme}>Alternar</button>} />
          <Row icon="🖨️" title="Imprimir" sub="Gerar uma versão para papel ou PDF"
            value={<button className="btn-ghost btn-sm" onClick={() => window.print()}>Imprimir</button>} />
          <Row icon="⬇️" title="Exportar JSON" sub="Baixar os dados desta viagem"
            value={<button className="btn-ghost btn-sm" onClick={exportJSON}>Exportar</button>} />
          <Row icon="⬆️" title="Importar JSON" sub="Substituir o conteúdo por um arquivo"
            value={<button className="btn-ghost btn-sm" onClick={() => fileRef.current.click()}>Importar</button>} />
          <Row icon="🩺" title="Diagnóstico" sub="Erros registrados nesta sessão"
            value={<button className="btn-ghost btn-sm" onClick={() => setSheet('diag')}>Abrir →</button>} />
        </div>

        <div className="card card-flush">
          <Row icon="🧳" title="Minhas viagens" sub="Trocar de viagem"
            value={<button className="btn-ghost btn-sm" onClick={() => tripsActions.closeTrip()}>Trocar</button>} />
          <Row icon="🚪" title="Sair" sub={user?.email}
            value={<button className="btn-ghost btn-sm" onClick={onLogout}>Sair</button>} />
        </div>

        <div className="card card-flush">
          <Row icon="🧹" title="Limpar viagem" sub="Apaga o conteúdo desta viagem. As versões salvas ficam."
            value={<button className="btn-danger btn-sm" onClick={() => setSheet('clear')}>Limpar</button>} />
        </div>

        <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={importJSON} />
      </div>

      {sheet === 'checklist' && <ChecklistSheet onClose={() => setSheet(null)} />}
      {sheet === 'share' && (
        <Sheet title="Compartilhar" onClose={() => setSheet(null)}>
          <ShareModal tripId={activeTripId} tripName={activeTrip?.name || 'Viagem'} user={user} isOwner={isOwner} />
        </Sheet>
      )}
      {sheet === 'versions' && (
        <Sheet title="Versões salvas" onClose={() => setSheet(null)}>
          <VersionsModal tripId={activeTripId} onClose={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet === 'diag' && (
        <Sheet title="Diagnóstico" onClose={() => setSheet(null)}>
          <DiagnosticsModal />
        </Sheet>
      )}
      {sheet === 'clear' && (
        <Sheet title="Limpar viagem" onClose={() => setSheet(null)}>
          <p>
            Isso apaga o conteúdo atual desta viagem (cidades, custos, checklist). As
            <b> versões salvas continuam intactas</b> e as outras viagens não são afetadas.
          </p>
          <div className="stack-2">
            <button className="btn-danger btn-block" onClick={() => { actions.clearCurrent(); setSheet(null); }}>
              Limpar esta viagem
            </button>
            <button className="btn-ghost btn-block" onClick={() => setSheet(null)}>Cancelar</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function ChecklistSheet({ onClose }) {
  const { state, actions } = useTrip();
  const [item, setItem] = useState('');
  const cs = checklistStats(state);

  const add = () => {
    if (!item.trim()) return;
    actions.addChecklist(item.trim());
    setItem('');
  };

  return (
    <Sheet title={`Checklist · ${cs.done}/${cs.total}`} onClose={onClose}>
      <div className="stack">
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <input placeholder="Novo item" value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="btn-primary" onClick={add}>Add</button>
        </div>

        {state.checklist.length === 0 ? (
          <EmptyState
            title="Checklist vazio"
            action={<button className="btn-primary" onClick={() => actions.seedChecklist()}>Usar lista sugerida</button>}
          >
            Adicione itens acima, ou comece de uma lista pronta com o essencial de viagem.
          </EmptyState>
        ) : (
          <div className="card card-flush">
            {state.checklist.map((c, i) => (
              <div className="row" key={c.id}>
                <input
                  type="checkbox"
                  checked={!!c.done}
                  aria-label={c.item}
                  onChange={(e) => actions.toggleChecklist(i, e.target.checked)}
                />
                <div className="row-main">
                  <input
                    value={c.item}
                    onChange={(e) => actions.updateItem('checklist', i, 'item', e.target.value)}
                    style={{ border: 0, padding: 0, minHeight: 0, fontWeight: 600, textDecoration: c.done ? 'line-through' : 'none' }}
                  />
                  <div className="row-actions">
                    <StatusChip value={c.status} options={CHECKLIST_STATUS} onChange={(v) => actions.updateItem('checklist', i, 'status', v)} />
                    <button className="btn-ghost btn-sm" onClick={() => actions.deleteItem('checklist', i)}>Excluir</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
