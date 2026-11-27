import React, { useState } from 'react';
import {
  Sliders,
  BarChart3,
  Settings2,
  X,
  RotateCcw,
  Zap,
  Lock,
  Unlock,
  Scale,
} from 'lucide-react';
import {
  BotActivityLevel,
  DEFAULT_GAME_CONFIG,
  formatCoins,
  GameControlConfig,
  getNormalizedWinProbs,
  OutcomeMode,
  RoundHistoryItem,
  SEAT_CONFIG,
  SeatId,
} from '../engine/teenPatti';

interface SessionStats {
  roundsPlayed: number;
  totalWagered: number;
  totalPayouts: number;
  seatWins: Record<SeatId, number>;
}

interface AdminDashboardProps {
  open: boolean;
  config: GameControlConfig;
  balance: number;
  roundNumber: number;
  phase: 'CONNECTING' | 'BETTING' | 'FLIPPING' | 'REVEAL';
  timeLeft: number;
  userBets: Record<SeatId, number>;
  pots: Record<SeatId, number>;
  stats: SessionStats;
  history: RoundHistoryItem[];
  onChangeConfig: (updater: (prev: GameControlConfig) => GameControlConfig) => void;
  onSetBalance: (newBalance: number) => void;
  onRevealNow: () => void;
  onResetStats: () => void;
  onResetDefaults: () => void;
  onClose: () => void;
}

const SEATS: SeatId[] = ['A', 'B', 'C'];
const MULTIPLIER_PRESETS = [2, 2.5, 2.9, 3, 5, 10];

