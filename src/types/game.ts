export type BetOption = 'watermelon' | 'seven' | 'plum';

export type ChipValue = 100 | 1000 | 10000 | 100000;

export type GamePhase = 'BETTING' | 'SPINNING' | 'RESULT';

export type ModalType = 'none' | 'howToPlay' | 'goodLuck' | 'gameHistory' | 'personalLog' | 'coinRefill' | 'sessionMenu';

export interface WheelSlice {
  index: number;
  option: BetOption;
  angleDeg: number; // Center angle of slice (0 = 12 o'clock, clockwise)
  color: string;
  accentColor: string;
}

export interface PlacedChip {
  id: string;
  option: BetOption;
  value: ChipValue;
  xPct: number; // Horizontal offset inside box (18% - 82%)
  yPct: number; // Vertical offset inside box (24% - 74%)
  rotation: number;
  isPlayer: boolean;
}

export interface WinnerEntry {
  rank: 1 | 2 | 3;
  name: string;
  avatar: string;
  cost: number;
  win: number;
}

export interface RoundResultData {
  roundNumber: number;
  winningSliceIndex: number;
  winningOption: BetOption;
  bonusOption: BetOption | null; // Triggered occasionally when Lucky 77 hits (Rule #6)
  playerCost: number;
  playerWin: number;
  topWinners: WinnerEntry[];
}

export interface PersonalRecord {
  id: string;
  roundNumber: number;
  result: BetOption;
  bonusResult: BetOption | null;
  bets: Record<BetOption, number>;
  totalCost: number;
  totalWin: number;
  timestamp: number;
}

export const BET_MULTIPLIERS: Record<BetOption, number> = {
  watermelon: 2,
  seven: 8,
  plum: 2,
};

export const CHIP_VALUES: ChipValue[] = [100, 1000, 10000, 100000];

export const CHIP_ASSETS: Record<ChipValue, string> = {
  100: '/assets/game/chip_100.png',
  1000: '/assets/game/chip_1k.png',
  10000: '/assets/game/chip_10k.png',
  100000: '/assets/game/chip_100k.png',
};

export const OPTION_ICONS: Record<BetOption, string> = {
  watermelon: '/assets/game/icon_watermelon.png',
  seven: '/assets/game/icon_77.png',
  plum: '/assets/game/icon_plum.png',
};

export const OPTION_WHEEL_ICONS: Record<BetOption, string> = {
  watermelon: '/assets/game/icon_watermelon.png',
  seven: '/assets/game/icon_77_large.png',
  plum: '/assets/game/icon_plum.png',
};

/**
 * Exact 9-slice wheel geometry matching Screenshot 4 clockwise from 12 o'clock (0 deg).
 * 4 Watermelon (x2), 4 Plum (x2), 1 Lucky 77 (x8).
 */
export const WHEEL_SLICES: WheelSlice[] = [
  { index: 0, option: 'plum', angleDeg: 0, color: '#0A5CC8', accentColor: '#1775E8' },
  { index: 1, option: 'watermelon', angleDeg: 40, color: '#1490FB', accentColor: '#28A6FF' },
  { index: 2, option: 'plum', angleDeg: 80, color: '#0A5CC8', accentColor: '#1775E8' },
  { index: 3, option: 'seven', angleDeg: 120, color: '#E328D6', accentColor: '#FF5BF0' },
  { index: 4, option: 'watermelon', angleDeg: 160, color: '#1490FB', accentColor: '#28A6FF' },
  { index: 5, option: 'plum', angleDeg: 200, color: '#0A5CC8', accentColor: '#1775E8' },
  { index: 6, option: 'watermelon', angleDeg: 240, color: '#1490FB', accentColor: '#28A6FF' },
  { index: 7, option: 'plum', angleDeg: 280, color: '#0A5CC8', accentColor: '#1775E8' },
  { index: 8, option: 'watermelon', angleDeg: 320, color: '#1490FB', accentColor: '#28A6FF' },
];
