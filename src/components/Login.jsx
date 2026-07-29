import { useState } from 'react';
import { isValidE164, normalizePhone } from '../lib/phoneAuth.js';

const RECAPTCHA_ID = 'recaptcha-login';

/** Traduz os códigos de erro do Firebase Auth para português claro. */
function mensagemDeErro(e) {
  const code = String(e?.code || '');
  const mapa = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-not-found': 'Não encontramos uma conta com esse e-mail.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Tente entrar.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um instante e tente de novo.',
    'auth/operation-not-allowed': 'Este método de login não está habilitado no projeto.',
    'auth/billing-not-enabled': 'O envio de SMS exige o plano Blaze no Firebase. Use e-mail e senha ou conta Google.',
  };
  return mapa[code] || e?.message || 'Não foi possível continuar.';
}

export default function Login({
  onLogin, onLoginPhoneStart, onLoginPhoneConfirm,
  onLoginEmail, onRegisterEmail, onResetPassword,
  error: googleError,
}) {
  const [mode, setMode] = useState('inicio'); // inicio | email | cadastro | telefone | codigo
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [phone, setPhone] = useState('+55 ');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const limpar = () => { setError(''); setAviso(''); };

  const entrarEmail = async () => {
    limpar();
    if (!email.trim() || !senha) { setError('Informe e-mail e senha.'); return; }
    setBusy(true);
    try { await onLoginEmail(email, senha); }
    catch (e) { setError(mensagemDeErro(e)); }
    finally { setBusy(false); }
  };

  const criarConta = async () => {
    limpar();
    if (!email.trim() || !senha) { setError('Informe e-mail e senha.'); return; }
    if (senha.length < 6) { setError('A senha precisa ter pelo menos 6 caracteres.'); return; }
    setBusy(true);
    try { await onRegisterEmail(email, senha, nome); }
    catch (e) { setError(mensagemDeErro(e)); }
    finally { setBusy(false); }
  };

  const esqueciSenha = async () => {
    limpar();
    if (!email.trim()) { setError('Informe seu e-mail para receber o link de redefinição.'); return; }
    setBusy(true);
    try {
      await onResetPassword(email);
      setAviso('Enviamos um link de redefinição para o seu e-mail.');
    } catch (e) { setError(mensagemDeErro(e)); }
    finally { setBusy(false); }
  };

  const enviarCodigo = async () => {
    limpar();
    const clean = normalizePhone(phone);
    if (!isValidE164(clean)) { setError('Informe o número com código do país, ex.: +55 11999998888.'); return; }
    setBusy(true);
    try {
      setConfirmation(await onLoginPhoneStart(clean, RECAPTCHA_ID));
      setMode('codigo');
    } catch (e) { setError(mensagemDeErro(e)); }
    finally { setBusy(false); }
  };

  const confirmarCodigo = async () => {
    limpar();
    if (!code.trim()) { setError('Informe o código recebido por SMS.'); return; }
    setBusy(true);
    try { await onLoginPhoneConfirm(confirmation, code.trim()); }
    catch (e) { setError(mensagemDeErro(e)); }
    finally { setBusy(false); }
  };

  const CampoEmail = (
    <label className="field" style={{ textAlign: 'left' }}>
      <span>E-mail</span>
      <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
    </label>
  );

  const CampoSenha = (autoComplete) => (
    <label className="field" style={{ textAlign: 'left' }}>
      <span>Senha</span>
      <input type="password" autoComplete={autoComplete} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="mínimo 6 caracteres" />
    </label>
  );

  return (
    <div className="container" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div className="card stack" style={{ maxWidth: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }} aria-hidden="true">✈️</div>
        <h2 style={{ margin: 0 }}>Plano de viagem</h2>
        <p className="t2" style={{ margin: 0 }}>Entre para planejar e compartilhar suas viagens.</p>

        {mode === 'inicio' && (
          <div className="stack-2">
            <button className="btn-primary btn-block" onClick={() => { limpar(); setMode('email'); }}>
              Entrar com e-mail e senha
            </button>
            <button className="btn-block" onClick={onLogin}>Entrar com Google</button>
            <button className="btn-ghost btn-block" onClick={() => { limpar(); setMode('telefone'); }}>
              Entrar com celular
            </button>
            <button className="btn-ghost btn-block" onClick={() => { limpar(); setMode('cadastro'); }}>
              Criar uma conta
            </button>
          </div>
        )}

        {mode === 'email' && (
          <div className="stack-2">
            {CampoEmail}
            {CampoSenha('current-password')}
            <button className="btn-primary btn-block" onClick={entrarEmail} disabled={busy}>
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
            <button className="btn-ghost btn-block" onClick={esqueciSenha} disabled={busy}>Esqueci minha senha</button>
            <button className="btn-ghost btn-block" onClick={() => { limpar(); setMode('cadastro'); }}>
              Não tenho conta — criar agora
            </button>
            <button className="btn-ghost btn-block" onClick={() => { limpar(); setMode('inicio'); }}>Voltar</button>
          </div>
        )}

        {mode === 'cadastro' && (
          <div className="stack-2">
            <label className="field" style={{ textAlign: 'left' }}>
              <span>Seu nome</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como você quer ser chamado" autoComplete="name" />
            </label>
            {CampoEmail}
            {CampoSenha('new-password')}
            <button className="btn-primary btn-block" onClick={criarConta} disabled={busy}>
              {busy ? 'Criando…' : 'Criar conta'}
            </button>
            <button className="btn-ghost btn-block" onClick={() => { limpar(); setMode('email'); }}>
              Já tenho conta — entrar
            </button>
            <button className="btn-ghost btn-block" onClick={() => { limpar(); setMode('inicio'); }}>Voltar</button>
          </div>
        )}

        {mode === 'telefone' && (
          <div className="stack-2">
            <label className="field" style={{ textAlign: 'left' }}>
              <span>Número de celular</span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11999998888" autoComplete="tel" />
              <span className="tiny t3">Inclua o código do país (Brasil: +55).</span>
            </label>
            <button className="btn-primary btn-block" onClick={enviarCodigo} disabled={busy}>Enviar código por SMS</button>
            <button className="btn-ghost btn-block" onClick={() => { limpar(); setMode('inicio'); }}>Voltar</button>
          </div>
        )}

        {mode === 'codigo' && (
          <div className="stack-2">
            <p className="small t2" style={{ margin: 0 }}>Enviamos um código por SMS para {phone}.</p>
            <label className="field" style={{ textAlign: 'left' }}>
              <span>Código</span>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
            </label>
            <button className="btn-primary btn-block" onClick={confirmarCodigo} disabled={busy}>Confirmar</button>
            <button className="btn-ghost btn-block" onClick={() => { limpar(); setMode('telefone'); setCode(''); }}>
              Reenviar / corrigir número
            </button>
          </div>
        )}

        {aviso && <p className="small" style={{ color: 'var(--ok)', margin: 0 }} role="status">{aviso}</p>}
        {(error || googleError) && (
          <p className="small" style={{ color: 'var(--danger)', margin: 0 }} role="alert">{error || googleError}</p>
        )}

        <div id={RECAPTCHA_ID} />
      </div>
    </div>
  );
}
