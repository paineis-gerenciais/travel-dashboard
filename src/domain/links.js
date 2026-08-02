// domain/links.js — Caminho A: anexos como LINKS externos.
//
// O app não hospeda arquivo nenhum: ele guarda o endereço de onde o documento
// já vive (Drive, e-mail, Dropbox) e dá contexto — a que dia e a que item aquele
// comprovante pertence. Decisão registrada em `plano_anexos_v1.md`: guardar
// arquivos de verdade exige Cloud Storage, que desde fev/2026 exige plano Blaze.
//
// Esta camada é pura e testável: validação, rótulo e a coleta que alimenta a
// central de anexos.

/** Só `https`. Link em texto puro não vira link; `http` é recusado. */
export function isValidLink(url) {
  const v = String(url || '').trim();
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Domínio legível de um link, para usar como rótulo quando não houver um. */
export function linkDomain(url) {
  try {
    return new URL(String(url || '').trim()).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Normaliza o que a pessoa colou. Colar sem protocolo é o caso mais comum, e
 * assumimos `https://` — nunca `http://`, para não rebaixar a segurança em
 * silêncio.
 */
export function normalizeLinkInput(url) {
  const v = String(url || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v.replace(/^http:\/\//i, 'https://');
  return `https://${v}`;
}

/** Rótulo de exibição: o que a pessoa escreveu, ou o domínio como reserva. */
export function linkLabel(link) {
  const label = String(link?.label || '').trim();
  return label || linkDomain(link?.url) || 'Documento';
}

/** Um item tem anexo? */
export function hasLink(item) {
  return isValidLink(item?.link?.url);
}

const ORIGENS = [
  ['cities', '🛏️', (x) => x.hotel || x.city || 'Hospedagem', (x) => x.start],
  ['transports', '🚆', (x) => x.mode || 'Transporte', (x) => x.date],
  ['foodItems', '🍽️', (x) => x.type || 'Refeição', (x) => x.date],
  ['attractions', '🎟️', (x) => x.name || 'Atração', (x) => x.date],
  ['otherExpenses', '💼', (x) => x.name || 'Despesa', (x) => x.date],
  ['checklist', '✅', (x) => x.item || 'Checklist', () => ''],
];

/**
 * Todos os anexos da viagem, para a central.
 *
 * Inclui os documentos gerais (`settings.documents`), que não pertencem a
 * nenhum dia — seguro-viagem, passaporte —, marcados com `kind: 'documents'` e
 * sem data, para aparecerem no topo.
 */
export function collectLinks(state) {
  const out = [];

  (state.settings?.documents || []).forEach((d) => {
    if (!isValidLink(d.url)) return;
    out.push({
      kind: 'documents',
      id: d.id,
      icon: '📄',
      origem: 'Documento da viagem',
      date: '',
      label: linkLabel(d),
      url: d.url,
      navegavel: false,
    });
  });

  ORIGENS.forEach(([kind, icon, rotulo, data]) => {
    (state[kind] || []).forEach((x) => {
      if (!hasLink(x)) return;
      out.push({
        kind,
        id: x.id,
        icon,
        origem: rotulo(x),
        date: data(x) || '',
        label: linkLabel(x.link),
        url: x.link.url,
        // só itens de dia levam à tela Dias; cidade e checklist têm tela própria
        navegavel: ['transports', 'foodItems', 'attractions', 'otherExpenses'].includes(kind),
      });
    });
  });

  // documentos gerais primeiro; o resto por data
  return out.sort((a, b) => {
    if (!a.date && b.date) return -1;
    if (a.date && !b.date) return 1;
    return String(a.date).localeCompare(String(b.date));
  });
}

/** Quantos anexos a viagem tem (para o contador no cabeçalho). */
export function countLinks(state) {
  return collectLinks(state).length;
}
