import React from 'react';
import { X } from 'lucide-react';
import { formatCoins } from '../engine/teenPatti';

interface TopUpModalProps {
  open: boolean;
  balance: number;
  onAddCoins: (amount: number) => void;
  onClose: () => void;
}

const PACKAGES = [
  { amount: 10_000, label: '+10k', tag: 'Starter' },
  { amount: 50_000, label: '+50k', tag: 'Popular' },
  { amount: 200_000, label: '+200k', tag: 'High Roller' },
  { amount: 1_000_000, label: '+1M', tag: 'Royal VIP' },
];

export const TopUpModal: React.FC<TopUpModalProps> = ({
  open,
  balance,
  onAddCoins,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50 bg-black/55 flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Top Up Coins"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[340px] rounded-xl bg-[#fffaf0] border-2 border-[#c89a45] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-[#f0ca78] to-[#dca94b] border-b border-[#b9852f]">
          <div className="flex items-center gap-2">
            <img
              src="/assets/hd/icon-pearl.png"
              alt="Pearl coins"
              referrerPolicy="no-referrer"
              className="w-6 h-6 object-contain"
            />
            <h2 className="text-[16px] font-extrabold text-[#4e3008]">
              Top Up Coins
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Top Up"
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#4e3008] hover:bg-black/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg bg-[#f6e6c3] border border-[#e0c182]">
            <span className="text-[13px] font-semibold text-[#6e4a16]">
              Current Balance
            </span>
            <span className="text-[15px] font-extrabold text-[#8a5407] tabular-nums">
              {balance.toLocaleString('en-US')} ({formatCoins(balance)})
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {PACKAGES.map((pkg) => (
              <button
                key={pkg.amount}
                type="button"
                onClick={() => onAddCoins(pkg.amount)}
                className="flex flex-col items-center justify-center py-3 px-2 rounded-lg bg-gradient-to-b from-[#fff5dc] to-[#f4d898] border border-[#cfa14e] hover:brightness-105 active:scale-95 transition-all cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-1.5">
                  <img
                    src="/assets/hd/icon-pearl.png"
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 object-contain"
                  />
                  <span className="text-[16px] font-extrabold text-[#5a3609] tabular-nums">
                    {pkg.label}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[#8c6429] mt-0.5">
                  {pkg.tag} · Free
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
