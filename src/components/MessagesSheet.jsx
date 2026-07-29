import { useState, useEffect, useMemo } from 'react';
import { useTrip } from '../store/TripProvider.jsx';
import { subscribeAllComments } from '../lib/tripData.js';
import { fmtDate, money, num } from '../domain/format.js';
import { getTransportDate, getTransportOrigin, getTransportDest, getTransportMode } from '../domain/transport.js';
import { track } from '../lib/analytics.js';
import { Sheet, Row, EmptyState } from './ui.jsx';

/**
 * T-1.16 — Central de mensagens.
 *
 * Reúne num só lugar todos os comentários da viagem, mostra a que item cada um
 * se refere, e navega direto para ele.
 *
 * ESCOPO (decisão registrada no backlog): isto NÃO é um chat. Sem tempo real
 * com contador de não-lidas, sem notificação de nova mensagem — isso exigiria
 * back-end (push) e é Fase 2. A aposta aqui é em "conversa ancorada no item",
 * que reforça a coordenação familiar em vez de competir com o WhatsApp.
 */

const KIND_LABEL = {
  transports: { icon: '🚆', nome: 'Transporte' },
  foodItems: { icon: '🍽️', nome: 'Refeição' },
  attractions: { icon: '🎟️', nome: 'Atração' },
  otherExpenses: { icon: '💼', nome: 'Despesa' },
};

function timeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

export default function MessagesSheet({ tripId, onClose, onGoToItem }) {
  const { state } = useTrip();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) return;
    const unsub = subscribeAllComments(tripId, (list) => {
      setComments(list);
      setLoading(false);
    });
    return unsub;
  }, [tripId]);

  /** Resolve "foodItems:abc" para um rótulo legível + a data do item. */
  const resolve = useMemo(() => (itemKey) => {
    const [kind, id] = String(itemKey || '').split(':');
    const meta = KIND_LABEL[kind];
    const item = (state[kind] || []).find((x) => x.id === id);
    if (!meta || !item) return { existe: false, icon: '💬', titulo: 'Item removido', detalhe: '' };

    let titulo = '';
    if (kind === 'transports') titulo = `${getTransportMode(item) || 'Transporte'}: ${getTransportOrigin(item) || '—'} → ${getTransportDest(item) || '—'}`;
    else if (kind === 'foodItems') titulo = item.type || 'Refeição';
    else titulo = item.name || meta.nome;

    const date = kind === 'transports' ? getTransportDate(item) : item.date;
    const custo = num(item.cost) > 0 ? ` · ${money(num(item.cost))}` : '';
    return {
      existe: true,
      icon: meta.icon,
      titulo,
      detalhe: `${meta.nome}${date ? ` · ${fmtDate(date)}` : ''}${custo}`,
      date,
    };
  }, [state]);

  const ir = (itemKey, date) => {
    track('message_navigated_to_item');
    onGoToItem?.(itemKey, date);
    onClose();
  };

  return (
    <Sheet title="Mensagens" onClose={onClose}>
      <div className="stack">
        <p className="small t2" style={{ margin: 0 }}>
          Todas as conversas da viagem, em um lugar só. Toque numa mensagem para abrir o item que
          ela comenta.
        </p>

        {loading ? (
          <p className="t2">Carregando…</p>
        ) : comments.length === 0 ? (
          <EmptyState title="Nenhuma mensagem ainda">
            Comente em qualquer item na tela Dias — a conversa aparece aqui.
          </EmptyState>
        ) : (
          <div className="card card-flush">
            {comments.map((c) => {
              const r = resolve(c.itemKey);
              return (
                <Row
                  key={c.id}
                  icon={r.icon}
                  title={`${c.authorName}: ${c.text}`}
                  sub={r.existe ? r.detalhe : 'O item comentado não existe mais'}
                  value={<span className="tiny t3">{timeAgo(c.createdAtMs)}</span>}
                >
                  {r.existe && (
                    <button className="btn-ghost btn-sm" onClick={() => ir(c.itemKey, r.date)}>
                      Ir para o item →
                    </button>
                  )}
                </Row>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}
