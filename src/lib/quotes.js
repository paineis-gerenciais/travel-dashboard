// lib/quotes.js — frases inspiradoras de viagem, para a saudação da tela inicial.
const QUOTES = [
  'Viajar é a única coisa que você compra que te deixa mais rico.',
  'O mundo é um livro, e quem não viaja lê apenas uma página.',
  'Colecione momentos, não coisas.',
  'A vida é curta e o mundo é grande.',
  'Não se pode descobrir novos oceanos sem coragem para perder a costa de vista.',
  'Viajar muda a forma como você vê o mundo.',
  'A melhor época para viajar é sempre agora.',
  'Uma viagem de mil quilômetros começa com um único passo.',
  'O importante não é chegar, é a jornada.',
  'Quem viaja em busca de coisas encontra apenas hotéis; quem viaja para viver encontra o mundo.',
  'Ir para lugares novos é sempre bom para a alma.',
  'A viagem te deixa sem palavras e depois faz de você um contador de histórias.',
  'Onde quer que você vá, vá de coração inteiro.',
  'A vida é ou uma aventura ousada, ou nada.',
  'Nem todos os que vagueiam estão perdidos.',
];

/** Sorteia uma frase — usar dentro de um useState(() => randomQuote()) para não mudar a cada render. */
export function randomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

/**
 * Frase ESTÁVEL de uma viagem: derivada do próprio id, então aquela viagem
 * sempre mostra a mesma frase. Preferida à frase sorteada por sessão porque
 * evita o efeito "roleta" — o elemento parece intencional, e não aleatório.
 * Mesmo padrão de `cityColorIndex`, que deriva cor estável do nome da cidade.
 */
export function quoteForTrip(tripId) {
  const s = String(tripId || '');
  if (!s) return QUOTES[0];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return QUOTES[h % QUOTES.length];
}

/** Quantidade de frases disponíveis (usado em teste). */
export const QUOTES_COUNT = QUOTES.length;
