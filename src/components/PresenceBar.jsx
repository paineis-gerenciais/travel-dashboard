import { useTrip } from '../store/TripProvider.jsx';

/** Quem mais está com esta viagem aberta agora. Discreto, no cabeçalho. */
export default function PresenceBar() {
  const { presence } = useTrip();
  if (!presence || presence.length === 0) return null;
  const nomes = presence.map((p) => p.displayName).join(', ');
  return (
    <span
      className="tiny"
      title={`${nomes} ${presence.length === 1 ? 'está' : 'estão'} vendo esta viagem agora`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'var(--ok-soft)', color: 'var(--ok)',
        padding: '4px 10px', borderRadius: 'var(--r-pill)', fontWeight: 600, whiteSpace: 'nowrap',
      }}
      role="status"
    >
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />
      {presence.length}
    </span>
  );
}
