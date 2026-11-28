import React, { useCallback, useEffect, useState } from 'react';
import { Crown, RefreshCw, Trophy, X } from 'lucide-react';
import { formatCoins } from '../engine/teenPatti';
import { fetchLeaderboard, LeaderboardEntry } from '../utils/api';

interface LeaderboardModalProps {
  open: boolean;
  apiBase: string;
  serverConnected: boolean;
  currentPlayerId: string;
  currentPlayerName: string;
  currentBalance: number;
  currentTotalPayouts: number;
  currentRoundsPlayed: number;
  coinIconUrl: string;
  onClose: () => void;
}

const AVATAR_PALETTES = [
  'bg-[#7c2d12] text-[#fde68a]',
  'bg-[#1e3a5f] text-[#e0f2fe]',
  'bg-[#4c1d95] text-[#ede9fe]',
  'bg-[#14532d] text-[#dcfce7]',
  'bg-[#701a75] text-[#fae8ff]',
  'bg-[#78350f] text-[#fef3c7]',
  'bg-[#334155] text-[#f1f5f9]',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getRankBadgeClasses(rank: number): string {
  if (rank === 1) {
    return 'bg-gradient-to-b from-[#fde047] via-[#eab308] to-[#b45309] text-[#451a03] shadow-[0_2px_6px_rgba(180,83,9,0.35)]';
  }
  if (rank === 2) {
    return 'bg-gradient-to-b from-[#f1f5f9] via-[#cbd5e1] to-[#64748b] text-[#1e293b] shadow-[0_2px_5px_rgba(71,85,105,0.28)]';
  }
  if (rank === 3) {
    return 'bg-gradient-to-b from-[#fdba74] via-[#d97706] to-[#7c2d12] text-[#fff7ed] shadow-[0_2px_5px_rgba(124,45,18,0.28)]';
  }
  return 'bg-[#f3ead6] text-[#7c5824] border border-[#e2cfa8]';
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  open,
  apiBase,
  serverConnected,
  currentPlayerId,
  currentPlayerName,
  currentBalance,
  currentTotalPayouts,
  currentRoundsPlayed,
  coinIconUrl,
  onClose,
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!serverConnected) {
      setEntries([
        {
          rank: 1,
          id: currentPlayerId,
          name: currentPlayerName || 'Player',
          balance: currentBalance,
          totalPayouts: currentTotalPayouts,
          winsCount: 0,
          totalRounds: currentRoundsPlayed,
          winRate: 0,
          isOnline: true,
        },
      ]);
      setTotalPlayers(1);
      setLoading(false);
      return;
    }

    try {
      const res = await fetchLeaderboard(apiBase, 7);
      setEntries(res.leaderboard.slice(0, 7));
      setTotalPlayers(res.totalPlayers);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load leaderboard right now.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    apiBase,
    serverConnected,
    currentPlayerId,
    currentPlayerName,
    currentBalance,
    currentTotalPayouts,
    currentRoundsPlayed,
  ]);

  useEffect(() => {
    if (!open) return;
    void loadLeaderboard();
  }, [open, loadLeaderboard]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50 bg-[#fffdf7] flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Top 7 Leaderboard"
    >
      {/* Royal Gold Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-[#e8d2a2] shrink-0"
        style={{
          background: 'linear-gradient(180deg, #fff8e4 0%, #f5e2b5 100%)',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-b from-[#fcd34d] to-[#b45309] flex items-center justify-center shadow-[0_2px_6px_rgba(146,64,14,0.3)] shrink-0">
            <Trophy className="w-4 h-4 text-[#451a03] stroke-[2.3]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[16px] sm:text-[18px] font-bold text-[#5a370c] tracking-tight leading-tight truncate">
              Top 7 Leaderboard
            </h2>
            <p className="text-[11px] text-[#8a6530] leading-tight">
              Ranked by total winnings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => void loadLeaderboard()}
            disabled={loading}
            aria-label="Refresh Leaderboard"
            title="Refresh"
            className="w-10 h-10 flex items-center justify-center rounded-full text-[#7c4d12] hover:bg-[#ecd399]/60 active:scale-95 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Leaderboard"
            className="w-10 h-10 -mr-1.5 flex items-center justify-center rounded-full text-[#7c4d12] hover:bg-[#ecd399]/60 active:scale-95 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6 stroke-[2.2]" />
          </button>
        </div>
      </div>

      {/* Column Labels */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#f0e5cc] bg-[#fcf7eb] text-[11px] font-semibold text-[#8c6b3a] shrink-0">
        <span>Rank · Player</span>
        <span>Total Won · Balance</span>
      </div>

      {/* Leaderboard List */}
      <div className="flex-1 overflow-y-auto history-scroll px-3 py-2.5 space-y-2">
        {loading && entries.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#8c6b3a]">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-[13px] font-medium">Loading rankings...</span>
          </div>
        ) : error ? (
          <div className="py-10 px-4 text-center space-y-3">
            <p className="text-[13px] text-[#991b1b] font-medium">{error}</p>
            <button
              type="button"
              onClick={() => void loadLeaderboard()}
              className="px-4 py-2 rounded-lg bg-[#7c4d12] text-[#fff8e4] text-[12.5px] font-semibold hover:bg-[#633c0d] active:scale-95 transition-all cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-1.5">
            <Trophy className="w-9 h-9 text-[#d4a654] mx-auto mb-1" />
            <p className="text-[14px] font-bold text-[#5a370c]">
              No ranked players yet
            </p>
            <p className="text-[12px] text-[#8c6b3a]">
              Place a bet on the table to claim the #1 throne.
            </p>
          </div>
        ) : (
          entries.map((entry, idx) => {
            const isSelf = entry.id === currentPlayerId;
            const isTopThree = entry.rank <= 3;
            const paletteClass = AVATAR_PALETTES[idx % AVATAR_PALETTES.length];

            return (
              <div
                key={entry.id}
                className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl border transition-colors ${
                  entry.rank === 1
                    ? 'bg-[#fff6d6] border-[#e6be5a] shadow-[0_2px_8px_rgba(217,119,6,0.12)]'
                    : isSelf
                    ? 'bg-[#fdf4e3] border-[#d8b36b]'
                    : 'bg-white border-[#efe5d1]'
                }`}
              >
                {/* Left: Rank + Avatar + Name & Record */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-extrabold tabular-nums ${getRankBadgeClasses(
                        entry.rank
                      )}`}
                    >
                      {entry.rank}
                    </div>
                    {entry.rank === 1 && (
                      <Crown className="w-3.5 h-3.5 text-[#d97706] fill-[#facc15] absolute -top-2.5 left-1/2 -translate-x-1/2" />
                    )}
                  </div>

                  {isSelf ? (
                    <img
                      src="/assets/hd/avatar-player.png"
                      alt={`${entry.name} avatar`}
                      referrerPolicy="no-referrer"
                      draggable={false}
                      className="w-9 h-9 rounded-full object-cover border border-[#d6a84e] shrink-0"
                    />
                  ) : (
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${paletteClass}`}
                    >
                      {getInitials(entry.name)}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`text-[13.5px] font-bold truncate ${
                          isTopThree ? 'text-[#3f2406]' : 'text-[#2c2115]'
                        }`}
                      >
                        {entry.name}
                      </span>
                      {isSelf && (
                        <span className="text-[11px] font-bold text-[#9c259b] shrink-0">
                          (You)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#85673b] tabular-nums truncate">
                      {entry.totalRounds > 0
                        ? `${entry.winsCount} wins · ${entry.winRate}% rate`
                        : '0 rounds played'}
                    </p>
                  </div>
                </div>

                {/* Right: Total Won + Balance */}
                <div className="text-right shrink-0">
                  <div className="flex items-center justify-end gap-1">
                    <img
                      src={coinIconUrl}
                      alt="Coins"
                      referrerPolicy="no-referrer"
                      draggable={false}
                      className="w-4 h-4 object-contain shrink-0"
                    />
                    <span className="text-[14px] font-extrabold text-[#9a5708] tabular-nums">
                      {formatCoins(entry.totalPayouts)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8c6b3a] tabular-nums">
                    Bal: {formatCoins(entry.balance)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Subtle Footer Summary */}
      <div className="px-4 py-2.5 border-t border-[#efe5d1] bg-[#fcf7eb] flex items-center justify-between text-[11.5px] text-[#85673b] shrink-0">
        <span>Showing top {entries.length} of 7 slots</span>
        <span className="tabular-nums">
          {totalPlayers} {totalPlayers === 1 ? 'player' : 'players'} tracked
        </span>
      </div>
    </div>
  );
};
