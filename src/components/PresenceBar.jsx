import { useTrip } from '../store/TripProvider.jsx';

// Mostra quem mais está com esta viagem aberta agora (presença em tempo real).
// Fica oculta quando ninguém além do próprio usuário está online.
export default function PresenceBar() {
  const { presence } = useTrip();
  if (!presence || presence.length === 0) return null;

  const nomes = presence.map((p) => p.displayName).join(', ');
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        background: 'var(--soft)', color: 'var(--strong)', border: '1px solid var(--line)',
        borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 700, margin: '0 0 14px',
      }}
      role="status"
    >
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
      {presence.length === 1 ? `${nomes} está vendo esta viagem agora` : `${nomes} estão vendo esta viagem agora`}
    </div>
  );
}
