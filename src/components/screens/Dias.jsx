import { useState, useMemo, useRef, useLayoutEffect } from 'react';
import { useTrip } from '../../store/TripProvider.jsx';
import { fmtDate, money, num } from '../../domain/format.js';
import { allPlanningDates, cityForDate, tripDayFlow, validateCityCoverage, cityColorClass, HOME } from '../../domain/dates.js';
import {
  getTransportDate, getTransportOrigin, getTransportDest, getTransportMode,
  getTransportDurationMinutes, minutesToLabel,
} from '../../domain/transport.js';
import { activeCost } from '../../domain/costs.js';
import { Row, StatusChip, Sheet, EmptyState, Banner, Stepper, Field, isCancelled } from '../ui.jsx';
import MoneyInput from '../MoneyInput.jsx';
import DurationInput from '../DurationInput.jsx';
import CommentThread from '../CommentThread.jsx';
import Timeline from '../Timeline.jsx';

/**
 * DIAS — a tela de trabalho do app (Fase R2/R3 do redesign).
 * Absorve Roteiro, Transporte, Alimentação, Atrações e Outras: tudo o que
 * acontece num dia é montado aqui, sem trocar de destino.
 * O domínio é o mesmo de sempre — só a apresentação mudou.
 */

function dayItems(state, date) {
  return {
    hosting: state.cities.find((c) => date >= c.start && date < c.end),
    transports: state.transports.filter((x) => getTransportDate(x) === date),
    foods: state.foodItems.filter((x) => x.date === date),
    attractions: state.attractions.filter((x) => x.date === date),
    others: state.otherExpenses.filter((x) => x.date === date),
  };
}
const dayTotal = ({ transports, foods, attractions, others }) =>
  [...transports, ...foods, ...attractions, ...others].reduce((s, x) => s + activeCost(x), 0);

