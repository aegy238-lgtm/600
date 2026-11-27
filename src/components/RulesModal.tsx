import React from 'react';
import { X } from 'lucide-react';
import { SeatId } from '../engine/teenPatti';

interface RulesModalProps {
  open: boolean;
  multipliers: Record<SeatId, number>;
  onClose: () => void;
}

const HAND_RANKINGS = [
  {
    rank: '1. Trail (Three of a Kind)',
    example: ['A♠', 'A♥', 'A♦'],
    desc: 'Three cards of the same rank. A-A-A is the highest hand.',
  },
  {
    rank: '2. Pure Sequence (Straight Flush)',
    example: ['A♥', 'K♥', 'Q♥'],
    desc: 'Three consecutive cards of the same suit. A-K-Q > A-2-3 > K-Q-J.',
  },
  {
    rank: '3. Sequence (Straight)',
    example: ['9♠', '10♦', 'J♣'],
    desc: 'Three consecutive cards of mixed suits.',
  },
  {
    rank: '4. Color (Flush)',
    example: ['K♣', '8♣', '4♣'],
    desc: 'Any three cards of the same suit, not in sequence.',
  },
  {
    rank: '5. Pair',
    example: ['5♠', '9♣', '9♥'],
    desc: 'Two cards of the same rank plus a high kicker.',
  },
  {
    rank: '6. High Card',
    example: ['6♥', '10♥', 'A♦'],
    desc: 'Highest single card wins when no combination is formed.',
  },
];

export const RulesModal: React.FC<RulesModalProps> = ({
  open,
  multipliers,
  onClose,
}) => {
  if (!open) return null;

  const sameMultiplier =
    multipliers.A === multipliers.B && multipliers.B === multipliers.C;

  return (
    <div
      className="absolute inset-0 z-50 bg-white flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Teen Patti Rules"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#ececec] shrink-0">
        <h2 className="text-[17px] sm:text-[19px] font-bold text-[#9c6b1f] tracking-tight">
          Teen Patti Rules
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Rules"
          className="w-9 h-9 -mr-1.5 flex items-center justify-center rounded-full text-[#9c6b1f] hover:bg-[#fdf3de] active:scale-95 transition-colors cursor-pointer"
        >
          <X className="w-6 h-6 stroke-[2.2]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto history-scroll px-4 py-4 space-y-4 text-[#3b2c1a]">
        <div className="rounded-lg bg-[#fdf5e4] border border-[#ebd3a2] p-3.5 text-[13px] leading-relaxed">
          <p className="font-bold text-[#7c4d12] mb-1">How to Play</p>
          <p>
            Select a chip denomination at the bottom, then tap Royal Throne{' '}
            <strong>A</strong>, <strong>B</strong>, or <strong>C</strong> before the
            countdown ends. When cards flip, the throne with the highest 3-card Teen
            Patti hand wins and pays{' '}
            {sameMultiplier ? (
              <strong className="text-[#9e2598]">{multipliers.A}×</strong>
            ) : (
              <strong className="text-[#9e2598]">
                A: {multipliers.A}× · B: {multipliers.B}× · C: {multipliers.C}×
              </strong>
            )}{' '}
            your bet!
          </p>
        </div>

        <div>
          <h3 className="text-[13px] font-bold text-[#7c4d12] mb-2.5">
            Hand Rankings (Highest to Lowest)
          </h3>
          <div className="space-y-2.5">
            {HAND_RANKINGS.map((item) => (
              <div
                key={item.rank}
                className="flex items-center justify-between gap-3 py-2 border-b border-[#f1ece1] last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-[#2c2115]">{item.rank}</p>
                  <p className="text-[11.5px] text-[#7a6852] leading-snug mt-0.5">
                    {item.desc}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.example.map((c, i) => {
                    const isRed = c.includes('♥') || c.includes('♦');
                    return (
                      <span
                        key={i}
                        className={`inline-flex items-center justify-center w-[28px] h-[34px] rounded-[4px] border border-[#d6d3cb] bg-white text-[11px] font-extrabold shadow-xs ${
                          isRed ? 'text-[#dc2626]' : 'text-[#18181b]'
                        }`}
                      >
                        {c}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
