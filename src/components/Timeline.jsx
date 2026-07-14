import { fmtDate } from '../domain/format.js';

/**
 * Rethink 5.B — linha do tempo visual. Uma faixa horizontal com um segmento
 * colorido por cidade (largura proporcional aos dias) e um marcador por dia,
 * clicável para pular direto para ele. Usa rolagem horizontal nativa do
 * navegador — no celular isso já é arrastável com o dedo (swipe) sem precisar
 * de nenhum gesto customizado.
 */
export default function Timeline({ dates, activeIndex, onSelect }) {
  if (dates.length === 0) return null;

  // Agrupa dias consecutivos da mesma cidade em segmentos, para colorir por cidade.
  const segments = [];
  dates.forEach((d, i) => {
    const last = segments[segments.length - 1];
    if (last && last.city === (d.city || '')) last.count += 1;
    else segments.push({ city: d.city || '—', count: 1, startIndex: i });
  });

  return (
    <div
      className="timeline-scroll"
      style={{ overflowX: 'auto', paddingBottom: 6, marginBottom: 14, WebkitOverflowScrolling: 'touch' }}
      role="tablist"
      aria-label="Linha do tempo da viagem"
    >
      <div style={{ display: 'flex', gap: 2, minWidth: 'max-content' }}>
        {segments.map((seg, si) => (
          <div key={si} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              className="badge"
              style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: 11, padding: '3px 8px' }}
            >
              {seg.city}
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: seg.count }).map((_, k) => {
                const i = seg.startIndex + k;
                const isActive = i === activeIndex;
                return (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={isActive}
                    aria-label={fmtDate(dates[i].date)}
                    onClick={() => onSelect(i)}
                    style={{
                      minWidth: 34,
                      height: 34,
                      padding: 0,
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 700,
                      background: isActive ? 'var(--primary)' : 'var(--soft)',
                      color: isActive ? '#fff' : 'var(--strong)',
                      boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    {new Date(dates[i].date + 'T00:00').getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
