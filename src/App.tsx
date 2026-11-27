/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sliders } from 'lucide-react';
import {
  dealRoundHands,
  DEFAULT_COIN_ICON,
  DEFAULT_GAME_CONFIG,
  formatCoins,
  GameControlConfig,
  HandEvaluation,
  INITIAL_HISTORY,
  isSafeCoinIconUrl,
  MAX_BET_SEATS_PER_ROUND,
  RoundHistoryItem,
  SEAT_CONFIG,
  SeatId,
} from './engine/teenPatti';
import { soundFX } from './utils/sound';
import {
  getInitialApiBase,
  requestPlayerReset,
  requestTopUp,
  resolveCoinIconSrc,
  resolveServerRound,
  sendPlayerHeartbeat,
  ServerStats,
} from './utils/api';
import { PlayingCardSet } from './components/PlayingCardSet';
import { GameHistoryModal } from './components/GameHistoryModal';
import { RulesModal } from './components/RulesModal';
import { TopUpModal } from './components/TopUpModal';
import { MenuModal } from './components/MenuModal';
import { AdminDashboard } from './components/AdminDashboard';
import { WinBannerData, WinResultCard } from './components/WinResultCard';
import { HistoryClockSvg, SilverChipSvg } from './components/HdIcons';

type GamePhase = 'CONNECTING' | 'BETTING' | 'FLIPPING' | 'REVEAL';
type AppMode = 'all' | 'game' | 'admin';

interface FlyingChip {
  id: number;
  value: number;
  startX: number;
  startY: number;
  tx: number;
  ty: number;
}

const SEATS: SeatId[] = ['A', 'B', 'C'];
const DEFAULT_STARTING_BALANCE = 100_000;
const INITIAL_ROUND_NUMBER = 1511;
const CONFIG_STORAGE_KEY = 'teen_patti_royal_config_v5';
const PLAYER_ID_STORAGE_KEY = 'teen_patti_player_id_v1';

const APP_MODE: AppMode = (() => {
  const raw = (import.meta.env.VITE_APP_MODE as string | undefined)?.trim().toLowerCase();
  if (raw === 'admin' || raw === 'game') return raw;
  return 'all';
})();

function isAdminRouteActive(): boolean {
  if (APP_MODE === 'admin') return true;
  if (APP_MODE === 'game') return false;
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname === '/admin' ||
    window.location.pathname.startsWith('/admin/') ||
    window.location.hash === '#/admin'
  );
}

function getOrCreatePlayerId(): string {
  try {
    const existing = localStorage.getItem(PLAYER_ID_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{3,48}$/.test(existing)) {
      return existing;
    }
    const generated = `tp_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
    localStorage.setItem(PLAYER_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `tp_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function loadSavedConfig(): GameControlConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_GAME_CONFIG;
    const parsed = JSON.parse(raw) as Partial<GameControlConfig>;
    const coinUrl =
      typeof parsed.coinIconUrl === 'string' && isSafeCoinIconUrl(parsed.coinIconUrl)
        ? parsed.coinIconUrl
        : DEFAULT_COIN_ICON;
    const forced =
      parsed.forceNextWinner === 'A' ||
      parsed.forceNextWinner === 'B' ||
      parsed.forceNextWinner === 'C'
        ? parsed.forceNextWinner
        : null;
    return {
      ...DEFAULT_GAME_CONFIG,
      ...parsed,
      forceNextWinner: forced,
      coinIconUrl: coinUrl,
      winRates: {
        A: parsed.winRates?.A ?? DEFAULT_GAME_CONFIG.winRates.A,
        B: parsed.winRates?.B ?? DEFAULT_GAME_CONFIG.winRates.B,
        C: parsed.winRates?.C ?? DEFAULT_GAME_CONFIG.winRates.C,
      },
      multipliers: {
        A: parsed.multipliers?.A ?? DEFAULT_GAME_CONFIG.multipliers.A,
        B: parsed.multipliers?.B ?? DEFAULT_GAME_CONFIG.multipliers.B,
        C: parsed.multipliers?.C ?? DEFAULT_GAME_CONFIG.multipliers.C,
      },
      chipValues:
        Array.isArray(parsed.chipValues) && parsed.chipValues.length === 4
          ? (parsed.chipValues as [number, number, number, number])
          : DEFAULT_GAME_CONFIG.chipValues,
    };
  } catch {
    return DEFAULT_GAME_CONFIG;
  }
}

