// domain/transport.js
// Getters tolerantes a nomes de campo legados + construção de URL do Google
// Maps. Portados do Index.html.
//
// Sobre gmaps(): no app original a montagem por template literal foi suspeita
// de um bug do pipeline do Apps Script, então foi reescrita com concatenação.
// Fora do Apps Script essa causa não existe mais, mas mantemos a concatenação
// por clareza — não custa nada e evita reabrir a discussão.

import { num } from './format.js';

export function getTransportDate(x) {
  return x.date || x.data || '';
}
export function getTransportOriginCity(x) {
  return x.originCity || x.origemCidade || x.origin_city || x.fromCity || x.cidadeOrigem || '';
}
export function getTransportOriginPlace(x) {
  return x.originPlace || x.origemLocal || x.originLocal || x.fromPlace || x.localOrigem || '';
}
export function getTransportDestCity(x) {
  return x.destCity || x.destinationCity || x.destinoCidade || x.toCity || x.cidadeDestino || '';
}
export function getTransportDestPlace(x) {
  return x.destPlace || x.destinationPlace || x.destinoLocal || x.destLocal || x.toPlace || x.localDestino || '';
}

export function joinPlaceCity(place, city) {
  place = String(place || '').trim();
  city = String(city || '').trim();
  if (place && city) return `${place}, ${city}`;
  return place || city || '';
}

export function getTransportOrigin(x) {
  const city = getTransportOriginCity(x);
  const place = getTransportOriginPlace(x);
  if (city || place) return joinPlaceCity(place, city);
  return x.origin || x.origem || x.from || x.saida || '';
}
export function getTransportDest(x) {
  const city = getTransportDestCity(x);
  const place = getTransportDestPlace(x);
  if (city || place) return joinPlaceCity(place, city);
  return x.dest || x.destination || x.destino || x.to || x.chegada || '';
}
export function getTransportMode(x) {
  return x.mode || x.meio || x.transport || x.tipo || 'Transporte';
}
export function getTransportDuration(x) {
  return x.duration || x.tempo || x.tempoEstimado || '';
}
export function getTransportCost(x) {
  return num(x.cost ?? x.custo ?? x.valor ?? 0);
}

/** Monta uma URL do Google Maps (busca simples ou rota com waypoints). */
export function gmaps(points) {
  points = points.map((p) => String(p || '').trim()).filter(Boolean);
  if (points.length < 2)
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(points[0] || '');
  const origin = encodeURIComponent(points[0]);
  const dest = encodeURIComponent(points.at(-1));
  const ways = points.slice(1, -1).map(encodeURIComponent).join('|');
  let url = 'https://www.google.com/maps/dir/?api=1&origin=' + origin + '&destination=' + dest;
  if (ways) url = url + '&waypoints=' + ways;
  return url;
}
