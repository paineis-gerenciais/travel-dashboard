import { useState } from 'react';
import { track } from '../lib/analytics.js';
import { Sheet } from './ui.jsx';

const KEY = 'trip_onboarding_done';

export function onboardingPending() {
  try { return localStorage.getItem(KEY) !== '1'; } catch { return false; }
}
function markDone() {
  try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
}

const PASSOS = [
  {
    icone: '🧳',
    titulo: 'Uma viagem, um lugar só',
    texto: 'Aqui você reúne datas, roteiro, hospedagem e custos — tudo o que hoje fica espalhado entre conversas, e-mails e prints.',
  },
  {
    icone: '📍',
    titulo: 'Comece pelas cidades',
    texto: 'Cadastre uma cidade com check-in e check-out. Os dias da viagem aparecem sozinhos, prontos para você preencher.',
  },
  {
    icone: '🤝',
    titulo: 'Chame quem viaja com você',
    texto: 'Convide pelo e-mail e todo mundo enxerga o mesmo plano, ao vivo. Dá para comentar item a item e dividir as despesas.',
  },
];

/**
 * T-1.3 — Onboarding de primeiro uso.
 *
 * Três passos curtos, puláveis, que aparecem só uma vez. Ensina no contexto:
 * ao terminar, a pessoa está na própria tela de criar viagem, não numa tela de
 * tutorial descolada. O estado fica em localStorage, como o tema e a aba ativa.
 */
export default function Onboarding({ onClose }) {
  const [i, setI] = useState(() => { track('onboarding_started'); return 0; });
  const passo = PASSOS[i];
  const ultimo = i === PASSOS.length - 1;

  const fechar = (pulou) => {
    markDone();
    track(pulou ? 'onboarding_skipped' : 'onboarding_finished', { step: i + 1 });
    onClose();
  };

  const avancar = () => {
    if (ultimo) return fechar(false);
    track('onboarding_step_completed', { step: i + 1 });
    setI((v) => v + 1);
  };

  return (
    <Sheet title="Bem-vindo" onClose={() => fechar(true)}>
      <div className="stack" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 44 }} aria-hidden="true">{passo.icone}</div>
        <h3 style={{ margin: 0 }}>{passo.titulo}</h3>
        <p className="t2" style={{ margin: 0 }}>{passo.texto}</p>

        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }} aria-hidden="true">
          {PASSOS.map((_, k) => (
            <span
              key={k}
              style={{
                width: 7, height: 7, borderRadius: '50%',
                background: k === i ? 'var(--accent)' : 'var(--line-strong)',
              }}
            />
          ))}
        </div>

        <div className="sheet-footer stack-2">
          <button className="btn-primary btn-block" onClick={avancar}>
            {ultimo ? 'Começar' : 'Próximo'}
          </button>
          {!ultimo && (
            <button className="btn-ghost btn-block" onClick={() => fechar(true)}>Pular</button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
