import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCcw, Volume2, VolumeX, Check, Sliders } from 'lucide-react';
import {
  BetOption,
  ModalType,
  OPTION_ICONS,
  PersonalRecord,
  RoundResultData,
} from '../types/game';
import { formatCompactCoins, formatExactCoins } from '../utils/gameHelpers';
import { GoldCoinIcon } from './GameIcons';

interface ModalsProps {
  activeModal: ModalType;
  onClose: () => void;
  history: BetOption[];
  lastResult: RoundResultData | null;
  personalRecords: PersonalRecord[];
  playerName: string;
  playerBalance: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onAddCoins: (amount: number) => void;
  onUpdateName: (name: string) => void;
  onResetSession: () => void;
  onOpenAdmin?: () => void;
}

const HOW_TO_PLAY_RULES = [
  '1.Players can place cost on the fruit or 77 they predict the wheel will stop on, in order to earn rewards.',
  '2.Players need to select the cost amount before starting the game.',
  '3.Players can choose fruit or 77 on the wheel.',
  "4.If the result matches the player's choose, they will receive rewards based on the odds.",
  '5.Different options have different odds, players can analyze the probability of options by observing the game history.',
  '6.When lucky 77 occurs, there is a chance to hit multiple awards at the same time.',
];

export const GameModals: React.FC<ModalsProps> = ({
  activeModal,
  onClose,
  history,
  lastResult,
  personalRecords,
  playerName,
  playerBalance,
  isMuted,
  onToggleMute,
  onAddCoins,
  onUpdateName,
  onResetSession,
  onOpenAdmin,
}) => {
  const [nameDraft, setNameDraft] = useState(playerName);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveName = () => {
    const cleaned = nameDraft.trim().slice(0, 14) || 'A Egy';
    onUpdateName(cleaned);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1400);
  };

  // Compute frequency stats for the 49-round Game History grid
  const recent49 = history.slice(0, 49);
  const melonCount = recent49.filter((x) => x === 'watermelon').length;
  const sevenCount = recent49.filter((x) => x === 'seven').length;
  const plumCount = recent49.filter((x) => x === 'plum').length;

  return (
    <AnimatePresence>
      {activeModal !== 'none' && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/58 px-4 backdrop-blur-[2px]"
        >
          {/* 1. HOW TO PLAY MODAL (100% faithful to Screenshot 1) */}
          {activeModal === 'howToPlay' && (
            <motion.div
              key="how-to-play"
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="royal-modal-frame relative w-full max-w-[92%] rounded-[20px] px-5 py-6 text-white"
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="Close How to play"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-yellow-200 transition hover:bg-white/20 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <h2 className="font-display mb-4 text-center text-[23px] font-bold tracking-tight text-white">
                How to play
              </h2>

              <div className="space-y-2.5 text-[13px] leading-[1.45] text-[#e8defa]">
                {HOW_TO_PLAY_RULES.map((rule, idx) => (
                  <p key={idx}>{rule}</p>
                ))}
              </div>
            </motion.div>
          )}

          {/* 2. GOOD LUCK / WINNERS PODIUM MODAL (100% faithful to Screenshot 2) */}
          {activeModal === 'goodLuck' && lastResult && (
            <motion.div
              key="good-luck"
              initial={{ opacity: 0, scale: 0.88, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[90%] pt-9"
            >
              {/* Peeking Golden Crown Crest + Winning Fruit behind top ribbon (matching Screenshot 2) */}
              <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 flex flex-col items-center">
                <div
                  className="flex h-14 w-32 items-center justify-center rounded-t-full border-t-[3px] border-x-[3px] border-[#ffd866] bg-gradient-to-b from-[#1782e6] to-[#0a4ca8] shadow-[0_0_16px_rgba(255,212,72,0.55)]"
                >
                  <img
                    src={OPTION_ICONS[lastResult.winningOption]}
                    alt={lastResult.winningOption}
                    referrerPolicy="no-referrer"
                    className="h-9 w-9 object-contain -mt-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                  />
                  {lastResult.bonusOption && (
                    <img
                      src={OPTION_ICONS[lastResult.bonusOption]}
                      alt={lastResult.bonusOption}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 object-contain -ml-1 -mt-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                    />
                  )}
                </div>
              </div>

              <div className="royal-modal-frame relative rounded-[20px] px-3.5 pb-4 pt-12 text-white">
                {/* Gold Trapezoid Ribbon Banner: Good Luck */}
                <div
                  className="gold-ribbon-header absolute left-1/2 top-[-2px] -translate-x-1/2 px-8 py-1.5"
                  style={{
                    clipPath: 'polygon(0 0, 100% 0, 88% 100%, 12% 100%)',
                    minWidth: '64%',
                  }}
                >
                  <h2 className="font-display text-center text-[22px] font-extrabold tracking-tight text-[#3d5700] drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
                    Good Luck
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close winners dialog"
                  className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-yellow-200 transition hover:bg-white/20 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>

                <p className="mb-3 text-center text-[12px] font-medium text-[#d7c6f5]">
                  Congratulations to the following winners
                </p>

                {/* Top 3 Winners Podium: #2 Left, #1 Center, #3 Right */}
                <div className="grid grid-cols-3 items-end gap-1.5 pb-3">
                  {[
                    lastResult.topWinners.find((w) => w.rank === 2)!,
                    lastResult.topWinners.find((w) => w.rank === 1)!,
                    lastResult.topWinners.find((w) => w.rank === 3)!,
                  ].map((winner) => {
                    const isFirst = winner.rank === 1;
                    const crownSrc =
                      winner.rank === 1
                        ? '/assets/game/crown_1.png'
                        : winner.rank === 2
                          ? '/assets/game/crown_2.png'
                          : '/assets/game/crown_3.png';
                    const ringBorder =
                      winner.rank === 1
                        ? 'border-[#ffd83d]'
                        : winner.rank === 2
                          ? 'border-[#d7e8f7]'
                          : 'border-[#e89b4c]';
                    const ribbonStyle =
                      winner.rank === 1
                        ? 'bg-gradient-to-b from-[#ffe94d] to-[#f2b800] text-[#5c3200]'
                        : winner.rank === 2
                          ? 'bg-gradient-to-b from-[#ffffff] to-[#dce7f2] text-[#555068]'
                          : 'bg-gradient-to-b from-[#ffb74d] to-[#e67e22] text-[#4d1e00]';

                    return (
                      <div key={winner.rank} className="flex flex-col items-center">
                        {/* Crown */}
                        <img
                          src={crownSrc}
                          alt={`Rank ${winner.rank}`}
                          referrerPolicy="no-referrer"
                          className={`z-10 -mb-2.5 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] ${
                            isFirst ? 'h-9 w-11' : 'h-7 w-9'
                          }`}
                        />
                        {/* Circular Avatar */}
                        <div
                          className={`relative overflow-hidden rounded-full border-[2.5px] ${ringBorder} shadow-md ${
                            isFirst ? 'h-[66px] w-[66px]' : 'h-[58px] w-[58px]'
                          }`}
                        >
                          <img
                            src={winner.avatar}
                            alt={winner.name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        </div>

                        {/* Name Ribbon */}
                        <div
                          className={`-mt-2 z-10 w-[94%] rounded-sm px-1.5 py-0.5 text-center text-[11px] font-bold truncate shadow ${ribbonStyle}`}
                        >
                          {winner.name}
                        </div>

                        {/* Cost & Win */}
                        <div className="mt-1.5 w-full space-y-0.5 text-center text-[11px] leading-tight text-[#d9ccf2] tabular-nums">
                          <div className="flex items-center justify-center gap-1">
                            <span className="opacity-85">Cost:</span>
                            <span className="font-semibold text-white">
                              {formatExactCoins(winner.cost)}
                            </span>
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            <span className="opacity-85">Win:</span>
                            <span className="font-bold text-[#ffe46b]">
                              {formatExactCoins(winner.win)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Current Player Summary Row (matching Screenshot 2 bottom row) */}
                <div className="mt-1 flex items-center justify-between rounded-xl border border-purple-400/20 bg-[#170542]/90 px-3 py-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src="/src/assets/images/hd_player_avatar_1795648953099.jpg"
                      alt={playerName}
                      referrerPolicy="no-referrer"
                      className="h-11 w-11 shrink-0 rounded-lg border-2 border-[#e8bc54] object-cover"
                    />
                    <span className="truncate text-[13px] font-semibold text-[#e2d4fb]">
                      {playerName}
                    </span>
                  </div>

                  <div className="space-y-1 text-[12px] tabular-nums shrink-0">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[#c9b7ed]">Cost:</span>
                      <span className="min-w-[64px] rounded bg-[#270e61] px-2 py-0.5 text-center font-semibold text-white">
                        {formatExactCoins(lastResult.playerCost)}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[#c9b7ed]">Win:</span>
                      <span
                        className={`min-w-[64px] rounded bg-[#270e61] px-2 py-0.5 text-center font-bold ${
                          lastResult.playerWin > 0 ? 'text-[#ffe45e]' : 'text-white'
                        }`}
                      >
                        {formatExactCoins(lastResult.playerWin)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 3. GAME HISTORY 7x7 GRID MODAL (100% faithful to Screenshot 3) */}
          {activeModal === 'gameHistory' && (
            <motion.div
              key="game-history"
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="royal-modal-frame relative w-full max-w-[88%] rounded-[20px] px-3.5 pb-4 pt-12 text-white"
            >
              {/* Gold Ribbon Header: Game History */}
              <div
                className="gold-ribbon-header absolute left-1/2 top-[-2px] -translate-x-1/2 px-6 py-1.5"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 88% 100%, 12% 100%)',
                  minWidth: '64%',
                }}
              >
                <h2 className="font-display text-center text-[18px] font-extrabold tracking-tight text-[#3d5700] whitespace-nowrap">
                  Game History
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close Game History"
                className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-yellow-200 transition hover:bg-white/20 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              {/* 7 x 7 Grid of Last 49 Results */}
              <div className="grid grid-cols-7 gap-1.5">
                {recent49.map((item, index) => {
                  const isLatest = index === 0;
                  return (
                    <div
                      key={`${index}-${item}`}
                      className={`flex aspect-square items-center justify-center rounded-[7px] p-1 ${
                        isLatest
                          ? 'bg-[#361c7d] border-[2px] border-[#a3e635] shadow-[0_0_10px_rgba(163,230,53,0.65)]'
                          : 'bg-[#2e146e]/90 border border-[#4a2696]/45'
                      }`}
                    >
                      <img
                        src={OPTION_ICONS[item]}
                        alt={item}
                        referrerPolicy="no-referrer"
                        draggable={false}
                        className="h-[84%] w-[84%] object-contain"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Subtle Probability Analysis Bar (supports Rule #5) */}
              <div className="mt-3 flex items-center justify-around border-t border-white/10 pt-2.5 text-[11px] text-[#d9ccf2] tabular-nums">
                <div className="flex items-center gap-1.5">
                  <img src={OPTION_ICONS.watermelon} alt="Watermelon" className="h-4 w-4 object-contain" />
                  <span>{melonCount}</span>
                  <span className="text-white/55">({Math.round((melonCount / recent49.length) * 100)}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <img src={OPTION_ICONS.seven} alt="77" className="h-4 w-4 object-contain" />
                  <span>{sevenCount}</span>
                  <span className="text-white/55">({Math.round((sevenCount / recent49.length) * 100)}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <img src={OPTION_ICONS.plum} alt="Plum" className="h-4 w-4 object-contain" />
                  <span>{plumCount}</span>
                  <span className="text-white/55">({Math.round((plumCount / recent49.length) * 100)}%)</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* 4. PERSONAL BETTING RECORD MODAL (top-right profile-clock button) */}
          {activeModal === 'personalLog' && (
            <motion.div
              key="personal-log"
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="royal-modal-frame relative w-full max-w-[90%] rounded-[20px] px-4 pb-4 pt-12 text-white"
            >
              <div
                className="gold-ribbon-header absolute left-1/2 top-[-2px] -translate-x-1/2 px-6 py-1.5"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 88% 100%, 12% 100%)',
                  minWidth: '64%',
                }}
              >
                <h2 className="font-display text-center text-[17px] font-extrabold tracking-tight text-[#3d5700] whitespace-nowrap">
                  My Record
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close My Record"
                className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-yellow-200 transition hover:bg-white/20 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              {personalRecords.length === 0 ? (
                <div className="py-10 text-center text-[13px] text-[#cbb8ef]">
                  No rounds played yet. Select a chip and place a bet on the fruit or 77!
                </div>
              ) : (
                <div className="royal-scroll max-h-[320px] space-y-2 overflow-y-auto pr-1">
                  {personalRecords.map((rec) => {
                    const net = rec.totalWin - rec.totalCost;
                    return (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between rounded-xl border border-purple-400/20 bg-[#170542]/85 px-3 py-2 text-[12px] tabular-nums"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2e146e]">
                            <img
                              src={OPTION_ICONS[rec.result]}
                              alt={rec.result}
                              className="h-6 w-6 object-contain"
                            />
                          </div>
                          <div>
                            <div className="font-semibold text-white">Round:{rec.roundNumber}</div>
                            <div className="text-[11px] text-[#b9a3e6]">
                              Cost: {formatCompactCoins(rec.totalCost)}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={`font-bold ${
                              rec.totalWin > 0 ? 'text-[#ffe45e]' : 'text-white/60'
                            }`}
                          >
                            Win: {formatCompactCoins(rec.totalWin)}
                          </div>
                          <div
                            className={`text-[11px] font-semibold ${
                              net > 0 ? 'text-emerald-400' : net < 0 ? 'text-rose-400' : 'text-white/50'
                            }`}
                          >
                            {net >= 0 ? `+${formatCompactCoins(net)}` : `-${formatCompactCoins(Math.abs(net))}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* 5. COIN REFILL MODAL (+ button next to player balance) */}
          {activeModal === 'coinRefill' && (
            <motion.div
              key="coin-refill"
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="royal-modal-frame relative w-full max-w-[88%] rounded-[20px] px-4 pb-5 pt-12 text-white"
            >
              <div
                className="gold-ribbon-header absolute left-1/2 top-[-2px] -translate-x-1/2 px-6 py-1.5"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 88% 100%, 12% 100%)',
                  minWidth: '62%',
                }}
              >
                <h2 className="font-display text-center text-[17px] font-extrabold tracking-tight text-[#3d5700] whitespace-nowrap">
                  Add Coins
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close Add Coins"
                className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-yellow-200 transition hover:bg-white/20 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-[#16053d] py-2.5">
                <GoldCoinIcon className="h-5 w-5" />
                <span className="font-display text-lg font-bold tabular-nums text-[#ffe45e]">
                  {formatExactCoins(playerBalance)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[10000, 100000, 500000, 1000000].map((pack) => (
                  <button
                    key={pack}
                    type="button"
                    onClick={() => {
                      onAddCoins(pack);
                      onClose();
                    }}
                    className="flex flex-col items-center justify-center rounded-xl border border-[#f4c85a]/70 bg-gradient-to-b from-[#49199c] to-[#2c0d66] py-3 transition hover:brightness-115 active:scale-95 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <GoldCoinIcon className="h-4 w-4" />
                      <span className="font-display text-[17px] font-extrabold text-[#ffe45e]">
                        +{formatCompactCoins(pack)}
                      </span>
                    </div>
                    <span className="mt-0.5 text-[11px] font-medium text-purple-200/80">Free Refill</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* 6. SESSION MENU MODAL (top-left back button) */}
          {activeModal === 'sessionMenu' && (
            <motion.div
              key="session-menu"
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="royal-modal-frame relative w-full max-w-[86%] rounded-[20px] px-5 pb-5 pt-12 text-white"
            >
              <div
                className="gold-ribbon-header absolute left-1/2 top-[-2px] -translate-x-1/2 px-6 py-1.5"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 88% 100%, 12% 100%)',
                  minWidth: '60%',
                }}
              >
                <h2 className="font-display text-center text-[17px] font-extrabold tracking-tight text-[#3d5700] whitespace-nowrap">
                  Game Menu
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close Menu"
                className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-yellow-200 transition hover:bg-white/20 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-purple-200">
                    Player Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      maxLength={14}
                      className="flex-1 rounded-lg border border-purple-400/40 bg-[#14043a] px-3 py-2 text-sm text-white outline-none focus:border-yellow-400"
                    />
                    <button
                      type="button"
                      onClick={handleSaveName}
                      className="flex items-center gap-1 rounded-lg bg-[#eab308] px-3 py-2 text-xs font-bold text-[#3b1c00] hover:bg-yellow-300 cursor-pointer whitespace-nowrap"
                    >
                      {savedNotice ? <Check className="h-3.5 w-3.5" /> : 'Save'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#16053d] px-3.5 py-2.5">
                  <span className="text-sm font-medium text-purple-100">Sound Effects</span>
                  <button
                    type="button"
                    onClick={onToggleMute}
                    className="flex items-center gap-1.5 rounded-lg bg-purple-700/80 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-600 cursor-pointer"
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    {isMuted ? 'Muted' : 'On'}
                  </button>
                </div>

                {onOpenAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAdmin();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/50 bg-amber-500/15 py-2.5 text-sm font-bold text-amber-200 transition hover:bg-amber-500/25 cursor-pointer"
                  >
                    <Sliders className="h-4 w-4" />
                    لوحة التحكم (Admin Dashboard)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onResetSession();
                    onClose();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/40 bg-rose-950/50 py-2.5 text-sm font-semibold text-rose-200 hover:bg-rose-900/60 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset Session & Balance
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
