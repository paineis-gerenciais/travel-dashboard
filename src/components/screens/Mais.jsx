import { useState, useRef } from 'react';
import { useTrip } from '../../store/TripProvider.jsx';
import { useTrips } from '../../store/TripsProvider.jsx';
import { money, fmtDate, num } from '../../domain/format.js';
import { totals, checklistStats } from '../../domain/costs.js';
import { allPlanningDates, uniqueCities, mainCities } from '../../domain/dates.js';
import { normalizeState } from '../../domain/state.js';
import { logError } from '../../lib/logger.js';
import { Row, Sheet, Metric, EmptyState, StatusChip, CHECKLIST_STATUS, SearchField, useToast } from '../ui.jsx';
import { appUrl, whatsappUrl, nativeShare, copyToClipboard } from '../../lib/invite.js';
import { track } from '../../lib/analytics.js';
import { countLinks, hasLink } from '../../domain/links.js';
import LinkField from '../LinkField.jsx';
import SheetImportSheet from '../SheetImportSheet.jsx';
import { sendFeedback } from '../../lib/tripData.js';
import {
  remindersEnabled, setRemindersEnabled, notificationsSupported,
  notificationPermission, requestNotificationPermission,
} from '../../lib/reminders.js';
import VersionsModal from '../VersionsModal.jsx';
import ShareModal from '../ShareModal.jsx';
import DiagnosticsModal from '../DiagnosticsModal.jsx';
import ActivityFeed from '../ActivityFeed.jsx';

/**
 * MAIS — resumo da viagem, checklist e todas as ações que antes viviam num menu
 * de 16 botões. Tudo alcançável em no máximo 2 toques. (Fase R2.)
 */
