import { useTrip } from '../../store/TripProvider.jsx';
import { fmtDate, money, num } from '../../domain/format.js';
import { periodByTime, datesFromCities, cityForDate } from '../../domain/dates.js';
import { activeCost, dayAttractions } from '../../domain/costs.js';
import { statusRowClass, StatusSelect } from '../ui.jsx';
import { useTextFilter, dateOptions } from '../tableHelpers.js';
import { usePagination, Pager } from '../usePagination.jsx';
import { useState } from 'react';
import MoneyInput from '../MoneyInput.jsx';

export default function Atracoes() {
  const { state, actions } = useTrip();
  const { query, setQuery, filter } = useTextFilter();
  const [addDate, setAddDate] = useState('');
  const opts = dateOptions(state);

  const sorted = [...state.attractions].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const grouped = {};
  filter(sorted, (x) => [x.date, x.name, x.city].join(' ')).forEach((x) => (grouped[x.date] ||= []).push(x));

  const dayKeys = Object.keys(grouped).sort();
  const { paged: pagedDays, ...pag } = usePagination(dayKeys, 15);

  return (
    <section>
      <h2>Atrações</h2>
      <div className="toolbar">
        <input placeholder="Filtrar atrações" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={addDate} onChange={(e) => setAddDate(e.target.value)}>
          <option value="">Selecione a data</option>
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={() => addDate && actions.addAttraction(addDate, cityForDate(state, addDate))}>
          Adicionar atração na data
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Data</th><th>Cidade</th><th>Horário</th><th>Período</th><th>Nome</th><th>Custo</th><th>Status</th><th>Total do dia</th><th></th></tr>
          </thead>
          <tbody>
            {pagedDays.map((date) => {
              const arr = grouped[date];
              const total = arr.reduce((s, x) => s + activeCost(x), 0);
              return arr.map((x, idx) => {
                const i = state.attractions.indexOf(x);
                return (
                  <tr className={statusRowClass(x)} key={x.id}>
                    {idx === 0 && (
                      <>
                        <td data-label="Data" rowSpan={arr.length}>
                          {fmtDate(date)}<br />
                          <button className="small-btn ghost" onClick={() => actions.addAttraction(date, cityForDate(state, date))}>+ atração</button>
                        </td>
                        <td data-label="Cidade" rowSpan={arr.length}>{x.city}</td>
                      </>
                    )}
                    <td data-label="Horário"><input type="time" value={x.time || ''} onChange={(e) => actions.updateItem('attractions', i, 'time', e.target.value)} /></td>
                    <td data-label="Período"><span className="badge">{periodByTime(x.time)}</span></td>
                    <td data-label="Nome"><input value={x.name || ''} onChange={(e) => actions.updateItem('attractions', i, 'name', e.target.value)} /></td>
                    <td data-label="Custo"><MoneyInput value={num(x.cost)} onChange={(v) => actions.updateItem('attractions', i, 'cost', v)} /></td>
                    <td data-label="Status"><StatusSelect value={x.status} onChange={(v) => actions.updateItem('attractions', i, 'status', v)} /></td>
                    {idx === 0 && <td data-label="Total do dia" rowSpan={arr.length} className="total-cell">{money(total)}</td>}
                    <td><button className="small-btn danger" onClick={() => actions.deleteItem('attractions', i)}>Excluir</button></td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
      <Pager {...pag} />
      <br />
      <div className="card">
        <h3>Consolidado por dia</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Cidade</th><th>Total atrações</th></tr></thead>
            <tbody>
              {datesFromCities(state).map((d) => (
                <tr key={d.date}>
                  <td data-label="Data">{fmtDate(d.date)}</td>
                  <td data-label="Cidade">{d.city}</td>
                  <td data-label="Total atrações" className="total-cell">{money(dayAttractions(state, d.date))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
