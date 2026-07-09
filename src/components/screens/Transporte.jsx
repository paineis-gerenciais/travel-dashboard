import { useTrip } from '../../store/TripProvider.jsx';
import { fmtDate } from '../../domain/format.js';
import { periodByTime, allPlanningDates, datesFromCities } from '../../domain/dates.js';
import {
  getTransportDate,
  getTransportOriginCity,
  getTransportOriginPlace,
  getTransportDestCity,
  getTransportDestPlace,
  getTransportOrigin,
  getTransportDest,
  getTransportMode,
  getTransportDuration,
  getTransportCost,
} from '../../domain/transport.js';
import { statusRowClass, StatusSelect } from '../ui.jsx';
import { useTextFilter } from '../tableHelpers.js';
import { usePagination, Pager } from '../usePagination.jsx';
import MoneyInput from '../MoneyInput.jsx';

export default function Transporte() {
  const { state, actions } = useTrip();
  const { query, setQuery, filter } = useTextFilter();

  const sorted = [...state.transports].sort((a, b) =>
    (getTransportDate(a) + (a.time || '')).localeCompare(getTransportDate(b) + (b.time || ''))
  );
  const rows = filter(sorted, (x) =>
    [getTransportDate(x), getTransportOrigin(x), getTransportDest(x), getTransportMode(x), x.notes].join(' ')
  );
  const firstDate = allPlanningDates(state)[0]?.date || datesFromCities(state)[0]?.date || '';
  const { paged, ...pag } = usePagination(rows, 40);

  return (
    <section>
      <h2>Transporte</h2>
      <div className="toolbar">
        <input
          placeholder="Filtrar trajetos"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={() => actions.addTransport(firstDate)}>Adicionar trajeto</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th><th>Horário</th><th>Origem cidade</th><th>Origem local</th>
              <th>Destino cidade</th><th>Destino local</th><th>Meio</th><th>Tempo</th>
              <th>Custo</th><th>Status</th><th>Período</th><th>Observações</th><th></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((x) => {
              const i = state.transports.indexOf(x);
              const originCity = getTransportOriginCity(x);
              const originPlace = getTransportOriginPlace(x) || (!originCity ? getTransportOrigin(x) : '');
              const destCity = getTransportDestCity(x);
              const destPlace = getTransportDestPlace(x) || (!destCity ? getTransportDest(x) : '');
              return (
                <tr className={statusRowClass(x)} key={x.id}>
                  <td data-label="Data">
                    <input type="date" value={getTransportDate(x) || ''} onChange={(e) => actions.updateItem('transports', i, 'date', e.target.value)} />
                  </td>
                  <td data-label="Horário">
                    <input type="time" value={x.time || ''} onChange={(e) => actions.updateItem('transports', i, 'time', e.target.value)} />
                  </td>
                  <td data-label="Origem cidade">
                    <input value={originCity} placeholder="Cidade" onChange={(e) => actions.updateItem('transports', i, 'originCity', e.target.value)} />
                  </td>
                  <td data-label="Origem local">
                    <input value={originPlace} placeholder="Local" onChange={(e) => actions.updateItem('transports', i, 'originPlace', e.target.value)} />
                  </td>
                  <td data-label="Destino cidade">
                    <input value={destCity} placeholder="Cidade" onChange={(e) => actions.updateItem('transports', i, 'destCity', e.target.value)} />
                  </td>
                  <td data-label="Destino local">
                    <input value={destPlace} placeholder="Local" onChange={(e) => actions.updateItem('transports', i, 'destPlace', e.target.value)} />
                  </td>
                  <td data-label="Meio">
                    <input value={getTransportMode(x) || ''} onChange={(e) => actions.updateItem('transports', i, 'mode', e.target.value)} />
                  </td>
                  <td data-label="Tempo">
                    <input value={getTransportDuration(x) || ''} onChange={(e) => actions.updateItem('transports', i, 'duration', e.target.value)} />
                  </td>
                  <td data-label="Custo">
                    <MoneyInput value={getTransportCost(x)} onChange={(v) => actions.updateItem('transports', i, 'cost', v)} />
                  </td>
                  <td data-label="Status">
                    <StatusSelect value={x.status} onChange={(v) => actions.updateItem('transports', i, 'status', v)} />
                  </td>
                  <td data-label="Período"><span className="badge">{periodByTime(x.time)}</span></td>
                  <td data-label="Observações">
                    <input value={x.notes || ''} onChange={(e) => actions.updateItem('transports', i, 'notes', e.target.value)} />
                  </td>
                  <td>
                    <button className="small-btn danger" onClick={() => actions.deleteItem('transports', i)}>Excluir</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager {...pag} />
    </section>
  );
}
