import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type BetOption = 'watermelon' | 'seven' | 'plum';

export interface GameSettings {
  winRate: number; // 0..100 (% chance player wins when they place bets)
  lossRate: number; // 100 - winRate
  lucky77BonusChance: number; // 0..100 (% chance of extra fruit award when 77 hits)
  bettingDurationSec: number; // 5..30 seconds
  updatedAt: number;
}

export interface PlayerRecord {
  id: string;
  name: string;
  balance: number;
  totalRounds: number;
  winsCount: number;
  lossesCount: number;
  totalWagered: number;
  totalWon: number;
  netProfit: number;
  winRatePct: number;
  lossRatePct: number;
  customWinRate: number | null; // Optional per-player override (0..100) or null to use global winRate
  lastBetAt: number | null;
  lastSeenAt: number;
  createdAt: number;
}

export interface RoundLogRecord {
  id: string;
  roundNumber: number;
  playerId: string;
  playerName: string;
  bets: Record<BetOption, number>;
  winningOption: BetOption;
  bonusOption: BetOption | null;
  winningSliceIndex: number;
  totalCost: number;
  totalWin: number;
  netPlayerProfit: number;
  appliedWinRate: number;
  outcome: 'win' | 'loss' | 'no_bet';
  timestamp: number;
}

export interface DatabaseSnapshot {
  version: number;
  settings: GameSettings;
  adminPasswordHash: string | null; // scrypt "salt:hash" when claimed via first-run setup
  players: Record<string, PlayerRecord>;
  roundLogs: RoundLogRecord[];
  globalHistory: BetOption[];
  currentRoundNumber: number;
}

const DEFAULT_HISTORY: BetOption[] = [
  'plum', 'watermelon', 'watermelon', 'plum', 'watermelon', 'watermelon', 'plum',
  'plum', 'plum', 'watermelon', 'plum', 'plum', 'plum', 'watermelon',
  'seven', 'watermelon', 'watermelon', 'seven', 'watermelon', 'watermelon', 'plum',
  'plum', 'plum', 'watermelon', 'plum', 'plum', 'watermelon', 'seven',
  'plum', 'plum', 'plum', 'plum', 'plum', 'plum', 'plum',
  'plum', 'plum', 'plum', 'watermelon', 'plum', 'seven', 'watermelon',
  'plum', 'seven', 'plum', 'plum', 'watermelon', 'seven', 'watermelon',
];

const DEFAULT_SNAPSHOT = (): DatabaseSnapshot => ({
  version: 1,
  settings: {
    winRate: 45,
    lossRate: 55,
    lucky77BonusChance: 45,
    bettingDurationSec: 10,
    updatedAt: Date.now(),
  },
  adminPasswordHash: null,
  players: {},
  roundLogs: [],
  globalHistory: [...DEFAULT_HISTORY],
  currentRoundNumber: 228,
});

/**
 * Clean pluggable Database Adapter interface.
 * Developers can swap this JSON file implementation with PostgreSQL / MySQL / MongoDB
 * by implementing these methods without changing any API route or UI code.
 */
export interface IGameDatabase {
  getSettings(): GameSettings;
  updateSettings(patch: Partial<Pick<GameSettings, 'winRate' | 'lucky77BonusChance' | 'bettingDurationSec'>>): GameSettings;
  getAdminPasswordHash(): string | null;
  claimAdminPasswordHash(plainPassword: string): boolean;
  verifyClaimedAdminPassword(plainPassword: string): boolean;
  upsertPlayerHeartbeat(input: { id: string; name: string; balance: number }): PlayerRecord;
  getPlayer(playerId: string): PlayerRecord | null;
  listPlayers(): PlayerRecord[];
  updatePlayerAdmin(playerId: string, patch: { balance?: number; customWinRate?: number | null; name?: string }): PlayerRecord | null;
  deletePlayer(playerId: string): boolean;
  recordRound(entry: Omit<RoundLogRecord, 'id' | 'timestamp'> & { newBalance: number }): {
    log: RoundLogRecord;
    player: PlayerRecord;
    history: BetOption[];
    roundNumber: number;
  };
  getRoundLogs(limit?: number): RoundLogRecord[];
  getGlobalHistory(): BetOption[];
  getCurrentRoundNumber(): number;
  exportAll(): Omit<DatabaseSnapshot, 'adminPasswordHash'>;
}

