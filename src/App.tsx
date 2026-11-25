/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BET_MULTIPLIERS,
  BetOption,
  CHIP_VALUES,
  ChipValue,
  GamePhase,
  ModalType,
  OPTION_ICONS,
  PersonalRecord,
  PlacedChip,
  RoundResultData,
  WHEEL_SLICES,
} from './types/game';
import {
  INITIAL_HISTORY,
  buildTopWinners,
  formatCompactCoins,
  pickRandomBotChip,
} from './utils/gameHelpers';
import { soundEngine } from './utils/sound';
import { FruitWheel } from './components/FruitWheel';
import { BettingPanel } from './components/BettingPanel';
import { GameModals } from './components/Modals';
import {
  CasinoChipIcon,
  GoldCoinIcon,
  GoldPlusIcon,
  HudCircleIcon,
  NewBadgeIcon,
} from './components/GameIcons';

const STORAGE_KEY = 'lucky_fruit_wheel_77_state_v1';
const BETTING_DURATION_SEC = 10;
const SPIN_DURATION_MS = 4600;
const RESULT_DURATION_MS = 5200;
const STARTING_BALANCE = 100000;

interface SavedState {
  balance: number;
  playerName: string;
  roundNumber: number;
  history: BetOption[];
  personalRecords: PersonalRecord[];
}

function loadSavedState(): SavedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedState>;
      return {
        balance: typeof parsed.balance === 'number' && Number.isFinite(parsed.balance) ? parsed.balance : STARTING_BALANCE,
        playerName: typeof parsed.playerName === 'string' && parsed.playerName.trim() ? parsed.playerName : 'A Egy',
        roundNumber: typeof parsed.roundNumber === 'number' && parsed.roundNumber >= 1 ? parsed.roundNumber : 228,
        history: Array.isArray(parsed.history) && parsed.history.length >= 8 ? parsed.history.slice(0, 49) : INITIAL_HISTORY,
        personalRecords: Array.isArray(parsed.personalRecords) ? parsed.personalRecords.slice(0, 30) : [],
      };
    }
  } catch {
    // Ignore storage parse failures
  }
  return {
    balance: STARTING_BALANCE,
    playerName: 'A Egy',
    roundNumber: 228,
    history: INITIAL_HISTORY,
    personalRecords: [],
  };
}

const EMPTY_BETS: Record<BetOption, number> = {
  watermelon: 0,
  seven: 0,
  plum: 0,
};

