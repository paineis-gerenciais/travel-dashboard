export default function Login({ onLogin, error }) {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div style={{ fontSize: 44, marginBottom: 8 }}>✈️</div>
        <h1 style={{ fontSize: 24, margin: '0 0 6px' }}>Planejamento da Viagem</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          Entre com sua conta Google para acessar suas viagens, salvas na nuvem e disponíveis
          em qualquer dispositivo.
        </p>
        <button onClick={onLogin} style={{ width: '100%', justifyContent: 'center' }}>
          Entrar com Google
        </button>
        {error && (
          <p className="error" role="alert" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
