import { useTrip } from '../store/TripProvider.jsx';
import { money, fmtDate, num } from '../domain/format.js';
import { allPlanningDates, tripDayFlow, itemTimeMinutes, uniqueCities, HOME } from '../domain/dates.js';
import { totals, dayTotal, activeCost } from '../domain/costs.js';
import { collectLinks, hasLink, linkLabel } from '../domain/links.js';
import {
  getTransportDate, getTransportOrigin, getTransportDest, getTransportMode,
  getTransportDurationMinutes, minutesToLabel,
} from '../domain/transport.js';

/**
 * T-1.5 — versão para papel/PDF do roteiro inteiro.
 *
 * Fica oculta na tela (`.print-only`) e aparece só na impressão, substituindo
 * o conteúdo do app. Assim o PDF sai completo e organizado, independentemente
 * de qual aba estava aberta — em vez de imprimir "a tela atual", que era o
 * comportamento anterior.
 *
 * Escolha deliberada: nenhuma biblioteca de PDF. O navegador já sabe gerar PDF
 * ("Salvar como PDF"), e uma lib como jsPDF/pdfmake acrescentaria centenas de
 * kB ao bundle para reproduzir o que o CSS de impressão faz de graça.
 */
export default function PrintView({ tripName }) {
  const { state } = useTrip();
  const dates = allPlanningDates(state);
  const t = totals(state);
  const trav = Math.max(1, num(state.settings.travelers) || 1);

  const itensDoDia = (date) => {
    const arr = [
      ...state.transports.filter((x) => getTransportDate(x) === date).map((item) => ({ kind: 'transports', item })),
      ...state.foodItems.filter((x) => x.date === date).map((item) => ({ kind: 'foodItems', item })),
      ...state.attractions.filter((x) => x.date === date).map((item) => ({ kind: 'attractions', item })),
      ...state.otherExpenses.filter((x) => x.date === date).map((item) => ({ kind: 'otherExpenses', item })),
    ];
    return arr.sort((a, b) => itemTimeMinutes(a.kind, a.item) - itemTimeMinutes(b.kind, b.item));
  };

  const rotulo = ({ kind, item: x }) => {
    if (kind === 'transports') {
      const dur = getTransportDurationMinutes(x);
      return {
        titulo: `${getTransportMode(x) || 'Transporte'}${x.time ? ` · ${x.time}` : ''}${dur ? ` · ${minutesToLabel(dur)}` : ''}`,
        detalhe: `${getTransportOrigin(x) || '—'} → ${getTransportDest(x) || '—'}`,
      };
    }
    if (kind === 'foodItems') return { titulo: x.type || 'Refeição', detalhe: x.place || '' };
    if (kind === 'attractions') return { titulo: x.name || 'Atração', detalhe: x.time || '' };
    return { titulo: x.name || 'Despesa', detalhe: '' };
  };

  return (
    <div className="print-only print-doc">
      <header className="print-cover">
        <h1>{tripName || state.settings.title || 'Viagem'}</h1>
        {dates.length > 0 && (
          <p>
            {fmtDate(dates[0].date)} a {fmtDate(dates.at(-1).date)} · {dates.length}{' '}
            {dates.length === 1 ? 'dia' : 'dias'} · {trav} {trav === 1 ? 'viajante' : 'viajantes'}
          </p>
        )}
        {uniqueCities(state).length > 0 && <p>{uniqueCities(state).join(' · ')}</p>}
      </header>

      {state.cities.length > 0 && (
        <section className="print-block">
          <h2>Hospedagem</h2>
          {state.cities.map((c) => (
            <p key={c.id} className="print-line">
              <b>{c.city}</b>
              {c.hotel ? ` — ${c.hotel}` : ''}
              {c.start && c.end ? ` · ${fmtDate(c.start)} a ${fmtDate(c.end)}` : ''}
              {c.breakfastIncluded ? ' · café da manhã incluso' : ''}
              {c.status ? ` · ${c.status}` : ''}
              {hasLink(c) && <span className="print-link"> · {linkLabel(c.link)}: {c.link.url}</span>}
            </p>
          ))}
        </section>
      )}

      {dates.map((d) => {
        const flow = tripDayFlow(state, d.date);
        const label = flow.from && flow.to && flow.from !== flow.to ? `${flow.from} → ${flow.to}` : (flow.to || flow.from);
        const itens = itensDoDia(d.date);
        return (
          <section className="print-block print-day" key={d.date}>
            <h2>
              {fmtDate(d.date)} — {label}
              <span className="print-day-total">{money(dayTotal(state, d.date))}</span>
            </h2>
            {itens.length === 0 ? (
              <p className="print-line print-muted">Sem itens.</p>
            ) : (
              itens.map(({ kind, item }) => {
                const { titulo, detalhe } = rotulo({ kind, item });
                return (
                  <p key={item.id} className="print-line">
                    <b>{titulo}</b>
                    {detalhe ? ` — ${detalhe}` : ''}
                    {activeCost(item) > 0 ? ` · ${money(activeCost(item))}` : ''}
                    {item.status ? ` · ${item.status}` : ''}
                    {hasLink(item) && (
                      <span className="print-link"> · {linkLabel(item.link)}: {item.link.url}</span>
                    )}
                  </p>
                );
              })
            )}
          </section>
        );
      })}

      <section className="print-block">
        <h2>Resumo de custos</h2>
        <p className="print-line">Hospedagem · {money(t.lodging)}</p>
        <p className="print-line">Alimentação · {money(t.food)}</p>
        <p className="print-line">Atrações · {money(t.att)}</p>
        <p className="print-line">Transporte · {money(t.trans)}</p>
        <p className="print-line">Outros · {money(t.other)}</p>
        <p className="print-line print-total">
          <b>Total · {money(t.total)}</b> · por pessoa {money(t.total / trav)}
        </p>
      </section>

      {collectLinks(state).length > 0 && (
        <section className="print-block">
          <h2>Comprovantes e documentos</h2>
          {collectLinks(state).map((l) => (
            <p key={`${l.kind}:${l.id}`} className="print-line">
              <b>{l.label}</b> — {l.origem}
              {l.date ? ` · ${fmtDate(l.date)}` : ''}
              <span className="print-link"> · {l.url}</span>
            </p>
          ))}
        </section>
      )}

      {state.checklist.length > 0 && (
        <section className="print-block">
          <h2>Checklist</h2>
          {state.checklist.map((c) => (
            <p key={c.id} className="print-line">
              {c.done ? '☑' : '☐'} {c.item}
              {c.responsible ? ` · ${c.responsible}` : ''}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
