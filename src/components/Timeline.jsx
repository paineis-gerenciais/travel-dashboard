import { useEffect, useRef } from 'react';
import { fmtDate } from '../domain/format.js';
import { cityColorClass } from '../domain/dates.js';

/** Linha do tempo: um marcador por dia, agrupado e COLORIDO por cidade. */
export default function Timeline({ dates, activeIndex, onSelect }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current?.querySelector('[aria-selected="true"]');
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  if (dates.length === 0) return null;

  const segments = [];
  dates.forEach((d, i) => {
    const last = segments[segments.length - 1];
    if (last && last.city === (d.city || '')) last.count += 1;
    else segments.push({ city: d.city || '—', count: 1, startIndex: i });
  });

  return (
    <div className="timeline no-print" ref={ref} role="tablist" aria-label="Dias da viagem">
      <div className="timeline-inner">
        {segments.map((seg, si) => {
          const cc = cityColorClass(seg.city);
          return (
            <div className="timeline-seg" key={si}>
              <span className={`timeline-city ${cc}`}>{seg.city}</span>
              <div className="timeline-days">
                {Array.from({ length: seg.count }).map((_, k) => {
                  const i = seg.startIndex + k;
                  return (
                    <button
                      key={i}
                      className={`timeline-day ${cc}`}
                      role="tab"
                      aria-selected={i === activeIndex}
                      aria-label={fmtDate(dates[i].date)}
                      onClick={() => onSelect(i)}
                    >
                      {new Date(dates[i].date + 'T00:00').getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
