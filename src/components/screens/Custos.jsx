import { useState } from 'react';
import { useTrip } from '../../store/TripProvider.jsx';
import { money, num, fmtDate } from '../../domain/format.js';
import { allPlanningDates } from '../../domain/dates.js';
import {
  totals, costRowsByView, expenseStatusTotals, paidPct, palette,
  dayLodging, dayFood, dayAttractions, dayTransport, dayOther, dayTotal,
} from '../../domain/costs.js';
import {
  getTransportDate, getTransportOrigin, getTransportDest, getTransportMode,
  getTransportDurationMinutes, minutesToLabel,
} from '../../domain/transport.js';
import { Row, Metric, EmptyState, Sheet, isCancelled, useToast } from '../ui.jsx';
import { splitSummary, settlements, participants } from '../../domain/split.js';
import { track } from '../../lib/analytics.js';

/**
 * CUSTOS — o modo orçamento. Totais, distribuição e os RELATÓRIOS por categoria
 * (Transporte, Alimentação, Atrações, Outras, Roteiro), que antes eram abas de
 * navegação e agora são consultas: aqui se lê, não se monta. (Fases R2/R3.)
 */
const REPORTS = [
  ['transporte', '🚆', 'Transporte'],
  ['alimentacao', '🍽️', 'Alimentação'],
  ['atracoes', '🎟️', 'Atrações'],
  ['outras', '💼', 'Outras despesas'],
  ['roteiro', '🗓️', 'Roteiro por dia'],
];

