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
import { Row, Metric, EmptyState, Sheet, Field, StatusChip, isCancelled, useToast } from '../ui.jsx';
import MoneyInput from '../MoneyInput.jsx';
import PaymentFields, { pct2 } from '../PaymentFields.jsx';
import {
  splitSummary, settlements, participants, allCostRows, rowsForParticipant,
  withSettlementStatus,
} from '../../domain/split.js';
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

        <div className="grid-metrics">
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
      // Item 9: café da manhã INCLUSO na hospedagem e sem custo não é gasto —
      // só poluiria o relatório. Some daqui, mas continua visível na tela Dias,
      // onde tem valor informativo ("hoje o café está incluso").
      const arr = [...state.foodItems]
        .filter((x) => !(x.autoBreakfast && num(x.cost) === 0))
        .sort((a, b) => a.date.localeCompare(b.date));
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

/* ---------- Divisão de despesas ---------- */
function SplitSheet({ onClose }) {
  const { state, actions } = useTrip();
  const notify = useToast();
  const [editandoPessoas, setEditandoPessoas] = useState(false);
  const [expandido, setExpandido] = useState(null);   // id do participante aberto
  const [editandoLinha, setEditandoLinha] = useState(null); // {kind, id}

  const resumo = splitSummary(state);
  const acertos = withSettlementStatus(state, settlements(resumo));
  const pendentes = acertos.filter((a) => !a.confirmado).length;

  return (
    <Sheet title="Divisão de despesas" onClose={onClose}>
      <div className="stack">
        <p className="small t2" style={{ margin: 0 }}>
          Cada despesa pode ter um pagador e um rateio próprio. Sem rateio definido, ela é dividida
          igualmente.
        </p>

        {/* Participantes: renomear preserva o vínculo das despesas (id estável) */}
        <div className="card" style={{ background: 'var(--surface-2)', border: 0 }}>
          {editandoPessoas ? (
            <ParticipantsEditor onDone={() => setEditandoPessoas(false)} />
          ) : (
            <div className="row-between">
              <span className="small">{resumo.people.map((p) => p.name).join(' · ')}</span>
              <button className="btn-ghost btn-sm" onClick={() => setEditandoPessoas(true)}>Editar</button>
            </div>
          )}
        </div>

        <div className="grid-metrics">
          <Metric label="Total da viagem" value={money(resumo.total)} />
          <Metric label="Sem pagador" value={money(resumo.unassigned)} />
        </div>

        {/* Por participante, expansível */}
        <div className="stack-2">
          {resumo.rows.map((r) => (
            <div key={r.id} className="card card-flush">
              <Row
                icon="👤"
                title={r.name}
                sub={`Pagou ${money(r.paid)} · deve ${money(r.owed)}`}
                value={
                  <span className="num" style={{ color: r.balance >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
                    {r.balance >= 0 ? '+' : ''}{money(r.balance)}
                  </span>
                }
              >
                <button
                  className="btn-ghost btn-sm"
                  aria-expanded={expandido === r.id}
                  onClick={() => setExpandido(expandido === r.id ? null : r.id)}
                >
                  {expandido === r.id ? 'Ocultar gastos' : 'Ver gastos'}
                </button>
              </Row>

              {expandido === r.id && (
                <ParticipantRows
                  participantId={r.id}
                  onEdit={(kind, id) => setEditandoLinha({ kind, id })}
                />
              )}
            </div>
          ))}
        </div>

        {resumo.unassigned > 0 && (
          <p className="small t2" style={{ margin: 0 }}>
            <b>{money(resumo.unassigned)}</b> ainda sem pagador definido. O acerto abaixo considera
            só o que já foi atribuído.
          </p>
        )}

        <div className="row-between">
          <h3 style={{ margin: 0 }}>Acerto</h3>
          {acertos.length > 0 && (
            <span className="tiny t3">
              {pendentes === 0 ? 'tudo acertado' : `${pendentes} pendente${pendentes > 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        {acertos.length === 0 ? (
          <p className="small t2" style={{ margin: 0 }}>Ninguém deve nada a ninguém.</p>
        ) : (
          <div className="card card-flush">
            {acertos.map((a) => (
              <Row
                key={a.key}
                icon={a.confirmado ? '✅' : '➡️'}
                title={`${a.from} paga para ${a.to}`}
                sub={a.confirmado ? 'Acerto confirmado' : 'Aguardando confirmação'}
                value={<span className="num" style={{ color: a.confirmado ? 'var(--text-3)' : 'var(--text)' }}>{money(a.valor)}</span>}
              >
                <button
                  className={a.confirmado ? 'btn-ghost btn-sm' : 'btn-sm'}
                  aria-pressed={a.confirmado}
                  onClick={() => actions.toggleSettlementDone(a.key, !a.confirmado)}
                >
                  {a.confirmado ? 'Desfazer' : '✓ Confirmar pagamento'}
                </button>
              </Row>
            ))}
          </div>
        )}
        {acertos.some((a) => a.confirmado) && (
          <p className="tiny t3" style={{ margin: 0 }}>
            Se novas despesas mudarem o valor devido, o acerto volta a aparecer como pendente.
          </p>
        )}

        <div className="sheet-footer stack-2">
          <button className="btn-primary btn-block" onClick={onClose}>Fechar</button>
        </div>
      </div>

      {editandoLinha && (
        <RowEditor
          kind={editandoLinha.kind}
          id={editandoLinha.id}
          onClose={() => setEditandoLinha(null)}
          onSaved={() => notify('Despesa atualizada.')}
        />
      )}
    </Sheet>
  );
}

/** Edição dos participantes: adicionar, renomear e remover. */
function ParticipantsEditor({ onDone }) {
  const { state, actions } = useTrip();
  const notify = useToast();
  const people = participants(state);
  const [novo, setNovo] = useState('');

  const cadastrados = (state.settings.participants || []).length > 0;

  return (
    <div className="stack-2">
      {!cadastrados && (
        <p className="tiny t3" style={{ margin: 0 }}>
          Ainda usando nomes automáticos. Adicione os participantes reais abaixo.
        </p>
      )}

      {cadastrados && people.map((p) => (
        <div key={p.id} style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <input
            value={p.name}
            aria-label={`Nome de ${p.name}`}
            onChange={(e) => actions.renameParticipant(p.id, e.target.value)}
          />
          <button
            className="btn-danger btn-sm"
            aria-label={`Remover ${p.name}`}
            onClick={() => { actions.removeParticipant(p.id); notify(`${p.name} removido.`); }}
          >
            ✕
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <input
          placeholder="Adicionar participante"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !novo.trim()) return;
            actions.addParticipant(novo);
            setNovo('');
          }}
        />
        <button
          className="btn-primary btn-sm"
          onClick={() => { if (novo.trim()) { actions.addParticipant(novo); setNovo(''); } }}
        >
          Add
        </button>
      </div>

      <p className="tiny t3" style={{ margin: 0 }}>
        Renomear não desfaz nada: as despesas ficam ligadas à pessoa, não ao nome.
      </p>
      <button className="btn-ghost btn-sm" onClick={onDone}>Concluir</button>
    </div>
  );
}

/** Lista de gastos de um participante — o que ele pagou e/ou é responsável. */
function ParticipantRows({ participantId, onEdit }) {
  const { state } = useTrip();
  const rows = rowsForParticipant(state, participantId);

  if (rows.length === 0) {
    return <p className="small t2" style={{ padding: 'var(--sp-4)', margin: 0 }}>Nenhum gasto ligado a esta pessoa.</p>;
  }

  return (
    <div style={{ borderTop: '1px solid var(--line)' }}>
      {rows.map((r) => (
        <Row
          key={`${r.kind}:${r.id}`}
          icon={r.pagouEste ? '💳' : '•'}
          cancelled={isCancelled(r.item)}
          title={r.rotulo}
          sub={`${r.detalhe ? r.detalhe + ' · ' : ''}${money(r.valor)} · ${pct2(r.pct)}% = ${money(r.parte)}${r.pagouEste ? ' · pagou' : ''}`}
          value={<button className="btn-ghost btn-sm" onClick={() => onEdit(r.kind, r.id)}>Editar</button>}
        />
      ))}
    </div>
  );
}

/** Editor completo de uma linha de custo, chamado de dentro da divisão. */
function RowEditor({ kind, id, onClose, onSaved }) {
  const { state, actions } = useTrip();
  const linha = allCostRows(state).find((r) => r.kind === kind && r.id === id);
  if (!linha) return null;
  const item = linha.item;

  const set = (key, value) => actions.setRowField(kind, id, key, value);
  const ehHospedagem = kind === 'cities';

  return (
    <Sheet title={`Editar ${linha.rotulo}`} onClose={onClose}>
      <div className="stack">
        {ehHospedagem ? (
          <Field label="Custo por diária">
            <MoneyInput value={num(item.nightly)} onChange={(v) => set('nightly', v)} className="input-money" />
          </Field>
        ) : (
          <Field label="Custo">
            <MoneyInput value={num(item.cost)} onChange={(v) => set('cost', v)} className="input-money" />
          </Field>
        )}

        {ehHospedagem && (
          <p className="tiny t3" style={{ margin: 0 }}>
            Total da hospedagem: {money(linha.valor)} ({item.city}).
          </p>
        )}

        <div className="field">
          <span>Status</span>
          <div><StatusChip value={item.status} onChange={(v) => set('status', v)} /></div>
        </div>

        <PaymentFields item={item} valor={linha.valor} onChange={set} />

        <div className="sheet-footer stack-2">
          <button className="btn-primary btn-block" onClick={() => { onSaved?.(); onClose(); }}>Concluir</button>
        </div>
      </div>
    </Sheet>
  );
}
