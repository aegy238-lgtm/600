import {
  DEFAULT_COIN_ICON,
  GameControlConfig,
  HandEvaluation,
  isSafeCoinIconUrl,
  RoundHistoryItem,
  SeatId,
} from '../engine/teenPatti';

export interface ServerPlayerRecord {
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

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  balance: number;
  totalPayouts: number;
  winsCount: number;
  totalRounds: number;
  winRate: number;
  isOnline: boolean;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  totalPlayers: number;
  updatedAt: number;
}

export interface ServerStats {
  roundsPlayed: number;
  totalWagered: number;
  totalPayouts: number;
  seatWins: Record<SeatId, number>;
}

export interface PublicConfigResponse {
  config: GameControlConfig;
  currentRoundNumber: number;
  history: RoundHistoryItem[];
  stats: ServerStats;
}

export interface HeartbeatResponse extends PublicConfigResponse {
  player: ServerPlayerRecord;
}

export interface ResolveRoundResponse {
  hands: Record<SeatId, HandEvaluation>;
  winner: SeatId;
  seatMultiplier: number;
  totalBet: number;
  payout: number;
  newBalance: number;
  history: RoundHistoryItem[];
  nextRoundNumber: number;
  stats: ServerStats;
  config: GameControlConfig;
}

export interface AdminOverviewResponse {
  config: GameControlConfig;
  stats: ServerStats;
  players: ServerPlayerRecord[];
  history: RoundHistoryItem[];
  currentRoundNumber: number;
  uploadedCoinIcon: {
    filename: string;
    mimeType: string;
    updatedAt: number;
  } | null;
}

const API_BASE_STORAGE_KEY = 'teen_patti_api_base_url';

function sanitizeApiBase(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
    }
  } catch {
    return '';
  }
  return '';
}

export function getInitialApiBase(): string {
  const envBase = sanitizeApiBase(import.meta.env.VITE_API_BASE_URL as string | undefined);
  if (envBase) return envBase;
  try {
    return sanitizeApiBase(localStorage.getItem(API_BASE_STORAGE_KEY));
  } catch {
    return '';
  }
}

