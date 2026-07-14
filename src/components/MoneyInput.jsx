import { money } from '../domain/format.js';

/** Campo monetário com máscara: dígitos preenchem os centavos da direita para a esquerda. */
export default function MoneyInput({ value, onChange, className = '', ...rest }) {
  const display = money(value || 0).replace('R$ ', '');
  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    onChange(digits ? Number(digits) / 100 : 0);
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      className={`input-money ${(value || 0) === 0 ? 'money-zero' : ''} ${className}`.trim()}
      value={display}
      onChange={handleChange}
      aria-label="Valor em reais"
      {...rest}
    />
  );
}
