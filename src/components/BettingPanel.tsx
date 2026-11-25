import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BetOption,
  BET_MULTIPLIERS,
  GamePhase,
  PlacedChip,
} from '../types/game';
import { formatCompactCoins } from '../utils/gameHelpers';
import { CasinoChipIcon } from './GameIcons';

interface BettingPanelProps {
  phase: GamePhase;
  poolBets: Record<BetOption, number>;
  playerBets: Record<BetOption, number>;
  placedChips: PlacedChip[];
  winningOption: BetOption | null;
  bonusOption: BetOption | null;
  onPlaceBet: (option: BetOption) => void;
}

const OPTIONS_ORDER: BetOption[] = ['watermelon', 'seven', 'plum'];

/**
 * Razor-sharp metallic silver-blue beveled hexagonal shield matching Screenshot 4
 * for BOTH Watermelon and Plum HD fruit icons.
 */
const SilverHexPlate: React.FC<{ iconSrc: string; alt: string; uid: string }> = ({
  iconSrc,
  alt,
  uid,
}) => {
  return (
    <div className="relative flex h-full aspect-[1.2/1] items-center justify-center">
      <svg
        viewBox="0 0 116 96"
        className="absolute inset-0 h-full w-full drop-shadow-[0_3px_5px_rgba(32,0,58,0.72)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`hex-outer-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F5FAFF" />
            <stop offset="35%" stopColor="#C8E1F8" />
            <stop offset="72%" stopColor="#8DB4DB" />
            <stop offset="100%" stopColor="#5C7FA8" />
          </linearGradient>
          <radialGradient id={`hex-inner-${uid}`} cx="50%" cy="38%" r="65%">
            <stop offset="0%" stopColor="#3B8CE3" />
            <stop offset="60%" stopColor="#2162B5" />
            <stop offset="100%" stopColor="#123D7A" />
          </radialGradient>
        </defs>
        <polygon
          points="28,4 88,4 110,48 88,92 28,92 6,48"
          fill="#3A1061"
          stroke="#4F187D"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <polygon
          points="29,8 87,8 106,48 87,88 29,88 10,48"
          fill={`url(#hex-outer-${uid})`}
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <polygon
          points="32,15 84,15 98,48 84,81 32,81 18,48"
          fill={`url(#hex-inner-${uid})`}
          stroke="#89C4FF"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <img
        src={iconSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        draggable={false}
        className="relative z-10 h-[82%] w-[82%] object-contain drop-shadow-[0_3px_4px_rgba(0,0,0,0.5)]"
      />
    </div>
  );
};

export const BettingPanel: React.FC<BettingPanelProps> = ({
  phase,
  poolBets,
  playerBets,
  placedChips,
  winningOption,
  bonusOption,
  onPlaceBet,
}) => {
  const isBetting = phase === 'BETTING';

  return (
    <div
      className="absolute left-[2.1%] right-[2.1%] rounded-[14px] p-[3px]"
      style={{
        top: '69.1%',
        height: '15.8%',
        background: 'linear-gradient(180deg, #ffe787 0%, #e5a31c 45%, #a15a04 100%)',
        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.65), inset 0 1px 1px rgba(255,255,255,0.75)',
      }}
    >
      <div className="grid h-full w-full grid-cols-3 gap-[3px] rounded-[11px] bg-[#6e2408]/80 p-[2px]">
        {OPTIONS_ORDER.map((option) => {
          const mult = BET_MULTIPLIERS[option];
          const poolAmt = poolBets[option];
          const userAmt = playerBets[option];
          const isWinner =
            phase === 'RESULT' && (winningOption === option || bonusOption === option);
          const chipsForBox = placedChips.filter((c) => c.option === option).slice(-14);

          return (
            <button
              key={option}
              type="button"
              onClick={() => onPlaceBet(option)}
              disabled={!isBetting}
              aria-label={`Bet on ${option} for x${mult} multiplier`}
              className={`bet-box-surface group relative flex flex-col justify-between overflow-hidden rounded-[9px] border border-[#f5c451]/75 px-1.5 py-1 text-left transition-transform duration-100 focus-visible:outline-2 focus-visible:outline-yellow-300 ${
                isBetting ? 'cursor-pointer active:scale-[0.97]' : 'cursor-default'
              } ${isWinner ? 'bet-box-winning border-yellow-200 ring-2 ring-yellow-300' : ''}`}
            >
              {/* Top: Total Room Pool Amount */}
              <div className="relative z-10 flex w-full items-center justify-center">
                <span
                  className="font-display tabular-nums font-bold tracking-tight text-white text-stroke-dark leading-none"
                  style={{ fontSize: 'clamp(11px, 2.7vw, 18px)' }}
                >
                  {formatCompactCoins(poolAmt)}
                </span>
              </div>

              {/* Center: HD Icon + Full Unclipped Gold Multiplier */}
              <div className="relative flex flex-1 w-full items-center justify-center gap-0.5 min-h-0 px-0.5">
                <div className="relative z-10 flex h-[70%] max-h-[50px] items-center justify-center shrink-0">
                  {option === 'watermelon' && (
                    <SilverHexPlate
                      uid="melon"
                      iconSrc="/assets/game/icon_watermelon.png"
                      alt="Watermelon"
                    />
                  )}
                  {option === 'plum' && (
                    <SilverHexPlate
                      uid="plum"
                      iconSrc="/assets/game/icon_plum.png"
                      alt="Plum"
                    />
                  )}
                  {option === 'seven' && (
                    <div className="relative flex h-[92%] items-center justify-center">
                      <img
                        src="/assets/game/icon_77_large.png"
                        alt="Lucky 77"
                        referrerPolicy="no-referrer"
                        draggable={false}
                        className="h-full w-auto max-w-[66px] object-contain drop-shadow-[0_3px_6px_rgba(55,0,70,0.85)]"
                      />
                    </div>
                  )}
                </div>

                <span
                  className="relative z-30 font-display text-gold-3d font-black italic tracking-tight leading-none shrink-0 pr-1.5 pl-0.5"
                  style={{ fontSize: 'clamp(16px, 3.6vw, 25px)' }}
                >
                  x{mult}
                </span>
              </div>

              {/* Animated Scattered Ultra-Crisp Betting Chips on Box */}
              <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
                <AnimatePresence initial={false}>
                  {chipsForBox.map((chip) => (
                    <motion.div
                      key={chip.id}
                      initial={{
                        opacity: 0,
                        scale: 0.45,
                        y: chip.isPlayer ? 70 : -35,
                      }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                        y: 0,
                      }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute w-[18%] max-w-[27px] aspect-square rounded-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.75)]"
                      style={{
                        left: `${chip.xPct}%`,
                        top: `${chip.yPct}%`,
                        transform: `translate(-50%, -50%) rotate(${chip.rotation}deg)`,
                      }}
                    >
                      <CasinoChipIcon value={chip.value} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Bottom: Player's Own Bet Counter */}
              <div className="relative z-30 flex w-full items-center justify-center">
                <span
                  className={`font-display tabular-nums font-bold leading-none text-stroke-dark ${
                    userAmt > 0 ? 'text-[#ffec5c]' : 'text-white'
                  }`}
                  style={{ fontSize: 'clamp(11px, 2.7vw, 18px)' }}
                >
                  {formatCompactCoins(userAmt)}
                </span>
              </div>

              {/* Winning overlay flash badge */}
              {isWinner && (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-full rounded-[9px] bg-gradient-to-b from-yellow-200/20 via-transparent to-yellow-300/25" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
