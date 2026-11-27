export type SeatId = 'A' | 'B' | 'C';
export const MAX_BET_SEATS_PER_ROUND = 2;

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export interface PlayingCard {
  rank: number; // 2..14 (11=J, 12=Q, 13=K, 14=A)
  label: string;
  suit: Suit;
}

export type HandRankName =
  | 'Trail'
  | 'Pure Sequence'
  | 'Sequence'
  | 'Color'
  | 'Pair'
  | 'High Card';

export interface HandEvaluation {
  cards: PlayingCard[];
  category: number; // 6=Trail .. 1=High Card
  rankName: HandRankName;
  score: number;
}

export interface RoundHistoryItem {
  round: number;
  winner: SeatId;
  winningRank: HandRankName;
  userBetTotal?: number;
  userPayout?: number;
  multiplierUsed?: number;
}

export type OutcomeMode = 'weighted' | 'fair' | 'lowest_bet' | 'highest_bet';
export type BotActivityLevel = 'low' | 'medium' | 'high';

export const DEFAULT_COIN_ICON = '/assets/hd/icon-pearl.png';

/**
 * Validates that a dynamic coin icon URL uses only safe relative asset/API paths,
 * http(s) URLs, or local blob previews (blocks javascript:, data:, vbscript:, etc.).
 */
