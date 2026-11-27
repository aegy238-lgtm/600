import React from 'react';
import {
  HandEvaluation,
  IS_RED_SUIT,
  SUIT_SYMBOL,
} from '../engine/teenPatti';

interface PlayingCardSetProps {
  hand: HandEvaluation | null;
  revealed: boolean;
  revealDelayMs?: number;
  showRankBanner: boolean;
  isWinner: boolean;
  isDimmed: boolean;
  timerSeconds?: number | null;
  onTimerClick?: () => void;
}

export const PlayingCardSet: React.FC<PlayingCardSetProps> = ({
  hand,
  revealed,
  revealDelayMs = 0,
  showRankBanner,
  isWinner,
  isDimmed,
  timerSeconds,
  onTimerClick,
}) => {
  const slots = [0, 1, 2];

  return (
    <div
      className={`relative w-full aspect-[1.64/1] transition-all duration-300 ${
        isWinner ? 'z-20 scale-[1.03]' : 'z-10'
      }`}
    >
      {/* Winning subtle luminous glow behind the 3 cards (appears ONLY after all cards open) */}
      {revealed && isWinner && (
        <div
          className="pointer-events-none absolute -inset-1 rounded-md opacity-95 transition-opacity duration-300"
          style={{
            boxShadow:
              '0 0 20px rgba(255, 245, 195, 0.95), 0 0 8px rgba(255, 210, 80, 0.9)',
          }}
        />
      )}

      {/* 3 Overlapping Playing Cards */}
      <div className="relative w-full h-full">
        {slots.map((idx) => {
          const card = hand?.cards[idx];
          const isRed = card ? IS_RED_SUIT[card.suit] : false;
          const suitChar = card ? SUIT_SYMBOL[card.suit] : '';
          const leftPercent = idx * 27;

          return (
            <div
              key={idx}
              className="card-perspective absolute top-0 bottom-0"
              style={{
                left: `${leftPercent}%`,
                width: '46%',
                zIndex: idx + 1,
              }}
            >
              <div
                className={`card-inner ${revealed && card ? 'is-flipped' : ''}`}
                style={{
                  transitionDelay: revealed ? `${revealDelayMs + idx * 75}ms` : '0ms',
                }}
              >
                {/* Card Back (Ultra-crisp HD geometric gold lattice pattern) */}
                <div className="card-face rounded-[5px] overflow-hidden bg-white p-[1.5px] shadow-[0_2px_4px_rgba(68,42,10,0.35)] border border-[#e7d8b9]">
                  <img
                    src="/assets/hd/card-back.png"
                    alt="Teen Patti card back"
                    referrerPolicy="no-referrer"
                    draggable={false}
                    className="w-full h-full object-cover rounded-[3.5px]"
                  />
                </div>

                {/* Card Front (Exact white card face matching Screenshot 2) */}
                <div
                  className={`card-face card-face-front rounded-[5px] bg-white border border-[#d6d6d6] shadow-[0_2px_5px_rgba(0,0,0,0.28)] overflow-hidden flex flex-col justify-between ${
                    isRed ? 'text-[#e02424]' : 'text-[#18181b]'
                  }`}
                >
                  {card && (
                    <>
                      {/* Top-left rank & small suit stacked tightly so overlapping cards stay legible */}
                      <div className="pl-[3px] pt-[2px] leading-none flex flex-col items-center w-[42%]">
                        <span
                          className={`font-extrabold tracking-tighter ${
                            card.label === '10'
                              ? 'text-[11px] sm:text-[13px]'
                              : 'text-[12px] sm:text-[14px]'
                          }`}
                        >
                          {card.label}
                        </span>
                        <span className="text-[9px] sm:text-[11px] leading-none -mt-[1px]">
                          {suitChar}
                        </span>
                      </div>

                      {/* Large bottom-center suit pip */}
                      <div className="flex-1 flex items-end justify-center pb-[3px] sm:pb-[4px] pr-[2px]">
                        <span className="text-[22px] sm:text-[27px] leading-none">
                          {suitChar}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Hand Rank Translucent Ribbon Banner (appears smoothly once this seat's cards open) */}
        {showRankBanner && hand && (
          <div
            className="pointer-events-none absolute left-0 right-0 top-[39%] h-[25%] z-20 flex items-center justify-center rounded-[2px] transition-opacity duration-300"
            style={{
              background:
                'linear-gradient(90deg, rgba(35,35,35,0.18) 0%, rgba(30,30,30,0.74) 18%, rgba(30,30,30,0.74) 82%, rgba(35,35,35,0.18) 100%)',
            }}
          >
            <span className="text-white font-bold text-[11px] sm:text-[13px] tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] whitespace-nowrap px-1">
              {hand.rankName}
            </span>
          </div>
        )}

        {/* Losing Seat Dimming Veil (applied ONLY during RESULT phase after all cards have opened) */}
        {isDimmed && (
          <div className="pointer-events-none absolute inset-0 z-30 rounded-[5px] bg-black/45 transition-opacity duration-300" />
        )}

        {/* Center Green Countdown Circle over Set B during Betting Phase (Screenshot 3) */}
        {typeof timerSeconds === 'number' && !revealed && (
          <button
            type="button"
            onClick={onTimerClick}
            title="Tap to skip countdown"
            aria-label={`Betting countdown: ${timerSeconds} seconds remaining`}
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-[38px] h-[38px] sm:w-[44px] sm:h-[44px] rounded-full flex items-center justify-center cursor-pointer transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-white ${
              timerSeconds <= 5 ? 'animate-timer-urgent' : ''
            }`}
            style={{
              background:
                timerSeconds <= 5
                  ? 'radial-gradient(circle at 35% 30%, #f59e0b, #dc2626)'
                  : 'radial-gradient(circle at 35% 30%, #43d957, #1cb835)',
              boxShadow:
                timerSeconds <= 5
                  ? '0 0 0 3px rgba(248,113,113,0.45), 0 3px 8px rgba(0,0,0,0.35)'
                  : '0 0 0 3px rgba(134,239,172,0.45), 0 3px 8px rgba(0,0,0,0.3)',
            }}
          >
            <span className="text-white font-extrabold text-[15px] sm:text-[18px] tabular-nums drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">
              {timerSeconds}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