export default function App() {
  const [playerId] = useState<string>(getOrCreatePlayerId);
  const [apiBase, setApiBase] = useState<string>(getInitialApiBase);
  const [serverConnected, setServerConnected] = useState<boolean>(false);
  // Admin Bearer token held strictly in React memory (never persisted to localStorage/sessionStorage)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [standaloneAdmin, setStandaloneAdmin] = useState<boolean>(isAdminRouteActive);

  const [config, setConfig] = useState<GameControlConfig>(loadSavedConfig);

  const [phase, setPhase] = useState<GamePhase>('CONNECTING');
  const [roundNumber, setRoundNumber] = useState<number>(INITIAL_ROUND_NUMBER);
  const [timeLeft, setTimeLeft] = useState<number>(config.roundDuration);

  const [balance, setBalance] = useState<number>(DEFAULT_STARTING_BALANCE);
  const [selectedChipIndex, setSelectedChipIndex] = useState<number>(0);

  const [pots, setPots] = useState<Record<SeatId, number>>({
    A: 1000,
    B: 3000,
    C: 1000,
  });
  const [userBets, setUserBets] = useState<Record<SeatId, number>>({
    A: 0,
    B: 0,
    C: 0,
  });

  const [hands, setHands] = useState<Record<SeatId, HandEvaluation> | null>(null);
  const [openedRankCount, setOpenedRankCount] = useState<number>(0);
  const [winner, setWinner] = useState<SeatId | null>(null);
  const [lastWinAmount, setLastWinAmount] = useState<number>(0);
  const [winBanner, setWinBanner] = useState<WinBannerData | null>(null);
  const [history, setHistory] = useState<RoundHistoryItem[]>(INITIAL_HISTORY);

  const [stats, setStats] = useState<ServerStats>({
    roundsPlayed: 0,
    totalWagered: 0,
    totalPayouts: 0,
    seatWins: { A: 0, B: 0, C: 0 },
  });

  const [showDashboard, setShowDashboard] = useState<boolean>(() =>
    APP_MODE === 'game'
      ? false
      : typeof window !== 'undefined'
      ? window.innerWidth >= 1024
      : false
  );
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showRules, setShowRules] = useState<boolean>(false);
  const [showTopUp, setShowTopUp] = useState<boolean>(false);
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [flyingChips, setFlyingChips] = useState<FlyingChip[]>([]);

  const selectedChipValue = config.chipValues[selectedChipIndex] ?? config.chipValues[0];
  const activeCoinIconSrc = resolveCoinIconSrc(config.coinIconUrl, apiBase);

  // Sync browser back/forward navigation for /admin SPA route
  useEffect(() => {
    const handlePop = () => setStandaloneAdmin(isAdminRouteActive());
    window.addEventListener('popstate', handlePop);
    window.addEventListener('hashchange', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      window.removeEventListener('hashchange', handlePop);
    };
  }, []);

  const navigateToStandaloneAdmin = useCallback(() => {
    if (APP_MODE === 'game') return;
    window.history.pushState({}, '', '/admin');
    setStandaloneAdmin(true);
  }, []);

  const navigateBackToGame = useCallback(() => {
    if (APP_MODE === 'admin') return;
    window.history.pushState({}, '', '/');
    setStandaloneAdmin(false);
  }, []);

  // Cache non-blob config locally for offline fallback
  useEffect(() => {
    try {
      const toStore = {
        ...config,
        coinIconUrl: config.coinIconUrl.startsWith('blob:')
          ? DEFAULT_COIN_ICON
          : config.coinIconUrl,
      };
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // Ignore storage quota issues
    }
  }, [config]);

  // Refs for flying chip coordinates & latest state inside timers
  const boardRef = useRef<HTMLDivElement | null>(null);
  const seatBoxRefs = useRef<Record<SeatId, HTMLButtonElement | null>>({
    A: null,
    B: null,
    C: null,
  });
  const chipRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const userBetsRef = useRef(userBets);
  const roundNumberRef = useRef(roundNumber);
  const configRef = useRef(config);
  const phaseRef = useRef(phase);
  const apiBaseRef = useRef(apiBase);
  const serverConnectedRef = useRef(serverConnected);
  const pendingOutcomeRef = useRef<{
    hands: Record<SeatId, HandEvaluation>;
    winner: SeatId;
    fromServer?: boolean;
    payout?: number;
    newBalance?: number;
    history?: RoundHistoryItem[];
    nextRoundNumber?: number;
    stats?: ServerStats;
    config?: GameControlConfig;
    seatMultiplier?: number;
  } | null>(null);
  const chipIdCounter = useRef(0);
  const toastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    userBetsRef.current = userBets;
  }, [userBets]);

  useEffect(() => {
    roundNumberRef.current = roundNumber;
  }, [roundNumber]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    apiBaseRef.current = apiBase;
  }, [apiBase]);

  useEffect(() => {
    serverConnectedRef.current = serverConnected;
  }, [serverConnected]);

  const syncFromServerPayload = useCallback(
    (payload: {
      config?: GameControlConfig;
      stats?: ServerStats;
      history?: RoundHistoryItem[];
      currentRoundNumber?: number;
    }) => {
      if (payload.config) {
        setConfig((prev) => ({
          ...prev,
          ...payload.config,
          coinIconUrl: isSafeCoinIconUrl(payload.config?.coinIconUrl)
            ? payload.config!.coinIconUrl
            : prev.coinIconUrl,
        }));
      }
      if (payload.stats) {
        setStats(payload.stats);
      }
      if (payload.history && payload.history.length > 0) {
        const validHistory = payload.history.filter(
          (item) => item.winner === 'A' || item.winner === 'B' || item.winner === 'C'
        );
        if (validHistory.length > 0) setHistory(validHistory);
      }
      if (typeof payload.currentRoundNumber === 'number') {
        setRoundNumber(payload.currentRoundNumber);
      }
    },
    []
  );

  // Heartbeat with Express Server DB (syncs config, coin icon, balance, history, online presence)
  useEffect(() => {
    let active = true;
    const runHeartbeat = async () => {
      try {
        const res = await sendPlayerHeartbeat(
          apiBase,
          playerId,
          configRef.current.playerName
        );
        if (!active) return;
        setServerConnected(true);
        syncFromServerPayload({
          config: res.config,
          stats: res.stats,
          history: res.history,
          currentRoundNumber: res.currentRoundNumber,
        });
        // Update player balance from server DB when no un-settled bets are on the table
        const bets = userBetsRef.current;
        const hasPendingBets = bets.A + bets.B + bets.C > 0;
        if (!hasPendingBets && phaseRef.current !== 'FLIPPING') {
          setBalance(res.player.balance);
        }
      } catch {
        if (!active) return;
        setServerConnected(false);
      }
    };

    runHeartbeat();
    const interval = window.setInterval(runHeartbeat, 10_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [apiBase, playerId, syncFromServerPayload]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 1800);
  }, []);

  // Begin a fresh betting round
  const startNewBettingRound = useCallback((nextRoundNum: number, duration: number) => {
    pendingOutcomeRef.current = null;
    setRoundNumber(nextRoundNum);
    setHands(null);
    setOpenedRankCount(0);
    setWinner(null);
    setLastWinAmount(0);
    setWinBanner(null);
    setUserBets({ A: 0, B: 0, C: 0 });
    const botsOn = configRef.current.botsEnabled;
    setPots(
      botsOn
        ? {
            A: (Math.floor(Math.random() * 2) + 1) * 1000,
            B: (Math.floor(Math.random() * 3) + 1) * 1000,
            C: (Math.floor(Math.random() * 2) + 1) * 1000,
          }
        : { A: 0, B: 0, C: 0 }
    );
    setTimeLeft(duration);
    setPhase('BETTING');
  }, []);

  // Step 1: Deal cards via Server DB (with seamless local fallback if offline) and start FLIPPING
  const triggerFlipSequence = useCallback(async () => {
    const cfg = configRef.current;
    const currentBets = { ...userBetsRef.current };

    if (serverConnectedRef.current) {
      try {
        const res = await resolveServerRound(apiBaseRef.current, {
          playerId,
          playerName: cfg.playerName,
          bets: currentBets,
        });
        pendingOutcomeRef.current = {
          hands: res.hands,
          winner: res.winner,
          fromServer: true,
          payout: res.payout,
          newBalance: res.newBalance,
          history: res.history,
          nextRoundNumber: res.nextRoundNumber,
          stats: res.stats,
          config: res.config,
          seatMultiplier: res.seatMultiplier,
        };
        setHands(res.hands);
        setWinner(null);
        setOpenedRankCount(0);
        setLastWinAmount(0);
        setWinBanner(null);
        setPhase('FLIPPING');
        return;
      } catch {
        // Fallback cleanly to local resolution if server temporarily unavailable
      }
    }

    const result = dealRoundHands({
      outcomeMode: cfg.outcomeMode,
      winRates: cfg.winRates,
      forceWinner: cfg.forceNextWinner,
      userBets: currentBets,
      multipliers: cfg.multipliers,
    });

    if (cfg.forceNextWinner && !cfg.lockForcedWinner) {
      setConfig((prev) => ({ ...prev, forceNextWinner: null }));
    }

    pendingOutcomeRef.current = {
      hands: result.hands,
      winner: result.winner,
      fromServer: false,
    };
    setHands(result.hands);
    setWinner(null);
    setOpenedRankCount(0);
    setLastWinAmount(0);
    setWinBanner(null);
    setPhase('FLIPPING');
  }, [playerId]);

  // Step 2: After ALL 9 cards open, highlight winner & apply server/local settlement
  const finalizeWinnerReveal = useCallback(() => {
    const result = pendingOutcomeRef.current;
    if (!result) return;

    const cfg = configRef.current;
    const currentBets = userBetsRef.current;

    setWinner(result.winner);
    setPhase('REVEAL');

    const finishedRound = roundNumberRef.current;
    const roundTotalBet = currentBets.A + currentBets.B + currentBets.C;
    const seatMultiplier = result.seatMultiplier ?? cfg.multipliers[result.winner];
    const betOnWinner = currentBets[result.winner];
    const payout =
      result.fromServer && typeof result.payout === 'number'
        ? result.payout
        : betOnWinner > 0
        ? Math.round(betOnWinner * seatMultiplier)
        : 0;

    if (result.fromServer) {
      if (result.history) setHistory(result.history);
      if (result.stats) setStats(result.stats);
      if (result.config) {
        setConfig((prev) => ({
          ...prev,
          ...result.config,
        }));
      }
      if (typeof result.newBalance === 'number') {
        setBalance(result.newBalance);
      }
    } else {
      setHistory((prev) => [
        {
          round: finishedRound,
          winner: result.winner,
          winningRank: result.hands[result.winner].rankName,
          userBetTotal: roundTotalBet,
          userPayout: payout,
          multiplierUsed: seatMultiplier,
        },
        ...prev.slice(0, 49),
      ]);

      setStats((prev) => ({
        roundsPlayed: prev.roundsPlayed + 1,
        totalWagered: prev.totalWagered + roundTotalBet,
        totalPayouts: prev.totalPayouts + payout,
        seatWins: {
          ...prev.seatWins,
          [result.winner]: prev.seatWins[result.winner] + 1,
        },
      }));

      if (payout > 0) {
        setBalance((b) => b + payout);
      }
    }

    if (payout > 0) {
      setLastWinAmount(payout);
      setWinBanner({
        seat: result.winner,
        handRank: result.hands[result.winner].rankName,
        betAmount: roundTotalBet,
        winAmount: payout,
      });
      soundFX.playWin();
    } else {
      setLastWinAmount(0);
      setWinBanner(null);
      soundFX.playChipSelect();
    }
  }, []);

  // Phase 1: Initial Connecting splash
  useEffect(() => {
    if (standaloneAdmin || phase !== 'CONNECTING') return;
    const t = window.setTimeout(() => {
      startNewBettingRound(roundNumberRef.current, configRef.current.roundDuration);
    }, 1050);
    return () => window.clearTimeout(t);
  }, [phase, standaloneAdmin, startNewBettingRound]);

  // Phase 2: Betting countdown + simulated live table players
  useEffect(() => {
    if (standaloneAdmin || phase !== 'BETTING') return;

    const countdownInterval = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(countdownInterval);
          void triggerFlipSequence();
          return 0;
        }
        if (prev <= 6) {
          soundFX.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    let potSimInterval: number | null = null;
    if (config.botsEnabled) {
      const intervalMs =
        config.botActivity === 'high'
          ? 700
          : config.botActivity === 'low'
          ? 2400
          : 1350;
      const betPool =
        config.botActivity === 'high'
          ? [2000, 5000, 10000, 20000]
          : config.botActivity === 'low'
          ? [1000, 1000, 2000]
          : [1000, 1000, 2000, 3000, 5000];

      potSimInterval = window.setInterval(() => {
        const seat = SEATS[Math.floor(Math.random() * SEATS.length)];
        const delta = betPool[Math.floor(Math.random() * betPool.length)];
        setPots((prev) => ({
          ...prev,
          [seat]: prev[seat] + delta,
        }));
      }, intervalMs);
    }

    return () => {
      window.clearInterval(countdownInterval);
      if (potSimInterval !== null) {
        window.clearInterval(potSimInterval);
      }
    };
  }, [phase, standaloneAdmin, config.botsEnabled, config.botActivity, triggerFlipSequence]);

  // Phase 2.5: Sequential Card Opening (Seat A -> B -> C)
  useEffect(() => {
    if (standaloneAdmin || phase !== 'FLIPPING') return;

    const timers: number[] = [];

    soundFX.playCardFlip();
    timers.push(window.setTimeout(() => setOpenedRankCount(1), 360));

    timers.push(
      window.setTimeout(() => {
        soundFX.playCardFlip();
      }, 360)
    );
    timers.push(window.setTimeout(() => setOpenedRankCount(2), 720));

    timers.push(
      window.setTimeout(() => {
        soundFX.playCardFlip();
      }, 720)
    );
    timers.push(window.setTimeout(() => setOpenedRankCount(3), 1080));

    timers.push(
      window.setTimeout(() => {
        finalizeWinnerReveal();
      }, 1850)
    );

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [phase, standaloneAdmin, finalizeWinnerReveal]);

  // Phase 3: Reveal duration -> auto start next round
  useEffect(() => {
    if (standaloneAdmin || phase !== 'REVEAL') return;
    const t = window.setTimeout(() => {
      const nextNum =
        pendingOutcomeRef.current?.nextRoundNumber ?? roundNumberRef.current + 1;
      startNewBettingRound(nextNum, configRef.current.roundDuration);
    }, config.revealDuration * 1000);
    return () => window.clearTimeout(t);
  }, [phase, standaloneAdmin, config.revealDuration, startNewBettingRound]);

  // Spawn animated HD silver chip flying from bottom selector into target seat
  const spawnFlyingChip = useCallback((seat: SeatId, chipIdx: number, chipVal: number) => {
    const boardEl = boardRef.current;
    const chipEl = chipRefs.current[chipIdx];
    const seatEl = seatBoxRefs.current[seat];
    if (!boardEl || !chipEl || !seatEl) return;

    const boardRect = boardEl.getBoundingClientRect();
    const chipRect = chipEl.getBoundingClientRect();
    const seatRect = seatEl.getBoundingClientRect();

    const startX = chipRect.left - boardRect.left + chipRect.width / 2;
    const startY = chipRect.top - boardRect.top + chipRect.height / 2;
    const endX = seatRect.left - boardRect.left + seatRect.width / 2;
    const endY = seatRect.top - boardRect.top + seatRect.height * 0.35;

    const id = ++chipIdCounter.current;
    const flying: FlyingChip = {
      id,
      value: chipVal,
      startX,
      startY,
      tx: endX - startX,
      ty: endY - startY,
    };

    setFlyingChips((prev) => [...prev, flying]);
    window.setTimeout(() => {
      setFlyingChips((prev) => prev.filter((item) => item.id !== id));
    }, 450);
  }, []);

  // Place bet on Seat A, B, or C (maximum 2 distinct seats per round)
  const handlePlaceBet = useCallback(
    (seat: SeatId) => {
      if (phase === 'CONNECTING') return;
      if (phase === 'FLIPPING' || phase === 'REVEAL') {
        showToast('Wait for next round...');
        return;
      }

      const currentBets = userBetsRef.current;
      const activeSeatsCount = SEATS.filter((s) => currentBets[s] > 0).length;
      if (currentBets[seat] === 0 && activeSeatsCount >= MAX_BET_SEATS_PER_ROUND) {
        showToast('You can only bet on 2 seats per round');
        return;
      }

      if (balance < selectedChipValue) {
        showToast('Not enough coins — Top Up!');
        setShowTopUp(true);
        return;
      }

      soundFX.playBetPlace();
      setBalance((b) => b - selectedChipValue);
      setPots((prev) => ({
        ...prev,
        [seat]: prev[seat] + selectedChipValue,
      }));
      setUserBets((prev) => ({
        ...prev,
        [seat]: prev[seat] + selectedChipValue,
      }));
      spawnFlyingChip(seat, selectedChipIndex, selectedChipValue);
    },
    [phase, balance, selectedChipValue, selectedChipIndex, showToast, spawnFlyingChip]
  );

  const handleSelectChip = (idx: number) => {
    soundFX.playChipSelect();
    setSelectedChipIndex(idx);
  };

  const handleRevealNow = () => {
    if (phase === 'BETTING') {
      soundFX.playChipSelect();
      void triggerFlipSequence();
    }
  };

  const handleAddCoins = async (amount: number) => {
    soundFX.playCoinTopUp();
    if (serverConnected) {
      try {
        const res = await requestTopUp(apiBase, playerId, amount);
        setBalance(res.player.balance);
        showToast(`Added +${formatCoins(amount)} coins!`);
        return;
      } catch {
        // fallback below
      }
    }
    setBalance((b) => b + amount);
    showToast(`Added +${formatCoins(amount)} coins!`);
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    soundFX.enabled = next;
    setSoundEnabled(next);
    if (next) soundFX.playChipSelect();
  };

  const handleReconnect = () => {
    setPhase('CONNECTING');
  };

  const handleResetSession = async () => {
    if (serverConnected) {
      try {
        const res = await requestPlayerReset(apiBase, playerId);
        setBalance(res.player.balance);
        setPhase('CONNECTING');
        return;
      } catch {
        // fallback below
      }
    }
    setBalance(DEFAULT_STARTING_BALANCE);
    setHistory(INITIAL_HISTORY);
    setRoundNumber(INITIAL_ROUND_NUMBER);
    roundNumberRef.current = INITIAL_ROUND_NUMBER;
    setStats({
      roundsPlayed: 0,
      totalWagered: 0,
      totalPayouts: 0,
      seatWins: { A: 0, B: 0, C: 0 },
    });
    setPhase('CONNECTING');
  };

  const handleResetDefaults = () => {
    setConfig((prev) => ({
      ...DEFAULT_GAME_CONFIG,
      coinIconUrl: prev.coinIconUrl,
    }));
    showToast('Default settings restored');
  };

  const handleConfigUpdate = useCallback(
    (updater: (prev: GameControlConfig) => GameControlConfig) => {
      setConfig((prev) => {
        const next = updater(prev);
        if (
          phaseRef.current === 'BETTING' &&
          next.roundDuration !== prev.roundDuration &&
          timeLeft > next.roundDuration
        ) {
          setTimeLeft(next.roundDuration);
        }
        return next;
      });
    },
    [timeLeft]
  );

  // ================= STANDALONE EXTERNAL /admin FULL-SCREEN MODE =================
  if (standaloneAdmin) {
    return (
      <main
        className="min-h-dvh w-full flex items-center justify-center p-2 sm:p-4 overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at center, #1e293b 0%, #0f172a 65%, #070b14 100%)',
        }}
      >
        <AdminDashboard
          open
          standalone
          config={config}
          balance={balance}
          roundNumber={roundNumber}
          phase={phase}
          timeLeft={timeLeft}
          userBets={userBets}
          pots={pots}
          stats={stats}
          history={history}
          apiBase={apiBase}
          serverConnected={serverConnected}
          adminToken={adminToken}
          onAdminTokenChange={setAdminToken}
          onApiBaseChange={setApiBase}
          onChangeConfig={handleConfigUpdate}
          onSyncServerState={syncFromServerPayload}
          onSetBalance={setBalance}
          onRevealNow={handleRevealNow}
          onResetStats={() =>
            setStats({
              roundsPlayed: 0,
              totalWagered: 0,
              totalPayouts: 0,
              seatWins: { A: 0, B: 0, C: 0 },
            })
          }
          onResetDefaults={handleResetDefaults}
          onBackToGame={APP_MODE === 'admin' ? undefined : navigateBackToGame}
        />
      </main>
    );
  }

  const visibleResults = history.slice(0, 10);

  return (
    <main
      className="min-h-dvh w-full flex flex-col lg:flex-row items-center justify-center gap-0 lg:gap-6 p-0 sm:p-3 overflow-hidden relative"
      style={{
        background:
          'radial-gradient(ellipse at center, #3b2814 0%, #1c1209 70%, #0e0904 100%)',
      }}
    >
      {/* Floating Admin Dashboard Toggle Button (desktop only; mobile uses header icon & menu) */}
      {APP_MODE !== 'game' && !showDashboard && (
        <button
          type="button"
          onClick={() => {
            soundFX.playChipSelect();
            setShowDashboard(true);
          }}
          className="hidden lg:inline-flex fixed top-3 right-3 z-50 items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0f172a]/95 hover:bg-[#1e293b] text-amber-300 border border-amber-500/40 shadow-xl text-[12.5px] font-bold cursor-pointer transition-all active:scale-95 whitespace-nowrap"
        >
          <Sliders className="w-4 h-4" />
          Admin Dashboard
        </button>
      )}

      {/* ================= TEEN PATTI ROYAL GAME BOARD ================= */}
      <div
        ref={boardRef}
        className="relative w-full h-[100dvh] max-w-[480px] sm:h-auto sm:max-w-[465px] sm:max-h-[95dvh] sm:aspect-[1080/1289] overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.75)] sm:rounded-[6px] shrink-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 55% at 50% 34%, #f9e8be 0%, #eccb83 58%, #dfa94e 100%)',
        }}
      >
        {/* Inner Playable Board aligned precisely inside the ornate carved gold frame */}
        <div className="relative w-full h-full flex flex-col justify-between pt-[3.6%] pb-[3.6%] px-[5.4%] sm:pt-[3.3%] sm:pb-[3.3%] sm:px-[5.2%]">
          {/* ================= TOP HEADER BAR ================= */}
          <header className="relative flex items-center justify-between px-2 pt-1.5 pb-1 z-20 shrink-0 gap-1.5">
            {/* Left Round Pill + Mobile Dashboard Quick Button */}
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="px-2.5 sm:px-3 py-[2px] rounded-full border border-[#8e6731] bg-[#eed498]/55 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]">
                <span className="text-[12px] sm:text-[15px] font-semibold text-[#1e1408] tracking-tight tabular-nums whitespace-nowrap">
                  round: {roundNumber}
                </span>
              </div>
              {APP_MODE !== 'game' && !showDashboard && (
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playChipSelect();
                    setShowDashboard(true);
                  }}
                  aria-label="Open Admin Dashboard"
                  title="Admin Dashboard"
                  className="lg:hidden w-7 h-7 rounded-full border border-[#8e6731] bg-[#5a3b11]/90 text-[#ffe699] flex items-center justify-center shadow-sm active:scale-95 cursor-pointer shrink-0"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Center Title Pill */}
            <div
              className="px-4 sm:px-8 py-[2px] rounded-full border border-[#8c642d] shadow-[0_1px_3px_rgba(92,58,12,0.22)] shrink-0"
              style={{
                background:
                  'linear-gradient(180deg, #fff6de 0%, #f1da9f 55%, #d6ad5c 100%)',
              }}
            >
              <h1 className="text-[12.5px] sm:text-[15px] font-semibold text-[#5a3b11] tracking-tight whitespace-nowrap">
                Teen Patti
              </h1>
            </div>

            {/* Right Hanging Close / Options Tag */}
            <button
              type="button"
              onClick={() => {
                soundFX.playChipSelect();
                setShowMenu(true);
              }}
              aria-label="Table Options"
              className="relative -mt-1.5 -mr-0.5 w-[35px] h-[39px] sm:-mt-2 sm:-mr-1 sm:w-[42px] sm:h-[46px] flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-[#7c4d12] shrink-0"
            >
              <img
                src="/assets/hd/btn-close.png"
                alt="Menu"
                referrerPolicy="no-referrer"
                draggable={false}
                className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
              />
            </button>
          </header>

          {/* ================= 3 CARD SETS ROW ================= */}
          <section
            aria-label="Card Hands"
            className="grid grid-cols-3 gap-2.5 sm:gap-3 px-2.5 pt-1.5 pb-1 z-20 shrink-0"
          >
            {SEATS.map((seat, seatIdx) => {
              const cardsOpen =
                (phase === 'FLIPPING' || phase === 'REVEAL') && hands !== null;
              const showRankBanner =
                phase === 'REVEAL' ||
                (phase === 'FLIPPING' && openedRankCount > seatIdx);
              const isWinnerFinalized = phase === 'REVEAL' && winner !== null;
              const isWinSeat = isWinnerFinalized && winner === seat;
              const isDimmed = isWinnerFinalized && winner !== seat;

              return (
                <PlayingCardSet
                  key={seat}
                  hand={hands ? hands[seat] : null}
                  revealed={cardsOpen}
                  revealDelayMs={seatIdx * 360}
                  showRankBanner={showRankBanner}
                  isWinner={isWinSeat}
                  isDimmed={isDimmed}
                  timerSeconds={
                    seat === 'B' && phase === 'BETTING' ? timeLeft : null
                  }
                  onTimerClick={seat === 'B' ? handleRevealNow : undefined}
                />
              );
            })}
          </section>

          {/* ================= 3 HD ROYAL THRONES + LEFT RULES TAB ================= */}
          <section
            aria-label="Royal Thrones"
            className="relative grid grid-cols-3 grid-rows-[minmax(0,1fr)] gap-2 sm:gap-3 pl-5 pr-2 sm:pl-6 sm:pr-2.5 items-center flex-[1.5] min-h-[120px] sm:min-h-[128px] py-1.5 z-10 overflow-hidden"
          >
            {/* Left Vertical "Rules" Tab */}
            <button
              type="button"
              onClick={() => {
                soundFX.playChipSelect();
                setShowRules(true);
              }}
              aria-label="Open Teen Patti Rules"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-30 py-2 px-[4px] sm:px-[5px] rounded-r-[4px] border-y border-r border-[#a67a32] shadow-[1px_2px_4px_rgba(74,44,8,0.28)] cursor-pointer transition-all hover:brightness-105 active:scale-95"
              style={{
                background: 'linear-gradient(90deg, #bd8d3d 0%, #d4a654 100%)',
              }}
            >
              <span
                className="block text-[10.5px] sm:text-[12px] font-bold text-[#52330d] tracking-wide leading-none"
                style={{ writingMode: 'vertical-rl' }}
              >
                Rules
              </span>
            </button>

            {SEATS.map((seat) => {
              const isRevealed = phase === 'REVEAL';
              const isWinSeat = isRevealed && winner === seat;
              const isDimmed = isRevealed && winner !== seat;
              const activeBetCount = SEATS.filter((s) => userBets[s] > 0).length;
              const isSeatLockedByLimit =
                phase === 'BETTING' &&
                activeBetCount >= MAX_BET_SEATS_PER_ROUND &&
                userBets[seat] === 0;

              return (
                <button
                  key={seat}
                  type="button"
                  onClick={() => handlePlaceBet(seat)}
                  aria-label={`Bet on Throne ${seat}`}
                  className={`relative w-full h-full min-h-0 max-h-[170px] sm:max-h-[140px] flex items-center justify-center p-0.5 cursor-pointer transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[#7c4d12] rounded-lg ${
                    phase === 'BETTING' && !isSeatLockedByLimit
                      ? 'hover:-translate-y-1 active:scale-95'
                      : ''
                  } ${isWinSeat ? 'scale-105 z-20' : ''} ${
                    isSeatLockedByLimit ? 'opacity-55 grayscale-[35%]' : ''
                  }`}
                >
                  <img
                    src={SEAT_CONFIG[seat].throneImg}
                    alt={`Royal Throne ${seat}`}
                    referrerPolicy="no-referrer"
                    draggable={false}
                    className={`w-full h-full object-contain object-center transition-all duration-300 ${
                      isDimmed
                        ? 'brightness-50 opacity-75'
                        : isWinSeat
                        ? 'drop-shadow-[0_0_14px_rgba(255,225,110,0.95)]'
                        : 'drop-shadow-[0_4px_6px_rgba(88,52,10,0.3)]'
                    }`}
                  />
                </button>
              );
            })}
          </section>

          {/* ================= 3 BETTING BOXES (A, B, C — MAX 2 BETS PER ROUND) ================= */}
          <section
            aria-label="Betting Boxes"
            className="relative grid grid-cols-3 gap-2 sm:gap-2.5 px-2.5 pb-1.5 z-20 shrink-0"
          >
            {SEATS.map((seat) => {
              const isRevealed = phase === 'REVEAL';
              const isWinSeat = isRevealed && winner === seat;
              const isDimmed = isRevealed && winner !== seat;
              const mult = config.multipliers[seat];
              const activeBetCount = SEATS.filter((s) => userBets[s] > 0).length;
              const isSeatLockedByLimit =
                phase === 'BETTING' &&
                activeBetCount >= MAX_BET_SEATS_PER_ROUND &&
                userBets[seat] === 0;

              return (
                <button
                  key={seat}
                  ref={(el) => {
                    seatBoxRefs.current[seat] = el;
                  }}
                  type="button"
                  onClick={() => handlePlaceBet(seat)}
                  aria-label={`Seat ${seat}, Pot ${formatCoins(pots[seat])}, Your bet ${formatCoins(userBets[seat])}`}
                  className={`relative rounded-[5px] overflow-hidden border transition-all duration-200 text-center cursor-pointer focus-visible:outline-2 focus-visible:outline-[#7c4d12] ${
                    isWinSeat
                      ? 'border-[#fff1a8] winner-seat-glow z-20'
                      : 'border-[#c59a4d] shadow-[0_2px_4px_rgba(82,50,12,0.18)]'
                  } ${
                    phase === 'BETTING' && !isSeatLockedByLimit
                      ? 'hover:brightness-[1.03] active:scale-[0.98]'
                      : ''
                  } ${isSeatLockedByLimit ? 'opacity-65' : ''}`}
                >
                  {/* Floating Win Payout Badge */}
                  {isWinSeat && lastWinAmount > 0 && (
                    <div className="pointer-events-none absolute left-1/2 -top-1 z-40 animate-win-float whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-[#24b838] text-white text-[12px] sm:text-[13px] font-extrabold shadow-[0_2px_8px_rgba(0,0,0,0.35)] border border-[#b4f8be] tabular-nums">
                        +{formatCoins(lastWinAmount)}
                      </span>
                    </div>
                  )}

                  {/* Top Gold Header Band */}
                  <div
                    className={`py-2 sm:py-2.5 flex items-center justify-center gap-1.5 transition-colors ${
                      isWinSeat
                        ? 'bg-gradient-to-b from-[#f0c56c] to-[#e4b354]'
                        : isSeatLockedByLimit
                        ? 'bg-[#b38f52]'
                        : 'bg-[#d5a858]'
                    }`}
                  >
                    <span className="text-white text-[17px] sm:text-[20px] font-medium leading-none tracking-wide drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]">
                      {seat}
                    </span>
                    {config.showMultipliersOnBoard && (
                      <span className="text-[11px] sm:text-[12px] font-extrabold text-[#fff4c2] tabular-nums drop-shadow-[0_1px_1px_rgba(0,0,0,0.28)]">
                        ×{mult}
                      </span>
                    )}
                  </div>

                  {/* Middle Pot Band */}
                  <div className="py-1.5 sm:py-2 bg-[#f8e4bc] border-b border-[#d6b370]">
                    <span className="text-[12.5px] sm:text-[14.5px] font-bold text-[#5e3d16] tabular-nums whitespace-nowrap">
                      Pot: {formatCoins(pots[seat])}
                    </span>
                  </div>

                  {/* Bottom Your Bet Band */}
                  <div className="py-1.5 sm:py-2 bg-[#f8e4bc]">
                    <span className="text-[12.5px] sm:text-[14.5px] font-bold text-[#9c259b] tabular-nums whitespace-nowrap">
                      {isSeatLockedByLimit ? 'Max 2' : `You: ${formatCoins(userBets[seat])}`}
                    </span>
                  </div>

                  {/* Losing Seat Dimming Veil */}
                  {isDimmed && (
                    <div className="pointer-events-none absolute inset-0 bg-black/45 transition-opacity duration-300" />
                  )}
                </button>
              );
            })}
          </section>

          {/* ================= RESULT STRIP ================= */}
          <button
            type="button"
            onClick={() => {
              soundFX.playChipSelect();
              setShowHistory(true);
            }}
            aria-label="Open Game History"
            className="w-full bg-[#f5e4c2] hover:bg-[#f8ead0] transition-colors py-1.5 px-2.5 flex items-center justify-between gap-1.5 cursor-pointer shrink-0 z-20"
          >
            <span className="text-[12px] sm:text-[13.5px] font-extrabold text-[#8e1c24] shrink-0 tracking-tight">
              Result:
            </span>

            <div className="flex-1 flex items-center justify-between gap-[2px] sm:gap-1 min-w-0">
              {visibleResults.map((item, idx) => (
                <div
                  key={`${item.round}-${idx}`}
                  className="relative flex flex-col items-center justify-center shrink-0"
                >
                  {idx === 0 && (
                    <span className="absolute -top-[7px] left-1/2 -translate-x-1/2 text-[7px] sm:text-[8.5px] font-black text-[#a62d21] leading-none tracking-tighter z-10">
                      NEW
                    </span>
                  )}
                  <div className="w-[19px] h-[19px] min-[390px]:w-[22px] min-[390px]:h-[22px] sm:w-[25px] sm:h-[25px] rounded-full bg-white shadow-[0_1px_2px_rgba(88,52,12,0.2)] flex items-center justify-center p-[2px] sm:p-[2.5px]">
                    <img
                      src={SEAT_CONFIG[item.winner].throneImg}
                      alt={`Winner ${item.winner}`}
                      referrerPolicy="no-referrer"
                      draggable={false}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              ))}
            </div>
          </button>

          {/* ================= MIDDLE GOLD BREATHING SPACE ================= */}
          <div className="flex-[0.22] min-h-[8px] sm:flex-[0.42]" />

          {/* ================= BOTTOM PLAYER & CHIP FOOTER ================= */}
          <footer
            className="w-full px-2 sm:px-2.5 pt-2 pb-2 shrink-0 z-20"
            style={{
              background: 'linear-gradient(180deg, #deb460 0%, #d2a450 100%)',
            }}
          >
            {/* Row 1: Player Avatar + Name + User ID */}
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src="/assets/hd/avatar-player.png"
                  alt={`${config.playerName} avatar`}
                  referrerPolicy="no-referrer"
                  draggable={false}
                  className="w-[26px] h-[26px] sm:w-[30px] sm:h-[30px] rounded-full object-cover shadow-[0_1px_3px_rgba(0,0,0,0.3)] shrink-0"
                />
                <span className="text-[13px] sm:text-[15px] font-medium text-[#f9f0dc] truncate drop-shadow-[0_1px_1px_rgba(92,58,12,0.35)]">
                  {config.playerName}
                </span>
              </div>
              <span className="text-[12px] sm:text-[14.5px] font-medium text-[#f9f0dc] tabular-nums whitespace-nowrap drop-shadow-[0_1px_1px_rgba(92,58,12,0.35)]">
                User ID: {config.userId}
              </span>
            </div>

            {/* Row 2: Custom Coin Balance + Top Up + 4 Silver Chips + History Clock */}
            <div className="flex items-center justify-between gap-1 sm:gap-1.5">
              {/* Balance & Top Up */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <img
                  src={activeCoinIconSrc}
                  alt="Coins"
                  referrerPolicy="no-referrer"
                  draggable={false}
                  className="w-[22px] h-[22px] min-[390px]:w-[25px] min-[390px]:h-[25px] sm:w-[28px] sm:h-[28px] object-contain shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.22)]"
                />
                <span className="text-[13px] min-[390px]:text-[14px] sm:text-[16px] font-extrabold text-[#ffea2e] tabular-nums drop-shadow-[0_1px_2px_rgba(110,66,0,0.65)]">
                  {formatCoins(balance)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playChipSelect();
                    setShowTopUp(true);
                  }}
                  className="ml-0.5 text-[11.5px] min-[390px]:text-[13px] sm:text-[14.5px] font-bold text-[#6c4814] hover:text-[#4b3009] active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                >
                  Top Up
                </button>
              </div>

              {/* 4 Vector Silver Betting Chips + History Clock */}
              <div className="flex items-center gap-1 min-[390px]:gap-1.5 sm:gap-2 shrink-0">
                {config.chipValues.map((chipVal, idx) => {
                  const isSelected = selectedChipIndex === idx;
                  return (
                    <button
                      key={idx}
                      ref={(el) => {
                        chipRefs.current[idx] = el;
                      }}
                      type="button"
                      onClick={() => handleSelectChip(idx)}
                      aria-label={`Select ${formatCoins(chipVal)} chip`}
                      aria-pressed={isSelected}
                      className={`relative w-[31px] h-[31px] min-[390px]:w-[35px] min-[390px]:h-[35px] sm:w-[39px] sm:h-[39px] rounded-full cursor-pointer transition-all duration-150 focus-visible:outline-2 focus-visible:outline-white ${
                        isSelected
                          ? '-translate-y-1 scale-[1.08] ring-2 ring-[#fff199] shadow-[0_4px_10px_rgba(255,230,110,0.85)]'
                          : 'opacity-95 hover:opacity-100 hover:-translate-y-0.5 active:scale-95 drop-shadow-[0_2px_3px_rgba(0,0,0,0.22)]'
                      }`}
                    >
                      <SilverChipSvg value={chipVal} />
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    soundFX.playChipSelect();
                    setShowHistory(true);
                  }}
                  aria-label="Open Game History"
                  className="w-[31px] h-[31px] min-[390px]:w-[35px] min-[390px]:h-[35px] sm:w-[39px] sm:h-[39px] rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.2)]"
                >
                  <HistoryClockSvg />
                </button>
              </div>
            </div>
          </footer>
        </div>

        {/* ================= FLYING HD BETTING CHIPS LAYER ================= */}
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {flyingChips.map((fc) => (
            <div
              key={fc.id}
              className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full animate-chip-fly drop-shadow-[0_3px_6px_rgba(0,0,0,0.35)]"
              style={
                {
                  left: `${fc.startX}px`,
                  top: `${fc.startY}px`,
                  '--tx': `${fc.tx}px`,
                  '--ty': `${fc.ty}px`,
                } as React.CSSProperties
              }
            >
              <SilverChipSvg value={fc.value} />
            </div>
          ))}
        </div>

        {/* ================= CONNECTING OVERLAY ================= */}
        {phase === 'CONNECTING' && (
          <div
            className="pointer-events-none absolute inset-x-[5.2%] top-[47%] z-30 py-4 flex items-center justify-center"
            style={{
              background:
                'linear-gradient(90deg, rgba(15,12,8,0.42) 0%, rgba(12,10,6,0.84) 50%, rgba(15,12,8,0.42) 100%)',
            }}
          >
            <span className="text-white text-[16px] sm:text-[18px] font-medium tracking-wide drop-shadow-[0_1px_3px_rgba(0,0,0,0.75)]">
              Connecting with server...
            </span>
          </div>
        )}

        {/* ================= SUBTLE TOAST MESSAGE ================= */}
        {toastMsg && (
          <div className="pointer-events-none absolute inset-x-[12%] top-[46%] z-40 flex justify-center">
            <div className="px-4 py-2 rounded-lg bg-black/80 text-[#ffefc2] text-[13px] font-semibold shadow-lg border border-[#d6a84e]/60">
              {toastMsg}
            </div>
          </div>
        )}

        {/* ================= PLAYER WIN CELEBRATION CARD ================= */}
        {phase === 'REVEAL' && winBanner && (
          <WinResultCard
            data={winBanner}
            playerName={config.playerName}
            coinIconUrl={activeCoinIconSrc}
            onDismiss={() => setWinBanner(null)}
          />
        )}

        {/* ================= ENHANCED ORNATE CARVED GOLD FRAME OVERLAY ================= */}
        <img
          src="/assets/hd/gold-frame.png"
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          draggable={false}
          className="pointer-events-none absolute inset-0 w-full h-full object-fill z-40"
        />

        {/* ================= FULL-SHEET MODALS ================= */}
        <GameHistoryModal
          open={showHistory}
          history={history}
          onClose={() => setShowHistory(false)}
        />

        <RulesModal
          open={showRules}
          multipliers={config.multipliers}
          onClose={() => setShowRules(false)}
        />

        <TopUpModal
          open={showTopUp}
          balance={balance}
          coinIconUrl={activeCoinIconSrc}
          onAddCoins={handleAddCoins}
          onClose={() => setShowTopUp(false)}
        />

        <MenuModal
          open={showMenu}
          soundEnabled={soundEnabled}
          roundDuration={config.roundDuration}
          onToggleSound={handleToggleSound}
          onChangeDuration={(sec) => {
            handleConfigUpdate((prev) => ({ ...prev, roundDuration: sec }));
          }}
          onOpenDashboard={() => {
            if (APP_MODE !== 'game') setShowDashboard(true);
          }}
          onReconnect={handleReconnect}
          onResetSession={handleResetSession}
          onClose={() => setShowMenu(false)}
        />
      </div>

      {/* ================= ADMIN CONTROL DASHBOARD ================= */}
      {APP_MODE !== 'game' && showDashboard && (
        <div className="fixed inset-0 z-50 lg:static lg:z-auto flex justify-end bg-black/60 lg:bg-transparent">
          <AdminDashboard
            open={showDashboard}
            config={config}
            balance={balance}
            roundNumber={roundNumber}
            phase={phase}
            timeLeft={timeLeft}
            userBets={userBets}
            pots={pots}
            stats={stats}
            history={history}
            apiBase={apiBase}
            serverConnected={serverConnected}
            adminToken={adminToken}
            onAdminTokenChange={setAdminToken}
            onApiBaseChange={setApiBase}
            onChangeConfig={handleConfigUpdate}
            onSyncServerState={syncFromServerPayload}
            onSetBalance={setBalance}
            onRevealNow={handleRevealNow}
            onResetStats={() =>
              setStats({
                roundsPlayed: 0,
                totalWagered: 0,
                totalPayouts: 0,
                seatWins: { A: 0, B: 0, C: 0 },
              })
            }
            onResetDefaults={handleResetDefaults}
            onOpenStandaloneAdmin={navigateToStandaloneAdmin}
            onClose={() => setShowDashboard(false)}
          />
        </div>
      )}
    </main>
  );
}
