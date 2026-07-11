// components/DurationInput.jsx — contador de horas e minutos (item N2).
// Armazena e devolve o total em MINUTOS (número), gravado no mesmo campo
// `duration` do transporte — sem criar campo novo no Firestore.
import { getTransportDurationMinutes } from '../domain/transport.js';

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} aria-label="Duração">
      <input
        type="number"
        min="0"
        max="99"
        value={h}
        onChange={(e) => set(e.target.value, m)}
        aria-label="Horas"
        style={{ width: 56, textAlign: 'right' }}
      />
      <span aria-hidden="true">h</span>
      <input
        type="number"
        min="0"
        max="59"
        value={m}
        onChange={(e) => set(h, e.target.value)}
        aria-label="Minutos"
        style={{ width: 56, textAlign: 'right' }}
      />
      <span aria-hidden="true">min</span>
    </div>
  );
}
