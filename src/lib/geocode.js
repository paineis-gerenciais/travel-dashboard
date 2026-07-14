// lib/geocode.js — geocodificação client-side (Fase 5, item 5.D).
//
// Decisão de infraestrutura, registrada por transparência: em vez de assumir
// uma dependência de API paga (Google Maps/Mapbox), o mapa embutido usa
// OpenStreetMap + Nominatim, que são gratuitos e não exigem chave. A política
// de uso do Nominatim pede: identificar a aplicação, no máximo 1 requisição
// por segundo, e cachear resultados para não repetir buscas — é exatamente o
// que este helper faz. Para uso pessoal/familiar (poucas buscas por sessão),
// isso é adequado; um app com tráfego alto precisaria de um provedor pago ou
// self-hosted.

const CACHE_KEY = 'trip_geocode_cache_v1';
let queue = Promise.resolve();

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}
function saveCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* ignore */ }
}

/** Geocodifica um texto livre (ex.: "Torre de Belém Lisboa") -> {lat, lon} | null. */
export async function geocode(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  const cache = loadCache();
  if (cache[q] !== undefined) return cache[q];

  // Enfileira: no máximo 1 requisição por segundo, como pede a política do Nominatim.
  const result = await (queue = queue.then(async () => {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || data.length === 0) return null;
      return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
    } catch {
      return null;
    }
  }));

  cache[q] = result;
  saveCache(cache);
  return result;
}
