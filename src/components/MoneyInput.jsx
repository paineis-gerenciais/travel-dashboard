// components/MoneyInput.jsx — máscara monetária real (Fase 3, item 3.3).
// Em vez de tolerar formato depois de digitado, formata enquanto digita:
// o usuário digita dígitos e eles preenchem os centavos da direita para a
// esquerda (ex.: 1 2 3 4 -> "12,34"). Devolve sempre um número via onChange.
import { money } from '../domain/format.js';

export default function MoneyInput({ value, onChange, ...rest }) {
  // Exibe o valor formatado sem o prefixo "R$ " (a coluna já indica custo).
  const display = money(value || 0).replace('R$ ', '');

  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    const numeric = digits ? Number(digits) / 100 : 0;
    onChange(numeric);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      aria-label="Valor em reais"
      {...rest}
    />
  );
}
