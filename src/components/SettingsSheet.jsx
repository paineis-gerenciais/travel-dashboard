import { useState } from 'react';
import { updateProfile, linkWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase.js';
import { upsertUserProfile } from '../lib/tripData.js';
import { sendLinkCode, confirmCode, isValidE164, normalizePhone } from '../lib/phoneAuth.js';
import { Sheet, Field, Banner } from './ui.jsx';

const RECAPTCHA_ID = 'recaptcha-settings';

/**
 * Configurações: vincular nome, número de celular e e-mail à conta.
 * - Nome: sempre editável (updateProfile + perfil no Firestore).
 * - Celular: se a conta ainda não tem um, oferece vincular (envia SMS,
 *   confirma código). Se já tem (por ter entrado por celular, ou já ter
 *   vinculado antes), mostra só como informação.
 * - E-mail: se a conta não tem um (entrou só por celular), oferece vincular
 *   uma conta Google para ganhar um e-mail. Se já tem, mostra como informação.
 */
export default function SettingsSheet({ user, onClose }) {
  const [name, setName] = useState(user.displayName || '');
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState('');

  const [phoneMode, setPhoneMode] = useState('info'); // info | telefone | codigo
  const [phone, setPhone] = useState('+55 ');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneMsg, setPhoneMsg] = useState('');

  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailMsg, setEmailMsg] = useState('');

  const saveName = async () => {
    const n = name.trim();
    if (!n) return;
    setSavingName(true); setNameMsg('');
    try {
      await updateProfile(auth.currentUser, { displayName: n });
      await upsertUserProfile(auth.currentUser);
      setNameMsg('Nome salvo.');
    } catch (e) {
      setNameMsg('Falha ao salvar: ' + e.message);
    } finally { setSavingName(false); }
  };

  const sendPhoneCode = async () => {
    setPhoneError('');
    const clean = normalizePhone(phone);
    if (!isValidE164(clean)) {
      setPhoneError('Informe o número com código do país, ex.: +55 11999998888.');
      return;
    }
    setPhoneBusy(true);
    try {
      const conf = await sendLinkCode(clean, RECAPTCHA_ID);
      setConfirmation(conf);
      setPhoneMode('codigo');
    } catch (e) {
      setPhoneError('Não foi possível enviar o código: ' + e.message);
    } finally { setPhoneBusy(false); }
  };

  const confirmPhone = async () => {
    setPhoneError('');
    if (!code.trim()) { setPhoneError('Informe o código recebido por SMS.'); return; }
    setPhoneBusy(true);
    try {
      await confirmCode(confirmation, code.trim());
      await upsertUserProfile(auth.currentUser);
      setPhoneMsg('Celular vinculado.');
      setPhoneMode('info');
    } catch (e) {
      setPhoneError('Código inválido ou expirado: ' + e.message);
    } finally { setPhoneBusy(false); }
  };

  const linkGoogle = async () => {
    setEmailError(''); setEmailMsg('');
    setEmailBusy(true);
    try {
      await linkWithPopup(auth.currentUser, googleProvider);
      await upsertUserProfile(auth.currentUser);
      setEmailMsg('Conta Google vinculada.');
    } catch (e) {
      setEmailError('Falha ao vincular: ' + e.message);
    } finally { setEmailBusy(false); }
  };

  return (
    <Sheet title="Configurações" onClose={onClose}>
      <div className="stack">
        <Field label="Nome">
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveName()} />
            <button className="btn-primary" onClick={saveName} disabled={savingName}>Salvar</button>
          </div>
          {nameMsg && <span className="tiny t2">{nameMsg}</span>}
        </Field>

        <div className="field">
          <span>Celular</span>
          {user.phoneNumber ? (
            <p className="small t2" style={{ margin: 0 }}>{user.phoneNumber} · vinculado</p>
          ) : phoneMode === 'info' ? (
            <button onClick={() => setPhoneMode('telefone')}>Vincular número de celular</button>
          ) : phoneMode === 'telefone' ? (
            <div className="stack-2">
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11999998888" onKeyDown={(e) => e.key === 'Enter' && sendPhoneCode()} />
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button className="btn-primary" onClick={sendPhoneCode} disabled={phoneBusy}>Enviar código</button>
                <button className="btn-ghost" onClick={() => setPhoneMode('info')}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="stack-2">
              <p className="small t2" style={{ margin: 0 }}>Código enviado para {phone}.</p>
              <input type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" onKeyDown={(e) => e.key === 'Enter' && confirmPhone()} />
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button className="btn-primary" onClick={confirmPhone} disabled={phoneBusy}>Confirmar</button>
                <button className="btn-ghost" onClick={() => setPhoneMode('telefone')}>Corrigir número</button>
              </div>
            </div>
          )}
          {phoneError && <span className="tiny" style={{ color: 'var(--danger)' }} role="alert">{phoneError}</span>}
          {phoneMsg && <span className="tiny t2">{phoneMsg}</span>}
        </div>

        <div className="field">
          <span>E-mail</span>
          {user.email ? (
            <p className="small t2" style={{ margin: 0 }}>{user.email} · vinculado</p>
          ) : (
            <>
              <Banner kind="info">Sua conta entrou só por celular. Vincule uma conta Google para ganhar um e-mail — útil para receber convites de viagens.</Banner>
              <button onClick={linkGoogle} disabled={emailBusy}>Vincular conta Google</button>
            </>
          )}
          {emailError && <span className="tiny" style={{ color: 'var(--danger)' }} role="alert">{emailError}</span>}
          {emailMsg && <span className="tiny t2">{emailMsg}</span>}
        </div>

        <div id={RECAPTCHA_ID} />
      </div>
    </Sheet>
  );
}
