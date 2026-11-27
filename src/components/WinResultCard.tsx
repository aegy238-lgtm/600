import React from 'react';
import { Crown, X } from 'lucide-react';
import { HandRankName, SEAT_CONFIG, SeatId, formatCoins } from '../engine/teenPatti';

export interface WinBannerData {
  seat: SeatId;
  handRank: HandRankName;
  betAmount: number;
  winAmount: number;
}

interface WinResultCardProps {
  data: WinBannerData | null;
  playerName: string;
  coinIconUrl: string;
  onDismiss: () => void;
}

export const WinResultCard: React.FC<WinResultCardProps> = ({
  data,
  playerName,
  coinIconUrl,
  onDismiss,
}) => {
  if (!data) return null;

  const seatInfo = SEAT_CONFIG[data.seat];

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onDismiss}
      className="absolute inset-x-[7.5%] top-[36%] z-45 flex justify-center cursor-pointer animate-win-card"
    >
      <div
        className="relative w-full max-w-[360px] rounded-[16px] p-[2.5px] shadow-[0_14px_38px_rgba(0,0,0,0.68),0_0_26px_rgba(255,212,92,0.55)]"
        style={{
          background:
            'linear-gradient(135deg, #fff3b8 0%, #e5ad3c 32%, #9a6012 68%, #ffea9c 100%)',
        }}
      >
        {/* Top Royal "YOU WIN" Crest Ribbon */}
        <div
          className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-0.5 rounded-full border border-[#fff2b2] shadow-[0_3px_10px_rgba(0,0,0,0.45)] flex items-center gap-1.5 whitespace-nowrap"
          style={{
            background:
              'linear-gradient(180deg, #ffe885 0%, #e8a728 55%, #be7b0f 100%)',
          }}
        >
          <Crown className="w-3.5 h-3.5 text-[#5c3000] fill-[#fff4b8]" />
          <span className="text-[11.5px] sm:text-[12.5px] font-black tracking-wide text-[#472300] uppercase">
            You Win!
          </span>
        </div>

        {/* Inner Velvet Royal Card */}
        <div
          className="relative rounded-[14px] px-3.5 pt-5 pb-3.5 text-[#fff6df] overflow-hidden"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, #5e310c 0%, #341906 58%, #210e03 100%)',
          }}
        >
          {/* Dismiss button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            aria-label="Close win banner"
            className="absolute right-2 top-2 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-[#f8df9c] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Player Profile Row: Avatar + Name + Winning Throne */}
          <div className="flex items-center gap-3 mb-3">
            <div className="relative shrink-0">
              <div
                className="w-[52px] h-[52px] sm:w-[56px] sm:h-[56px] rounded-full p-[2.5px] shadow-[0_0_14px_rgba(255,214,96,0.65)]"
                style={{
                  background:
                    'linear-gradient(180deg, #fff2a6 0%, #e5a52a 55%, #9b5d0e 100%)',
                }}
              >
                <img
                  src="/assets/hd/avatar-player.png"
                  alt={playerName}
                  referrerPolicy="no-referrer"
                  draggable={false}
                  className="w-full h-full rounded-full object-cover bg-[#1d0e04]"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#fff5db] border border-[#d69b31] shadow flex items-center justify-center p-0.5">
                <img
                  src={seatInfo.throneImg}
                  alt={`Seat ${data.seat}`}
                  referrerPolicy="no-referrer"
                  draggable={false}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            <div className="min-w-0 flex-1 pr-5">
              <p className="text-[15px] sm:text-[16.5px] font-extrabold text-white truncate leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]">
                {playerName}
              </p>
              <p className="mt-0.5 text-[11.5px] font-semibold text-[#f3cf7c] truncate">
                Seat {data.seat} · {data.handRank}
              </p>
            </div>
          </div>

          {/* Bet & Win Amounts Grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* Bet Amount Box */}
            <div className="rounded-lg bg-black/35 border border-[#c89236]/40 px-2.5 py-2 text-center">
              <span className="block text-[10.5px] font-semibold text-[#e6c98a] leading-none mb-1 uppercase tracking-wider">
                Bet
              </span>
              <div className="flex items-center justify-center gap-1">
                <img
                  src={coinIconUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  draggable={false}
                  className="w-4 h-4 object-contain shrink-0"
                />
                <span className="text-[14px] sm:text-[15.5px] font-bold text-[#fff4d4] tabular-nums">
                  {data.betAmount.toLocaleString('en-US')}
                </span>
              </div>
              <span className="block text-[10px] text-[#c7a96d] tabular-nums mt-0.5">
                ({formatCoins(data.betAmount)})
              </span>
            </div>

            {/* Win Amount Box */}
            <div className="rounded-lg bg-gradient-to-b from-[#2f6d1b]/55 to-[#163a0b]/70 border border-[#7be850]/55 px-2.5 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
              <span className="block text-[10.5px] font-semibold text-[#c5f8ae] leading-none mb-1 uppercase tracking-wider">
                Win
              </span>
              <div className="flex items-center justify-center gap-1">
                <img
                  src={coinIconUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  draggable={false}
                  className="w-4 h-4 object-contain shrink-0"
                />
                <span className="text-[14px] sm:text-[15.5px] font-black text-[#ffea52] tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]">
                  +{data.winAmount.toLocaleString('en-US')}
                </span>
              </div>
              <span className="block text-[10px] font-bold text-[#a9f28b] tabular-nums mt-0.5">
                (+{formatCoins(data.winAmount)})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
