import { useTrip } from '../../store/TripProvider.jsx';
import { fmtDate } from '../../domain/format.js';
import { allPlanningDates, inferCityForDate, periodByTime, tripDayFlow } from '../../domain/dates.js';
import { minutesToLabel } from '../../domain/transport.js';
import {
  getTransportDate,
  getTransportOrigin,
  getTransportDest,
  getTransportMode,
  getTransportDurationMinutes,
} from '../../domain/transport.js';

function dayItems(state, date) {
  const foods = state.foodItems.filter((x) => x.date === date && x.place);
  const attrs = state.attractions.filter((x) => x.date === date && x.name);
  const others = state.otherExpenses.filter((x) => x.date === date && x.name);
  const trans = state.transports.filter((x) => getTransportDate(x) === date);
  return { foods, attrs, others, trans };
}

export default function Roteiro({ onNavigate }) {
  const { state } = useTrip();
  const dates = allPlanningDates(state);

  return (
    <section>
      <h2>Roteiro</h2>
      <p className="hint">
        Consolidado automático sem valores, organizado por período, incluindo transportes,
        alimentação, atrações, hospedagem e outros registros.
      </p>
      {dates.length === 0 ? (
        <p className="empty">Cadastre cidades ou transportes para gerar o roteiro.</p>
      ) : (
        dates.map((d) => {
          const { foods, attrs, others, trans } = dayItems(state, d.date);
          const city = d.city || inferCityForDate(state, d.date) || '';
          const flow = tripDayFlow(state, d.date);
          const flowLabel = flow.from && flow.to && flow.from !== flow.to
            ? `${flow.from} → ${flow.to}`
            : (city || flow.to || flow.from);
          return (
            <div className="route-day" key={d.date}>
              <h3>
                {fmtDate(d.date)} — {flowLabel}
              </h3>
              <div className="route-grid">
                <div className="route-box">
                  <h4><button className="linkbtn ghost small-btn" onClick={() => onNavigate && onNavigate('transporte')}>Transporte ✎</button></h4>
                  {trans.length
                    ? trans.map((x) => (
                        <div key={x.id}>
                          {x.time} {getTransportMode(x)}{getTransportDurationMinutes(x) ? ` (${minutesToLabel(getTransportDurationMinutes(x))})` : ''}: {getTransportOrigin(x)} → {getTransportDest(x)}
                        </div>
                      ))
                    : <span className="muted">—</span>}
                </div>
                <div className="route-box">
                  <h4><button className="linkbtn ghost small-btn" onClick={() => onNavigate && onNavigate('alimentacao')}>Alimentação ✎</button></h4>
                  {foods.length
                    ? foods.map((x) => <div key={x.id}>{x.type}: {x.place}</div>)
                    : <span className="muted">—</span>}
                </div>
                <div className="route-box">
                  <h4><button className="linkbtn ghost small-btn" onClick={() => onNavigate && onNavigate('atracoes')}>Atrações ✎</button></h4>
                  {attrs.length
                    ? attrs.map((x) => <div key={x.id}>{periodByTime(x.time)}: {x.name}</div>)
                    : <span className="muted">—</span>}
                </div>
                <div className="route-box">
                  <h4><button className="linkbtn ghost small-btn" onClick={() => onNavigate && onNavigate('outras')}>Outros ✎</button></h4>
                  {others.length
                    ? others.map((x) => <div key={x.id}>{x.name}</div>)
                    : <span className="muted">—</span>}
                </div>
                <div className="route-box">
                  <h4><button className="linkbtn ghost small-btn" onClick={() => onNavigate && onNavigate('cidades')}>Hospedagem ✎</button></h4>
                  {(() => {
                    const c = state.cities.find((c) => d.date >= c.start && d.date < c.end);
                    return c && c.hotel ? <div>{c.hotel}</div> : <span className="muted">—</span>;
                  })()}
                </div>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
