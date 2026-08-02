import { useState } from 'react';
import { useTrip } from '../store/TripProvider.jsx';
import { collectLinks, isValidLink, normalizeLinkInput } from '../domain/links.js';
import { fmtDate } from '../domain/format.js';
import { track } from '../lib/analytics.js';
import { Sheet, Row, EmptyState, Field, useToast } from './ui.jsx';

/**
 * Central de anexos — espelha deliberadamente a central de mensagens.
 *
 * Reúne todos os links da viagem num lugar, mostra a que item cada um pertence
 * e leva até ele, reaproveitando o mesmo mecanismo de navegação por item.
 * Não faz nenhuma leitura extra do Firestore: os dados já estão carregados.
 */
export default function AttachmentsSheet({ onClose, onGoToItem }) {
  const { state } = useTrip();
  const [gerenciando, setGerenciando] = useState(false);
  const links = collectLinks(state);

  const gerais = links.filter((l) => l.kind === 'documents');
  const doDia = links.filter((l) => l.kind !== 'documents');

  const ir = (l) => {
    track('attachment_navigated_to_item');
    onGoToItem?.(`${l.kind}:${l.id}`, l.date);
    onClose();
  };

  const abrir = (l) => {
    track('attachment_opened', { kind: l.kind });
    window.open(l.url, '_blank', 'noreferrer');
  };

  return (
    <Sheet title="Anexos" onClose={onClose}>
      <div className="stack">
        <p className="small t2" style={{ margin: 0 }}>
          Todos os comprovantes da viagem em um lugar. Os arquivos ficam onde você os guardou —
          o app aponta para eles.
        </p>

        <div className="row-between">
          <h3 style={{ margin: 0 }}>Documentos da viagem</h3>
          <button className="btn-ghost btn-sm" onClick={() => setGerenciando((v) => !v)}>
            {gerenciando ? 'Concluir' : 'Gerenciar'}
          </button>
        </div>

        {gerenciando ? (
          <DocumentsEditor />
        ) : gerais.length === 0 ? (
          <p className="small t2" style={{ margin: 0 }}>
            Nenhum documento geral. Use <b>Gerenciar</b> para guardar seguro-viagem, passaporte ou
            o roteiro em PDF.
          </p>
        ) : (
          <div className="card card-flush">
            {gerais.map((l) => (
              <Row
                key={`${l.kind}:${l.id}`}
                icon={l.icon}
                title={l.label}
                sub={l.origem}
                value={<button className="btn-ghost btn-sm" onClick={() => abrir(l)}>Abrir →</button>}
              />
            ))}
          </div>
        )}

        <h3 style={{ margin: 0 }}>Por item</h3>
        {doDia.length === 0 ? (
          <EmptyState title="Nenhum comprovante anexado">
            Ao editar um transporte, hospedagem, refeição, atração ou item do checklist, cole o link
            do comprovante — ele aparece aqui.
          </EmptyState>
        ) : (
          <div className="card card-flush">
            {doDia.map((l) => (
              <Row
                key={`${l.kind}:${l.id}`}
                icon={l.icon}
                title={l.label}
                sub={`${l.origem}${l.date ? ` · ${fmtDate(l.date)}` : ''}`}
              >
                <button className="btn-sm" onClick={() => abrir(l)}>Abrir</button>
                {l.navegavel && (
                  <button className="btn-ghost btn-sm" onClick={() => ir(l)}>Ir para o item →</button>
                )}
              </Row>
            ))}
          </div>
        )}

        <div className="sheet-footer stack-2">
          <button className="btn-primary btn-block" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </Sheet>
  );
}

/** Documentos que não pertencem a nenhum dia: seguro, passaporte, apólice. */
function DocumentsEditor() {
  const { state, actions } = useTrip();
  const notify = useToast();
  const docs = state.settings.documents || [];
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [erro, setErro] = useState('');

  const adicionar = () => {
    const limpa = normalizeLinkInput(url);
    if (!isValidLink(limpa)) { setErro('Cole o link completo do documento.'); return; }
    setErro('');
    actions.addDocument(label, limpa);
    setLabel('');
    setUrl('');
    track('document_added');
  };

  return (
    <div className="stack-2">
      {docs.map((d, i) => (
        <div key={d.id} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
          <input
            value={d.label || ''}
            placeholder="Nome do documento"
            aria-label={`Nome do documento ${i + 1}`}
            onChange={(e) => actions.setDocumentField(d.id, 'label', e.target.value)}
            style={{ flex: 1 }}
          />
          <a className="btn btn-sm" href={d.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${d.label || 'documento'}`}>Abrir</a>
          <button
            className="btn-danger btn-sm"
            aria-label={`Remover ${d.label || 'documento'}`}
            onClick={() => { actions.removeDocument(d.id); notify('Documento removido.'); }}
          >
            ✕
          </button>
        </div>
      ))}

      <Field label="Novo documento">
        <input placeholder="Seguro-viagem" value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <input
        type="url"
        inputMode="url"
        placeholder="https://…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && adicionar()}
      />
      {erro && <span className="tiny" style={{ color: 'var(--danger)' }} role="alert">{erro}</span>}
      <button className="btn-primary btn-sm" onClick={adicionar}>Adicionar documento</button>
    </div>
  );
}
