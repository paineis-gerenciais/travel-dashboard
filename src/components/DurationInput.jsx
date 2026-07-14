import { getTransportDurationMinutes } from '../domain/transport.js';

/** Contador de horas e minutos. Devolve o total em minutos. */
export default function DurationInput({ item, onChange }) {
  const totalMin = getTransportDurationMinutes(item);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  const set = (nh, nm) => {
    nh = Math.max(0, Math.min(99, Number(nh) || 0));
    nm = Math.max(0, Math.min(59, Number(nm) || 0));
    onChange(nh * 60 + nm);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
      <input type="number" min="0" max="99" inputMode="numeric" value={h}
        onChange={(e) => set(e.target.value, m)} aria-label="Horas" style={{ textAlign: 'right' }} />
      <span className="small t2">h</span>
      <input type="number" min="0" max="59" inputMode="numeric" value={m}
        onChange={(e) => set(h, e.target.value)} aria-label="Minutos" style={{ textAlign: 'right' }} />
      <span className="small t2">min</span>
    </div>
  );
}
