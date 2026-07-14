export default function Login({ onLogin, error }) {
  return (
    <div className="container" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div className="card stack" style={{ maxWidth: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }} aria-hidden="true">✈️</div>
        <h2 style={{ margin: 0 }}>Plano de viagem</h2>
        <p className="t2" style={{ margin: 0 }}>
          Entre com sua conta Google para planejar e compartilhar suas viagens.
        </p>
        <button className="btn-primary btn-block" onClick={onLogin}>Entrar com Google</button>
        {error && <p className="small" style={{ color: 'var(--danger)', margin: 0 }} role="alert">{error}</p>}
      </div>
    </div>
  );
}
