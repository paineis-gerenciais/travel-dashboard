import { useState } from 'react';
import { isValidLink, normalizeLinkInput, linkDomain } from '../domain/links.js';
import { Field } from './ui.jsx';

/**
 * Campo de anexo por LINK, usado no editor de item, de cidade e do checklist.
 *
 * O app não hospeda o arquivo — guarda o endereço de onde ele já vive. Por isso
 * o aviso de conteúdo externo: quem abrir precisa ter acesso àquele arquivo
 * (no Drive, por exemplo), e o app não tem como conceder esse acesso nem saber
 * se o link quebrou.
 */
export default function LinkField({ link, onChange }) {
  const [url, setUrl] = useState(link?.url || '');
  const [label, setLabel] = useState(link?.label || '');
  const [erro, setErro] = useState('');

  const salvar = (novaUrl, novoLabel) => {
    const limpa = normalizeLinkInput(novaUrl);
    if (!limpa) {
      setErro('');
      onChange('link', undefined);
      return;
    }
    if (!isValidLink(limpa)) {
      setErro('Endereço inválido. Cole o link completo do documento.');
      return;
    }
    setErro('');
    onChange('link', { url: limpa, label: String(novoLabel || '').trim() });
  };

  const remover = () => {
    setUrl('');
    setLabel('');
    setErro('');
    onChange('link', undefined);
  };

  const valido = isValidLink(link?.url);

  return (
    <>
      <Field label="Link do comprovante">
        <input
          type="url"
          inputMode="url"
          placeholder="https://… (Drive, e-mail, Dropbox)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => salvar(url, label)}
          aria-describedby={erro ? 'link-erro' : undefined}
        />
        {erro && <span id="link-erro" className="tiny" style={{ color: 'var(--danger)' }} role="alert">{erro}</span>}
      </Field>

      {(url || valido) && (
        <Field label="Como chamar este documento">
          <input
            placeholder="Voucher, passagem, reserva…"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => salvar(url, label)}
          />
          <span className="tiny t3">
            Se ficar vazio, usamos o site de origem{linkDomain(url) ? ` (${linkDomain(url)})` : ''}.
          </span>
        </Field>
      )}

      {valido && (
        <div className="stack-2">
          <a className="btn btn-block" href={link.url} target="_blank" rel="noreferrer">
            📎 Abrir documento
          </a>
          <p className="tiny t3" style={{ margin: 0 }}>
            O arquivo fica onde você o guardou — o app só aponta para ele. Quem compartilha a viagem
            precisa ter acesso a esse link também.
          </p>
          <button type="button" className="btn-ghost btn-sm" onClick={remover}>Remover link</button>
        </div>
      )}
    </>
  );
}
