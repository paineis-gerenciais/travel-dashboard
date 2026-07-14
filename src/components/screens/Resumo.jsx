import { useTrip } from '../../store/TripProvider.jsx';
import { money, fmtDate, num } from '../../domain/format.js';
import { totals, checklistStats, paidPct } from '../../domain/costs.js';
import { allPlanningDates, uniqueCities } from '../../domain/dates.js';
import { SUBTITLES } from '../../domain/state.js';
import { Kpi } from '../ui.jsx';
import ActivityFeed from '../ActivityFeed.jsx';

export default function Resumo({ userEmail, tripId }) {
  const { state, actions } = useTrip();
  const t = totals(state);
  const dates = allPlanningDates(state);
  const cs = checklistStats(state);
  const trav = Math.max(1, num(state.settings.travelers) || 1);

  return (
    <section>
      <h2>Resumo</h2>
      <div className="grid grid4">
        <Kpi label="Dias" value={dates.length} />
        <Kpi label="Cidades únicas" value={uniqueCities(state).length} />
        <Kpi label="Custo total" value={money(t.total)} />
        <Kpi label="Custo por pessoa" value={money(t.total / trav)} />
      </div>
      <br />
      <div className="grid grid2">
        <div className="card">
          <h3>Configurações rápidas</h3>
          <label>
            Número de viajantes
            <input
              type="number"
              min="1"
              value={trav}
              onChange={(e) => actions.setTravelers(e.target.value)}
            />
          </label>
          <br />
          <button className="small-btn ghost" onClick={() => actions.regenerateTitle()}>
            Regerar título automático
          </button>{' '}
          <button
            className="small-btn ghost"
            onClick={() => actions.setSubtitle(SUBTITLES[Math.floor(Math.random() * SUBTITLES.length)])}
          >
            Nova frase
          </button>
          <p className="hint" style={{ marginTop: 10 }}>
            🔒 Seus dados ficam na sua conta, salvos automaticamente na nuvem (Firestore) e
            disponíveis offline neste dispositivo.{' '}
            {userEmail ? `Conectado como ${userEmail}.` : ''}
          </p>
        </div>
        <div className="card">
          <h3>Status geral</h3>
          <p>
            <b>Média por dia:</b> {money(t.total / (dates.length || 1))}
          </p>
          <p>
            <b>Média por pessoa/dia:</b> {money(t.total / (trav * (dates.length || 1)))}
          </p>
          <p>
            <b>Checklist:</b> {cs.pct}% concluído ({cs.done}/{cs.active})
          </p>
          <p>
            <b>Itens pagos:</b> {paidPct(state)}%
          </p>
        </div>
      </div>
      <br />
      <div className="card">
        <h3>Resumo do roteiro</h3>
        {dates.length ? (
          <p>
            A viagem passa por <b>{uniqueCities(state).join(', ')}</b>, de{' '}
            {fmtDate(dates[0].date)} a {fmtDate(dates.at(-1).date)}, com custo estimado de{' '}
            <b>{money(t.total)}</b>.
          </p>
        ) : (
          <p className="empty">
            Comece cadastrando uma cidade na tela Cidades. Após cadastrar datas, as demais telas
            serão geradas automaticamente.
          </p>
        )}
      </div>
      <br />
      <ActivityFeed tripId={tripId} />
    </section>
  );
}