export function hashPasswordScrypt(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPasswordScrypt(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

class JsonFileGameDatabase implements IGameDatabase {
  private readonly filePath: string;
  private data: DatabaseSnapshot;

  constructor(customRelativePath?: string) {
    const baseDir = path.resolve(process.cwd(), 'data');
    fs.mkdirSync(baseDir, { recursive: true });

    const requested = customRelativePath ? path.basename(customRelativePath) : 'game-db.json';
    const resolved = path.resolve(baseDir, requested);
    if (!resolved.startsWith(baseDir + path.sep)) {
      throw new Error('Invalid database file path outside data directory');
    }
    this.filePath = resolved;
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): DatabaseSnapshot {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<DatabaseSnapshot>;
        const defaults = DEFAULT_SNAPSHOT();
        const winRate =
          typeof parsed.settings?.winRate === 'number'
            ? Math.max(0, Math.min(100, Math.round(parsed.settings.winRate)))
            : defaults.settings.winRate;
        return {
          version: 1,
          settings: {
            winRate,
            lossRate: 100 - winRate,
            lucky77BonusChance:
              typeof parsed.settings?.lucky77BonusChance === 'number'
                ? Math.max(0, Math.min(100, Math.round(parsed.settings.lucky77BonusChance)))
                : defaults.settings.lucky77BonusChance,
            bettingDurationSec:
              typeof parsed.settings?.bettingDurationSec === 'number'
                ? Math.max(5, Math.min(30, Math.round(parsed.settings.bettingDurationSec)))
                : defaults.settings.bettingDurationSec,
            updatedAt: parsed.settings?.updatedAt ?? Date.now(),
          },
          adminPasswordHash: typeof parsed.adminPasswordHash === 'string' ? parsed.adminPasswordHash : null,
          players: parsed.players && typeof parsed.players === 'object' ? parsed.players : {},
          roundLogs: Array.isArray(parsed.roundLogs) ? parsed.roundLogs.slice(0, 500) : [],
          globalHistory:
            Array.isArray(parsed.globalHistory) && parsed.globalHistory.length >= 8
              ? parsed.globalHistory.slice(0, 49)
              : defaults.globalHistory,
          currentRoundNumber:
            typeof parsed.currentRoundNumber === 'number' && parsed.currentRoundNumber >= 1
              ? parsed.currentRoundNumber
              : defaults.currentRoundNumber,
        };
      }
    } catch {
      // Fallback to fresh snapshot if file is corrupted
    }
    const fresh = DEFAULT_SNAPSHOT();
    this.persist(fresh);
    return fresh;
  }

  private persist(snapshot: DatabaseSnapshot = this.data) {
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.filePath);
  }

  getSettings(): GameSettings {
    return { ...this.data.settings };
  }

  updateSettings(patch: Partial<Pick<GameSettings, 'winRate' | 'lucky77BonusChance' | 'bettingDurationSec'>>): GameSettings {
    if (typeof patch.winRate === 'number' && Number.isFinite(patch.winRate)) {
      const clamped = Math.max(0, Math.min(100, Math.round(patch.winRate)));
      this.data.settings.winRate = clamped;
      this.data.settings.lossRate = 100 - clamped;
    }
    if (typeof patch.lucky77BonusChance === 'number' && Number.isFinite(patch.lucky77BonusChance)) {
      this.data.settings.lucky77BonusChance = Math.max(0, Math.min(100, Math.round(patch.lucky77BonusChance)));
    }
    if (typeof patch.bettingDurationSec === 'number' && Number.isFinite(patch.bettingDurationSec)) {
      this.data.settings.bettingDurationSec = Math.max(5, Math.min(30, Math.round(patch.bettingDurationSec)));
    }
    this.data.settings.updatedAt = Date.now();
    this.persist();
    return this.getSettings();
  }

  getAdminPasswordHash(): string | null {
    return this.data.adminPasswordHash;
  }

  claimAdminPasswordHash(plainPassword: string): boolean {
    if (this.data.adminPasswordHash !== null) {
      return false;
    }
    this.data.adminPasswordHash = hashPasswordScrypt(plainPassword);
    this.persist();
    return true;
  }

  verifyClaimedAdminPassword(plainPassword: string): boolean {
    if (!this.data.adminPasswordHash) return false;
    return verifyPasswordScrypt(plainPassword, this.data.adminPasswordHash);
  }

  upsertPlayerHeartbeat(input: { id: string; name: string; balance: number }): PlayerRecord {
    const now = Date.now();
    const existing = this.data.players[input.id];
    if (existing) {
      existing.name = input.name;
      existing.balance = input.balance;
      existing.lastSeenAt = now;
      this.persist();
      return { ...existing };
    }

    const created: PlayerRecord = {
      id: input.id,
      name: input.name,
      balance: input.balance,
      totalRounds: 0,
      winsCount: 0,
      lossesCount: 0,
      totalWagered: 0,
      totalWon: 0,
      netProfit: 0,
      winRatePct: 0,
      lossRatePct: 0,
      customWinRate: null,
      lastBetAt: null,
      lastSeenAt: now,
      createdAt: now,
    };
    this.data.players[input.id] = created;
    this.persist();
    return { ...created };
  }

  getPlayer(playerId: string): PlayerRecord | null {
    const p = this.data.players[playerId];
    return p ? { ...p } : null;
  }

  listPlayers(): PlayerRecord[] {
    return Object.values(this.data.players)
      .map((p) => ({ ...p }))
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }

  updatePlayerAdmin(
    playerId: string,
    patch: { balance?: number; customWinRate?: number | null; name?: string }
  ): PlayerRecord | null {
    const p = this.data.players[playerId];
    if (!p) return null;
    if (typeof patch.balance === 'number' && Number.isFinite(patch.balance) && patch.balance >= 0) {
      p.balance = Math.floor(patch.balance);
    }
    if (patch.customWinRate === null) {
      p.customWinRate = null;
    } else if (typeof patch.customWinRate === 'number' && Number.isFinite(patch.customWinRate)) {
      p.customWinRate = Math.max(0, Math.min(100, Math.round(patch.customWinRate)));
    }
    if (typeof patch.name === 'string' && patch.name.trim()) {
      p.name = patch.name.trim().slice(0, 24);
    }
    this.persist();
    return { ...p };
  }

  deletePlayer(playerId: string): boolean {
    if (!this.data.players[playerId]) return false;
    delete this.data.players[playerId];
    this.persist();
    return true;
  }

  recordRound(
    entry: Omit<RoundLogRecord, 'id' | 'timestamp'> & { newBalance: number }
  ): {
    log: RoundLogRecord;
    player: PlayerRecord;
    history: BetOption[];
    roundNumber: number;
  } {
    const now = Date.now();
    const existing = this.data.players[entry.playerId] ?? {
      id: entry.playerId,
      name: entry.playerName,
      balance: entry.newBalance,
      totalRounds: 0,
      winsCount: 0,
      lossesCount: 0,
      totalWagered: 0,
      totalWon: 0,
      netProfit: 0,
      winRatePct: 0,
      lossRatePct: 0,
      customWinRate: null,
      lastBetAt: null,
      lastSeenAt: now,
      createdAt: now,
    };

    existing.name = entry.playerName;
    existing.balance = Math.max(0, Math.floor(entry.newBalance));
    existing.lastSeenAt = now;

    if (entry.totalCost > 0) {
      existing.totalRounds += 1;
      existing.totalWagered += entry.totalCost;
      existing.totalWon += entry.totalWin;
      existing.netProfit = existing.totalWon - existing.totalWagered;
      existing.lastBetAt = now;
      if (entry.outcome === 'win') {
        existing.winsCount += 1;
      } else if (entry.outcome === 'loss') {
        existing.lossesCount += 1;
      }
      existing.winRatePct =
        existing.totalRounds > 0
          ? Number(((existing.winsCount / existing.totalRounds) * 100).toFixed(1))
          : 0;
      existing.lossRatePct =
        existing.totalRounds > 0
          ? Number(((existing.lossesCount / existing.totalRounds) * 100).toFixed(1))
          : 0;
    }

    this.data.players[entry.playerId] = existing;

    const log: RoundLogRecord = {
      id: `${entry.roundNumber}-${now}-${crypto.randomBytes(3).toString('hex')}`,
      roundNumber: entry.roundNumber,
      playerId: entry.playerId,
      playerName: entry.playerName,
      bets: entry.bets,
      winningOption: entry.winningOption,
      bonusOption: entry.bonusOption,
      winningSliceIndex: entry.winningSliceIndex,
      totalCost: entry.totalCost,
      totalWin: entry.totalWin,
      netPlayerProfit: entry.netPlayerProfit,
      appliedWinRate: entry.appliedWinRate,
      outcome: entry.outcome,
      timestamp: now,
    };

    if (entry.totalCost > 0) {
      this.data.roundLogs.unshift(log);
      if (this.data.roundLogs.length > 500) {
        this.data.roundLogs = this.data.roundLogs.slice(0, 500);
      }
    }

    this.data.globalHistory = [entry.winningOption, ...this.data.globalHistory].slice(0, 49);
    this.data.currentRoundNumber = Math.max(this.data.currentRoundNumber + 1, entry.roundNumber + 1);
    this.persist();

    return {
      log,
      player: { ...existing },
      history: [...this.data.globalHistory],
      roundNumber: this.data.currentRoundNumber,
    };
  }

  getRoundLogs(limit = 60): RoundLogRecord[] {
    return this.data.roundLogs.slice(0, limit);
  }

  getGlobalHistory(): BetOption[] {
    return [...this.data.globalHistory];
  }

  getCurrentRoundNumber(): number {
    return this.data.currentRoundNumber;
  }

  exportAll(): Omit<DatabaseSnapshot, 'adminPasswordHash'> {
    return {
      version: this.data.version,
      settings: this.getSettings(),
      players: { ...this.data.players },
      roundLogs: [...this.data.roundLogs],
      globalHistory: [...this.data.globalHistory],
      currentRoundNumber: this.data.currentRoundNumber,
    };
  }
}

export const db: IGameDatabase = new JsonFileGameDatabase(process.env.DATABASE_FILE);
