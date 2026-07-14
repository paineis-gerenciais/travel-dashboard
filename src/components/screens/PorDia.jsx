import { useState, useMemo, useRef } from 'react';
import { useTrip } from '../../store/TripProvider.jsx';
import { fmtDate, money, num } from '../../domain/format.js';
import { allPlanningDates, cityForDate, tripDayFlow, validateCityCoverage, HOME } from '../../domain/dates.js';
import {
  getTransportDate,
  getTransportOrigin,
  getTransportDest,
  getTransportMode,
  getTransportDurationMinutes,
  minutesToLabel,
} from '../../domain/transport.js';
import { activeCost } from '../../domain/costs.js';
import { StatusChip, statusRowClass } from '../ui.jsx';
import MoneyInput from '../MoneyInput.jsx';
import Timeline from '../Timeline.jsx';
import CommentThread from '../CommentThread.jsx';

/**
 * EXPERIMENTAL — rethinks 5.A/5.B/5.C do diagnóstico de UX.
 *
 * Reorganiza os MESMOS dados de sempre (state.transports/foodItems/attractions/
 * otherExpenses/cities) numa navegação por dia. Não cria campo novo no modelo
 * de dados de VIAGEM, não muda nenhuma ação existente do TripProvider, não
 * altera cálculo de custo. Os únicos dados novos desta tela (comentários) vivem
 * numa coleção própria do Firestore (ver CommentThread.jsx / tripData.js),
 * isolados por viagem como o resto do app.
 *
 * - 5.A: navegação por dia, com swipe no celular e botões no desktop.
 * - 5.B: timeline horizontal acima do cartão do dia.
 * - 5.C: alternância "Montar" (esta tela) / "Orçamento" (telas de categoria).
 */

function dayItems(state, date) {
  const hosting = state.cities.find((c) => date >= c.start && date < c.end);
  const transports = state.transports.filter((x) => getTransportDate(x) === date);
  const foods = state.foodItems.filter((x) => x.date === date);
  const attractions = state.attractions.filter((x) => x.date === date);
  const others = state.otherExpenses.filter((x) => x.date === date);
  return { hosting, transports, foods, attractions, others };
}

function dayTotal({ transports, foods, attractions, others }) {
  return [...transports, ...foods, ...attractions, ...others].reduce((s, x) => s + activeCost(x), 0);
}

