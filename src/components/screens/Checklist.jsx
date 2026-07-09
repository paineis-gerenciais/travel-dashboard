import { useTrip } from '../../store/TripProvider.jsx';
import { checklistStats } from '../../domain/costs.js';
import { Kpi, CategorySelect, PrioritySelect, ChecklistStatusSelect } from '../ui.jsx';
import { useTextFilter } from '../tableHelpers.js';

export default function Checklist() {
  const { state, actions } = useTrip();
  const { query, setQuery, filter } = useTextFilter();
  const cs = checklistStats(state);
  const rows = filter(state.checklist, (x) =>
    [x.category, x.item, x.responsible, x.priority, x.status, x.notes].join(' ')
  );

  return (
    <section>
      <h2>Checklist</h2>
      <div className="grid grid4">
        <Kpi label="Total" value={cs.total} />
        <Kpi label="Concluídos" value={cs.done} />
        <Kpi label="Pendentes" value={cs.pending} />
        <Kpi label="Conclusão" value={cs.pct + '%'} />
      </div>
      <br />
      <div className="toolbar">
        <input placeholder="Busca livre" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button onClick={() => actions.addChecklist()}>Adicionar item</button>
        <button onClick={() => actions.seedChecklist()}>Inserir sugestões padrão</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>OK</th><th>Categoria</th><th>Item</th><th>Responsável</th><th>Prioridade</th><th>Status</th><th>Observações</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((x) => {
              const i = state.checklist.indexOf(x);
              return (
                <tr className={x.status === 'Cancelado' ? 'status-cancelado' : ''} key={x.id}>
                  <td data-label="OK">
                    <input type="checkbox" checked={!!x.done} onChange={(e) => actions.toggleChecklist(i, e.target.checked)} />
                  </td>
                  <td data-label="Categoria"><CategorySelect value={x.category} onChange={(v) => actions.updateItem('checklist', i, 'category', v)} /></td>
                  <td data-label="Item"><input value={x.item || ''} onChange={(e) => actions.updateItem('checklist', i, 'item', e.target.value)} /></td>
                  <td data-label="Responsável"><input value={x.responsible || ''} onChange={(e) => actions.updateItem('checklist', i, 'responsible', e.target.value)} /></td>
                  <td data-label="Prioridade"><PrioritySelect value={x.priority} onChange={(v) => actions.updateItem('checklist', i, 'priority', v)} /></td>
                  <td data-label="Status"><ChecklistStatusSelect value={x.status} onChange={(v) => actions.updateItem('checklist', i, 'status', v)} /></td>
                  <td data-label="Observações"><input value={x.notes || ''} onChange={(e) => actions.updateItem('checklist', i, 'notes', e.target.value)} /></td>
                  <td><button className="small-btn danger" onClick={() => actions.deleteItem('checklist', i)}>Excluir</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