export default function Dias({ tripId, onNavigate }) {
  const { state, actions } = useTrip();
  const dates = allPlanningDates(state);
  const [idx, setIdx] = useState(0);
  const [editing, setEditing] = useState(null); // {kind, index}
  const coverage = useMemo(() => validateCityCoverage(state), [state]);
  const cardRef = useRef(null);
  const direction = useRef(1);
  const gesture = useRef({ startX: 0, dx: 0, dragging: false, width: 0 });

  const i = Math.min(idx, Math.max(0, dates.length - 1));

  // Transição fluida: o cartão entra deslizando do lado correspondente,
  // tanto no swipe quanto na navegação por botão.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.style.transform = 'translateX(0px)';
      return;
    }
    const w = el.offsetWidth || 320;
    el.style.transition = 'none';
    el.style.transform = `translateX(${direction.current > 0 ? w : -w}px)`;
    void el.offsetWidth;
    el.style.transition = 'transform 220ms ease';
    el.style.transform = 'translateX(0px)';
  }, [i]);

  if (dates.length === 0) {
    return (
      <div className="screen">
        <div className="container">
          <h2>Dias</h2>
          <EmptyState
            title="Comece pelas cidades"
            action={<button className="btn-primary" onClick={() => onNavigate('cidades')}>Cadastrar cidade</button>}
          >
            Cadastre uma cidade com datas de check-in e check-out. Os dias da viagem aparecem aqui automaticamente.
          </EmptyState>
        </div>
      </div>
    );
  }

  const date = dates[i].date;
  const flow = tripDayFlow(state, date);
  const items = dayItems(state, date);
  const { hosting, transports, foods, attractions, others } = items;
  const total = dayTotal(items);
  const overlap = coverage.overlaps.find((o) => o.date === date);
  const flowLabel = flow.from && flow.to && flow.from !== flow.to ? `${flow.from} → ${flow.to}` : (flow.to || flow.from);
  const isHome = flow.from === HOME || flow.to === HOME;

  const go = (delta) => {
    direction.current = delta;
    setIdx((v) => Math.max(0, Math.min(dates.length - 1, v + delta)));
  };
  const jumpTo = (target) => {
    direction.current = target >= i ? 1 : -1;
    setIdx(target);
  };

  const onTouchStart = (e) => {
    gesture.current = { startX: e.touches[0].clientX, dx: 0, dragging: true, width: cardRef.current?.offsetWidth || 320 };
    if (cardRef.current) cardRef.current.style.transition = 'none';
  };
  const onTouchMove = (e) => {
    if (!gesture.current.dragging) return;
    let dx = e.touches[0].clientX - gesture.current.startX;
    // rigidez: o cartão acompanha o dedo com resistência (não 1:1), e resiste
    // ainda mais nas pontas da viagem, onde não há para onde ir.
    dx *= 0.6;
    if ((i === 0 && dx > 0) || (i === dates.length - 1 && dx < 0)) dx *= 0.35;
    gesture.current.dx = dx;
    if (cardRef.current) cardRef.current.style.transform = `translateX(${dx}px)`;
  };
  const onTouchEnd = () => {
    if (!gesture.current.dragging) return;
    gesture.current.dragging = false;
    const { dx, width } = gesture.current;
    const el = cardRef.current;
    if (!el) return;
    // limiar maior: exige um gesto mais decidido para trocar de dia
    const threshold = Math.min(140, width * 0.38);
    if (dx <= -threshold && i < dates.length - 1) {
      el.style.transition = 'transform 160ms ease';
      el.style.transform = `translateX(-${width}px)`;
      setTimeout(() => go(1), 160);
    } else if (dx >= threshold && i > 0) {
      el.style.transition = 'transform 160ms ease';
      el.style.transform = `translateX(${width}px)`;
      setTimeout(() => go(-1), 160);
    } else {
      el.style.transition = 'transform 180ms ease';
      el.style.transform = 'translateX(0px)';
    }
  };

  const city = cityForDate(state, date);
  const cityClass = cityColorClass(flow.to && flow.to !== HOME ? flow.to : city);

  return (
    <div className="screen">
      <div className="container stack">
        <Timeline dates={dates} activeIndex={i} onSelect={jumpTo} />

        <div
          ref={cardRef}
          className={`card stack city-edge dias-card ${cityClass}`}
          style={{ touchAction: 'pan-y', willChange: 'transform' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="row-between">
            <div>
              <p className="small t2" style={{ margin: 0 }}>{fmtDate(date)} · dia {i + 1} de {dates.length}</p>
              <h2 style={{ margin: '2px 0 0', fontSize: 'var(--fs-4)' }}>
                {isHome && <span aria-hidden="true">🏠 </span>}{flowLabel}
              </h2>
              {city && !isHome && <span className={`city-tag ${cityClass}`} style={{ marginTop: 4 }}>{city}</span>}
            </div>
            <span className="num" style={{ fontWeight: 600, color: total > 0 ? 'var(--text)' : 'var(--text-3)' }}>
              {total > 0 ? money(total) : '—'}
            </span>
          </div>

          {overlap && (
            <Banner kind="warn">
              Duas cidades neste dia ({overlap.cities.join(' e ')}). Confira as datas em Cidades.
            </Banner>
          )}

          <div className="card card-flush">
            {hosting && (
              <Row
                icon="🛏️"
                title={hosting.hotel || hosting.city}
                sub={hosting.breakfastIncluded ? `${hosting.city} · café da manhã incluso` : hosting.city}
                value={<button className="btn-ghost btn-sm" onClick={() => onNavigate('cidades')}>Editar</button>}
              />
            )}

            {transports.map((x) => {
              const r = state.transports.indexOf(x);
              const dur = getTransportDurationMinutes(x);
              return (
                <Row
                  key={x.id}
                  icon="🚆"
                  cancelled={isCancelled(x)}
                  title={`${getTransportMode(x) || 'Transporte'}${x.time ? ` · ${x.time}` : ''}${dur ? ` · ${minutesToLabel(dur)}` : ''}`}
                  sub={`${getTransportOrigin(x) || '—'} → ${getTransportDest(x) || '—'}`}
                  value={<span className="num">{money(num(x.cost))}</span>}
                >
                  <StatusChip value={x.status} onChange={(v) => actions.updateItem('transports', r, 'status', v)} />
                  <button className="btn-ghost btn-sm" onClick={() => setEditing({ kind: 'transports', index: r })}>Editar</button>
                  <CommentThread tripId={tripId} itemKey={`transports:${x.id}`} />
                </Row>
              );
            })}

            {foods.map((x) => {
              const r = state.foodItems.indexOf(x);
              return (
                <Row
                  key={x.id}
                  icon={x.autoBreakfast ? '☕' : '🍽️'}
                  cancelled={isCancelled(x)}
                  title={x.type || 'Refeição'}
                  sub={x.autoBreakfast
                    ? `${x.place || 'hotel'} · incluso na hospedagem`
                    : (x.place || 'Sem local')}
                  value={<span className="num">{money(num(x.cost))}</span>}
                >
                  <StatusChip value={x.status} onChange={(v) => actions.updateItem('foodItems', r, 'status', v)} />
                  <button className="btn-ghost btn-sm" onClick={() => setEditing({ kind: 'foodItems', index: r })}>Editar</button>
                  <CommentThread tripId={tripId} itemKey={`foodItems:${x.id}`} />
                </Row>
              );
            })}

            {attractions.map((x) => {
              const r = state.attractions.indexOf(x);
              return (
                <Row
                  key={x.id}
                  icon="🎟️"
                  cancelled={isCancelled(x)}
                  title={x.name || 'Atração'}
                  sub={x.time ? `${x.time} · ${x.period}` : x.period}
                  value={<span className="num">{money(num(x.cost))}</span>}
                >
                  <StatusChip value={x.status} onChange={(v) => actions.updateItem('attractions', r, 'status', v)} />
                  <button className="btn-ghost btn-sm" onClick={() => setEditing({ kind: 'attractions', index: r })}>Editar</button>
                  <CommentThread tripId={tripId} itemKey={`attractions:${x.id}`} />
                </Row>
              );
            })}

            {others.map((x) => {
              const r = state.otherExpenses.indexOf(x);
              return (
                <Row
                  key={x.id}
                  icon="💼"
                  cancelled={isCancelled(x)}
                  title={x.name || 'Outra despesa'}
                  sub={x.city}
                  value={<span className="num">{money(num(x.cost))}</span>}
                >
                  <StatusChip value={x.status} onChange={(v) => actions.updateItem('otherExpenses', r, 'status', v)} />
                  <button className="btn-ghost btn-sm" onClick={() => setEditing({ kind: 'otherExpenses', index: r })}>Editar</button>
                </Row>
              );
            })}
          </div>

          <div className="stack-2">
            <button className="btn-add" onClick={() => actions.addTransport(date)}>+ Transporte</button>
            <button className="btn-add" onClick={() => actions.addFoodItem(date, city)}>+ Refeição</button>
            <button className="btn-add" onClick={() => actions.addAttraction(date, city)}>+ Atração</button>
            <button className="btn-add" onClick={() => actions.addOther(date, city)}>+ Outra despesa</button>
          </div>

          <Stepper
            onPrev={() => go(-1)} onNext={() => go(1)}
            canPrev={i > 0} canNext={i < dates.length - 1}
            label={`${i + 1} / ${dates.length}`}
          />
        </div>

        <p className="tiny t3 no-print" style={{ textAlign: 'center' }}>
          Arraste o cartão para o lado para trocar de dia.
        </p>
      </div>

      {editing && (
        <ItemSheet
          kind={editing.kind}
          index={editing.index}
          date={date}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/* Folha de edição de um item — o formulário completo mora aqui, fora da lista. */
function ItemSheet({ kind, index, onClose }) {
  const { state, actions } = useTrip();
  const item = state[kind]?.[index];
  if (!item) return null;
  const set = (key, value) => actions.updateItem(kind, index, key, value);
  const remove = () => { actions.deleteItem(kind, index); onClose(); };

  const titles = {
    transports: 'Transporte',
    foodItems: 'Refeição',
    attractions: 'Atração',
    otherExpenses: 'Outra despesa',
  };

  return (
    <Sheet title={titles[kind]} onClose={onClose}>
      <div className="stack">
        {kind === 'transports' && (
          <>
            <Field label="Meio de transporte">
              <input value={item.mode || ''} placeholder="Trem, voo, carro…" onChange={(e) => set('mode', e.target.value)} />
            </Field>
            <div className="grid-2">
              <Field label="Origem (cidade)">
                <input value={item.originCity || ''} onChange={(e) => set('originCity', e.target.value)} />
              </Field>
              <Field label="Origem (local)">
                <input value={item.originPlace || ''} onChange={(e) => set('originPlace', e.target.value)} />
              </Field>
              <Field label="Destino (cidade)">
                <input value={item.destCity || ''} onChange={(e) => set('destCity', e.target.value)} />
              </Field>
              <Field label="Destino (local)">
                <input value={item.destPlace || ''} onChange={(e) => set('destPlace', e.target.value)} />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Horário">
                <input type="time" value={item.time || ''} onChange={(e) => set('time', e.target.value)} />
              </Field>
              <Field label="Duração">
                <DurationInput item={item} onChange={(min) => set('duration', min)} />
              </Field>
            </div>
          </>
        )}

        {kind === 'foodItems' && (
          <>
            {item.autoBreakfast && (
              <Banner kind="info">
                Café da manhã incluso na hospedagem, criado automaticamente. Se você editar qualquer
                campo, ele passa a ser seu — e não some mais se você desmarcar o café na cidade.
              </Banner>
            )}
            <Field label="Tipo">
              <input value={item.type || ''} placeholder="Café da manhã, almoço…" onChange={(e) => set('type', e.target.value)} />
            </Field>
            <Field label="Restaurante ou local">
              <input value={item.place || ''} onChange={(e) => set('place', e.target.value)} />
            </Field>
          </>
        )}

        {kind === 'attractions' && (
          <>
            <Field label="Atração">
              <input value={item.name || ''} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Horário">
              <input type="time" value={item.time || ''} onChange={(e) => set('time', e.target.value)} />
            </Field>
          </>
        )}

        {kind === 'otherExpenses' && (
          <Field label="Descrição">
            <input value={item.name || ''} onChange={(e) => set('name', e.target.value)} />
          </Field>
        )}

        <Field label="Custo">
          <MoneyInput value={num(item.cost)} onChange={(v) => set('cost', v)} className="input-money" />
        </Field>

        <div className="field">
          <span>Status</span>
          <div><StatusChip value={item.status} onChange={(v) => set('status', v)} /></div>
        </div>

        <div className="stack-2" style={{ marginTop: 'var(--sp-2)' }}>
          <button className="btn-primary btn-block" onClick={onClose}>Concluir</button>
          <button className="btn-danger btn-block" onClick={remove}>Excluir item</button>
        </div>
      </div>
    </Sheet>
  );
}
