import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_COIN_ICON,
  DEFAULT_GAME_CONFIG,
  GameControlConfig,
  INITIAL_HISTORY,
  isSafeCoinIconUrl,
  RoundHistoryItem,
  SeatId,
} from '../engine/teenPatti.ts';

export interface PlayerRecord {
  id: string;
  name: string;
  balance: number;
  totalRounds: number;
  winsCount: number;
  lossesCount: number;
  totalWagered: number;
  totalPayouts: number;
  lastSeenAt: number;
  createdAt: number;
}

export interface GlobalStats {
  roundsPlayed: number;
  totalWagered: number;
  totalPayouts: number;
  seatWins: Record<SeatId, number>;
}

export interface UploadedCoinIconMeta {
  filename: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  updatedAt: number;
}

export interface TeenPattiDbSchema {
  config: GameControlConfig;
  adminPasswordHash: string | null;
  uploadedCoinIcon: UploadedCoinIconMeta | null;
  currentRoundNumber: number;
  history: RoundHistoryItem[];
  stats: GlobalStats;
  players: Record<string, PlayerRecord>;
}

export interface PublicDbExport {
  exportedAt: string;
  config: GameControlConfig;
  currentRoundNumber: number;
  stats: GlobalStats;
  history: RoundHistoryItem[];
  players: PlayerRecord[];
}

/**
 * Pluggable Database Interface for Teen Patti Royal.
 * Developers can implement this interface with PostgreSQL, MySQL, MongoDB, or Prisma
 * and swap it in server.ts without changing any REST routes or frontend UI.
 */
export interface ITeenPattiDatabase {
  getConfig(): GameControlConfig;
  updateConfig(patch: Partial<GameControlConfig>): GameControlConfig;
  resetConfig(): GameControlConfig;

  getAdminPasswordHash(): string | null;
  setAdminPasswordHash(hash: string): void;

  getUploadedCoinIcon(): UploadedCoinIconMeta | null;
  saveUploadedCoinIcon(
    buffer: Buffer,
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  ): { meta: UploadedCoinIconMeta; url: string };
  getUploadedCoinIconPath(): { filePath: string; mimeType: string } | null;
  clearUploadedCoinIcon(): GameControlConfig;

  getCurrentRoundNumber(): number;
  getHistory(): RoundHistoryItem[];
  getStats(): GlobalStats;
  resetStats(): GlobalStats;

  upsertPlayerHeartbeat(playerId: string, name?: string): PlayerRecord;
  getPlayer(playerId: string): PlayerRecord | null;
  listPlayers(): PlayerRecord[];
  updatePlayer(
    playerId: string,
    patch: { balance?: number; name?: string }
  ): PlayerRecord | null;
  topUpPlayer(playerId: string, amount: number): PlayerRecord;
  resetPlayerBalance(playerId: string, defaultBalance: number): PlayerRecord;

  recordRoundResolution(params: {
    playerId: string;
    playerName?: string;
    winner: SeatId;
    winningRank: RoundHistoryItem['winningRank'];
    userBetTotal: number;
    payout: number;
    multiplierUsed: number;
    clearOneShotForcedWinner: boolean;
  }): {
    player: PlayerRecord;
    history: RoundHistoryItem[];
    nextRoundNumber: number;
    stats: GlobalStats;
    config: GameControlConfig;
  };

  exportPublicSnapshot(): PublicDbExport;
}

const DEFAULT_STARTING_BALANCE = 100_000;
const INITIAL_ROUND_NUMBER = 1511;

function createInitialDbState(): TeenPattiDbSchema {
  return {
    config: {
      ...DEFAULT_GAME_CONFIG,
      winRates: { ...DEFAULT_GAME_CONFIG.winRates },
      multipliers: { ...DEFAULT_GAME_CONFIG.multipliers },
      chipValues: [...DEFAULT_GAME_CONFIG.chipValues] as [number, number, number, number],
    },
    adminPasswordHash: null,
    uploadedCoinIcon: null,
    currentRoundNumber: INITIAL_ROUND_NUMBER,
    history: [...INITIAL_HISTORY],
    stats: {
      roundsPlayed: 0,
      totalWagered: 0,
      totalPayouts: 0,
      seatWins: { A: 0, B: 0, C: 0 },
    },
    players: {},
  };
}

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function sanitizePlayerName(raw: unknown, fallback = 'Player'): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.trim().slice(0, 32);
  return cleaned.length > 0 ? cleaned : fallback;
}

