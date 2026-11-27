import type { BetOption } from '../types/game';

export interface ServerGameSettings {
  winRate: number;
  lossRate: number;
  lucky77BonusChance: number;
  bettingDurationSec: number;
  updatedAt: number;
}

export interface ServerPlayerRecord {
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
  customWinRate: number | null;
  lastBetAt: number | null;
  lastSeenAt: number;
  createdAt: number;
  isOnline?: boolean;
}

export interface ServerRoundLog {
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

export interface AdminOverviewPayload {
  settings: ServerGameSettings;
  kpis: {
    onlinePlayers: number;
    totalPlayers: number;
    totalWagered: number;
    totalPayouts: number;
    houseProfit: number;
    totalPlayedRounds: number;
    realizedWinRate: number;
    realizedLossRate: number;
  };
  players: ServerPlayerRecord[];
  roundLogs: ServerRoundLog[];
  currentRoundNumber: number;
}

export interface ResolveRoundResponse {
  winningSliceIndex: number;
  winningOption: BetOption;
  bonusOption: BetOption | null;
  totalCost: number;
  totalWin: number;
  newBalance: number;
  history: BetOption[];
  nextRoundNumber: number;
}

export function getDefaultApiBase(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }
  return '';
}

export function isValidHttpBaseUrl(url: string): boolean {
  if (!url) return true; // empty = same-origin
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildUrl(path: string, customBase?: string): string {
  const base = (customBase !== undefined ? customBase : getDefaultApiBase()).replace(/\/$/, '');
  return `${base}${path}`;
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`;
    throw new Error(errMsg);
  }
  return data as T;
}

// ---------------- Game Client API ----------------

export function fetchGameConfig(apiBase?: string) {
  return jsonRequest<{
    settings: ServerGameSettings;
    currentRoundNumber: number;
    history: BetOption[];
  }>(buildUrl('/api/config', apiBase));
}

export function sendPlayerHeartbeat(
  payload: { playerId: string; name: string },
  apiBase?: string
) {
  return jsonRequest<{ player: ServerPlayerRecord; settings: ServerGameSettings }>(
    buildUrl('/api/players/heartbeat', apiBase),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

export function resetPlayerSession(
  payload: { playerId: string; name: string },
  apiBase?: string
) {
  return jsonRequest<{ player: ServerPlayerRecord }>(
    buildUrl('/api/players/reset', apiBase),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

export function refillPlayerCoins(
  payload: { playerId: string; name: string; amount: number },
  apiBase?: string
) {
  return jsonRequest<{ player: ServerPlayerRecord }>(
    buildUrl('/api/players/refill', apiBase),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

export function resolveRoundServer(
  payload: {
    playerId: string;
    playerName: string;
    bets: Record<BetOption, number>;
    roundNumber: number;
  },
  apiBase?: string
) {
  return jsonRequest<ResolveRoundResponse>(buildUrl('/api/rounds/resolve', apiBase), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ---------------- Admin Dashboard API ----------------

export function fetchAdminStatus(apiBase?: string) {
  return jsonRequest<{ needsSetup: boolean; envManaged: boolean }>(
    buildUrl('/api/admin/status', apiBase)
  );
}

export function setupAdminPassword(password: string, apiBase?: string) {
  return jsonRequest<{ ok: boolean; token: string }>(buildUrl('/api/admin/setup', apiBase), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

export function loginAdmin(password: string, apiBase?: string) {
  return jsonRequest<{ ok: boolean; token: string }>(buildUrl('/api/admin/login', apiBase), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

export function fetchAdminOverview(token: string, apiBase?: string) {
  return jsonRequest<AdminOverviewPayload>(buildUrl('/api/admin/overview', apiBase), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateAdminSettings(
  token: string,
  patch: Partial<Pick<ServerGameSettings, 'winRate' | 'lucky77BonusChance' | 'bettingDurationSec'>>,
  apiBase?: string
) {
  return jsonRequest<{ settings: ServerGameSettings }>(buildUrl('/api/admin/settings', apiBase), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  });
}

export function updateAdminPlayer(
  token: string,
  playerId: string,
  patch: { balance?: number; customWinRate?: number | null; name?: string },
  apiBase?: string
) {
  return jsonRequest<{ player: ServerPlayerRecord }>(
    buildUrl(`/api/admin/players/${encodeURIComponent(playerId)}`, apiBase),
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patch),
    }
  );
}

export function deleteAdminPlayer(token: string, playerId: string, apiBase?: string) {
  return jsonRequest<{ ok: boolean }>(
    buildUrl(`/api/admin/players/${encodeURIComponent(playerId)}`, apiBase),
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

export async function downloadDatabaseExport(token: string, apiBase?: string): Promise<void> {
  const res = await fetch(buildUrl('/api/admin/export', apiBase), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Export failed (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `lucky-wheel-db-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
