// CardDefinitions.js
// All 11 ranks for "Night of the Ninja" — abilities, art hints, theming.
// Used by both client (display) and server (resolution metadata).
// The server enforces ability LOGIC; this file describes WHAT each card does.

export const HOUSES = {
  CRANE: {
    id: 'CRANE',
    name: 'House Crane',
    motto: 'Honor sharper than steel.',
    accent: '#7DF9FF',          // electric cyan
    accentDeep: '#1AC8DB',
    accentSoft: 'rgba(125, 249, 255, 0.12)',
    sigil: 'crane',
  },
  LOTUS: {
    id: 'LOTUS',
    name: 'House Lotus',
    motto: 'Beauty drowned in blood.',
    accent: '#FF3D5A',          // deep crimson
    accentDeep: '#C8102E',
    accentSoft: 'rgba(255, 61, 90, 0.12)',
    sigil: 'lotus',
  },
};

// ---------------------------------------------------------------------------
// RANKS
// resolveOrder = ascending: 1 first, 11 last. The Mystic acts before everyone;
// the Shinobi Spirit acts even from beyond death.
// ---------------------------------------------------------------------------
export const RANKS = {
  1: {
    rank: 1,
    name: 'Mystic',
    tagline: 'Sees the unseen.',
    ability:
      'Reveal the House (Lotus or Crane) of any one player. The information is yours alone.',
    targets: 'one_player',
    silhouette: 'mystic',
    glyph: '✦',
  },
  2: {
    rank: 2,
    name: 'Blind Assassin',
    tagline: 'A trap dressed as a blade.',
    ability:
      'Choose a target. If they played a Shinobi (Rank 3) this turn, the Shinobi dies instead of you. Otherwise, no effect.',
    targets: 'one_player',
    silhouette: 'blind_assassin',
    glyph: '⌖',
  },
  3: {
    rank: 3,
    name: 'Shinobi',
    tagline: 'Silent. Swift. Sudden.',
    ability:
      'Assassinate any one player. They are out for the round. Vulnerable to the Blind Assassin.',
    targets: 'one_player',
    silhouette: 'shinobi',
    glyph: '刃',
  },
  4: {
    rank: 4,
    name: 'Spy',
    tagline: 'Secrets are the sharpest weapon.',
    ability: 'Peek at the unrevealed card of any one player.',
    targets: 'one_player',
    silhouette: 'spy',
    glyph: '◉',
  },
  5: {
    rank: 5,
    name: 'Bodyguard',
    tagline: 'A shield of muscle and oath.',
    ability:
      'Protect any one player from death this turn. Damage redirects to you only if the attacker chose your ward; otherwise the attack simply fails.',
    targets: 'one_player',
    silhouette: 'bodyguard',
    glyph: '盾',
  },
  6: {
    rank: 6,
    name: 'Diplomat',
    tagline: 'Words bend the world.',
    ability:
      'Force any one player to swap one of their unplayed cards with one of yours, your choice from theirs.',
    targets: 'one_player',
    silhouette: 'diplomat',
    glyph: '巻',
  },
  7: {
    rank: 7,
    name: 'Samurai',
    tagline: 'Steel that does not waver.',
    ability:
      'Duel any one player. The lower-ranked card-holder dies. Ties: both survive, both lose 1 Honor at round end.',
    targets: 'one_player',
    silhouette: 'samurai',
    glyph: '士',
  },
  8: {
    rank: 8,
    name: 'Daimyo',
    tagline: 'The hand that signs the order.',
    ability:
      'Command another living player to play their next card on a target you choose.',
    targets: 'one_player',
    silhouette: 'daimyo',
    glyph: '主',
  },
  9: {
    rank: 9,
    name: 'Oracle',
    tagline: 'Tomorrow whispers tonight.',
    ability:
      'Look at the top 3 cards of the draw deck. Reorder them as you wish.',
    targets: 'self',
    silhouette: 'oracle',
    glyph: '占',
  },
  10: {
    rank: 10,
    name: 'Shogun',
    tagline: 'The crown beneath the helm.',
    ability:
      'If you survive the round, your House gains +2 Honor regardless of victory.',
    targets: 'self',
    silhouette: 'shogun',
    glyph: '将',
  },
  11: {
    rank: 11,
    name: 'Shinobi Spirit',
    tagline: 'Death is merely a doorway.',
    ability:
      'Triggers AFTER your death (or at end of round if you live). Kill any one player. Cannot be blocked by Bodyguard.',
    targets: 'one_player',
    silhouette: 'shinobi_spirit',
    glyph: '霊',
  },
};

// All ranks in resolution order (1 → 11).
export const RANK_ORDER = Object.keys(RANKS)
  .map(Number)
  .sort((a, b) => a - b);

// ---------------------------------------------------------------------------
// DECK CONSTRUCTION (6–8 players)
// 11 unique ranks, with duplicates of the most common roles to fill the deck.
// Each player draws 3 in the draft, plays 2; some are passed and discarded.
// Aim: ~3 cards * playerCount + buffer for draft-passing.
// ---------------------------------------------------------------------------
export function buildDeck(playerCount) {
  // Base copies — ensures 6–8 players always have enough ammo.
  const distribution = {
    1: 2,   // Mystic
    2: 3,   // Blind Assassin
    3: 4,   // Shinobi (most common — this game has teeth)
    4: 3,   // Spy
    5: 3,   // Bodyguard
    6: 2,   // Diplomat
    7: 3,   // Samurai
    8: 1,   // Daimyo (rare)
    9: 2,   // Oracle
    10: 1,  // Shogun (legendary)
    11: 2,  // Shinobi Spirit
  };
  // Bump deck size to support up to 8 players * 3 cards + 6 buffer = 30
  const deck = [];
  let id = 0;
  Object.entries(distribution).forEach(([rank, count]) => {
    const r = Number(rank);
    // Slight scale-up for 8 players
    const copies = playerCount >= 8 ? count + 1 : count;
    for (let i = 0; i < copies; i++) {
      deck.push({ id: `c${id++}`, rank: r });
    }
  });
  return deck;
}

// Fisher–Yates
export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Honor Token values dropped at round end (random draw 2–4)
export const HONOR_TOKEN_VALUES = [2, 2, 3, 3, 3, 4, 4];

export const POINTS_TO_WIN_GAME = 10;