export default function Mais({ user, tripId, theme, toggleTheme, onLogout, onOpenAttachments }) {
  const { state, actions } = useTrip();
  const { activeTripId, trips, actions: tripsActions } = useTrips();
  const [sheet, setSheet] = useState(null);
  const fileRef = useRef(null);

  const t = totals(state);
  const dates = allPlanningDates(state);
  const cs = checklistStats(state);
  const trav = Math.max(1, num(state.settings.travelers) || 1);
  const activeTrip = trips.find((x) => x.id === activeTripId);
  const isOwner = activeTrip ? activeTrip.ownerId === user.uid : true;

  const exportJSON = () => {
    try {
      const cityName = (mainCities(state)[0] || 'viagem').replace(/\s+/g, '-');
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `dados-viagem-${cityName}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } catch (e) { logError('exportJSON', e); }
  };

  const importJSON = (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || !Array.isArray(obj.cities)) throw new Error('Estrutura inválida');
        if (confirm('Importar dados e substituir o conteúdo desta viagem?')) {
          actions.replaceState(normalizeState(obj));
        }
      } catch (e) { logError('importJSON', e); alert('Arquivo JSON inválido.'); }
    };
    reader.readAsText(file);
    ev.target.value = '';
  };

  return (
    <div className="screen">
      <div className="container stack">
        <h2>Mais</h2>

        {dates.length > 0 && (
          <>
            <div className="grid-metrics">
              <Metric label="Dias" value={dates.length} />
              <Metric label="Cidades" value={uniqueCities(state).length} />
              <Metric label="Total" value={money(t.total)} />
              <Metric label="Por pessoa" value={money(t.total / trav)} />
            </div>
            <div className="card">
              <p style={{ margin: 0 }}>
                A viagem passa por <b>{uniqueCities(state).join(', ')}</b>, de{' '}
                {fmtDate(dates[0].date)} a {fmtDate(dates.at(-1).date)}.
              </p>
            </div>
          </>
        )}

        <ActivityFeed tripId={tripId} />

        <div className="card card-flush">
          <Row icon="✅" title="Checklist" sub={`${cs.done} de ${cs.total} concluídos`}
            value={<button className="btn-ghost btn-sm" onClick={() => setSheet('checklist')} aria-label="Abrir Checklist">Abrir →</button>} />
          <Row icon="📎" title="Anexos" sub={`${countLinks(state)} comprovante(s) e documento(s)`}
            value={<button className="btn-ghost btn-sm" onClick={onOpenAttachments} aria-label="Abrir Anexos">Abrir →</button>} />
          <Row icon="🤝" title="Compartilhar" sub="Convidar pessoas para a viagem"
            value={<button className="btn-ghost btn-sm" onClick={() => setSheet('share')} aria-label="Abrir Compartilhar">Abrir →</button>} />
          <Row icon="🗂️" title="Versões salvas" sub="Guardar ou voltar a um ponto anterior"
            value={<button className="btn-ghost btn-sm" onClick={() => setSheet('versions')} aria-label="Abrir Versões salvas">Abrir →</button>} />
          <Row icon="🔗" title="Enviar link do app" sub="Sem convite: só o endereço, por WhatsApp ou cópia"
            value={<button className="btn-ghost btn-sm" onClick={() => setSheet('applink')}>Enviar →</button>} />
        </div>

        <div className="card card-flush">
          <Row icon="🔔" title="Lembretes" sub={<RemindersSub />}
            value={<RemindersToggle />} />
          <Row icon="🎨" title="Tema" sub={theme === 'dark' ? 'Escuro' : 'Claro'}
            value={<button className="btn-ghost btn-sm" onClick={toggleTheme}>Alternar</button>} />
          <Row icon="📄" title="Exportar PDF do roteiro" sub="Versão organizada para mandar no grupo ou imprimir"
            value={<button className="btn-ghost btn-sm" onClick={() => setSheet('pdf')}>Gerar →</button>} />
          <Row icon="📊" title="Planilha" sub="Modelo, exportar, importar e colar da planilha"
            value={<button className="btn-ghost btn-sm" onClick={() => setSheet('planilha')} aria-label="Abrir Planilha">Abrir →</button>} />
          <Row icon="⬇️" title="Exportar JSON" sub="Baixar os dados desta viagem (cópia de segurança)"
            value={<button className="btn-ghost btn-sm" onClick={exportJSON}>Exportar</button>} />
          <Row icon="⬆️" title="Importar JSON" sub="Substituir o conteúdo por um arquivo"
            value={<button className="btn-ghost btn-sm" onClick={() => fileRef.current.click()}>Importar</button>} />
          <Row icon="🩺" title="Diagnóstico" sub="Erros registrados nesta sessão"
            value={<button className="btn-ghost btn-sm" onClick={() => setSheet('diag')} aria-label="Abrir Diagnóstico">Abrir →</button>} />
          <Row icon="💡" title="Enviar feedback" sub="Reportar um problema ou sugerir algo"
            value={<button className="btn-ghost btn-sm" onClick={() => { setSheet('feedback'); track('feedback_opened'); }} aria-label="Abrir Enviar feedback">Abrir →</button>} />
        </div>

        <div className="card card-flush">
          <Row icon="📋" title="Duplicar esta viagem" sub="Criar uma cópia para reaproveitar o roteiro"
            value={<button className="btn-ghost btn-sm" onClick={() => setSheet('duplicate')}>Duplicar →</button>} />
          <Row icon="🧳" title="Minhas viagens" sub="Trocar de viagem"
            value={<button className="btn-ghost btn-sm" onClick={() => tripsActions.closeTrip()}>Trocar</button>} />
          <Row icon="🚪" title="Sair" sub={user?.email}
            value={<button className="btn-ghost btn-sm" onClick={onLogout}>Sair</button>} />
        </div>

        <div className="card card-flush">
          <Row icon="🧹" title="Limpar viagem" sub="Apaga o conteúdo desta viagem. As versões salvas ficam."
            value={<button className="btn-danger btn-sm" onClick={() => setSheet('clear')}>Limpar</button>} />
        </div>

        <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={importJSON} />
      </div>

      {sheet === 'checklist' && <ChecklistSheet onClose={() => setSheet(null)} />}
      {sheet === 'share' && (
        <Sheet title="Compartilhar" onClose={() => setSheet(null)}>
          <ShareModal tripId={activeTripId} tripName={activeTrip?.name || 'Viagem'} user={user} isOwner={isOwner} />
        </Sheet>
      )}
      {sheet === 'versions' && (
        <Sheet title="Versões salvas" onClose={() => setSheet(null)}>
          <VersionsModal tripId={activeTripId} onClose={() => setSheet(null)} />
        </Sheet>
      )}
      {sheet === 'diag' && (
        <Sheet title="Diagnóstico" onClose={() => setSheet(null)}>
          <DiagnosticsModal />
        </Sheet>
      )}
      {sheet === 'applink' && <AppLinkSheet onClose={() => setSheet(null)} />}
      {sheet === 'feedback' && <FeedbackSheet user={user} onClose={() => setSheet(null)} />}
      {sheet === 'planilha' && <SheetImportSheet onClose={() => setSheet(null)} />}
      {sheet === 'duplicate' && <DuplicateSheet onClose={() => setSheet(null)} />}
      {sheet === 'pdf' && <PdfSheet onClose={() => setSheet(null)} />}
      {sheet === 'clear' && (
        <Sheet title="Limpar viagem" onClose={() => setSheet(null)}>
          <p>
            Isso apaga o conteúdo atual desta viagem (cidades, custos, checklist). As
            <b> versões salvas continuam intactas</b> e as outras viagens não são afetadas.
          </p>
          <div className="stack-2">
            <button className="btn-danger btn-block" onClick={() => { actions.clearCurrent(); setSheet(null); }}>
              Limpar esta viagem
            </button>
            <button className="btn-ghost btn-block" onClick={() => setSheet(null)}>Cancelar</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function ChecklistSheet({ onClose }) {
  const { state, actions } = useTrip();
  const [item, setItem] = useState('');
  const [linkChecklist, setLinkChecklist] = useState(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const cs = checklistStats(state);

  // T-1.10: busca por texto + filtro por status, tudo no cliente.
  const norm = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const visiveis = state.checklist
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => (q ? norm(c.item).includes(norm(q)) : true))
    .filter(({ c }) => (statusFilter === 'todos' ? true : c.status === statusFilter));

  const add = () => {
    if (!item.trim()) return;
    actions.addChecklist(item.trim());
    setItem('');
  };

  return (
    <Sheet title={`Checklist · ${cs.done}/${cs.total}`} onClose={onClose}>
      <div className="stack">
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <input placeholder="Novo item" value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="btn-primary" onClick={add}>Add</button>
        </div>

        {state.checklist.length > 3 && (
          <div className="stack-2">
            <SearchField value={q} onChange={(v) => { setQ(v); if (v) track('list_filtered', { area: 'checklist' }); }} placeholder="Buscar item…" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrar por status">
              <option value="todos">Todos os status</option>
              {CHECKLIST_STATUS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}

        {linkChecklist != null && state.checklist[linkChecklist] && (
          <Sheet title="Anexar link" onClose={() => setLinkChecklist(null)}>
            <div className="stack">
              <p className="small t2" style={{ margin: 0 }}>
                {state.checklist[linkChecklist].item || 'Item do checklist'}
              </p>
              <LinkField
                link={state.checklist[linkChecklist].link}
                onChange={(key, value) => actions.updateItem('checklist', linkChecklist, key, value)}
              />
              <div className="sheet-footer stack-2">
                <button className="btn-primary btn-block" onClick={() => setLinkChecklist(null)}>Concluir</button>
              </div>
            </div>
          </Sheet>
        )}

        {state.checklist.length === 0 ? (
          <EmptyState
            title="Checklist vazio"
            action={<button className="btn-primary" onClick={() => actions.seedChecklist()}>Usar lista sugerida</button>}
          >
            Adicione itens acima, ou comece de uma lista pronta com o essencial de viagem.
          </EmptyState>
        ) : (
          <div className="card card-flush">
            {visiveis.length === 0 && (
              <p className="small t2" style={{ padding: 'var(--sp-4)', margin: 0 }}>Nenhum item encontrado.</p>
            )}
            {visiveis.map(({ c, i }) => (
              <div className="row" key={c.id}>
                <input
                  type="checkbox"
                  checked={!!c.done}
                  aria-label={c.item}
                  onChange={(e) => actions.toggleChecklist(i, e.target.checked)}
                />
                <div className="row-main">
                  <input
                    value={c.item}
                    onChange={(e) => actions.updateItem('checklist', i, 'item', e.target.value)}
                    style={{ border: 0, padding: 0, minHeight: 0, fontWeight: 600, textDecoration: c.done ? 'line-through' : 'none' }}
                  />
                  <div className="row-actions">
                    <StatusChip value={c.status} options={CHECKLIST_STATUS} onChange={(v) => actions.updateItem('checklist', i, 'status', v)} />
                    <button className="btn-ghost btn-sm" onClick={() => setLinkChecklist(i)}>
                      {hasLink(c) ? '📎 Link' : 'Anexar link'}
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => actions.deleteItem('checklist', i)}>Excluir</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function AppLinkSheet({ onClose }) {
  const [copied, setCopied] = useState(false);
  const text = `Plano de viagem: ${appUrl()}`;
  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <Sheet title="Enviar link do app" onClose={onClose}>
      <div className="stack">
        <p className="small t2" style={{ margin: 0 }}>
          Isto envia só o endereço do app — não dá acesso a nenhuma viagem. Para dar acesso, use
          Compartilhar e convide o e-mail da pessoa.
        </p>
        <div className="stack-2">
          <a className="btn btn-primary btn-block" href={whatsappUrl(text)} target="_blank" rel="noreferrer">
            💬 Enviar pelo WhatsApp
          </a>
          {hasNativeShare && (
            <button className="btn-block" onClick={() => nativeShare('Plano de viagem', text)}>📤 Compartilhar…</button>
          )}
          <button className="btn-block" onClick={async () => setCopied(await copyToClipboard(appUrl()))}>
            {copied ? '✅ Link copiado' : '📋 Copiar link'}
          </button>
        </div>
        <p className="small t3" style={{ margin: 0, wordBreak: 'break-all' }}>{appUrl()}</p>
      </div>
    </Sheet>
  );
}

function FeedbackSheet({ user, onClose }) {
  const notify = useToast();
  const [category, setCategory] = useState('ideia');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const t = text.trim();
    if (!t) { setError('Escreva sua mensagem antes de enviar.'); return; }
    setBusy(true); setError('');
    try {
      await sendFeedback(user, category, t);
      track('feedback_sent', { category });
      notify('Obrigado! Seu feedback foi enviado.');
      onClose();
    } catch (e) {
      setError('Não foi possível enviar agora: ' + e.message);
    } finally { setBusy(false); }
  };

  return (
    <Sheet title="Enviar feedback" onClose={onClose}>
      <div className="stack">
        <p className="small t2" style={{ margin: 0 }}>
          Sua opinião guia o que construímos a seguir. Conte o que atrapalhou ou o que faria
          diferença para você.
        </p>
        <label className="field">
          <span>Tipo</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="ideia">Sugestão / ideia</option>
            <option value="bug">Problema / erro</option>
            <option value="outro">Outro</option>
          </select>
        </label>
        <label className="field">
          <span>Mensagem</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva aqui…" />
        </label>
        {error && <p className="small" style={{ color: 'var(--danger)', margin: 0 }} role="alert">{error}</p>}
        <div className="sheet-footer stack-2">
          <button className="btn-primary btn-block" onClick={send} disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar'}
          </button>
          <button className="btn-ghost btn-block" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- T-1.6: duplicar viagem ---------- */
function DuplicateSheet({ onClose }) {
  const { state } = useTrip();
  const { trips, activeTripId, actions: tripsActions } = useTrips();
  const notify = useToast();
  const atual = trips.find((t) => t.id === activeTripId);
  const [name, setName] = useState(`Cópia de ${atual?.name || 'viagem'}`);
  const [shift, setShift] = useState(0);
  const [busy, setBusy] = useState(false);

  const duplicate = async () => {
    setBusy(true);
    try {
      await tripsActions.duplicateTrip(state, name.trim() || 'Cópia', Number(shift) || 0);
      notify('Viagem duplicada.');
      onClose();
    } catch (e) {
      notify('Não foi possível duplicar: ' + e.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <Sheet title="Duplicar viagem" onClose={onClose}>
      <div className="stack">
        <p className="small t2" style={{ margin: 0 }}>
          Cria uma cópia com as cidades, itens e checklist. <b>Não</b> copia membros, versões salvas
          nem comentários — a cópia começa só sua.
        </p>
        <label className="field">
          <span>Nome da cópia</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Deslocar as datas (dias)</span>
          <input type="number" inputMode="numeric" value={shift} onChange={(e) => setShift(e.target.value)} />
          <span className="tiny t3">0 mantém as datas originais. Ex.: 365 joga a viagem para o ano que vem.</span>
        </label>
        <div className="sheet-footer stack-2">
          <button className="btn-primary btn-block" onClick={duplicate} disabled={busy}>
            {busy ? 'Duplicando…' : 'Duplicar'}
          </button>
          <button className="btn-ghost btn-block" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- T-1.5: PDF do roteiro ---------- */
function PdfSheet({ onClose }) {
  const notify = useToast();
  const gerar = () => {
    track('pdf_exported');
    onClose();
    // deixa o sheet fechar antes de abrir o diálogo de impressão
    setTimeout(() => window.print(), 120);
  };
  return (
    <Sheet title="Exportar PDF do roteiro" onClose={onClose}>
      <div className="stack">
        <p className="small t2" style={{ margin: 0 }}>
          Gera uma versão organizada da viagem — capa, um bloco por dia com os itens em ordem de
          horário, e o resumo de custos.
        </p>
        <p className="small t2" style={{ margin: 0 }}>
          Na janela que abrir, escolha <b>“Salvar como PDF”</b> como destino para gerar o arquivo,
          ou uma impressora para imprimir direto.
        </p>
        <div className="sheet-footer stack-2">
          <button className="btn-primary btn-block" onClick={gerar}>Gerar PDF</button>
          <button className="btn-ghost btn-block" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- T-1.11: lembretes locais ---------- */
function RemindersSub() {
  if (!notificationsSupported()) return 'Não disponível neste navegador';
  const p = notificationPermission();
  if (p === 'denied') return 'Bloqueado nas permissões do navegador';
  return remindersEnabled() ? 'Ativados: check-in e pendências do dia seguinte' : 'Avisos de check-in e pendências';
}

function RemindersToggle() {
  const notify = useToast();
  const [on, setOn] = useState(remindersEnabled());
  const [busy, setBusy] = useState(false);

  if (!notificationsSupported()) return <span className="tiny t3">—</span>;

  const alternar = async () => {
    if (on) {
      setRemindersEnabled(false);
      setOn(false);
      track('reminder_scheduled', { result: 'off' });
      return;
    }
    setBusy(true);
    // pede permissão só AGORA, quando a pessoa demonstrou interesse
    const perm = await requestNotificationPermission();
    track('reminder_permission', { result: perm });
    if (perm === 'granted') {
      setRemindersEnabled(true);
      setOn(true);
      notify('Lembretes ativados.');
    } else {
      notify('Permissão de notificação negada.', 'error');
    }
    setBusy(false);
  };

  return (
    <button className="btn-ghost btn-sm" onClick={alternar} disabled={busy}>
      {on ? 'Desativar' : 'Ativar'}
    </button>
  );
}