export default function PorDia({ onNavigate, tripId }) {
  const { state, actions } = useTrip();
  const dates = allPlanningDates(state);
  const [idx, setIdx] = useState(0);
  const coverage = useMemo(() => validateCityCoverage(state), [state]);
  const touch = useRef({ x: 0, active: false });

  if (dates.length === 0) {
    return (
      <section>
        <h2>Por dia <span className="badge">beta</span></h2>
        <p className="empty">Cadastre cidades com datas para navegar dia a dia.</p>
      </section>
    );
  }

  const i = Math.min(idx, dates.length - 1);
  const date = dates[i].date;
  const flow = tripDayFlow(state, date);
  const { hosting, transports, foods, attractions, others } = dayItems(state, date);
  const total = dayTotal({ transports, foods, attractions, others });
  const overlap = coverage.overlaps.find((o) => o.date === date);
  const flowLabel = flow.from && flow.to && flow.from !== flow.to ? `${flow.from} → ${flow.to}` : (flow.to || flow.from);

  const go = (delta) => setIdx((v) => Math.max(0, Math.min(dates.length - 1, v + delta)));

  // 5.A — swipe no celular (toque), sem interferir na rolagem vertical da página.
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, active: true }; };
  const onTouchMove = (e) => {
    if (!touch.current.active) return;
    // nada a fazer aqui; decidimos no touchend para não brigar com o scroll vertical
  };
  const onTouchEnd = (e) => {
    if (!touch.current.active) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    touch.current.active = false;
    if (Math.abs(dx) < 40) return; // toque curto, não foi swipe
    if (dx < 0) go(1); else go(-1);
  };

  const itemKey = (kind, id) => `${kind}:${id}`;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ marginBottom: 0 }}>Por dia <span className="badge">beta</span></h2>
        {/* 5.C — alternância entre modo Montar (esta tela) e modo Orçamento (telas de categoria) */}
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <button className="active-toggle" disabled>Montar</button>
          <button className="ghost" onClick={() => onNavigate && onNavigate('custos')}>Orçamento →</button>
        </div>
      </div>
      <p className="hint">
        Modo experimental: o mesmo conteúdo das abas de categoria, organizado por dia. As abas de
        sempre continuam funcionando normalmente. No celular, arraste o cartão para o lado para
        trocar de dia.
      </p>

      <Timeline dates={dates} activeIndex={i} onSelect={setIdx} />

      <div
        className="card"
        style={{ maxWidth: 460, touchAction: 'pan-y' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="muted" style={{ fontSize: 13 }}>{fmtDate(date)}</span>
          <span className="total-cell">{total > 0 ? money(total) : <span className="muted">sem gastos</span>}</span>
        </div>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          {flow.from === HOME || flow.to === HOME ? '🏠 ' : '📍 '}
          {flowLabel}
        </h3>

        {overlap && (
          <div className="card" style={{ borderLeft: '4px solid var(--warn)', marginBottom: 12, padding: 10 }} role="alert">
            <b>⚠️ Duas cidades neste dia:</b> {overlap.cities.join(' e ')}. Confira as datas em Cidades.
          </div>
        )}

        {transports.map((x) => {
          const idxReal = state.transports.indexOf(x);
          const dur = getTransportDurationMinutes(x);
          return (
            <div className={`route-box ${statusRowClass(x)}`} key={x.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <b>{getTransportMode(x) || 'Transporte'}</b>{x.time ? ` · ${x.time}` : ''}{dur ? ` · ${minutesToLabel(dur)}` : ''}
                  <div className="muted" style={{ fontSize: 13 }}>{getTransportOrigin(x)} → {getTransportDest(x)}</div>
                </div>
                <MoneyInput value={num(x.cost)} onChange={(v) => actions.updateItem('transports', idxReal, 'cost', v)} style={{ maxWidth: 90 }} />
              </div>
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusChip value={x.status} onChange={(v) => actions.updateItem('transports', idxReal, 'status', v)} />
                <CommentThread tripId={tripId} itemKey={itemKey('transports', x.id)} />
              </div>
            </div>
          );
        })}
        {transports.length === 0 && (
          <button className="small-btn ghost" style={{ width: '100%', marginBottom: 8 }} onClick={() => actions.addTransport(date)}>
            + Adicionar transporte
          </button>
        )}

        {hosting && (
          <div className="route-box" style={{ marginBottom: 8 }}>
            <b>{hosting.hotel || hosting.city}</b>
            <div className="muted" style={{ fontSize: 13 }}>
              {hosting.city}{hosting.breakfastIncluded ? ' · café da manhã incluso' : ''}
            </div>
          </div>
        )}

        {foods.map((x) => {
          const idxReal = state.foodItems.indexOf(x);
          return (
            <div className={`route-box ${statusRowClass(x)}`} key={x.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <input value={x.type} onChange={(e) => actions.updateItem('foodItems', idxReal, 'type', e.target.value)} style={{ fontWeight: 700, marginBottom: 4 }} />
                  <input value={x.place || ''} placeholder="Local" onChange={(e) => actions.updateItem('foodItems', idxReal, 'place', e.target.value)} />
                </div>
                <MoneyInput value={num(x.cost)} onChange={(v) => actions.updateItem('foodItems', idxReal, 'cost', v)} style={{ maxWidth: 90 }} />
                <button className="small-btn danger" onClick={() => actions.deleteItem('foodItems', idxReal)}>✕</button>
              </div>
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusChip value={x.status} onChange={(v) => actions.updateItem('foodItems', idxReal, 'status', v)} />
                <CommentThread tripId={tripId} itemKey={itemKey('foodItems', x.id)} />
              </div>
            </div>
          );
        })}
        <button className="small-btn ghost" style={{ width: '100%', marginBottom: 8 }} onClick={() => actions.addFoodItem(date, cityForDate(state, date))}>
          + Adicionar refeição
        </button>

        {attractions.map((x) => {
          const idxReal = state.attractions.indexOf(x);
          return (
            <div className={`route-box ${statusRowClass(x)}`} key={x.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <input value={x.name} placeholder="Atração" onChange={(e) => actions.updateItem('attractions', idxReal, 'name', e.target.value)} style={{ flex: 1 }} />
                <MoneyInput value={num(x.cost)} onChange={(v) => actions.updateItem('attractions', idxReal, 'cost', v)} style={{ maxWidth: 90 }} />
                <button className="small-btn danger" onClick={() => actions.deleteItem('attractions', idxReal)}>✕</button>
              </div>
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusChip value={x.status} onChange={(v) => actions.updateItem('attractions', idxReal, 'status', v)} />
                <CommentThread tripId={tripId} itemKey={itemKey('attractions', x.id)} />
              </div>
            </div>
          );
        })}
        <button className="small-btn ghost" style={{ width: '100%', marginBottom: 8 }} onClick={() => actions.addAttraction(date, cityForDate(state, date))}>
          + Adicionar atração
        </button>

        {others.map((x) => {
          const idxReal = state.otherExpenses.indexOf(x);
          return (
            <div className={`route-box ${statusRowClass(x)}`} key={x.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <input value={x.name} placeholder="Outra despesa" onChange={(e) => actions.updateItem('otherExpenses', idxReal, 'name', e.target.value)} style={{ flex: 1 }} />
                <MoneyInput value={num(x.cost)} onChange={(v) => actions.updateItem('otherExpenses', idxReal, 'cost', v)} style={{ maxWidth: 90 }} />
                <button className="small-btn danger" onClick={() => actions.deleteItem('otherExpenses', idxReal)}>✕</button>
              </div>
            </div>
          );
        })}

        {/* 5.A — botões sempre visíveis (versão web); no celular, o swipe no cartão acima já navega */}
        <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
          <button disabled={i === 0} onClick={() => go(-1)} style={{ flex: 1 }}>← Dia anterior</button>
          <button disabled={i === dates.length - 1} onClick={() => go(1)} style={{ flex: 1 }}>Próximo dia →</button>
        </div>
        <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 8 }}>
          Dia {i + 1} de {dates.length}
        </p>
      </div>
    </section>
  );
}