export function saveApiBase(url: string): string {
  const normalized = sanitizeApiBase(url);
  try {
    if (normalized) {
      localStorage.setItem(API_BASE_STORAGE_KEY, normalized);
    } else {
      localStorage.removeItem(API_BASE_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  return normalized;
}

export function resolveCoinIconSrc(coinIconUrl: string | undefined, apiBase: string): string {
  if (!isSafeCoinIconUrl(coinIconUrl)) return DEFAULT_COIN_ICON;
  const url = coinIconUrl!.trim();
  if (url.startsWith('/api/assets/') && apiBase) {
    return `${apiBase.replace(/\/+$/, '')}${url}`;
  }
  return url;
}

async function apiFetch<T>(
  apiBase: string,
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    token?: string | null;
  } = {}
): Promise<T> {
  const base = apiBase.replace(/\/+$/, '');
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(`${base}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

// ================= PUBLIC GAME ENDPOINTS =================

export function fetchServerConfig(apiBase: string): Promise<PublicConfigResponse> {
  return apiFetch<PublicConfigResponse>(apiBase, '/api/config');
}

export function fetchLeaderboard(
  apiBase: string,
  limit = 7
): Promise<LeaderboardResponse> {
  return apiFetch<LeaderboardResponse>(
    apiBase,
    `/api/leaderboard?limit=${encodeURIComponent(String(limit))}`
  );
}

export function sendPlayerHeartbeat(
  apiBase: string,
  playerId: string,
  name?: string
): Promise<HeartbeatResponse> {
  return apiFetch<HeartbeatResponse>(apiBase, '/api/players/heartbeat', {
    method: 'POST',
    body: { playerId, name },
  });
}

export function requestTopUp(
  apiBase: string,
  playerId: string,
  amount: number
): Promise<{ player: ServerPlayerRecord }> {
  return apiFetch<{ player: ServerPlayerRecord }>(apiBase, '/api/players/topup', {
    method: 'POST',
    body: { playerId, amount },
  });
}

export function requestPlayerReset(
  apiBase: string,
  playerId: string
): Promise<{ player: ServerPlayerRecord }> {
  return apiFetch<{ player: ServerPlayerRecord }>(apiBase, '/api/players/reset', {
    method: 'POST',
    body: { playerId },
  });
}

export function resolveServerRound(
  apiBase: string,
  payload: {
    playerId: string;
    playerName: string;
    bets: Record<SeatId, number>;
  }
): Promise<ResolveRoundResponse> {
  return apiFetch<ResolveRoundResponse>(apiBase, '/api/rounds/resolve', {
    method: 'POST',
    body: payload,
  });
}

// ================= ADMIN AUTH ENDPOINTS =================

export function fetchAdminStatus(
  apiBase: string
): Promise<{ setupRequired: boolean; envManaged: boolean }> {
  return apiFetch<{ setupRequired: boolean; envManaged: boolean }>(
    apiBase,
    '/api/admin/status'
  );
}

export function setupAdminPassword(
  apiBase: string,
  password: string
): Promise<{ token: string; expiresAt: number }> {
  return apiFetch<{ token: string; expiresAt: number }>(apiBase, '/api/admin/setup', {
    method: 'POST',
    body: { password },
  });
}

export function loginAdmin(
  apiBase: string,
  password: string
): Promise<{ token: string; expiresAt: number }> {
  return apiFetch<{ token: string; expiresAt: number }>(apiBase, '/api/admin/login', {
    method: 'POST',
    body: { password },
  });
}

// ================= PROTECTED ADMIN ENDPOINTS =================

export function fetchAdminOverview(
  apiBase: string,
  token: string
): Promise<AdminOverviewResponse> {
  return apiFetch<AdminOverviewResponse>(apiBase, '/api/admin/overview', {
    token,
  });
}

export function saveAdminConfig(
  apiBase: string,
  token: string,
  patch: Partial<GameControlConfig>
): Promise<{ config: GameControlConfig }> {
  return apiFetch<{ config: GameControlConfig }>(apiBase, '/api/admin/config', {
    method: 'PUT',
    token,
    body: patch,
  });
}

export function resetAdminConfig(
  apiBase: string,
  token: string
): Promise<{ config: GameControlConfig }> {
  return apiFetch<{ config: GameControlConfig }>(apiBase, '/api/admin/config/reset', {
    method: 'POST',
    token,
  });
}

export function resetAdminStats(
  apiBase: string,
  token: string
): Promise<{ stats: ServerStats }> {
  return apiFetch<{ stats: ServerStats }>(apiBase, '/api/admin/stats/reset', {
    method: 'POST',
    token,
  });
}

export function uploadAdminCoinIcon(
  apiBase: string,
  token: string,
  dataBase64: string
): Promise<{ coinIconUrl: string; config: GameControlConfig }> {
  return apiFetch<{ coinIconUrl: string; config: GameControlConfig }>(
    apiBase,
    '/api/admin/coin-icon',
    {
      method: 'POST',
      token,
      body: { dataBase64 },
    }
  );
}

export function deleteAdminCoinIcon(
  apiBase: string,
  token: string
): Promise<{ coinIconUrl: string; config: GameControlConfig }> {
  return apiFetch<{ coinIconUrl: string; config: GameControlConfig }>(
    apiBase,
    '/api/admin/coin-icon',
    {
      method: 'DELETE',
      token,
    }
  );
}

export function updateAdminPlayer(
  apiBase: string,
  token: string,
  playerId: string,
  patch: { balance?: number; name?: string }
): Promise<{ player: ServerPlayerRecord }> {
  return apiFetch<{ player: ServerPlayerRecord }>(
    apiBase,
    `/api/admin/players/${encodeURIComponent(playerId)}`,
    {
      method: 'PUT',
      token,
      body: patch,
    }
  );
}

export async function downloadDatabaseBackup(
  apiBase: string,
  token: string
): Promise<void> {
  const base = apiBase.replace(/\/+$/, '');
  const res = await fetch(`${base}/api/admin/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `teen-patti-db-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
