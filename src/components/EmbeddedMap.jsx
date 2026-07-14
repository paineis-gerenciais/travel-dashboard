import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocode } from '../lib/geocode.js';

// Ícones padrão do Leaflet via CDN (evita problemas de resolução de asset do
// bundler para os PNGs do pacote — funciona igual, sem passo de build extra).
const DEFAULT_ICON = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

/**
 * Rethink 5.D — mapa interativo embutido. Usa OpenStreetMap (via Leaflet) em
 * vez de um link externo para o Google Maps. Os pontos (nome/local) são
 * geocodificados no navegador do usuário (ver lib/geocode.js) e cacheados, para
 * não repetir buscas. Sem chave de API — decisão registrada em geocode.js.
 */
export default function EmbeddedMap({ points }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ok | empty | error

  useEffect(() => {
    let alive = true;
    if (!mapInstance.current && mapRef.current) {
      mapInstance.current = L.map(mapRef.current, { scrollWheelZoom: false }).setView([38.7, -9.1], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(mapInstance.current);
    }
    const map = mapInstance.current;
    const layer = L.layerGroup().addTo(map);

    (async () => {
      setStatus('loading');
      const coords = [];
      for (const p of points) {
        const g = await geocode(p.query);
        if (!alive) return;
        if (g) coords.push({ ...g, label: p.label });
      }
      if (!alive) return;
      layer.clearLayers();
      if (coords.length === 0) {
        setStatus('empty');
        return;
      }
      coords.forEach((c) => {
        L.marker([c.lat, c.lon], { icon: DEFAULT_ICON }).addTo(layer).bindPopup(c.label);
      });
      const bounds = L.latLngBounds(coords.map((c) => [c.lat, c.lon]));
      map.fitBounds(bounds.pad(0.25));
      setStatus('ok');
    })().catch(() => alive && setStatus('error'));

    return () => { layer.clearLayers(); };
  }, [points]);

  return (
    <div>
      <div ref={mapRef} style={{ height: 280, borderRadius: 12, border: '1px solid var(--line)' }} />
      {status === 'loading' && <p className="hint" style={{ marginTop: 6 }}>Localizando os pontos do dia…</p>}
      {status === 'empty' && <p className="hint" style={{ marginTop: 6 }}>Nenhum ponto pôde ser localizado neste dia.</p>}
      {status === 'error' && <p className="hint" style={{ marginTop: 6 }}>Não foi possível carregar o mapa agora.</p>}
    </div>
  );
}