export default function Custos() {
  const { state, actions } = useTrip();
  const [report, setReport] = useState(null);
  const [showSplit, setShowSplit] = useState(false);
  const t = totals(state);
  const dates = allPlanningDates(state);
  const view = state.settings.costView || 'categoria';
  const rows = costRowsByView(state, view, t, dates);
  const statusT = expenseStatusTotals(state);
  const trav = Math.max(1, num(state.settings.travelers) || 1);
  const maxRow = Math.max(1, ...rows.map((r) => r.value));

  if (dates.length === 0 && t.total === 0) {
    return (
      <div className="screen">
        <div className="container">
          <h2>Custos</h2>
          <EmptyState title="Sem custos ainda">
            Os totais aparecem aqui conforme você monta os dias da viagem.
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="container stack">
        <h2>Custos</h2>

        <div className="grid-2">
          <Metric label="Total" value={money(t.total)} />
          <Metric label="Por pessoa" value={money(t.total / trav)} />
          <Metric label="Por dia" value={money(dates.length ? t.total / dates.length : 0)} />
          <Metric label="Pago" value={`${paidPct(state)}%`} />
        </div>

        <div className="card stack">
          <div className="field">
            <label htmlFor="travelers">Viajantes</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <button
                type="button" className="btn-icon" aria-label="Diminuir viajantes"
                onClick={() => actions.setTravelers(Math.max(1, trav - 1))}
              >−</button>
              <input
                id="travelers" type="number" min="1" inputMode="numeric"
                value={trav} onChange={(e) => actions.setTravelers(e.target.value)}
                style={{ maxWidth: 90, textAlign: 'center' }}
              />
              <button
                type="button" className="btn-icon" aria-label="Aumentar viajantes"
                onClick={() => actions.setTravelers(trav + 1)}
              >+</button>
            </div>
          </div>
        </div>

        <div className="card stack">
          <div className="row-between">
            <h3 style={{ margin: 0 }}>Distribuição</h3>
            <select
              value={view}
              onChange={(e) => actions.setCostView(e.target.value)}
              style={{ width: 'auto', minWidth: 140 }}
              aria-label="Ver custos por"
            >
              <option value="categoria">Por categoria</option>
              <option value="cidade">Por cidade</option>
              <option value="dia">Por dia</option>
            </select>
          </div>
          <p className="small t2" style={{ margin: 0 }}>
            Cada barra mostra a participação de {view === 'categoria' ? 'cada categoria' : view === 'cidade' ? 'cada cidade' : 'cada dia'} no total da viagem — quanto mais longa, maior a fatia do gasto.
          </p>
          <div className="stack-2">
            {rows.map((r, i) => (
              <div key={r.name} className="stack-2" style={{ gap: 4 }}>
                <div className="row-between">
                  <span className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: palette(i), display: 'inline-block', flex: '0 0 auto' }} />
                    {r.name}
                  </span>
                  <span className="small num" style={{ fontWeight: 600 }}>
                    {money(r.value)} <span className="t3">· {t.total ? Math.round((r.value / t.total) * 100) : 0}%</span>
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
                  <div style={{ width: `${(r.value / maxRow) * 100}%`, height: '100%', background: palette(i), borderRadius: 'var(--r-pill)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card stack">
          <h3 style={{ margin: 0 }}>Por status</h3>
          <div className="stack-2">
            {statusT.map((s) => (
              <div key={s.label} className="row-between">
                <span className="small">{s.label} <span className="t3">· {s.count}</span></span>
                <span className="small num">{money(s.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-flush">
          <Row
            icon="🤝"
            title="Divisão de despesas"
            sub="Quanto cada um pagou e quem acerta com quem"
            value={<button className="btn-ghost btn-sm" onClick={() => { setShowSplit(true); track('expense_split_viewed'); }}>Ver →</button>}
          />
        </div>

        <div className="card card-flush">
          <div style={{ padding: 'var(--sp-4) var(--sp-4) 0' }}>
            <h3>Relatórios</h3>
            <p className="small t2">Consulte os itens por categoria. Para editar, use a tela Dias.</p>
          </div>
          {REPORTS.map(([id, icon, label]) => (
            <Row key={id} icon={icon} title={label} value={<button className="btn-ghost btn-sm" onClick={() => setReport(id)}>Ver →</button>} />
          ))}
        </div>
      </div>

      {report && <ReportSheet id={report} onClose={() => setReport(null)} />}
      {showSplit && <SplitSheet onClose={() => setShowSplit(false)} />}
    </div>
  );
}

/* Relatórios: leitura, em Rows — nenhuma tabela. */
function ReportSheet({ id, onClose }) {
  const { state } = useTrip();
  const label = REPORTS.find((r) => r[0] === id)?.[2] || 'Relatório';
  const dates = allPlanningDates(state);

  const body = () => {
    if (id === 'transporte') {
      const arr = [...state.transports].sort((a, b) => String(getTransportDate(a)).localeCompare(String(getTransportDate(b))));
      if (!arr.length) return <EmptyState title="Nenhum transporte">Adicione transportes na tela Dias.</EmptyState>;
      return arr.map((x) => {
        const dur = getTransportDurationMinutes(x);
        return (
          <Row key={x.id} icon="🚆" cancelled={isCancelled(x)}
            title={`${getTransportMode(x) || 'Transporte'}${dur ? ` · ${minutesToLabel(dur)}` : ''}`}
            sub={`${fmtDate(getTransportDate(x))} · ${getTransportOrigin(x) || '—'} → ${getTransportDest(x) || '—'}`}
            value={<span className="num">{money(num(x.cost))}</span>} />
        );
      });
    }
    if (id === 'alimentacao') {
      const arr = [...state.foodItems].sort((a, b) => a.date.localeCompare(b.date));
      if (!arr.length) return <EmptyState title="Nenhuma refeição">Adicione refeições na tela Dias.</EmptyState>;
      return arr.map((x) => (
        <Row key={x.id} icon="🍽️" cancelled={isCancelled(x)}
          title={x.type || 'Refeição'}
          sub={`${fmtDate(x.date)} · ${x.place || 'sem local'} · ${x.city || ''}`}
          value={<span className="num">{money(num(x.cost))}</span>} />
      ));
    }
    if (id === 'atracoes') {
      const arr = [...state.attractions].sort((a, b) => a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time)));
      if (!arr.length) return <EmptyState title="Nenhuma atração">Adicione atrações na tela Dias.</EmptyState>;
      return arr.map((x) => (
        <Row key={x.id} icon="🎟️" cancelled={isCancelled(x)}
          title={x.name || 'Atração'}
          sub={`${fmtDate(x.date)} · ${x.time || ''} · ${x.city || ''}`}
          value={<span className="num">{money(num(x.cost))}</span>} />
      ));
    }
    if (id === 'outras') {
      const arr = [...state.otherExpenses].sort((a, b) => String(a.date).localeCompare(String(b.date)));
      if (!arr.length) return <EmptyState title="Nenhuma despesa">Adicione despesas na tela Dias.</EmptyState>;
      return arr.map((x) => (
        <Row key={x.id} icon="💼" cancelled={isCancelled(x)}
          title={x.name || 'Despesa'}
          sub={`${fmtDate(x.date)} · ${x.city || ''}`}
          value={<span className="num">{money(num(x.cost))}</span>} />
      ));
    }
    // roteiro por dia
    if (!dates.length) return <EmptyState title="Sem dias">Cadastre cidades com datas.</EmptyState>;
    return dates.map((d) => (
      <Row key={d.date} icon="🗓️"
        title={`${fmtDate(d.date)} · ${d.city || ''}`}
        sub={[
          dayTransport(state, d.date) ? `transporte ${money(dayTransport(state, d.date))}` : null,
          dayLodging(state, d.date) ? `hospedagem ${money(dayLodging(state, d.date))}` : null,
          dayFood(state, d.date) ? `comida ${money(dayFood(state, d.date))}` : null,
          dayAttractions(state, d.date) ? `atrações ${money(dayAttractions(state, d.date))}` : null,
          dayOther(state, d.date) ? `outras ${money(dayOther(state, d.date))}` : null,
        ].filter(Boolean).join(' · ') || 'sem custos'}
        value={<span className="num">{money(dayTotal(state, d.date))}</span>} />
    ));
  };

  return (
    <Sheet title={label} onClose={onClose}>
      <div className="card card-flush">{body()}</div>
    </Sheet>
  );
}

/* ---------- T-1.7: divisão de despesas ---------- */
function SplitSheet({ onClose }) {
  const { state, actions } = useTrip();
  const notify = useToast();
  const t = totals(state);
  const [editingPeople, setEditingPeople] = useState(false);
  const [nomes, setNomes] = useState(participants(state).join(', '));

  const resumo = splitSummary(state, t.lodging);
  const acertos = settlements(resumo);

  const salvarNomes = () => {
    actions.setParticipants(nomes.split(',').map((x) => x.trim()).filter(Boolean));
    setEditingPeople(false);
    notify('Participantes atualizados.');
    track('expense_split_enabled', { count: nomes.split(',').filter((x) => x.trim()).length });
  };

  return (
    <Sheet title="Divisão de despesas" onClose={onClose}>
      <div className="stack">
        <p className="small t2" style={{ margin: 0 }}>
          Divisão igual entre os participantes. Marque <b>quem pagou</b> em cada item (na tela Dias)
          para o acerto ficar completo.
        </p>

        <div className="card" style={{ background: 'var(--surface-2)', border: 0 }}>
          {editingPeople ? (
            <div className="stack-2">
              <label className="field">
                <span>Participantes (separados por vírgula)</span>
                <input value={nomes} onChange={(e) => setNomes(e.target.value)} placeholder="Ana, Bruno, Carla" />
              </label>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button className="btn-primary btn-sm" onClick={salvarNomes}>Salvar</button>
                <button className="btn-ghost btn-sm" onClick={() => setEditingPeople(false)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="row-between">
              <span className="small">{resumo.people.join(' · ')}</span>
              <button className="btn-ghost btn-sm" onClick={() => setEditingPeople(true)}>Editar</button>
            </div>
          )}
        </div>

        <div className="grid-2">
          <Metric label="Total da viagem" value={money(resumo.total)} />
          <Metric label="Cota por pessoa" value={money(resumo.share)} />
        </div>

        <div className="card card-flush">
          {resumo.rows.map((r) => (
            <Row
              key={r.person}
              icon="👤"
              title={r.person}
              sub={`Pagou ${money(r.paid)} · cota ${money(r.share)}`}
              value={
                <span className="num" style={{ color: r.balance >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
                  {r.balance >= 0 ? '+' : ''}{money(r.balance)}
                </span>
              }
            />
          ))}
        </div>

        {resumo.unassigned > 0 && (
          <p className="small t2" style={{ margin: 0 }}>
            <b>{money(resumo.unassigned)}</b> ainda sem pagador definido (inclui a hospedagem).
            Enquanto isso, o acerto abaixo considera só o que já foi atribuído.
          </p>
        )}

        <h3 style={{ margin: 0 }}>Acerto</h3>
        {acertos.length === 0 ? (
          <p className="small t2" style={{ margin: 0 }}>Ninguém deve nada a ninguém.</p>
        ) : (
          <div className="card card-flush">
            {acertos.map((a, i) => (
              <Row key={i} icon="➡️" title={`${a.from} paga para ${a.to}`} value={<span className="num">{money(a.valor)}</span>} />
            ))}
          </div>
        )}

        <div className="sheet-footer stack-2">
          <button className="btn-primary btn-block" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </Sheet>
  );
}
