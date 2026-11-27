import React from 'react';
import { X } from 'lucide-react';
import { RoundHistoryItem, SeatId, SEAT_CONFIG } from '../engine/teenPatti';

interface GameHistoryModalProps {
  open: boolean;
  history: RoundHistoryItem[];
  onClose: () => void;
}

const SEATS: SeatId[] = ['A', 'B', 'C'];

export const GameHistoryModal: React.FC<GameHistoryModalProps> = ({
  open,
  history,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50 bg-white flex flex-col overflow-hidden animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Game History"
    >
      {/* Top Bar matching Screenshot 1 exactly */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#ececec] shrink-0">
        <h2 className="text-[17px] sm:text-[19px] font-bold text-[#24aac5] tracking-tight">
          Game History
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Game History"
          className="w-9 h-9 -mr-1.5 flex items-center justify-center rounded-full text-[#24aac5] hover:bg-[#e8f8fb] active:scale-95 transition-colors cursor-pointer"
        >
          <X className="w-6 h-6 stroke-[2.2]" />
        </button>
      </div>

      {/* Column Headers with Extracted Royal Thrones & A/B/C labels */}
      <div className="grid grid-cols-3 pt-4 pb-2 px-3 shrink-0 bg-white">
        {SEATS.map((seat) => (
          <div key={seat} className="flex flex-col items-center">
            <img
              src={SEAT_CONFIG[seat].throneImg}
              alt={`Throne ${seat}`}
              referrerPolicy="no-referrer"
              draggable={false}
              className="h-[62px] sm:h-[72px] w-auto object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.12)]"
            />
            <span className="mt-1.5 text-[15px] sm:text-[17px] font-semibold text-[#c4c4c4]">
              {seat}
            </span>
          </div>
        ))}
      </div>

      {/* Scrollable Win/Fail Rows matching Screenshot 1 */}
      <div className="flex-1 overflow-y-auto history-scroll px-3 pb-4">
        {history.map((item, idx) => (
          <div
            key={`${item.round}-${idx}`}
            className="grid grid-cols-3 items-center py-3 border-b border-[#f2f2f2] last:border-b-0"
          >
            {SEATS.map((seat) => {
              const isWin = item.winner === seat;
              return (
                <div key={seat} className="flex justify-center">
                  <div
                    className={`w-[36px] h-[36px] sm:w-[40px] sm:h-[40px] rounded-full flex items-center justify-center text-[11px] sm:text-[12px] font-bold tracking-tight ${
                      isWin
                        ? 'bg-[#78d92a] text-white shadow-[0_2px_5px_rgba(120,217,42,0.35)]'
                        : 'bg-[#e6e6e6] text-white'
                    }`}
                  >
                    {isWin ? 'Win' : 'Fail'}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
