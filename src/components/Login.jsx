import { useState } from 'react';
import { isValidE164, normalizePhone } from '../lib/phoneAuth.js';

const RECAPTCHA_ID = 'recaptcha-login';

export default function Login({ onLogin, onLoginPhoneStart, onLoginPhoneConfirm, error: googleError }) {
  const [mode, setMode] = useState('inicio'); // inicio | telefone | codigo
  const [phone, setPhone] = useState('+55 ');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sendCode = async () => {
    setError('');
    const clean = normalizePhone(phone);
    if (!isValidE164(clean)) {
      setError('Informe o número com código do país, ex.: +55 11999998888.');
      return;
    }
    setBusy(true);
    try {
      const conf = await onLoginPhoneStart(clean, RECAPTCHA_ID);
      setConfirmation(conf);
      setMode('codigo');
    } catch (e) {
      setError('Não foi possível enviar o código: ' + e.message);
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    setError('');
    if (!code.trim()) { setError('Informe o código recebido por SMS.'); return; }
    setBusy(true);
    try {
      await onLoginPhoneConfirm(confirmation, code.trim());
    } catch (e) {
      setError('Código inválido ou expirado: ' + e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="container" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div className="card stack" style={{ maxWidth: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }} aria-hidden="true">✈️</div>
        <h2 style={{ margin: 0 }}>Plano de viagem</h2>
        <p className="t2" style={{ margin: 0 }}>
          Entre para planejar e compartilhar suas viagens.
        </p>

        {mode === 'inicio' && (
          <div className="stack-2">
            <button className="btn-primary btn-block" onClick={onLogin}>Entrar com Google</button>
            <button className="btn-block" onClick={() => setMode('telefone')}>Entrar com celular</button>
          </div>
        )}

        {mode === 'telefone' && (
          <div className="stack-2">
            <div className="field" style={{ textAlign: 'left' }}>
              <label htmlFor="login-phone">Número de celular</label>
              <input
                id="login-phone" type="tel" value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+55 11999998888"
                onKeyDown={(e) => e.key === 'Enter' && sendCode()}
              />
              <span className="tiny t3">Inclua o código do país (Brasil: +55).</span>
            </div>
            <button className="btn-primary btn-block" onClick={sendCode} disabled={busy}>Enviar código por SMS</button>
            <button className="btn-ghost btn-block" onClick={() => { setMode('inicio'); setError(''); }}>Voltar</button>
          </div>
        )}

        {mode === 'codigo' && (
          <div className="stack-2">
            <p className="small t2" style={{ margin: 0 }}>Enviamos um código por SMS para {phone}.</p>
            <div className="field" style={{ textAlign: 'left' }}>
              <label htmlFor="login-code">Código</label>
              <input
                id="login-code" type="text" inputMode="numeric" value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                onKeyDown={(e) => e.key === 'Enter' && confirm()}
              />
            </div>
            <button className="btn-primary btn-block" onClick={confirm} disabled={busy}>Confirmar</button>
            <button className="btn-ghost btn-block" onClick={() => { setMode('telefone'); setCode(''); setError(''); }}>Reenviar / corrigir número</button>
          </div>
        )}

        {(error || googleError) && (
          <p className="small" style={{ color: 'var(--danger)', margin: 0 }} role="alert">{error || googleError}</p>
        )}

        {/* reCAPTCHA invisível exigido pelo login por celular do Firebase Auth */}
        <div id={RECAPTCHA_ID} />
      </div>
    </div>
  );
}