export default function App() {
  const initial = useRef<SavedState>(loadSavedState()).current;

  const [balance, setBalance] = useState<number>(initial.balance);
  const [playerName, setPlayerName] = useState<string>(initial.playerName);
  const [roundNumber, setRoundNumber] = useState<number>(initial.roundNumber);
  const [history, setHistory] = useState<BetOption[]>(initial.history);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>(initial.personalRecords);

  const [phase, setPhase] = useState<GamePhase>('BETTING');
  const [countdown, setCountdown] = useState<number>(BETTING_DURATION_SEC);
  const [selectedChip, setSelectedChip] = useState<ChipValue>(100);
  const [playerBets, setPlayerBets] = useState<Record<BetOption, number>>({ ...EMPTY_BETS });
  const [previousPlayerBets, setPreviousPlayerBets] = useState<Record<BetOption, number>>({ ...EMPTY_BETS });
  const [poolBets, setPoolBets] = useState<Record<BetOption, number>>({ ...EMPTY_BETS });
  const [placedChips, setPlacedChips] = useState<PlacedChip[]>([]);

  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [winningOption, setWinningOption] = useState<BetOption | null>(null);
  const [bonusOption, setBonusOption] = useState<BetOption | null>(null);
  const [lastResult, setLastResult] = useState<RoundResultData | null>(null);

  const [activeModal, setActiveModal] = useState<ModalType>('none');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Refs for fresh state inside animation & timer callbacks
  const rotationRef = useRef<number>(0);
  const playerBetsRef = useRef<Record<BetOption, number>>(playerBets);
  const playerNameRef = useRef<string>(playerName);
  const roundNumberRef = useRef<number>(roundNumber);
  const activeModalRef = useRef<ModalType>(activeModal);
  const toastTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const resultTimerRef = useRef<number | null>(null);

  useEffect(() => {
    playerBetsRef.current = playerBets;
  }, [playerBets]);

  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  useEffect(() => {
    roundNumberRef.current = roundNumber;
  }, [roundNumber]);

  useEffect(() => {
    activeModalRef.current = activeModal;
  }, [activeModal]);

  // Persist player progress locally
  useEffect(() => {
    try {
      const payload: SavedState = {
        balance,
        playerName,
        roundNumber,
        history,
        personalRecords,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [balance, playerName, roundNumber, history, personalRecords]);

  const showToast = useCallback((message: string) => {
    setToastMsg(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 2200);
  }, []);

  const spawnChipVisual = useCallback((option: BetOption, value: ChipValue, isPlayer: boolean) => {
    const chip: PlacedChip = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      option,
      value,
      xPct: 22 + Math.random() * 40,
      yPct: 36 + Math.random() * 30,
      rotation: Math.round((Math.random() - 0.5) * 34),
      isPlayer,
    };
    setPlacedChips((prev) => [...prev.slice(-30), chip]);
  }, []);

  // Place player bet
  const handlePlaceBet = useCallback(
    (option: BetOption) => {
      if (phase !== 'BETTING') return;
      if (balance < selectedChip) {
        soundEngine.playClick();
        showToast('Not enough coins! Tap + to refill.');
        setActiveModal('coinRefill');
        return;
      }

      soundEngine.playChipPlace(true);
      setBalance((b) => b - selectedChip);
      setPlayerBets((prev) => ({
        ...prev,
        [option]: prev[option] + selectedChip,
      }));
      setPoolBets((prev) => ({
        ...prev,
        [option]: prev[option] + selectedChip,
      }));
      spawnChipVisual(option, selectedChip, true);
    },
    [phase, balance, selectedChip, spawnChipVisual, showToast]
  );

  // Repeat previous round's bets
  const handleRepeatBet = useCallback(() => {
    if (phase !== 'BETTING') return;
    const totalPrev =
      previousPlayerBets.watermelon + previousPlayerBets.seven + previousPlayerBets.plum;

    if (totalPrev <= 0) {
      soundEngine.playClick();
      showToast('No previous round bet to repeat');
      return;
    }

    if (balance < totalPrev) {
      soundEngine.playClick();
      showToast('Not enough coins to repeat bet');
      setActiveModal('coinRefill');
      return;
    }

    soundEngine.playChipPlace(true);
    setBalance((b) => b - totalPrev);
    setPlayerBets((prev) => ({
      watermelon: prev.watermelon + previousPlayerBets.watermelon,
      seven: prev.seven + previousPlayerBets.seven,
      plum: prev.plum + previousPlayerBets.plum,
    }));
    setPoolBets((prev) => ({
      watermelon: prev.watermelon + previousPlayerBets.watermelon,
      seven: prev.seven + previousPlayerBets.seven,
      plum: prev.plum + previousPlayerBets.plum,
    }));

    (['watermelon', 'seven', 'plum'] as BetOption[]).forEach((opt) => {
      if (previousPlayerBets[opt] > 0) {
        const visualChip: ChipValue =
          previousPlayerBets[opt] >= 100000
            ? 100000
            : previousPlayerBets[opt] >= 10000
              ? 10000
              : previousPlayerBets[opt] >= 1000
                ? 1000
                : 100;
        spawnChipVisual(opt, visualChip, true);
      }
    });
    showToast(`Repeated ${formatCompactCoins(totalPrev)} bet!`);
  }, [phase, previousPlayerBets, balance, spawnChipVisual, showToast]);

  // Spin execution & physics easing
  const startSpin = useCallback(() => {
    setPhase('SPINNING');

    // Fair random selection across all 9 slices (4 watermelon, 4 plum, 1 seven)
    const targetSliceIdx = Math.floor(Math.random() * WHEEL_SLICES.length);
    const targetSlice = WHEEL_SLICES[targetSliceIdx];

    // Rule #6: When Lucky 77 hits, 45% chance to also award a bonus fruit simultaneously!
    let extraBonus: BetOption | null = null;
    if (targetSlice.option === 'seven' && Math.random() < 0.45) {
      extraBonus = Math.random() < 0.5 ? 'watermelon' : 'plum';
    }

    // Compute exact clockwise target rotation so targetSlice.angleDeg lands at 12 o'clock (0 deg)
    const currentRot = rotationRef.current;
    const normalizedCurrent = ((currentRot % 360) + 360) % 360;
    const desiredMod = (360 - targetSlice.angleDeg) % 360;
    let deltaToDesired = desiredMod - normalizedCurrent;
    if (deltaToDesired <= 0) deltaToDesired += 360;

    // 5 or 6 full spins + slight realistic landing offset inside the 40-deg slice (-9..+9 deg)
    const extraSpins = (5 + Math.floor(Math.random() * 2)) * 360;
    const microOffset = (Math.random() - 0.5) * 16;
    const finalTargetRot = currentRot + extraSpins + deltaToDesired + microOffset;

    const startTime = performance.now();
    let lastSliceTick = Math.floor((currentRot + 20) / 40);

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / SPIN_DURATION_MS);
      // Smooth quintic ease-out for authentic arcade wheel deceleration
      const eased = 1 - Math.pow(1 - t, 4.3);
      const nextRot = currentRot + (finalTargetRot - currentRot) * eased;

      rotationRef.current = nextRot;
      setRotationDeg(nextRot);

      const currentSliceTick = Math.floor((nextRot + 20) / 40);
      if (currentSliceTick !== lastSliceTick) {
        lastSliceTick = currentSliceTick;
        soundEngine.playWheelTick();
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Spin complete -> settle round
        const betsSnapshot = { ...playerBetsRef.current };
        const playerCost = betsSnapshot.watermelon + betsSnapshot.seven + betsSnapshot.plum;

        let playerWin = betsSnapshot[targetSlice.option] * BET_MULTIPLIERS[targetSlice.option];
        if (extraBonus) {
          playerWin += betsSnapshot[extraBonus] * BET_MULTIPLIERS[extraBonus];
        }

        if (playerCost > 0) {
          setPreviousPlayerBets(betsSnapshot);
        }

        if (playerWin > 0) {
          setBalance((b) => b + playerWin);
          soundEngine.playWin(targetSlice.option === 'seven');
          showToast(`You won +${formatCompactCoins(playerWin)} coins!`);
        } else {
          soundEngine.playRoundEnd();
        }

        const currentRound = roundNumberRef.current;
        const topWinners = buildTopWinners(
          targetSlice.option,
          extraBonus,
          playerNameRef.current,
          '/src/assets/images/hd_player_avatar_1795648953099.jpg',
          playerCost,
          playerWin
        );

        const resultData: RoundResultData = {
          roundNumber: currentRound,
          winningSliceIndex: targetSliceIdx,
          winningOption: targetSlice.option,
          bonusOption: extraBonus,
          playerCost,
          playerWin,
          topWinners,
        };

        setWinningOption(targetSlice.option);
        setBonusOption(extraBonus);
        setLastResult(resultData);
        setHistory((prev) => [targetSlice.option, ...prev].slice(0, 49));

        if (playerCost > 0) {
          const rec: PersonalRecord = {
            id: `${currentRound}-${Date.now()}`,
            roundNumber: currentRound,
            result: targetSlice.option,
            bonusResult: extraBonus,
            bets: betsSnapshot,
            totalCost: playerCost,
            totalWin: playerWin,
            timestamp: Date.now(),
          };
          setPersonalRecords((prev) => [rec, ...prev].slice(0, 30));
        }

        setPhase('RESULT');

        // Auto-open Good Luck Winners Podium modal if no info modal is currently open
        if (activeModalRef.current === 'none') {
          setActiveModal('goodLuck');
        }

        // Schedule next round cleanly
        resultTimerRef.current = window.setTimeout(() => {
          setActiveModal((cur) => (cur === 'goodLuck' ? 'none' : cur));
          setRoundNumber((r) => r + 1);
          setPlayerBets({ ...EMPTY_BETS });
          setPoolBets({ ...EMPTY_BETS });
          setPlacedChips([]);
          setWinningOption(null);
          setBonusOption(null);
          setCountdown(BETTING_DURATION_SEC);
          setPhase('BETTING');
        }, RESULT_DURATION_MS);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  }, [showToast]);

  // Countdown timer during BETTING phase
  useEffect(() => {
    if (phase !== 'BETTING') return;

    if (countdown <= 0) {
      startSpin();
      return;
    }

    const timer = window.setTimeout(() => {
      const next = countdown - 1;
      if (next > 0 && next <= 3) {
        soundEngine.playCountdownTick(true);
      }
      setCountdown(next);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [phase, countdown, startSpin]);

  // Live simulated room players placing bets during BETTING phase
  useEffect(() => {
    if (phase !== 'BETTING') return;

    const botInterval = window.setInterval(() => {
      if (Math.random() < 0.78) {
        const { option, value } = pickRandomBotChip();
        setPoolBets((prev) => ({
          ...prev,
          [option]: prev[option] + value,
        }));
        spawnChipVisual(option, value, false);
        soundEngine.playChipPlace(false);
      }
    }, 620);

    return () => window.clearInterval(botInterval);
  }, [phase, spawnChipVisual]);

  // Cleanup animation frame / timers on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
    if (!next) soundEngine.playClick();
  };

  const handleSelectChip = (val: ChipValue) => {
    setSelectedChip(val);
    soundEngine.playChipSelect();
  };

  const handleAddCoins = (amount: number) => {
    setBalance((b) => b + amount);
    soundEngine.playWin(false);
    showToast(`Added +${formatCompactCoins(amount)} coins!`);
  };

  const handleResetSession = () => {
    setBalance(STARTING_BALANCE);
    setRoundNumber(228);
    setHistory(INITIAL_HISTORY);
    setPersonalRecords([]);
    setPreviousPlayerBets({ ...EMPTY_BETS });
    showToast('Session reset to 100K coins');
  };

  const recentStrip = history.slice(0, 8);
  const canRepeat =
    phase === 'BETTING' &&
    previousPlayerBets.watermelon + previousPlayerBets.seven + previousPlayerBets.plum > 0;

  return (
    <main
      className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 35%, #2d1074 0%, #140738 48%, #07031a 100%)',
      }}
    >
      {/* Subtle ambient royal theater glow for wide desktop screens */}
      <div
        className="pointer-events-none absolute inset-0 opacity-45"
        style={{
          background:
            'radial-gradient(circle at 20% 25%, rgba(168, 42, 232, 0.25) 0%, transparent 45%), radial-gradient(circle at 80% 75%, rgba(234, 179, 8, 0.16) 0%, transparent 45%)',
        }}
        aria-hidden="true"
      />

      {/* Exact 576:944 Portrait Arcade Stage Container */}
      <div
        className="relative aspect-[576/944] h-full max-h-[100dvh] w-auto max-w-full overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.9)] sm:border-x sm:border-purple-400/20"
        style={{
          backgroundColor: '#0a0836',
        }}
      >
        {/* Extracted Original Royal Theater Stage + Ornate Wheel Frame Backdrop */}
        <img
          src="/assets/game/stage_bg.png"
          alt="Royal Fruit Wheel Theater Stage"
          referrerPolicy="no-referrer"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-fill select-none"
        />

        {/* TOP HUD: Round Counter matching Screenshots 1 & 3 */}
        <div
          className="pointer-events-none absolute z-20"
          style={{ left: '15.6%', top: '0.6%' }}
        >
          <span
            className="font-display font-medium tracking-tight text-white/90 tabular-nums drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
            style={{ fontSize: 'clamp(13px, 3.4vw, 22px)' }}
          >
            Round:{roundNumber}
          </span>
        </div>

        {/* TOP-LEFT BUTTON: Back / Session Menu */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setActiveModal('sessionMenu');
          }}
          aria-label="Open Game Menu"
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-yellow-300 cursor-pointer"
          style={{
            left: '8.85%',
            top: '7.63%',
            width: '9.8%',
            aspectRatio: '1 / 1',
          }}
        >
          <HudCircleIcon type="back" />
        </button>

        {/* TOP-RIGHT BUTTON 1: Sound Toggle */}
        <button
          type="button"
          onClick={handleToggleMute}
          aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-yellow-300 cursor-pointer"
          style={{
            left: '80.21%',
            top: '7.63%',
            width: '9.8%',
            aspectRatio: '1 / 1',
          }}
        >
          <HudCircleIcon type={isMuted ? 'soundMuted' : 'sound'} />
        </button>

        {/* TOP-RIGHT BUTTON 2: Personal Betting Record */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setActiveModal('personalLog');
          }}
          aria-label="Open My Betting Record"
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-yellow-300 cursor-pointer"
          style={{
            left: '91.32%',
            top: '7.63%',
            width: '9.8%',
            aspectRatio: '1 / 1',
          }}
        >
          <HudCircleIcon type="profile" />
        </button>

        {/* TOP-RIGHT BUTTON 3: How to Play (?) */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setActiveModal('howToPlay');
          }}
          aria-label="How to play"
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-yellow-300 cursor-pointer"
          style={{
            left: '91.32%',
            top: '14.51%',
            width: '9.8%',
            aspectRatio: '1 / 1',
          }}
        >
          <HudCircleIcon type="help" />
        </button>

        {/* TOP-RIGHT BUTTON 4: Game History (7x7 Grid) */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setActiveModal('gameHistory');
          }}
          aria-label="Open Game History"
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-yellow-300 cursor-pointer"
          style={{
            left: '91.32%',
            top: '21.40%',
            width: '9.8%',
            aspectRatio: '1 / 1',
          }}
        >
          <HudCircleIcon type="history" />
        </button>

        {/* CENTER: Spinning 9-Slice Fruit Wheel + Golden Pointer + Marquee Bulbs */}
        <FruitWheel
          rotationDeg={rotationDeg}
          phase={phase}
          countdown={countdown}
          winningOption={winningOption}
          bonusOption={bonusOption}
        />

        {/* FLOATING RIGHT: Glossy Magenta Repeat Button matching Screenshot 4 */}
        <button
          type="button"
          onClick={handleRepeatBet}
          disabled={!canRepeat}
          aria-label="Repeat previous round bets"
          className={`repeat-btn-gloss absolute z-20 flex items-center justify-center rounded-[12px] font-display font-bold text-white transition-all duration-150 focus-visible:outline-2 focus-visible:outline-yellow-300 ${
            canRepeat
              ? 'cursor-pointer hover:brightness-110 opacity-100'
              : 'cursor-not-allowed opacity-75'
          }`}
          style={{
            right: '3.8%',
            top: '54.2%',
            width: '16.2%',
            height: '5.8%',
            fontSize: 'clamp(11px, 2.8vw, 18px)',
            textShadow: '0 1.5px 2px rgba(95, 0, 72, 0.9)',
          }}
        >
          Repeat
        </button>

        {/* HISTORY STRIP: Frosted Bar + NEW Badge + Last 8 Results */}
        <div
          className="absolute left-[3%] right-[3%] z-20"
          style={{ top: '61.2%', height: '6.6%' }}
        >
          {/* Ultra-crisp NEW Badge sitting over first (newest) slot */}
          <div className="pointer-events-none absolute -top-[36%] left-[3.5%] z-30 h-[56%] drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)]">
            <NewBadgeIcon className="h-full w-auto" />
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setActiveModal('gameHistory');
            }}
            aria-label="View full 7x7 Game History"
            className="history-strip-bar grid h-full w-full grid-cols-8 items-center rounded-full px-2.5 transition hover:brightness-110 cursor-pointer focus-visible:outline-2 focus-visible:outline-yellow-300"
          >
            {recentStrip.map((opt, idx) => (
              <div
                key={`${roundNumber}-${idx}-${opt}`}
                className="flex h-full items-center justify-center p-1"
              >
                <img
                  src={OPTION_ICONS[opt]}
                  alt={opt}
                  referrerPolicy="no-referrer"
                  draggable={false}
                  className={`h-[84%] w-auto max-w-full object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.55)] ${
                    idx === 0 ? 'scale-108' : ''
                  }`}
                />
              </div>
            ))}
          </button>
        </div>

        {/* BETTING PANEL: 3 Gold-Framed Magenta Boxes (Watermelon x2, 77 x8, Plum x2) */}
        <BettingPanel
          phase={phase}
          poolBets={poolBets}
          playerBets={playerBets}
          placedChips={placedChips}
          winningOption={winningOption}
          bonusOption={bonusOption}
          onPlaceBet={handlePlaceBet}
        />

        {/* BOTTOM DOCK: Player Profile & Balance Left + 4 Selectable Casino Chips Right */}
        <div
          className="absolute left-[2.2%] right-[1.4%] z-20 flex items-center justify-between gap-2"
          style={{ top: '87.4%', height: '10.6%' }}
        >
          {/* Player Profile & Coins Card */}
          <div className="flex h-[74%] w-[37.5%] items-center gap-1.5 rounded-xl bg-[#070b2b]/85 p-1 pr-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setActiveModal('sessionMenu');
              }}
              aria-label="Edit player profile"
              className="h-full aspect-square shrink-0 overflow-hidden rounded-[9px] border-2 border-[#e5bd67] transition hover:brightness-110 cursor-pointer"
            >
              <img
                src="/src/assets/images/hd_player_avatar_1795648953099.jpg"
                alt={playerName}
                referrerPolicy="no-referrer"
                draggable={false}
                className="h-full w-full object-cover"
              />
            </button>

            <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5 h-full">
              <span
                className="truncate font-semibold leading-tight text-white"
                style={{ fontSize: 'clamp(11px, 2.7vw, 17px)' }}
              >
                {playerName}
              </span>

              <div className="flex items-center justify-between gap-1">
                <div className="flex min-w-0 items-center gap-1">
                  <GoldCoinIcon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]" />
                  <span
                    className="truncate font-display font-bold tabular-nums text-white"
                    style={{ fontSize: 'clamp(11px, 2.7vw, 17px)' }}
                  >
                    {formatCompactCoins(balance)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setActiveModal('coinRefill');
                  }}
                  aria-label="Add free coins"
                  className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 rounded-full transition-transform hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-yellow-300 cursor-pointer drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)]"
                >
                  <GoldPlusIcon />
                </button>
              </div>
            </div>
          </div>

          {/* 4 Selectable Ultra-HD Casino Chips (100, 1K, 10K, 100K) */}
          <div className="grid h-full flex-1 grid-cols-4 items-center gap-1.5 px-0.5">
            {CHIP_VALUES.map((val) => {
              const isSelected = selectedChip === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleSelectChip(val)}
                  aria-label={`Select ${formatCompactCoins(val)} chip`}
                  aria-pressed={isSelected}
                  className={`relative mx-auto flex w-[92%] aspect-square items-center justify-center rounded-full transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-yellow-300 cursor-pointer ${
                    isSelected
                      ? 'chip-selected-ring scale-[1.07] -translate-y-0.5 z-10'
                      : 'opacity-94 hover:opacity-100 hover:scale-[1.03]'
                  }`}
                >
                  <CasinoChipIcon
                    value={val}
                    className="h-full w-full drop-shadow-[0_3px_6px_rgba(0,0,0,0.65)]"
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Floating Feedback Toast */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              key="toast"
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.94 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-none absolute left-1/2 top-[13%] z-40 -translate-x-1/2 rounded-xl border border-yellow-300/75 bg-[#240a63]/95 px-4 py-1.5 text-center text-xs sm:text-sm font-bold text-yellow-200 shadow-[0_6px_20px_rgba(0,0,0,0.75)] whitespace-nowrap"
            >
              {toastMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interactive Modals Layer (How to play, Good Luck, Game History, Personal Log, Coin Refill, Menu) */}
        <GameModals
          activeModal={activeModal}
          onClose={() => {
            soundEngine.playClick();
            setActiveModal('none');
          }}
          history={history}
          lastResult={lastResult}
          personalRecords={personalRecords}
          playerName={playerName}
          playerBalance={balance}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onAddCoins={handleAddCoins}
          onUpdateName={setPlayerName}
          onResetSession={handleResetSession}
        />
      </div>
    </main>
  );
}
