import React from 'react';
import { Volume2, VolumeX, RotateCcw, RefreshCw, Sliders, X } from 'lucide-react';

interface MenuModalProps {
  open: boolean;
  soundEnabled: boolean;
  roundDuration: number;
  onToggleSound: () => void;
  onChangeDuration: (sec: number) => void;
  onOpenDashboard: () => void;
  onReconnect: () => void;
  onResetSession: () => void;
  onClose: () => void;
}

export const MenuModal: React.FC<MenuModalProps> = ({
  open,
  soundEnabled,
  roundDuration,
  onToggleSound,
  onChangeDuration,
  onOpenDashboard,
  onReconnect,
  onResetSession,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50 bg-black/55 flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Game Settings"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[310px] rounded-xl bg-[#fffaf0] border-2 border-[#c89a45] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-[#f0ca78] to-[#dca94b] border-b border-[#b9852f]">
          <h2 className="text-[16px] font-extrabold text-[#4e3008]">
            Table Options
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Menu"
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#4e3008] hover:bg-black/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2.5 text-[#4e3008]">
          {/* Open Control Dashboard */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenDashboard();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-amber-300 text-[13px] font-bold cursor-pointer transition-colors"
          >
            <Sliders className="w-4 h-4" />
            لوحة التحكم · Control Dashboard
          </button>

          {/* Sound FX Toggle */}
          <button
            type="button"
            onClick={onToggleSound}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#f6e6c3] border border-[#e0c182] hover:brightness-98 cursor-pointer"
          >
            <span className="flex items-center gap-2 text-[14px] font-bold">
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[#7c4d12]" />
              ) : (
                <VolumeX className="w-4 h-4 text-[#a18254]" />
              )}
              Sound Effects
            </span>
            <span className="text-[12px] font-extrabold text-[#8a5407]">
              {soundEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Round Speed */}
          <div className="px-3.5 py-2.5 rounded-lg bg-[#f6e6c3] border border-[#e0c182]">
            <p className="text-[13px] font-bold mb-2">Betting Countdown</p>
            <div className="grid grid-cols-3 gap-1.5">
              {[10, 15, 23].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onChangeDuration(sec)}
                  className={`py-1.5 rounded-md text-[12px] font-bold cursor-pointer transition-colors ${
                    roundDuration === sec
                      ? 'bg-[#b37c24] text-white'
                      : 'bg-white/75 text-[#6b4817] hover:bg-white'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* Reconnect Table */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onReconnect();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#f3d696] border border-[#cda04c] text-[13px] font-bold hover:brightness-98 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Reconnect Table
          </button>

          {/* Reset Session */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onResetSession();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#fce7e7] border border-[#e5a6a6] text-[#9b1c1c] text-[13px] font-bold hover:bg-[#fad5d5] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Session
          </button>
        </div>
      </div>
    </div>
  );
};
