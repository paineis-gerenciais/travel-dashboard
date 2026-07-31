import { useState } from 'react';
import { useTrip } from '../store/TripProvider.jsx';
import { participants, effectiveSplit } from '../domain/split.js';
import { num, money } from '../domain/format.js';
import { Field } from './ui.jsx';

/**
 * Campos de pagamento e rateio de uma despesa.
 *
 * Usado em três lugares (item do dia, hospedagem da cidade e o editor dentro da
 * divisão de despesas), por isso vive num componente próprio.
 *
 * - "Quem pagou" guarda o `id` do participante, nunca o nome — renomear alguém
 *   não desfaz o vínculo.
 * - O rateio é opcional: sem ele, a despesa é dividida igualmente. Ao ativar,
 *   os campos começam com a divisão igual e a soma é mostrada ao vivo. Valores
 *   que não somam 100 são normalizados proporcionalmente pelo domínio, então
 *   digitar 3 e 1 equivale a 75% e 25% — o aviso na tela explica isso.
 */
export default function PaymentFields({ item, valor, onChange }) {
  const { state } = useTrip();
  const people = participants(state);
  const temRateio = !!(item.split && typeof item.split === 'object' && Object.keys(item.split).length);
  const [aberto, setAberto] = useState(temRateio);

  const pcts = effectiveSplit(state, item);
  const soma = Object.values(item.split || {}).reduce((a, b) => a + num(b), 0);

  const ativarRateio = () => {
    // começa da divisão igual, para a pessoa só ajustar o que quer mudar
    const igual = {};
    people.forEach((p) => { igual[p.id] = Number((100 / people.length).toFixed(2)); });
    onChange('split', igual);
    setAberto(true);
  };

  const limparRateio = () => {
    onChange('split', undefined);
    setAberto(false);
  };

  const setPct = (id, v) => {
    const novo = { ...(item.split || {}) };
    const n = num(v);
    if (n > 0) novo[id] = n; else delete novo[id];
    onChange('split', Object.keys(novo).length ? novo : undefined);
  };

  return (
    <>
      <Field label="Quem pagou">
        <select value={item.paidBy || ''} onChange={(e) => onChange('paidBy', e.target.value)}>
          <option value="">Ainda não definido</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>

      <div className="field">
        <span>Responsabilidade pelo gasto</span>
        {!aberto ? (
          <>
            <p className="small t2" style={{ margin: 0 }}>
              Dividido igualmente entre {people.length} {people.length === 1 ? 'participante' : 'participantes'}.
            </p>
            <button type="button" className="btn-sm" onClick={ativarRateio}>
              Definir percentual por pessoa
            </button>
          </>
        ) : (
          <div className="stack-2">
            {people.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span className="small" style={{ flex: 1 }}>{p.name}</span>
                <input
                  type="number" min="0" max="100" inputMode="numeric"
                  aria-label={`Percentual de ${p.name}`}
                  value={item.split?.[p.id] ?? ''}
                  onChange={(e) => setPct(p.id, e.target.value)}
                  style={{ maxWidth: 80, textAlign: 'right' }}
                />
                <span className="small t2" style={{ width: 16 }}>%</span>
                <span className="tiny t3 num" style={{ minWidth: 74, textAlign: 'right' }}>
                  {money((num(valor) * num(pcts[p.id])) / 100)}
                </span>
              </div>
            ))}
            <p className="tiny t3" style={{ margin: 0 }}>
              Soma: {soma.toFixed(0)}%{Math.round(soma) !== 100 && ' — será ajustada proporcionalmente'}
            </p>
            <button type="button" className="btn-ghost btn-sm" onClick={limparRateio}>
              Voltar para divisão igual
            </button>
          </div>
        )}
      </div>
    </>
  );
}
