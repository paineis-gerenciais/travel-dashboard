import { useState, useMemo } from 'react';
import { useTrip } from '../../store/TripProvider.jsx';
import { money, num, fmtDate } from '../../domain/format.js';
import { daysBetween, uniqueCities, validateCityCoverage, cityColorClass } from '../../domain/dates.js';
import { totals } from '../../domain/costs.js';
import { Row, StatusChip, Sheet, EmptyState, Banner, Metric, Field, isCancelled } from '../ui.jsx';
import MoneyInput from '../MoneyInput.jsx';

/** CIDADES — o esqueleto da viagem. Reconstruída sem tabela (Fase R3). */
export default function Cidades() {
  const { state, actions } = useTrip();
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const coverage = useMemo(() => validateCityCoverage(state), [state]);
  const t = totals(state);
  const nights = state.cities.reduce((s, c) => s + daysBetween(c.start, c.end), 0);

  const add = () => { actions.addCity(); setEditing(state.cities.length); };

  return (
    <div className="screen">
      <div className="container stack">
        <h2>Cidades</h2>

        <div className="grid-2">
          <Metric label="Cidades" value={uniqueCities(state).length} />
          <Metric label="Diárias" value={nights} />
          <Metric label="Hospedagem" value={money(t.lodging)} />
          <Metric label="Total da viagem" value={money(t.total)} />
        </div>

        {coverage.gaps.length > 0 && (
          <Banner kind="warn">
            <b>Dias sem cidade:</b> {coverage.gaps.map(fmtDate).join(', ')}.
          </Banner>
        )}
        {coverage.overlaps.length > 0 && (
          <Banner kind="warn">
            <b>Dias em duas cidades:</b>{' '}
            {coverage.overlaps.map((o) => `${fmtDate(o.date)} (${o.cities.join(' e ')})`).join('; ')}.
            Isso é diferente de check-out e check-in no mesmo dia.
          </Banner>
        )}

        {state.cities.length === 0 ? (
          <EmptyState
            title="Comece a viagem aqui"
            action={<button className="btn-primary" onClick={add}>Adicionar cidade</button>}
          >
            Cadastre uma cidade com check-in e check-out. Os dias, custos e o roteiro se organizam sozinhos.
          </EmptyState>
        ) : (
          <>
            <div className="card card-flush">
              {state.cities.map((c, i) => {
                const n = daysBetween(c.start, c.end);
                const cc = cityColorClass(c.city);
                return (
                  <Row
                    key={c.id}
                    icon={<span className={cc} style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', borderRadius: 'inherit' }}>{c.emoji || '📍'}</span>}
                    cancelled={isCancelled(c)}
                    title={<span className={`city-tag ${cc}`}>{c.city || 'Cidade sem nome'}</span>}
                    sub={
                      c.start && c.end
                        ? `${fmtDate(c.start)} → ${fmtDate(c.end)} · ${n} ${n === 1 ? 'diária' : 'diárias'}${c.hotel ? ` · ${c.hotel}` : ''}`
                        : 'Sem datas'
                    }
                    value={<span className="num">{money(n * num(c.nightly))}</span>}
                  >
                    <StatusChip value={c.status} onChange={(v) => actions.setCityField(i, 'status', v)} />
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(i)}>Editar</button>
                  </Row>
                );
              })}
            </div>
            <button className="btn-add" onClick={add}>+ Adicionar cidade</button>
          </>
        )}
      </div>

      {editing != null && state.cities[editing] && (
        <CitySheet
          index={editing}
          onClose={() => setEditing(null)}
          onDelete={() => { setConfirmDel(editing); setEditing(null); }}
        />
      )}

      {confirmDel != null && state.cities[confirmDel] && (
        <Sheet title="Excluir cidade" onClose={() => setConfirmDel(null)}>
          <p>
            Excluir <b>{state.cities[confirmDel].city || 'esta cidade'}</b>. Os itens ligados a ela
            (refeições, atrações, transportes no período) podem ser removidos junto.
          </p>
          <div className="stack-2">
            <button className="btn-danger btn-block" onClick={() => { actions.deleteCity(confirmDel, true); setConfirmDel(null); }}>
              Excluir cidade e itens ligados
            </button>
            <button className="btn-block" onClick={() => { actions.deleteCity(confirmDel, false); setConfirmDel(null); }}>
              Excluir só a cidade
            </button>
            <button className="btn-ghost btn-block" onClick={() => setConfirmDel(null)}>Cancelar</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function CitySheet({ index, onClose, onDelete }) {
  const { state, actions } = useTrip();
  const c = state.cities[index];
  const [dateError, setDateError] = useState('');
  if (!c) return null;

  return (
    <Sheet title="Cidade" onClose={onClose}>
      <div className="stack">
        <div className="grid-2">
          <Field label="Cidade">
            <input value={c.city || ''} onChange={(e) => actions.setCityField(index, 'city', e.target.value)} />
          </Field>
          <Field label="Emoji">
            <input value={c.emoji || ''} maxLength={4} onChange={(e) => actions.setCityField(index, 'emoji', e.target.value)} />
          </Field>
        </div>

        <div className="grid-2">
          <Field label="Check-in">
            <input type="date" value={c.start || ''} onChange={(e) => { setDateError(''); actions.setCityStart(index, e.target.value); }} />
          </Field>
          <Field label="Check-out">
            <input
              type="date"
              value={c.end || ''}
              aria-describedby={dateError ? 'city-date-error' : undefined}
              onChange={(e) => {
                const ok = actions.setCityEnd(index, e.target.value);
                setDateError(ok ? '' : 'O check-out precisa ser depois do check-in.');
              }}
            />
          </Field>
        </div>
        {dateError && <p id="city-date-error" className="small" style={{ color: 'var(--danger)' }}>{dateError}</p>}

        <Field label="Hospedagem">
          <input value={c.hotel || ''} onChange={(e) => actions.setCityField(index, 'hotel', e.target.value)} />
        </Field>

        <label className="row" style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-1)', padding: 'var(--sp-3)' }}>
          <input
            type="checkbox"
            checked={!!c.breakfastIncluded}
            onChange={(e) => actions.setCityField(index, 'breakfastIncluded', e.target.checked)}
          />
          <span className="row-main">
            <span className="row-title">Café da manhã incluso</span>
            <span className="row-sub">Cria a refeição automaticamente em cada dia, com o nome do hotel.</span>
          </span>
        </label>

        <Field label="Custo por diária">
          <MoneyInput value={num(c.nightly)} onChange={(v) => actions.setCityField(index, 'nightly', v)} className="input-money" />
        </Field>

        <div className="field">
          <span>Status</span>
          <div><StatusChip value={c.status} onChange={(v) => actions.setCityField(index, 'status', v)} /></div>
        </div>

        <Field label="Notas">
          <textarea value={c.notes || ''} onChange={(e) => actions.setCityField(index, 'notes', e.target.value)} />
        </Field>

        <div className="stack-2" style={{ marginTop: 'var(--sp-2)' }}>
          <button className="btn-primary btn-block" onClick={onClose}>Concluir</button>
          <button className="btn-danger btn-block" onClick={onDelete}>Excluir cidade</button>
        </div>
      </div>
    </Sheet>
  );
}