type DashTab = 'seats' | 'elements' | 'analytics';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  open,
  config,
  balance,
  roundNumber,
  phase,
  timeLeft,
  userBets,
  pots,
  stats,
  onChangeConfig,
  onSetBalance,
  onRevealNow,
  onResetStats,
  onResetDefaults,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<DashTab>('seats');

  if (!open) return null;

  const probs = getNormalizedWinProbs(config.winRates);
  const netHouseProfit = stats.totalWagered - stats.totalPayouts;
  const currentRoundBet = userBets.A + userBets.B + userBets.C;

  // Update a seat's Win Rate (%) and keep it cleanly within 0..100
  const handleWinRateChange = (seat: SeatId, rawVal: number) => {
    const clamped = Math.max(0, Math.min(100, Number.isNaN(rawVal) ? 0 : rawVal));
    onChangeConfig((prev) => ({
      ...prev,
      winRates: {
        ...prev.winRates,
        [seat]: Math.round(clamped * 10) / 10,
      },
    }));
  };

  // Update via Loss Rate (%) directly -> sets Win Rate = 100 - Loss Rate, scaling other seats if needed
  const handleLossRateChange = (seat: SeatId, rawLoss: number) => {
    const clampedLoss = Math.max(0, Math.min(100, Number.isNaN(rawLoss) ? 0 : rawLoss));
    const targetWin = Math.round((100 - clampedLoss) * 10) / 10;
    onChangeConfig((prev) => {
      const others = SEATS.filter((s) => s !== seat);
      const remaining = Math.max(0, 100 - targetWin);
      const otherSum = prev.winRates[others[0]] + prev.winRates[others[1]];
      let o1 = remaining / 2;
      let o2 = remaining / 2;
      if (otherSum > 0) {
        o1 = (prev.winRates[others[0]] / otherSum) * remaining;
        o2 = remaining - o1;
      }
      return {
        ...prev,
        winRates: {
          ...prev.winRates,
          [seat]: targetWin,
          [others[0]]: Math.round(o1 * 10) / 10,
          [others[1]]: Math.round(o2 * 10) / 10,
        },
      };
    });
  };

  // Normalize weights to sum to exactly 100%
  const handleNormalize100 = () => {
    onChangeConfig((prev) => {
      const p = getNormalizedWinProbs(prev.winRates);
      const a = Math.round(p.A * 10) / 10;
      const b = Math.round(p.B * 10) / 10;
      const c = Math.round((100 - a - b) * 10) / 10;
      return {
        ...prev,
        winRates: { A: a, B: b, C: Math.max(0, c) },
      };
    });
  };

  const handleEqualSplit = () => {
    onChangeConfig((prev) => ({
      ...prev,
      winRates: { A: 33.3, B: 33.3, C: 33.4 },
    }));
  };

  const handleMultiplierChange = (seat: SeatId, rawVal: number) => {
    const clamped = Math.max(1.05, Math.min(100, Number.isNaN(rawVal) ? 2.9 : rawVal));
    onChangeConfig((prev) => ({
      ...prev,
      multipliers: {
        ...prev.multipliers,
        [seat]: Math.round(clamped * 100) / 100,
      },
    }));
  };

  const handleChipValueChange = (index: 0 | 1 | 2 | 3, rawVal: number) => {
    const val = Math.max(10, Math.min(10_000_000, Math.round(Number.isNaN(rawVal) ? 1000 : rawVal)));
    onChangeConfig((prev) => {
      const next: [number, number, number, number] = [...prev.chipValues] as [
        number,
        number,
        number,
        number,
      ];
      next[index] = val;
      return { ...prev, chipValues: next };
    });
  };

  return (
    <aside
      dir="rtl"
      aria-label="Game Control Dashboard"
      className="w-full lg:w-[470px] xl:w-[510px] h-dvh lg:h-[95dvh] max-h-dvh bg-[#0f172a] text-slate-100 border-l lg:border border-slate-800 lg:rounded-xl shadow-2xl flex flex-col overflow-hidden shrink-0"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-[#0b1120] shrink-0">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-white tracking-tight truncate">
            لوحة التحكم · Game Dashboard
          </h2>
          <p className="text-[11.5px] text-slate-400 tabular-nums mt-0.5">
            جولة #{roundNumber} ·{' '}
            {phase === 'BETTING'
              ? `متبقي ${timeLeft}ث`
              : phase === 'FLIPPING'
              ? 'جاري فتح الكروت...'
              : phase === 'REVEAL'
              ? 'عرض الفائز'
              : 'اتصال'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {phase === 'BETTING' && (
            <button
              type="button"
              onClick={onRevealNow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-[12px] font-bold cursor-pointer transition-colors whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5" />
              اكشف الآن
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق لوحة التحكم"
            className="w-8 h-8 rounded-md border border-slate-700 hover:bg-slate-800 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="grid grid-cols-3 gap-1 p-2 bg-[#0b1120] border-b border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('seats')}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-[12px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            activeTab === 'seats'
              ? 'bg-slate-800 text-amber-300 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          النسب والضرب
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('elements')}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-[12px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            activeTab === 'elements'
              ? 'bg-slate-800 text-amber-300 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          عناصر اللعبة
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-[12px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'bg-slate-800 text-amber-300 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          الإحصائيات
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* ================= TAB 1: SEATS WIN/LOSS % & MULTIPLIERS ================= */}
        {activeTab === 'seats' && (
          <>
            {/* Proportional Win Distribution Overview Bar */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13px] font-bold text-slate-200">
                  توزيع نسب الفوز الفعلي (المجموع 100%)
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleNormalize100}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-200 cursor-pointer"
                  >
                    <Scale className="w-3 h-3" />
                    ضبط 100%
                  </button>
                  <button
                    type="button"
                    onClick={handleEqualSplit}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-200 cursor-pointer"
                  >
                    متساوي
                  </button>
                </div>
              </div>

              {/* 3-Color Distribution Bar */}
              <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-800 border border-slate-700">
                <div
                  className="bg-[#dc2626] transition-all duration-200"
                  style={{ width: `${probs.A}%` }}
                />
                <div
                  className="bg-[#2563eb] transition-all duration-200"
                  style={{ width: `${probs.B}%` }}
                />
                <div
                  className="bg-[#c026d3] transition-all duration-200"
                  style={{ width: `${probs.C}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11.5px] text-slate-300 tabular-nums">
                <span>A: {probs.A.toFixed(1)}%</span>
                <span>B: {probs.B.toFixed(1)}%</span>
                <span>C: {probs.C.toFixed(1)}%</span>
              </div>
            </section>

            <hr className="border-slate-800" />

            {/* 3 Independent Seat Control Rows (A, B, C) */}
            <section className="space-y-4">
              {SEATS.map((seat) => {
                const effWin = probs[seat];
                const effLoss = Math.max(0, 100 - effWin);
                const mult = config.multipliers[seat];
                const expectedRtp = effWin * mult; // e.g. 33.3% * 2.9 = 96.6%
                const potentialPayout = Math.round(userBets[seat] * mult);

                return (
                  <div
                    key={seat}
                    className="rounded-lg bg-[#162033] border border-slate-700/80 p-3.5 space-y-3"
                  >
                    {/* Seat Header + Live Bet/RTP */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={SEAT_CONFIG[seat].throneImg}
                          alt={seat}
                          referrerPolicy="no-referrer"
                          className="w-9 h-10 object-contain shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-bold text-white leading-tight">
                            {SEAT_CONFIG[seat].arabicName}
                          </p>
                          <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                            الرهان الحالي: {formatCoins(userBets[seat])} · العائد المحتمل:{' '}
                            <span className="text-amber-300 font-semibold">
                              {formatCoins(potentialPayout)}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="text-left shrink-0 tabular-nums">
                        <span className="block text-[10.5px] text-slate-400">
                          معدل العائد RTP
                        </span>
                        <span
                          className={`text-[12.5px] font-bold ${
                            expectedRtp > 100
                              ? 'text-red-400'
                              : expectedRtp >= 90
                              ? 'text-amber-300'
                              : 'text-emerald-400'
                          }`}
                        >
                          {expectedRtp.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Win % & Loss % Controls */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="block">
                        <span className="flex items-center justify-between text-[11.5px] text-emerald-400 font-semibold mb-1">
                          <span>نسبة المكسب %</span>
                          <span className="tabular-nums text-[11px] text-slate-400">
                            فعلي {effWin.toFixed(1)}%
                          </span>
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={config.winRates[seat]}
                          onChange={(e) =>
                            handleWinRateChange(seat, parseFloat(e.target.value))
                          }
                          className="w-full px-2.5 py-1.5 rounded-md bg-[#0b1120] border border-slate-700 focus:border-emerald-400 focus:outline-none text-[13px] font-bold text-white tabular-nums"
                        />
                      </label>

                      <label className="block">
                        <span className="flex items-center justify-between text-[11.5px] text-rose-400 font-semibold mb-1">
                          <span>نسبة الخسارة %</span>
                          <span className="tabular-nums text-[11px] text-slate-400">
                            فعلي {effLoss.toFixed(1)}%
                          </span>
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={Math.round(effLoss * 10) / 10}
                          onChange={(e) =>
                            handleLossRateChange(seat, parseFloat(e.target.value))
                          }
                          className="w-full px-2.5 py-1.5 rounded-md bg-[#0b1120] border border-slate-700 focus:border-rose-400 focus:outline-none text-[13px] font-bold text-white tabular-nums"
                        />
                      </label>
                    </div>

                    {/* Slider for Win Weight */}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={config.winRates[seat]}
                      onChange={(e) =>
                        handleWinRateChange(seat, parseFloat(e.target.value))
                      }
                      aria-label={`Win rate slider for seat ${seat}`}
                      className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                    />

                    {/* Multiplier (الضرب كام) */}
                    <div className="pt-1 border-t border-slate-700/70 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold text-amber-300">
                          مضاعف المكسب (تدي ضرب كام ×)
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-amber-300 font-bold text-[13px]">×</span>
                          <input
                            type="number"
                            min={1.05}
                            max={100}
                            step={0.1}
                            value={mult}
                            onChange={(e) =>
                              handleMultiplierChange(seat, parseFloat(e.target.value))
                            }
                            aria-label={`Payout multiplier for seat ${seat}`}
                            className="w-20 px-2 py-1 rounded-md bg-[#0b1120] border border-amber-500/50 focus:border-amber-400 focus:outline-none text-[13px] font-extrabold text-amber-300 text-center tabular-nums"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {MULTIPLIER_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleMultiplierChange(seat, preset)}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold tabular-nums cursor-pointer transition-colors ${
                              Math.abs(mult - preset) < 0.01
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            ×{preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Show Multiplier on Table Toggle */}
            <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg bg-[#162033] border border-slate-700/80">
              <div>
                <p className="text-[12.5px] font-semibold text-white">
                  إظهار المضاعف (×) على الطاولة
                </p>
                <p className="text-[11px] text-slate-400">
                  عرض قيمة الضرب بجوار A و B و C داخل اللعبة
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config.showMultipliersOnBoard}
                onClick={() =>
                  onChangeConfig((prev) => ({
                    ...prev,
                    showMultipliersOnBoard: !prev.showMultipliersOnBoard,
                  }))
                }
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  config.showMultipliersOnBoard ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    config.showMultipliersOnBoard ? 'left-1' : 'right-1'
                  }`}
                />
              </button>
            </div>

            <hr className="border-slate-800" />

            {/* Outcome Engine Mode & Manual Force Winner */}
            <section className="space-y-3">
              <h3 className="text-[13px] font-bold text-slate-200">
                نظام تحديد الفائز والتحكم اليدوي
              </h3>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'weighted', label: 'حسب النسب %', sub: 'المضبوطة بالأعلى' },
                    { id: 'fair', label: 'عشوائي عادل', sub: 'كوتشينة 52 كارت' },
                    { id: 'lowest_bet', label: 'أقل رهان يفوز', sub: 'أعلى ربح للطاولة' },
                    { id: 'highest_bet', label: 'أعلى رهان يفوز', sub: 'مكسب للاعب' },
                  ] as { id: OutcomeMode; label: string; sub: string }[]
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() =>
                      onChangeConfig((prev) => ({ ...prev, outcomeMode: mode.id }))
                    }
                    className={`p-2.5 rounded-lg border text-right cursor-pointer transition-colors ${
                      config.outcomeMode === mode.id
                        ? 'bg-amber-500/15 border-amber-400 text-amber-200'
                        : 'bg-[#162033] border-slate-700/80 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span className="block text-[12.5px] font-bold">{mode.label}</span>
                    <span className="block text-[10.5px] text-slate-400 mt-0.5">
                      {mode.sub}
                    </span>
                  </button>
                ))}
              </div>

              {/* Manual Force Next Winner */}
              <div className="rounded-lg bg-[#162033] border border-slate-700/80 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-slate-200">
                    إجبار الفائز في الجولة الحالية
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        lockForcedWinner: !prev.lockForcedWinner,
                      }))
                    }
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                      config.lockForcedWinner
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {config.lockForcedWinner ? (
                      <Lock className="w-3 h-3" />
                    ) : (
                      <Unlock className="w-3 h-3" />
                    )}
                    {config.lockForcedWinner ? 'مثبت دائماً' : 'جولة واحدة'}
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeConfig((prev) => ({ ...prev, forceNextWinner: null }))
                    }
                    className={`py-1.5 rounded-md text-[12px] font-bold cursor-pointer ${
                      config.forceNextWinner === null
                        ? 'bg-slate-100 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    تلقائي
                  </button>
                  {SEATS.map((seat) => (
                    <button
                      key={seat}
                      type="button"
                      onClick={() =>
                        onChangeConfig((prev) => ({ ...prev, forceNextWinner: seat }))
                      }
                      className={`py-1.5 rounded-md text-[12px] font-bold cursor-pointer ${
                        config.forceNextWinner === seat
                          ? seat === 'A'
                            ? 'bg-red-600 text-white'
                            : seat === 'B'
                            ? 'bg-blue-600 text-white'
                            : 'bg-fuchsia-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      فوز {seat}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {/* ================= TAB 2: GAME ELEMENTS CONTROL ================= */}
        {activeTab === 'elements' && (
          <>
            {/* 4 Betting Chip Values */}
            <section className="space-y-2.5">
              <h3 className="text-[13px] font-bold text-slate-200">
                قيم العملات الأربعة (Betting Chips)
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                {([0, 1, 2, 3] as const).map((idx) => (
                  <label
                    key={idx}
                    className="block bg-[#162033] border border-slate-700/80 rounded-lg p-2.5"
                  >
                    <span className="block text-[11px] text-slate-400 mb-1">
                      العملة #{idx + 1} ({formatCoins(config.chipValues[idx])})
                    </span>
                    <input
                      type="number"
                      min={10}
                      max={10_000_000}
                      step={500}
                      value={config.chipValues[idx]}
                      onChange={(e) =>
                        handleChipValueChange(idx, parseInt(e.target.value, 10))
                      }
                      className="w-full px-2.5 py-1.5 rounded-md bg-[#0b1120] border border-slate-700 focus:border-amber-400 focus:outline-none text-[13px] font-bold text-white tabular-nums"
                    />
                  </label>
                ))}
              </div>
            </section>

            <hr className="border-slate-800" />

            {/* Timers */}
            <section className="space-y-3">
              <h3 className="text-[13px] font-bold text-slate-200">
                توقيت الجولة والعرض (Timers)
              </h3>

              <div className="rounded-lg bg-[#162033] border border-slate-700/80 p-3 space-y-3">
                <div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-slate-300 font-medium">مدة الرهان (ثانية)</span>
                    <span className="font-bold text-amber-300 tabular-nums">
                      {config.roundDuration}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={60}
                    step={1}
                    value={config.roundDuration}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        roundDuration: parseInt(e.target.value, 10),
                      }))
                    }
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-slate-300 font-medium">مدة عرض الفائز (ثانية)</span>
                    <span className="font-bold text-amber-300 tabular-nums">
                      {config.revealDuration}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    step={0.5}
                    value={config.revealDuration}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({
                        ...prev,
                        revealDuration: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </section>

            <hr className="border-slate-800" />

            {/* Bot / Live Pot Simulation */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-slate-200">
                  رهانات اللاعبين الحية (Live Pot Bots)
                </h3>
                <button
                  type="button"
                  role="switch"
                  aria-checked={config.botsEnabled}
                  onClick={() =>
                    onChangeConfig((prev) => ({
                      ...prev,
                      botsEnabled: !prev.botsEnabled,
                    }))
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    config.botsEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      config.botsEnabled ? 'left-1' : 'right-1'
                    }`}
                  />
                </button>
              </div>

              {config.botsEnabled && (
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'low', label: 'هادئ' },
                      { id: 'medium', label: 'متوسط' },
                      { id: 'high', label: 'سريع وعالي' },
                    ] as { id: BotActivityLevel; label: string }[]
                  ).map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() =>
                        onChangeConfig((prev) => ({ ...prev, botActivity: lvl.id }))
                      }
                      className={`py-2 rounded-md text-[12px] font-semibold cursor-pointer border ${
                        config.botActivity === lvl.id
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                          : 'bg-[#162033] border-slate-700 text-slate-300'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <hr className="border-slate-800" />

            {/* Player Profile & Direct Balance Control */}
            <section className="space-y-3">
              <h3 className="text-[13px] font-bold text-slate-200">
                بيانات اللاعب والرصيد
              </h3>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="block text-[11px] text-slate-400 mb-1">اسم اللاعب</span>
                  <input
                    type="text"
                    value={config.playerName}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({ ...prev, playerName: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-md bg-[#162033] border border-slate-700 focus:border-amber-400 focus:outline-none text-[13px] text-white"
                  />
                </label>

                <label className="block">
                  <span className="block text-[11px] text-slate-400 mb-1">User ID</span>
                  <input
                    type="text"
                    value={config.userId}
                    onChange={(e) =>
                      onChangeConfig((prev) => ({ ...prev, userId: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 rounded-md bg-[#162033] border border-slate-700 focus:border-amber-400 focus:outline-none text-[13px] text-white tabular-nums"
                  />
                </label>
              </div>

              <div className="rounded-lg bg-[#162033] border border-slate-700/80 p-3 space-y-2.5">
                <label className="block">
                  <span className="block text-[11.5px] text-slate-400 mb-1">
                    الرصيد المباشر للاعب
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={balance}
                    onChange={(e) =>
                      onSetBalance(Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                    className="w-full px-2.5 py-1.5 rounded-md bg-[#0b1120] border border-slate-700 focus:border-amber-400 focus:outline-none text-[14px] font-bold text-amber-300 tabular-nums"
                  />
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {[0, 10_000, 100_000, 500_000, 5_000_000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => onSetBalance(amt)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-bold text-slate-200 tabular-nums cursor-pointer"
                    >
                      {amt === 0 ? 'تصفير (0)' : formatCoins(amt)}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {/* ================= TAB 3: LIVE ANALYTICS ================= */}
        {activeTab === 'analytics' && (
          <>
            {/* Key Metrics Grid */}
            <section className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg bg-[#162033] border border-slate-700/80 p-3">
                <span className="text-[11px] text-slate-400">إجمالي الجولات</span>
                <p className="text-[20px] font-extrabold text-white tabular-nums mt-0.5">
                  {stats.roundsPlayed}
                </p>
              </div>

              <div className="rounded-lg bg-[#162033] border border-slate-700/80 p-3">
                <span className="text-[11px] text-slate-400">صافي ربح الطاولة</span>
                <p
                  className={`text-[20px] font-extrabold tabular-nums mt-0.5 ${
                    netHouseProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {netHouseProfit >= 0 ? '+' : ''}
                  {formatCoins(netHouseProfit)}
                </p>
              </div>

              <div className="rounded-lg bg-[#162033] border border-slate-700/80 p-3">
                <span className="text-[11px] text-slate-400">إجمالي رهانات اللاعب</span>
                <p className="text-[17px] font-bold text-slate-100 tabular-nums mt-0.5">
                  {formatCoins(stats.totalWagered)}
                </p>
              </div>

              <div className="rounded-lg bg-[#162033] border border-slate-700/80 p-3">
                <span className="text-[11px] text-slate-400">إجمالي الأرباح المدفوعة</span>
                <p className="text-[17px] font-bold text-amber-300 tabular-nums mt-0.5">
                  {formatCoins(stats.totalPayouts)}
                </p>
              </div>
            </section>

            {/* Current Round Live Exposure Table */}
            <section className="rounded-lg bg-[#162033] border border-slate-700/80 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-700/80 flex items-center justify-between">
                <h3 className="text-[12.5px] font-bold text-slate-200">
                  رهانات الجولة الحالية (#{roundNumber})
                </h3>
                <span className="text-[11.5px] text-slate-400 tabular-nums">
                  إجمالي رهانك: {formatCoins(currentRoundBet)}
                </span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-slate-700/70 text-slate-400">
                    <th className="py-2 px-3 text-right font-semibold">الاختيار</th>
                    <th className="py-2 px-2 text-left font-semibold">Pot</th>
                    <th className="py-2 px-2 text-left font-semibold">رهانك</th>
                    <th className="py-2 px-2 text-left font-semibold">الضرب</th>
                    <th className="py-2 px-3 text-left font-semibold">المكسب المحتمل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 tabular-nums">
                  {SEATS.map((seat) => (
                    <tr key={seat}>
                      <td className="py-2 px-3 font-bold text-white">{seat}</td>
                      <td className="py-2 px-2 text-left text-slate-300">
                        {formatCoins(pots[seat])}
                      </td>
                      <td className="py-2 px-2 text-left text-fuchsia-300 font-semibold">
                        {formatCoins(userBets[seat])}
                      </td>
                      <td className="py-2 px-2 text-left text-amber-300 font-bold">
                        ×{config.multipliers[seat]}
                      </td>
                      <td className="py-2 px-3 text-left text-emerald-400 font-bold">
                        {formatCoins(Math.round(userBets[seat] * config.multipliers[seat]))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Actual vs Target Win Rate Comparison */}
            <section className="rounded-lg bg-[#162033] border border-slate-700/80 p-3.5 space-y-3">
              <h3 className="text-[12.5px] font-bold text-slate-200">
                مقارنة النسب الفعلية مقابل المستهدفة
              </h3>
              {SEATS.map((seat) => {
                const wins = stats.seatWins[seat];
                const actualPct =
                  stats.roundsPlayed > 0 ? (wins / stats.roundsPlayed) * 100 : 0;
                const targetPct = probs[seat];
                return (
                  <div key={seat} className="space-y-1">
                    <div className="flex items-center justify-between text-[12px] tabular-nums">
                      <span className="font-bold text-slate-200">
                        {SEAT_CONFIG[seat].arabicName} ({wins} فوز)
                      </span>
                      <span className="text-slate-400">
                        فعلي <strong className="text-white">{actualPct.toFixed(1)}%</strong> ·
                        مستهدف <strong className="text-amber-300">{targetPct.toFixed(1)}%</strong>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full ${SEAT_CONFIG[seat].barClass} transition-all duration-300`}
                        style={{ width: `${actualPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onResetStats}
                  className="text-[11.5px] text-slate-400 hover:text-white underline cursor-pointer"
                >
                  تصفير إحصائيات الجلسة
                </button>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-2.5 border-t border-slate-800 bg-[#0b1120] flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={onResetDefaults}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 hover:text-white cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          استعادة الإعدادات الافتراضية
        </button>

        <span className="text-[11px] text-slate-500 tabular-nums">
          حفظ تلقائي · {DEFAULT_GAME_CONFIG.multipliers.A === config.multipliers.A ? 'قياسي' : 'مخصص'}
        </span>
      </div>
    </aside>
  );
};
