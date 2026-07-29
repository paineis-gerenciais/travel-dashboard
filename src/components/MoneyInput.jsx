import { money } from '../domain/format.js';

/**
 * Campo monetário com máscara: dígitos preenchem os centavos da direita para a
 * esquerda.
 *
 * Acessibilidade (T-1.8): NÃO define `aria-label` fixo. Antes definia
 * "Valor em reais", que sobrepunha o rótulo visível do `<Field>` que o envolve
 * — quem usa leitor de tela ouvia "Valor em reais" enquanto a tela dizia
 * "Custo por diária". Agora o rótulo visível prevalece; se algum uso futuro
 * ficar sem rótulo visível, passe `aria-label` explicitamente.
 */
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
      {...rest}
    />
  );
}