export function isSafeCoinIconUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > 512) return false;
  if (trimmed.startsWith('/assets/') || trimmed.startsWith('/api/assets/')) {
    return !trimmed.includes('..');
  }
  if (trimmed.startsWith('blob:')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export interface GameControlConfig {
  /** Single unified player win rate across A, B, and C (0..100). 0 = no player win. */
  globalWinRate: number;
  /** Legacy per-seat weights kept in sync with globalWinRate for backwards compatibility */
  winRates: Record<SeatId, number>;
  /** Independent payout multiplier per seat (e.g. 2.9x, 3x, 5x) */
  multipliers: Record<SeatId, number>;
  /** How the winner is determined each round */
  outcomeMode: OutcomeMode;
  /** Optional manual override for the next round winner */
  forceNextWinner: SeatId | null;
  /** Keep forced winner locked for subsequent rounds */
  lockForcedWinner: boolean;
  /** Show multiplier badge (e.g. x2.9) directly on A/B/C headers */
  showMultipliersOnBoard: boolean;
  /** Custom 4 chip values */
  chipValues: [number, number, number, number];
  /** Betting countdown duration in seconds */
  roundDuration: number;
  /** Reveal display duration in seconds */
  revealDuration: number;
  /** Simulated live table players betting into pots */
  botsEnabled: boolean;
  botActivity: BotActivityLevel;
  /** Editable player profile displayed in footer */
  playerName: string;
  userId: string;
  /** Custom coin icon URL (defaults to pearl shell icon, replaceable via Dashboard upload) */
  coinIconUrl: string;
}

export const DEFAULT_GAME_CONFIG: GameControlConfig = {
  globalWinRate: 35,
  winRates: {
    A: 35,
    B: 35,
    C: 35,
  },
  multipliers: {
    A: 2.9,
    B: 2.9,
    C: 2.9,
  },
  outcomeMode: 'weighted',
  forceNextWinner: null,
  lockForcedWinner: false,
  showMultipliersOnBoard: false,
  chipValues: [1000, 10000, 50000, 100000],
  roundDuration: 23,
  revealDuration: 4.5,
  botsEnabled: true,
  botActivity: 'medium',
  playerName: 'mr jack',
  userId: '21027209',
  coinIconUrl: DEFAULT_COIN_ICON,
};

export const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const SUIT_POWER: Record<Suit, number> = {
  spades: 4,
  hearts: 3,
  diamonds: 2,
  clubs: 1,
};

export const IS_RED_SUIT: Record<Suit, boolean> = {
  spades: false,
  clubs: false,
  hearts: true,
  diamonds: true,
};

const RANK_LABELS: Record<number, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const ALL_SEATS: SeatId[] = ['A', 'B', 'C'];

export function createDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({
        rank,
        label: RANK_LABELS[rank],
        suit,
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck: PlayingCard[]): PlayingCard[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Evaluates a 3-card Teen Patti hand using official Teen Patti rules.
 */
export function evaluateTeenPattiHand(cards: PlayingCard[]): HandEvaluation {
  const displayCards = [...cards].sort(
    (a, b) => a.rank - b.rank || SUIT_POWER[a.suit] - SUIT_POWER[b.suit]
  );

  const desc = [...cards].sort(
    (a, b) => b.rank - a.rank || SUIT_POWER[b.suit] - SUIT_POWER[a.suit]
  );
  const [r1, r2, r3] = desc.map((c) => c.rank);
  const s1 = SUIT_POWER[desc[0].suit];
  const s2 = SUIT_POWER[desc[1].suit];
  const s3 = SUIT_POWER[desc[2].suit];

  const isSameSuit = desc[0].suit === desc[1].suit && desc[1].suit === desc[2].suit;
  const isTrail = r1 === r2 && r2 === r3;

  const isAKQ = r1 === 14 && r2 === 13 && r3 === 12;
  const isA23 = r1 === 14 && r2 === 3 && r3 === 2;
  const isNormalSeq = r1 - 1 === r2 && r2 - 1 === r3;
  const isSequence = isAKQ || isA23 || isNormalSeq;

  const sequenceRankValue = (): number => {
    if (isAKQ) return 15;
    if (isA23) return 14;
    return r1;
  };

  let category = 1;
  let rankName: HandRankName = 'High Card';
  let primary = 0;
  let secondary = 0;
  let tertiary = 0;

  if (isTrail) {
    category = 6;
    rankName = 'Trail';
    primary = r1;
  } else if (isSequence && isSameSuit) {
    category = 5;
    rankName = 'Pure Sequence';
    primary = sequenceRankValue();
  } else if (isSequence) {
    category = 4;
    rankName = 'Sequence';
    primary = sequenceRankValue();
  } else if (isSameSuit) {
    category = 3;
    rankName = 'Color';
    primary = r1;
    secondary = r2;
    tertiary = r3;
  } else if (r1 === r2 || r2 === r3) {
    category = 2;
    rankName = 'Pair';
    if (r1 === r2) {
      primary = r1;
      secondary = r3;
    } else {
      primary = r2;
      secondary = r1;
    }
  } else {
    category = 1;
    rankName = 'High Card';
    primary = r1;
    secondary = r2;
    tertiary = r3;
  }

  const score =
    category * 1_000_000_000 +
    primary * 10_000_000 +
    secondary * 100_000 +
    tertiary * 1_000 +
    s1 * 50 +
    s2 * 10 +
    s3;

  return {
    cards: displayCards,
    category,
    rankName,
    score,
  };
}

/**
 * Returns the exact manual win rates (0..100%) per seat without forcing 0% back to 33%.
 */
export function getNormalizedWinProbs(
  winRates: Record<SeatId, number>
): Record<SeatId, number> {
  return {
    A: Math.min(100, Math.max(0, Number.isFinite(winRates.A) ? winRates.A : 0)),
    B: Math.min(100, Math.max(0, Number.isFinite(winRates.B) ? winRates.B : 0)),
    C: Math.min(100, Math.max(0, Number.isFinite(winRates.C) ? winRates.C : 0)),
  };
}

/**
 * Picks a seat organically from candidates so results distribute naturally across A, B, and C
 * with balanced rotation and realistic occasional repeats (without rigid or stuck streaks).
 */
function pickOrganicSeat(candidates: SeatId[], recentWinners?: SeatId[]): SeatId {
  if (candidates.length <= 1) {
    return candidates[0] ?? 'A';
  }
  const last0 = recentWinners?.[0];
  const last1 = recentWinners?.[1];
  const others = last0 ? candidates.filter((s) => s !== last0) : candidates;

  if (last0 && candidates.includes(last0) && others.length > 0) {
    // If the same seat already won twice in a row, strongly prefer rotating to another seat (85%)
    if (last1 === last0) {
      if (Math.random() < 0.85) {
        return others[Math.floor(Math.random() * others.length)];
      }
      return last0;
    }
    // Natural ~30% chance to repeat the previous winner, ~70% chance to rotate to another seat
    if (Math.random() < 0.3) {
      return last0;
    }
    return others[Math.floor(Math.random() * others.length)];
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Resolves the winning seat using a single unified 0..100% win rate across A, B, and C:
 * - When the player bets on 1 or 2 seats: player wins with exact `globalWinRate`% probability
 *   (distributed organically across their bet seats), and loses with `(100 - globalWinRate)`%
 *   (distributed organically across the unbet seat(s)).
 * - At 0%, player NEVER wins (unbet seat always wins).
 * - At 100%, player ALWAYS wins on one of their bet seats.
 * - When no bets are placed, winners rotate organically across A, B, and C.
 */
function pickUnifiedWinRateSeat(
  globalWinRate: number,
  userBets: Record<SeatId, number>,
  recentWinners?: SeatId[]
): SeatId {
  const rate = Math.min(100, Math.max(0, Number.isFinite(globalWinRate) ? globalWinRate : 0));
  const betSeats = ALL_SEATS.filter((s) => (userBets[s] || 0) > 0);
  const unbetSeats = ALL_SEATS.filter((s) => (userBets[s] || 0) <= 0);

  if (betSeats.length > 0 && unbetSeats.length > 0) {
    if (rate <= 0) {
      return pickOrganicSeat(unbetSeats, recentWinners);
    }
    if (rate >= 100) {
      return pickOrganicSeat(betSeats, recentWinners);
    }
    const roll = Math.random() * 100;
    if (roll < rate) {
      return pickOrganicSeat(betSeats, recentWinners);
    }
    return pickOrganicSeat(unbetSeats, recentWinners);
  }

  return pickOrganicSeat(ALL_SEATS, recentWinners);
}

export interface DealOptions {
  outcomeMode: OutcomeMode;
  globalWinRate?: number;
  winRates: Record<SeatId, number>;
  forceWinner: SeatId | null;
  userBets: Record<SeatId, number>;
  multipliers: Record<SeatId, number>;
  recentWinners?: SeatId[];
}

/**
 * Deals 9 authentic unique cards from a 52-card deck (3 hands of 3 cards) and resolves
 * the winning seat (A, B, or C) according to the Admin Dashboard configuration.
 */
export function dealRoundHands(options?: DealOptions): {
  hands: Record<SeatId, HandEvaluation>;
  winner: SeatId;
} {
  const deck = shuffleDeck(createDeck());
  const rawHands = [
    evaluateTeenPattiHand(deck.slice(0, 3)),
    evaluateTeenPattiHand(deck.slice(3, 6)),
    evaluateTeenPattiHand(deck.slice(6, 9)),
  ];

  // Fair random mode (or no options) -> direct seat assignment
  if (!options || (options.outcomeMode === 'fair' && !options.forceWinner)) {
    const hands: Record<SeatId, HandEvaluation> = {
      A: rawHands[0],
      B: rawHands[1],
      C: rawHands[2],
    };
    let winner: SeatId = 'A';
    if (hands.B.score > hands[winner].score) winner = 'B';
    if (hands.C.score > hands[winner].score) winner = 'C';
    return { hands, winner };
  }

  const effectiveWinRate =
    typeof options.globalWinRate === 'number' && Number.isFinite(options.globalWinRate)
      ? options.globalWinRate
      : Math.round(((options.winRates.A + options.winRates.B + options.winRates.C) / 3) * 10) / 10;

  // Determine target winning seat based on dashboard rules
  let targetWinner: SeatId;

  if (options.forceWinner) {
    targetWinner = options.forceWinner;
  } else if (options.outcomeMode === 'lowest_bet') {
    // House-profit mode: seat with lowest potential payout wins
    const liabilities = ALL_SEATS.map((s) => ({
      seat: s,
      liability: options.userBets[s] * options.multipliers[s],
    }));
    const minLiability = Math.min(...liabilities.map((l) => l.liability));
    const bestSeats = liabilities
      .filter((l) => l.liability === minLiability)
      .map((l) => l.seat);
    targetWinner = pickOrganicSeat(bestSeats, options.recentWinners);
  } else if (options.outcomeMode === 'highest_bet') {
    // Player-friendly mode: seat with highest user bet wins (fallback to organic rotation if no bet)
    const totalBet = options.userBets.A + options.userBets.B + options.userBets.C;
    if (totalBet > 0) {
      const maxBet = Math.max(options.userBets.A, options.userBets.B, options.userBets.C);
      const topSeats = ALL_SEATS.filter((s) => options.userBets[s] === maxBet);
      targetWinner = pickOrganicSeat(topSeats, options.recentWinners);
    } else {
      targetWinner = pickUnifiedWinRateSeat(
        effectiveWinRate,
        options.userBets,
        options.recentWinners
      );
    }
  } else {
    // Unified Win Rate mode (0%..100% across A, B, and C with organic rotation)
    targetWinner = pickUnifiedWinRateSeat(
      effectiveWinRate,
      options.userBets,
      options.recentWinners
    );
  }

  // Sort the 3 genuinely dealt hands strongest -> weakest and assign strongest to targetWinner
  const sorted = [...rawHands].sort((a, b) => b.score - a.score);
  const losingSeats = ALL_SEATS.filter((s) => s !== targetWinner);
  const swapLosers = Math.random() < 0.5;
  const hands = {} as Record<SeatId, HandEvaluation>;
  hands[targetWinner] = sorted[0];
  hands[losingSeats[0]] = swapLosers ? sorted[2] : sorted[1];
  hands[losingSeats[1]] = swapLosers ? sorted[1] : sorted[2];

  return { hands, winner: targetWinner };
}

/**
 * Formats chip/pot counts cleanly matching the screenshot style.
 */
export function formatCoins(amount: number): string {
  if (amount <= 0) return '0';
  if (amount >= 1_000_000) {
    const val = amount / 1_000_000;
    return Number.isInteger(val) ? `${val}M` : `${val.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (amount >= 1_000) {
    const val = amount / 1_000;
    return Number.isInteger(val) ? `${val}k` : `${val.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return amount.toLocaleString('en-US');
}

export const INITIAL_HISTORY: RoundHistoryItem[] = [
  { round: 1510, winner: 'C', winningRank: 'Pair' },
  { round: 1509, winner: 'C', winningRank: 'Color' },
  { round: 1508, winner: 'C', winningRank: 'Sequence' },
  { round: 1507, winner: 'B', winningRank: 'Pair' },
  { round: 1506, winner: 'C', winningRank: 'High Card' },
  { round: 1505, winner: 'B', winningRank: 'Color' },
  { round: 1504, winner: 'B', winningRank: 'Pair' },
  { round: 1503, winner: 'A', winningRank: 'Trail' },
  { round: 1502, winner: 'C', winningRank: 'High Card' },
  { round: 1501, winner: 'B', winningRank: 'Sequence' },
];

export const SEAT_CONFIG: Record<
  SeatId,
  {
    id: SeatId;
    name: string;
    arabicName: string;
    throneImg: string;
    accentColor: string;
    barClass: string;
  }
> = {
  A: {
    id: 'A',
    name: 'Seat A',
    arabicName: 'الكرسي الأحمر A',
    throneImg: '/assets/hd/throne-a.png',
    accentColor: '#DC2626',
    barClass: 'bg-[#dc2626]',
  },
  B: {
    id: 'B',
    name: 'Seat B',
    arabicName: 'الكرسي الأزرق B',
    throneImg: '/assets/hd/throne-b.png',
    accentColor: '#1D4ED8',
    barClass: 'bg-[#2563eb]',
  },
  C: {
    id: 'C',
    name: 'Seat C',
    arabicName: 'الكرسي البنفسجي C',
    throneImg: '/assets/hd/throne-c.png',
    accentColor: '#A21CAF',
    barClass: 'bg-[#c026d3]',
  },
};

export const PAYOUT_MULTIPLIER = 2.9;