function sanitizeConfigPatch(
  current: GameControlConfig,
  patch: Partial<GameControlConfig>
): GameControlConfig {
  const next: GameControlConfig = {
    ...current,
    winRates: { ...current.winRates },
    multipliers: { ...current.multipliers },
    chipValues: [...current.chipValues] as [number, number, number, number],
  };

  if (patch.winRates && typeof patch.winRates === 'object') {
    (['A', 'B', 'C'] as SeatId[]).forEach((seat) => {
      if (patch.winRates && patch.winRates[seat] !== undefined) {
        next.winRates[seat] = Math.round(clampNumber(patch.winRates[seat], 0, 100, current.winRates[seat]) * 10) / 10;
      }
    });
  }

  if (patch.multipliers && typeof patch.multipliers === 'object') {
    (['A', 'B', 'C'] as SeatId[]).forEach((seat) => {
      if (patch.multipliers && patch.multipliers[seat] !== undefined) {
        next.multipliers[seat] = Math.round(clampNumber(patch.multipliers[seat], 1.1, 20, current.multipliers[seat]) * 10) / 10;
      }
    });
  }

  if (
    patch.outcomeMode === 'weighted' ||
    patch.outcomeMode === 'fair' ||
    patch.outcomeMode === 'lowest_bet' ||
    patch.outcomeMode === 'highest_bet'
  ) {
    next.outcomeMode = patch.outcomeMode;
  }

  if (
    patch.forceNextWinner === null ||
    patch.forceNextWinner === 'A' ||
    patch.forceNextWinner === 'B' ||
    patch.forceNextWinner === 'C'
  ) {
    next.forceNextWinner = patch.forceNextWinner;
  } else if (patch.forceNextWinner !== undefined) {
    next.forceNextWinner = null;
  }

  if (typeof patch.lockForcedWinner === 'boolean') {
    next.lockForcedWinner = patch.lockForcedWinner;
  }

  if (typeof patch.showMultipliersOnBoard === 'boolean') {
    next.showMultipliersOnBoard = patch.showMultipliersOnBoard;
  }

  if (Array.isArray(patch.chipValues) && patch.chipValues.length === 4) {
    next.chipValues = patch.chipValues.map((v, idx) =>
      Math.round(clampNumber(v, 100, 10_000_000, current.chipValues[idx]))
    ) as [number, number, number, number];
  }

  if (patch.roundDuration !== undefined) {
    next.roundDuration = Math.round(clampNumber(patch.roundDuration, 5, 60, current.roundDuration));
  }

  if (patch.revealDuration !== undefined) {
    next.revealDuration = Math.round(clampNumber(patch.revealDuration, 2, 12, current.revealDuration) * 2) / 2;
  }

  if (typeof patch.botsEnabled === 'boolean') {
    next.botsEnabled = patch.botsEnabled;
  }

  if (patch.botActivity === 'low' || patch.botActivity === 'medium' || patch.botActivity === 'high') {
    next.botActivity = patch.botActivity;
  }

  if (typeof patch.playerName === 'string') {
    next.playerName = sanitizePlayerName(patch.playerName, current.playerName);
  }

  if (typeof patch.userId === 'string') {
    const cleanedId = patch.userId.trim().slice(0, 24);
    if (cleanedId.length > 0) next.userId = cleanedId;
  }

  if (typeof patch.coinIconUrl === 'string' && isSafeCoinIconUrl(patch.coinIconUrl)) {
    next.coinIconUrl = patch.coinIconUrl.trim();
  }

  return next;
}

