import { BetOption, BET_MULTIPLIERS, ChipValue, WinnerEntry } from '../types/game';

/**
 * Formats coin numbers identically to the reference screenshots:
 * e.g., 0 -> "0", 7000 -> "7K", 65800 -> "65.8K", 1200000 -> "1.2M"
 */
export function formatCompactCoins(value: number): string {
  if (value <= 0) return '0';
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return `${Number.isInteger(k) ? k : k.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(Math.floor(value));
}

export function formatExactCoins(value: number): string {
  return Math.floor(value).toLocaleString('en-US');
}

/**
 * Initial 49-round history matching Screenshot 3's authentic 7x7 distribution
 * (newest at index 0 -> top-left of 7x7 grid and leftmost 'NEW' slot of strip).
 */
export const INITIAL_HISTORY: BetOption[] = [
  // Row 1 (matches Screenshot 4 strip & Screenshot 3 grid!)
  'plum', 'watermelon', 'watermelon', 'plum', 'watermelon', 'watermelon', 'plum',
  // Row 2
  'plum', 'plum', 'watermelon', 'plum', 'plum', 'plum', 'watermelon',
  // Row 3
  'seven', 'watermelon', 'watermelon', 'seven', 'watermelon', 'watermelon', 'plum',
  // Row 4
  'plum', 'plum', 'watermelon', 'plum', 'plum', 'watermelon', 'seven',
  // Row 5
  'plum', 'plum', 'plum', 'plum', 'plum', 'plum', 'plum',
  // Row 6
  'plum', 'plum', 'plum', 'watermelon', 'plum', 'seven', 'watermelon',
  // Row 7
  'plum', 'seven', 'plum', 'plum', 'watermelon', 'seven', 'watermelon',
];

interface BotProfile {
  name: string;
  avatar: string;
}

const BOT_ROSTER: BotProfile[] = [
  { name: 'غــ...', avatar: '/assets/game/bot_1.png' },
  { name: 'وعد', avatar: '/assets/game/bot_2.png' },
  { name: 'مسك ❥', avatar: '/assets/game/bot_3.png' },
  { name: 'أمير', avatar: '/assets/game/bot_1.png' },
  { name: 'ليان', avatar: '/assets/game/bot_2.png' },
  { name: 'ميار 👑', avatar: '/assets/game/bot_3.png' },
  { name: 'سيف', avatar: '/assets/game/bot_1.png' },
  { name: 'نور ✨', avatar: '/assets/game/bot_2.png' },
];

export function pickRandomBotChip(): { option: BetOption; value: ChipValue } {
  const r = Math.random();
  const option: BetOption = r < 0.43 ? 'watermelon' : r < 0.85 ? 'plum' : 'seven';

  const v = Math.random();
  const value: ChipValue =
    v < 0.34 ? 100 : v < 0.74 ? 1000 : v < 0.94 ? 10000 : 100000;

  return { option, value };
}

/**
 * Generates realistic Top 3 winners for the Good Luck podium modal,
 * blending simulated room VIPs and including the real player if they won big!
 */
export function buildTopWinners(
  winningOption: BetOption,
  bonusOption: BetOption | null,
  playerName: string,
  playerAvatar: string,
  playerCost: number,
  playerWin: number
): WinnerEntry[] {
  const mult = BET_MULTIPLIERS[winningOption];
  const shuffled = [...BOT_ROSTER].sort(() => Math.random() - 0.5).slice(0, 4);

  const candidates = shuffled.map((bot, i) => {
    const tierBase = i === 0 ? 30000 : i === 1 ? 8000 : 3000;
    const rawBet = Math.round((tierBase * (0.65 + Math.random() * 1.4)) / 100) * 100;
    const sideBet = Math.round((rawBet * (0.1 + Math.random() * 0.4)) / 100) * 100;
    const cost = rawBet + sideBet;
    const win = rawBet * mult + (bonusOption ? Math.round(sideBet * BET_MULTIPLIERS[bonusOption]) : 0);
    return {
      name: bot.name,
      avatar: bot.avatar,
      cost,
      win,
    };
  });

  if (playerWin > 0) {
    candidates.push({
      name: playerName,
      avatar: playerAvatar,
      cost: playerCost,
      win: playerWin,
    });
  }

  candidates.sort((a, b) => b.win - a.win);
  const top3 = candidates.slice(0, 3);

  return [
    { rank: 1, ...top3[0] },
    { rank: 2, ...top3[1] },
    { rank: 3, ...top3[2] },
  ];
}
