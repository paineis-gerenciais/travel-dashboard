import { useState } from 'react';
import { useTrip } from '../../store/TripProvider.jsx';
import { money, num } from '../../domain/format.js';
import { daysBetween, calendarDays, mainCities, uniqueCities } from '../../domain/dates.js';
import { totals } from '../../domain/costs.js';
import { Kpi, StatusSelect } from '../ui.jsx';

export default function Cidades() {
  const { state, actions } = useTrip();
  const [confirmDelete, setConfirmDelete] = useState(null); // índice pendente de confirmação
  const totalNights = state.cities.reduce((s, c) => s + daysBetween(c.start, c.end), 0);
  const main = mainCities(state);
  const t = totals(state);

  return (
    <section>
      <h2>Cidades</h2>
      <div className="grid grid4">
        <Kpi label="Cidades únicas" value={uniqueCities(state).length} />
        <Kpi label="Total de diárias" value={totalNights} />
        <Kpi label="Cidade principal" value={main.join(', ') || '-'} />
        <Kpi label="Hospedagem total" value={money(t.lodging)} />
      </div>
      <br />
      <div className="toolbar">
        <button onClick={() => actions.addCity()}>Adicionar cidade</button>
      </div>

      {state.cities.length === 0 ? (
        <p className="empty">
          Comece adicionando uma cidade. As demais telas serão geradas a partir das datas de
          check-in e check-out.
        </p>
      ) : (
        <>
          <div className="card">
            <h3>Distribuição da viagem</h3>
            {state.cities.map((c, i) => {
              const pct = totalNights
                ? Math.round((daysBetween(c.start, c.end) / totalNights) * 100)
                : 0;
              return (
                <div className="progress-row" key={c.id}>
                  <b>{c.city || '(sem nome)'}</b>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: pct + '%' }} />
                  </div>
                  <span>{pct}%</span>
                </div>
              );
            })}
          </div>
          <br />
          <div className="grid grid2">
            {state.cities.map((c, i) => {
              const nights = daysBetween(c.start, c.end);
              const total = nights * num(c.nightly);
              const pct = totalNights ? Math.round((nights / totalNights) * 100) : 0;
              const invalid = c.start && c.end && nights <= 0;
              return (
                <div className="card city-card" key={c.id}>
                  <div className="emoji">{c.emoji || '📍'}</div>
                  {main.includes(c.city) && <span className="badge">⭐ Cidade principal</span>}
                  <label>
                    Nome da cidade
                    <input
                      value={c.city}
                      onChange={(e) => actions.setCityField(i, 'city', e.target.value)}
                    />
                  </label>
                  <div className="grid grid2">
                    <label>
                      Check-in
                      <input
                        type="date"
                        value={c.start || ''}
                        onChange={(e) => actions.setCityStart(i, e.target.value)}
                      />
                    </label>
                    <label>
                      Check-out
                      <input
                        type="date"
                        min={c.start || ''}
                        value={c.end || ''}
                        aria-describedby={invalid ? `cityEndErr${i}` : undefined}
                        onChange={(e) => {
                          const ok = actions.setCityEnd(i, e.target.value);
                          if (!ok) e.target.value = c.end || '';
                        }}
                      />
                    </label>
                  </div>
                  {invalid && (
                    <div className="error" id={`cityEndErr${i}`} role="alert">
                      Check-out deve ser posterior ao check-in.
                    </div>
                  )}
                  <label>
                    Hospedagem
                    <input
                      value={c.hotel || ''}
                      onChange={(e) => actions.setCityField(i, 'hotel', e.target.value)}
                    />
                  </label>
                  <div className="grid grid2">
                    <label>
                      Custo por diária
                      <input
                        type="number"
                        min="0"
                        value={num(c.nightly)}
                        onChange={(e) => actions.setCityField(i, 'nightly', e.target.value)}
                      />
                    </label>
                    <label>
                      Status
                      <StatusSelect
                        value={c.status || 'Planejado'}
                        onChange={(v) => actions.setCityField(i, 'status', v)}
                      />
                    </label>
                  </div>
                  <div className="grid grid2">
                    <div>
                      <b>Diárias:</b> {nights}
                    </div>
                    <div>
                      <b>Total hospedagem:</b> {money(total)}
                    </div>
                  </div>
                  <div>
                    <b>Distribuição:</b>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: pct + '%' }} />
                    </div>
                    <small>{pct}% da viagem</small>
                  </div>
                  <div>
                    <b>Mini calendário:</b>
                    <div className="calendar-line">
                      {calendarDays(c).map((d, k) => (
                        <span className="calendar-day" key={k}>
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                  <label>
                    Observações
                    <textarea
                      value={c.notes || ''}
                      onChange={(e) => actions.setCityField(i, 'notes', e.target.value)}
                    />
                  </label>
                  <button className="small-btn danger" onClick={() => setConfirmDelete(i)}>
                    Excluir cidade
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {confirmDelete !== null && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Excluir cidade</h3>
              <button className="ghost" onClick={() => setConfirmDelete(null)}>
                Fechar
              </button>
            </div>
            <p>Deseja remover também alimentação, atrações, transporte e despesas ligados a esta cidade?</p>
            <div className="toolbar">
              <button
                onClick={() => {
                  actions.deleteCity(confirmDelete, false);
                  setConfirmDelete(null);
                }}
              >
                Excluir só a cidade
              </button>
              <button
                className="danger"
                onClick={() => {
                  actions.deleteCity(confirmDelete, true);
                  setConfirmDelete(null);
                }}
              >
                Excluir tudo relacionado
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