const MIME_TO_EXT: Record<'image/png' | 'image/jpeg' | 'image/webp', string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export class JsonFileTeenPattiDatabase implements ITeenPattiDatabase {
  private readonly dataDir: string;
  private readonly uploadsDir: string;
  private readonly dbFilePath: string;
  private state: TeenPattiDbSchema;

  constructor(databaseFilename?: string) {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.uploadsDir = path.resolve(this.dataDir, 'uploads');

    const safeName = path.basename(databaseFilename || 'teen-patti-db.json');
    const resolvedDbPath = path.resolve(this.dataDir, safeName);
    if (!resolvedDbPath.startsWith(this.dataDir + path.sep)) {
      throw new Error('Invalid database file path outside data directory.');
    }
    this.dbFilePath = resolvedDbPath;

    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.uploadsDir, { recursive: true });
    this.state = this.loadFromDisk();
  }

  private loadFromDisk(): TeenPattiDbSchema {
    const fallback = createInitialDbState();
    try {
      if (!fs.existsSync(this.dbFilePath)) {
        this.persist(fallback);
        return fallback;
      }
      const raw = fs.readFileSync(this.dbFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<TeenPattiDbSchema>;
      const mergedConfig = sanitizeConfigPatch(
        fallback.config,
        (parsed.config as Partial<GameControlConfig>) || {}
      );
      return {
        config: mergedConfig,
        adminPasswordHash:
          typeof parsed.adminPasswordHash === 'string' && parsed.adminPasswordHash.length > 0
            ? parsed.adminPasswordHash
            : null,
        uploadedCoinIcon:
          parsed.uploadedCoinIcon &&
          typeof parsed.uploadedCoinIcon.filename === 'string' &&
          (parsed.uploadedCoinIcon.mimeType === 'image/png' ||
            parsed.uploadedCoinIcon.mimeType === 'image/jpeg' ||
            parsed.uploadedCoinIcon.mimeType === 'image/webp')
            ? parsed.uploadedCoinIcon
            : null,
        currentRoundNumber:
          typeof parsed.currentRoundNumber === 'number' && Number.isFinite(parsed.currentRoundNumber)
            ? Math.max(1, Math.floor(parsed.currentRoundNumber))
            : INITIAL_ROUND_NUMBER,
        history: (() => {
          const valid = Array.isArray(parsed.history)
            ? parsed.history
                .filter((h) => h && (h.winner === 'A' || h.winner === 'B' || h.winner === 'C'))
                .slice(0, 50)
            : [];
          return valid.length > 0 ? valid : [...INITIAL_HISTORY];
        })(),
        stats: {
          roundsPlayed: Number(parsed.stats?.roundsPlayed) || 0,
          totalWagered: Number(parsed.stats?.totalWagered) || 0,
          totalPayouts: Number(parsed.stats?.totalPayouts) || 0,
          seatWins: {
            A: Number(parsed.stats?.seatWins?.A) || 0,
            B: Number(parsed.stats?.seatWins?.B) || 0,
            C: Number(parsed.stats?.seatWins?.C) || 0,
          },
        },
        players:
          parsed.players && typeof parsed.players === 'object' && !Array.isArray(parsed.players)
            ? (parsed.players as Record<string, PlayerRecord>)
            : {},
      };
    } catch {
      this.persist(fallback);
      return fallback;
    }
  }

  private persist(nextState: TeenPattiDbSchema = this.state): void {
    const tmpPath = `${this.dbFilePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(nextState, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.dbFilePath);
  }

  getConfig(): GameControlConfig {
    return {
      ...this.state.config,
      winRates: { ...this.state.config.winRates },
      multipliers: { ...this.state.config.multipliers },
      chipValues: [...this.state.config.chipValues] as [number, number, number, number],
    };
  }

  updateConfig(patch: Partial<GameControlConfig>): GameControlConfig {
    this.state.config = sanitizeConfigPatch(this.state.config, patch);
    this.persist();
    return this.getConfig();
  }

  resetConfig(): GameControlConfig {
    const preservedIcon = this.state.config.coinIconUrl;
    this.state.config = {
      ...DEFAULT_GAME_CONFIG,
      winRates: { ...DEFAULT_GAME_CONFIG.winRates },
      multipliers: { ...DEFAULT_GAME_CONFIG.multipliers },
      chipValues: [...DEFAULT_GAME_CONFIG.chipValues] as [number, number, number, number],
      coinIconUrl: preservedIcon,
    };
    this.persist();
    return this.getConfig();
  }

  getAdminPasswordHash(): string | null {
    return this.state.adminPasswordHash;
  }

  setAdminPasswordHash(hash: string): void {
    this.state.adminPasswordHash = hash;
    this.persist();
  }

  getUploadedCoinIcon(): UploadedCoinIconMeta | null {
    return this.state.uploadedCoinIcon ? { ...this.state.uploadedCoinIcon } : null;
  }

  saveUploadedCoinIcon(
    buffer: Buffer,
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  ): { meta: UploadedCoinIconMeta; url: string } {
    const ext = MIME_TO_EXT[mimeType];
    const filename = `coin-icon.${ext}`;
    const targetPath = path.resolve(this.uploadsDir, filename);

    if (!targetPath.startsWith(this.uploadsDir + path.sep)) {
      throw new Error('Upload path outside allowed uploads directory.');
    }

    // Remove previous icon extensions to keep uploads folder clean
    for (const oldExt of ['png', 'jpg', 'webp']) {
      const candidate = path.resolve(this.uploadsDir, `coin-icon.${oldExt}`);
      if (candidate.startsWith(this.uploadsDir + path.sep) && candidate !== targetPath && fs.existsSync(candidate)) {
        try {
          fs.unlinkSync(candidate);
        } catch {
          // ignore cleanup failure
        }
      }
    }

    fs.writeFileSync(targetPath, buffer);
    const updatedAt = Date.now();
    const meta: UploadedCoinIconMeta = {
      filename,
      mimeType,
      updatedAt,
    };
    const url = `/api/assets/coin-icon?v=${updatedAt}`;
    this.state.uploadedCoinIcon = meta;
    this.state.config.coinIconUrl = url;
    this.persist();
    return { meta, url };
  }

  getUploadedCoinIconPath(): { filePath: string; mimeType: string } | null {
    const meta = this.state.uploadedCoinIcon;
    if (!meta) return null;
    const safeName = path.basename(meta.filename);
    const resolved = path.resolve(this.uploadsDir, safeName);
    if (!resolved.startsWith(this.uploadsDir + path.sep)) return null;
    if (!fs.existsSync(resolved)) return null;
    return { filePath: resolved, mimeType: meta.mimeType };
  }

  clearUploadedCoinIcon(): GameControlConfig {
    for (const oldExt of ['png', 'jpg', 'webp']) {
      const candidate = path.resolve(this.uploadsDir, `coin-icon.${oldExt}`);
      if (candidate.startsWith(this.uploadsDir + path.sep) && fs.existsSync(candidate)) {
        try {
          fs.unlinkSync(candidate);
        } catch {
          // ignore
        }
      }
    }
    this.state.uploadedCoinIcon = null;
    this.state.config.coinIconUrl = DEFAULT_COIN_ICON;
    this.persist();
    return this.getConfig();
  }

  getCurrentRoundNumber(): number {
    return this.state.currentRoundNumber;
  }

  getHistory(): RoundHistoryItem[] {
    return [...this.state.history];
  }

  getStats(): GlobalStats {
    return {
      ...this.state.stats,
      seatWins: { ...this.state.stats.seatWins },
    };
  }

  resetStats(): GlobalStats {
    this.state.stats = {
      roundsPlayed: 0,
      totalWagered: 0,
      totalPayouts: 0,
      seatWins: { A: 0, B: 0, C: 0 },
    };
    this.persist();
    return this.getStats();
  }

  upsertPlayerHeartbeat(playerId: string, name?: string): PlayerRecord {
    const now = Date.now();
    const existing = this.state.players[playerId];
    if (existing) {
      existing.lastSeenAt = now;
      if (name && name.trim().length > 0) {
        existing.name = sanitizePlayerName(name, existing.name);
      }
      this.persist();
      return { ...existing };
    }

    const created: PlayerRecord = {
      id: playerId,
      name: sanitizePlayerName(name, this.state.config.playerName || 'Player'),
      balance: DEFAULT_STARTING_BALANCE,
      totalRounds: 0,
      winsCount: 0,
      lossesCount: 0,
      totalWagered: 0,
      totalPayouts: 0,
      lastSeenAt: now,
      createdAt: now,
    };
    this.state.players[playerId] = created;
    this.persist();
    return { ...created };
  }

  getPlayer(playerId: string): PlayerRecord | null {
    const rec = this.state.players[playerId];
    return rec ? { ...rec } : null;
  }

  listPlayers(): PlayerRecord[] {
    return Object.values(this.state.players)
      .map((p) => ({ ...p }))
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }

  updatePlayer(
    playerId: string,
    patch: { balance?: number; name?: string }
  ): PlayerRecord | null {
    const existing = this.state.players[playerId];
    if (!existing) return null;
    if (patch.balance !== undefined) {
      existing.balance = Math.round(clampNumber(patch.balance, 0, 999_999_999, existing.balance));
    }
    if (patch.name !== undefined) {
      existing.name = sanitizePlayerName(patch.name, existing.name);
    }
    this.persist();
    return { ...existing };
  }

  topUpPlayer(playerId: string, amount: number): PlayerRecord {
    const player = this.upsertPlayerHeartbeat(playerId);
    const ref = this.state.players[player.id];
    ref.balance = Math.min(999_999_999, ref.balance + Math.max(0, Math.floor(amount)));
    ref.lastSeenAt = Date.now();
    this.persist();
    return { ...ref };
  }

  resetPlayerBalance(playerId: string, defaultBalance: number): PlayerRecord {
    const player = this.upsertPlayerHeartbeat(playerId);
    const ref = this.state.players[player.id];
    ref.balance = Math.max(0, Math.floor(defaultBalance));
    ref.lastSeenAt = Date.now();
    this.persist();
    return { ...ref };
  }

  recordRoundResolution(params: {
    playerId: string;
    playerName?: string;
    winner: SeatId;
    winningRank: RoundHistoryItem['winningRank'];
    userBetTotal: number;
    payout: number;
    multiplierUsed: number;
    clearOneShotForcedWinner: boolean;
  }) {
    const player = this.upsertPlayerHeartbeat(params.playerId, params.playerName);
    const ref = this.state.players[player.id];

    const finishedRound = this.state.currentRoundNumber;
    const betTotal = Math.max(0, Math.floor(params.userBetTotal));
    const payout = Math.max(0, Math.floor(params.payout));

    if (betTotal > 0) {
      ref.balance = Math.max(0, Math.min(999_999_999, ref.balance - betTotal + payout));
      ref.totalRounds += 1;
      ref.totalWagered += betTotal;
      ref.totalPayouts += payout;
      if (payout > 0) {
        ref.winsCount += 1;
      } else {
        ref.lossesCount += 1;
      }
    }
    ref.lastSeenAt = Date.now();

    const item: RoundHistoryItem = {
      round: finishedRound,
      winner: params.winner,
      winningRank: params.winningRank,
      userBetTotal: betTotal,
      userPayout: payout,
      multiplierUsed: params.multiplierUsed,
    };

    this.state.history = [item, ...this.state.history.slice(0, 49)];
    this.state.currentRoundNumber = finishedRound + 1;
    this.state.stats.roundsPlayed += 1;
    this.state.stats.totalWagered += betTotal;
    this.state.stats.totalPayouts += payout;
    this.state.stats.seatWins[params.winner] = (this.state.stats.seatWins[params.winner] || 0) + 1;

    if (params.clearOneShotForcedWinner && this.state.config.forceNextWinner && !this.state.config.lockForcedWinner) {
      this.state.config.forceNextWinner = null;
    }

    this.persist();

    return {
      player: { ...ref },
      history: this.getHistory(),
      nextRoundNumber: this.state.currentRoundNumber,
      stats: this.getStats(),
      config: this.getConfig(),
    };
  }

  exportPublicSnapshot(): PublicDbExport {
    return {
      exportedAt: new Date().toISOString(),
      config: this.getConfig(),
      currentRoundNumber: this.state.currentRoundNumber,
      stats: this.getStats(),
      history: this.getHistory(),
      players: this.listPlayers(),
    };
  }
}

export function createDatabase(): ITeenPattiDatabase {
  return new JsonFileTeenPattiDatabase(process.env.DATABASE_FILE);
}
