import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Bot,
  Check,
  Coins,
  Copy,
  Crown,
  Database,
  Download,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Languages,
  Lock,
  LogOut,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Sliders,
  Sparkles,
  Timer,
  Trash2,
  Unlock,
  Upload,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  BotActivityLevel,
  DEFAULT_COIN_ICON,
  formatCoins,
  GameControlConfig,
  getNormalizedWinProbs,
  OutcomeMode,
  RoundHistoryItem,
  SEAT_CONFIG,
  SeatId,
} from '../engine/teenPatti';
import {
  deleteAdminCoinIcon,
  downloadDatabaseBackup,
  fetchAdminOverview,
  fetchAdminStatus,
  loginAdmin,
  resetAdminConfig,
  resetAdminStats,
  resolveCoinIconSrc,
  saveAdminConfig,
  saveApiBase,
  ServerPlayerRecord,
  ServerStats,
  setupAdminPassword,
  updateAdminPlayer,
  uploadAdminCoinIcon,
} from '../utils/api';

type DashboardTab = 'seats' | 'elements' | 'analytics' | 'server';
export type DashboardLang = 'en' | 'ar';

interface AdminDashboardProps {
  open: boolean;
  standalone?: boolean;
  config: GameControlConfig;
  balance: number;
  roundNumber: number;
  phase: string;
  timeLeft: number;
  userBets: Record<SeatId, number>;
  pots: Record<SeatId, number>;
  stats: ServerStats;
  history: RoundHistoryItem[];
  apiBase: string;
  serverConnected: boolean;
  adminToken: string | null;
  onAdminTokenChange: (token: string | null) => void;
  onApiBaseChange: (nextBase: string) => void;
  onChangeConfig: (updater: (prev: GameControlConfig) => GameControlConfig) => void;
  onSyncServerState: (payload: {
    config?: GameControlConfig;
    stats?: ServerStats;
    history?: RoundHistoryItem[];
    currentRoundNumber?: number;
  }) => void;
  onSetBalance: (val: number) => void;
  onRevealNow: () => void;
  onResetStats: () => void;
  onResetDefaults: () => void;
  onOpenStandaloneAdmin?: () => void;
  onBackToGame?: () => void;
  onClose?: () => void;
}

const SEATS: SeatId[] = ['A', 'B', 'C'];

const DICT = {
  en: {
    title: 'Admin Control Dashboard',
    subtitle: 'Teen Patti Royal · Live Odds, Coin Icon, Server DB',
    round: 'Round',
    betting: 'Betting',
    reveal: 'Reveal',
    flipping: 'Flipping',
    connecting: 'Connecting',
    revealNow: 'Reveal Now',
    tabSeats: 'Seats & Odds',
    tabElements: 'Game Elements',
    tabAnalytics: 'Analytics',
    tabServer: 'Server & DB',
    serverOnline: 'Server DB Connected',
    serverOffline: 'Offline Local Mode',
    signOut: 'Sign Out',
    backToGame: 'Back to Game',
    openFullPage: 'Open /admin',
    // Auth Gate
    authSetupTitle: 'First-Run Admin Setup',
    authSetupDesc:
      'Create an admin password to secure your Teen Patti server database, odds controls, and custom coin icon uploads.',
    authLoginTitle: 'Admin Sign In',
    authLoginDesc:
      'Enter your admin password to manage win/loss rates, multipliers, coin currency icon, and server players.',
    passwordLabel: 'Admin Password',
    confirmPasswordLabel: 'Confirm Password',
    passwordPlaceholder: 'Minimum 6 characters...',
    setupBtn: 'Create Admin Password & Unlock',
    loginBtn: 'Sign In to Dashboard',
    passwordMismatch: 'Passwords do not match.',
    passwordTooShort: 'Password must be at least 6 characters.',
    offlineAuthNotice:
      'Backend server is unreachable at the configured API URL. You can enter a remote Server URL below or continue in local preview mode.',
    continueLocalBtn: 'Continue in Local Preview Mode',
    remoteServerUrl: 'Remote Game Server URL (optional)',
    applyServerUrl: 'Connect',
    // Seats tab
    outcomeModeTitle: 'Round Outcome Mode',
    modeWeighted: 'Custom Win Rates %',
    modeWeightedDesc: 'Applies your exact win/loss slider percentages',
    modeFair: 'Fair Random',
    modeFairDesc: 'Pure 52-card shuffle (~33.3% each)',
    modeLowest: 'House Profit',
    modeLowestDesc: 'Lowest player payout seat wins',
    modeHighest: 'Player Friendly',
    modeHighestDesc: 'Highest player bet seat wins',
    seatControlTitle: 'Manual Win / Loss Rates & Multipliers (A / B / C)',
    seatControlHint:
      'Set each seat win rate manually from 0% to 100% (players can bet on max 2 seats). Setting 0% means no win!',
    presetZero: '0% (No Win)',
    presetBalanced: 'Balanced 33%',
    presetFocusA: 'Focus A (60%)',
    presetFocusB: 'Focus B (60%)',
    presetFocusC: 'Focus C (60%)',
    zeroWinBanner: 'All seats are 0% — Players cannot win while manual mode is active.',
    winRate: 'Win Rate',
    lossRate: 'Loss Rate',
    multiplier: 'Multiplier',
    normalized: 'Manual Win',
    showMultOnBoard: 'Show Multiplier on A / B / C Boxes',
    showMultDesc: 'Display ×2.9 / ×3 directly on seat headers',
    forceWinnerTitle: 'Manual Winner Override',
    randomMode: 'Automatic',
    lockForced: 'Lock forced winner for all upcoming rounds',
    forcedActive: 'Next round winner forced to Seat',
    // Elements tab
    coinIconTitle: 'Custom Coin Currency Icon',
    coinIconDesc:
      'Replace the default seashell coin icon across the game footer, Top Up shop, and Win banner. Supports PNG, JPEG, or WebP (max 512 KB).',
    uploadCoinBtn: 'Upload Coin Image',
    uploading: 'Uploading...',
    resetCoinBtn: 'Reset Default Pearl',
    coinUpdated: 'Coin icon updated across the game!',
    coinReset: 'Restored default pearl coin icon.',
    coinInvalidType: 'Please choose a PNG, JPEG, or WebP image file.',
    coinTooLarge: 'Image must be smaller than 512 KB.',
    chipsTitle: 'Betting Chips (4 Values)',
    timersTitle: 'Round Timers',
    bettingSeconds: 'Betting Countdown (sec)',
    revealSeconds: 'Reveal Hold (sec)',
    botsTitle: 'Live Table Bots',
    botsDesc: 'Simulated table players betting into pots',
    botLow: 'Low',
    botMedium: 'Medium',
    botHigh: 'High',
    profileTitle: 'Default Player Display & Balance',
    playerName: 'Player Name',
    playerId: 'User ID',
    currentBalance: 'Current Balance',
    // Analytics tab
    kpiRounds: 'Rounds Played',
    kpiWagered: 'Total Wagered',
    kpiPayouts: 'Total Payouts',
    kpiNetProfit: 'House Net Profit',
    exposureTitle: 'Current Round Exposure',
    betLabel: 'Bet',
    potLabel: 'Pot',
    actualVsTarget: 'Actual vs Target Win Rates',
    winsLabel: 'wins',
    playersTitle: 'Server Players Database',
    refreshPlayers: 'Refresh',
    noPlayersYet: 'No players recorded in server database yet.',
    colPlayer: 'Player',
    colStatus: 'Status',
    colRounds: 'Rounds',
    colWinLoss: 'W / L',
    colBalance: 'Balance',
    online: 'Online',
    offline: 'Idle',
    saveBal: 'Save',
    resetStatsBtn: 'Reset Analytics',
    // Server & DB tab
    serverStatusTitle: 'Server & Database Connection',
    dbEngine: 'Database Engine',
    dbEngineValue: 'Persistent Server JSON DB (Pluggable ITeenPattiDatabase)',
    downloadBackup: 'Download DB Backup (.json)',
    externalDeployTitle: 'External Standalone Dashboard URL',
    externalDeployDesc:
      'Host this Admin Dashboard on any separate domain (Vercel, Netlify, Cloudflare) and connect it securely to your Teen Patti Game Server.',
    directAdminUrl: 'Current /admin Dashboard URL',
    copyBtn: 'Copy',
    copiedBtn: 'Copied',
    envSnippetTitle: 'External Dashboard .env Configuration',
    apiEndpointsTitle: 'REST API & Database Adapter Guide',
    resetAllDefaults: 'Restore Default Settings',
    savingToServer: 'Synced with server DB',
  },
  ar: {
    title: 'لوحة تحكم اللعبة',
    subtitle: 'Teen Patti Royal · النسب، أيقونة العملة، قاعدة البيانات',
    round: 'جولة',
    betting: 'رهان',
    reveal: 'النتيجة',
    flipping: 'كشف الورق',
    connecting: 'اتصال',
    revealNow: 'كشف الآن',
    tabSeats: 'النسب والضرب',
    tabElements: 'عناصر اللعبة',
    tabAnalytics: 'الإحصائيات',
    tabServer: 'الخادم والقاعدة',
    serverOnline: 'متصل بقاعدة بيانات السيرفر',
    serverOffline: 'وضع محلي (بدون سيرفر)',
    signOut: 'تسجيل الخروج',
    backToGame: 'العودة للعبة',
    openFullPage: 'فتح /admin',
    // Auth Gate
    authSetupTitle: 'إعداد كلمة مرور الأدمن لأول مرة',
    authSetupDesc:
      'قم بإنشاء كلمة مرور لحماية لوحة التحكم وقاعدة بيانات السيرفر وتغيير أيقونة العملة ونسب المكسب والخسارة.',
    authLoginTitle: 'تسجيل دخول لوحة التحكم',
    authLoginDesc:
      'أدخل كلمة مرور الأدمن للتحكم في نسب المكسب والخسارة وأيقونة العملة ومتابعة اللاعبين على السيرفر.',
    passwordLabel: 'كلمة مرور الأدمن',
    confirmPasswordLabel: 'تأكيد كلمة المرور',
    passwordPlaceholder: '6 أحرف على الأقل...',
    setupBtn: 'إنشاء كلمة المرور والدخول',
    loginBtn: 'دخول للوحة التحكم',
    passwordMismatch: 'كلمتا المرور غير متطابقتين.',
    passwordTooShort: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.',
    offlineAuthNotice:
      'تعذر الاتصال بسيرفر اللعبة على الرابط المحدد. يمكنك إدخال رابط سيرفر خارجي بالأسفل أو المتابعة في الوضع المحلي.',
    continueLocalBtn: 'المتابعة في الوضع المحلي',
    remoteServerUrl: 'رابط سيرفر اللعبة الخارجي (اختياري)',
    applyServerUrl: 'اتصال',
    // Seats tab
    outcomeModeTitle: 'وضع تحديد النتيجة',
    modeWeighted: 'نسب مخصصة %',
    modeWeightedDesc: 'تطبيق نسب المكسب والخسارة التي تحددها بدقة',
    modeFair: 'عشوائي عادل',
    modeFairDesc: 'توزيع عشوائي طبيعي (~33.3% لكل مقعد)',
    modeLowest: 'ربح البيت',
    modeLowestDesc: 'فوز المقعد الأقل تكلفة على اللعبة',
    modeHighest: 'صديق اللاعب',
    modeHighestDesc: 'فوز المقعد صاحب أعلى رهان من اللاعب',
    seatControlTitle: 'نسب المكسب والخسارة اليدوية ومعامل الضرب (A / B / C)',
    seatControlHint:
      'حدد نسبة المكسب يدوياً لكل مقعد من 0% إلى 100% (اللاعب يراهن على مقعدين فقط كحد أقصى). وضع 0% يعني لا يوجد مكسب!',
    presetZero: '0% (بدون مكسب)',
    presetBalanced: 'متوازن 33%',
    presetFocusA: 'تركيز A (60%)',
    presetFocusB: 'تركيز B (60%)',
    presetFocusC: 'تركيز C (60%)',
    zeroWinBanner: 'جميع المقاعد مضبوطة على 0% — لا يوجد مكسب للاعبين حالياً.',
    winRate: 'نسبة المكسب',
    lossRate: 'نسبة الخسارة',
    multiplier: 'معامل الضرب',
    normalized: 'المكسب اليدوي',
    showMultOnBoard: 'إظهار معامل الضرب على A / B / C',
    showMultDesc: 'عرض ×2.9 أو ×3 مباشرة أعلى صناديق الرهان',
    forceWinnerTitle: 'تحديد الفائز يدوياً',
    randomMode: 'تلقائي',
    lockForced: 'تثبيت الفائز المختار لجميع الجولات القادمة',
    forcedActive: 'الفائز المحدد للجولة القادمة: الكرسي',
    // Elements tab
    coinIconTitle: 'تغيير صورة أيقونة العملة (الكوينز)',
    coinIconDesc:
      'ارفع صورة مخصصة لتغيير أيقونة الصدفة في رصيد اللعبة ومتجر الشحن وكارت الفوز. يدعم PNG و JPEG و WebP (حد أقصى 512 كيلوبايت).',
    uploadCoinBtn: 'رفع صورة عملة جديدة',
    uploading: 'جاري الرفع...',
    resetCoinBtn: 'استعادة الصدفة الأصلية',
    coinUpdated: 'تم تحديث أيقونة العملة في اللعبة بالكامل!',
    coinReset: 'تمت استعادة أيقونة الصدفة الأصلية.',
    coinInvalidType: 'يرجى اختيار صورة بصيغة PNG أو JPEG أو WebP فقط.',
    coinTooLarge: 'حجم الصورة يجب أن يكون أقل من 512 كيلوبايت.',
    chipsTitle: 'قيم الفيشات الأربعة',
    timersTitle: 'مؤقتات الجولة',
    bettingSeconds: 'وقت الرهان (ثانية)',
    revealSeconds: 'مدة عرض النتيجة (ثانية)',
    botsTitle: 'لاعبو الطاولة التلقائيون (Bots)',
    botsDesc: 'رهانات حية تلقائية داخل الـ Pot',
    botLow: 'هادئ',
    botMedium: 'متوسط',
    botHigh: 'سريع',
    profileTitle: 'بيانات اللاعب والرصيد',
    playerName: 'اسم اللاعب',
    playerId: 'رقم المستخدم ID',
    currentBalance: 'الرصيد الحالي',
    // Analytics tab
    kpiRounds: 'الجولات المسجلة',
    kpiWagered: 'إجمالي الرهانات',
    kpiPayouts: 'إجمالي المدفوعات',
    kpiNetProfit: 'صافي ربح البيت',
    exposureTitle: 'رهانات الجولة الحالية',
    betLabel: 'الرهان',
    potLabel: 'الـ Pot',
    actualVsTarget: 'المقارنة: الفوز الفعلي مقابل النسبة المستهدفة',
    winsLabel: 'فوز',
    playersTitle: 'اللاعبون المسجلون في قاعدة البيانات',
    refreshPlayers: 'تحديث',
    noPlayersYet: 'لا يوجد لاعبون مسجلون في قاعدة البيانات بعد.',
    colPlayer: 'اللاعب',
    colStatus: 'الحالة',
    colRounds: 'الجولات',
    colWinLoss: 'فوز / خسارة',
    colBalance: 'الرصيد',
    online: 'متصل',
    offline: 'غير نشط',
    saveBal: 'حفظ',
    resetStatsBtn: 'تصفير الإحصائيات',
    // Server & DB tab
    serverStatusTitle: 'حالة السيرفر وقاعدة البيانات',
    dbEngine: 'محرك قاعدة البيانات',
    dbEngineValue: 'قاعدة بيانات دائمة على السيرفر (قابلة للربط بـ PostgreSQL / MySQL)',
    downloadBackup: 'تحميل نسخة قاعدة البيانات (.json)',
    externalDeployTitle: 'رفع الداش بورد على رابط خارجي مستقل',
    externalDeployDesc:
      'يمكن للمبرمج رفع هذه اللوحة على دومين منفصل (Vercel أو Netlify) وربطها مباشرة بسيرفر اللعبة عبر الـ API.',
    directAdminUrl: 'رابط صفحة الأدمن المباشر (/admin)',
    copyBtn: 'نسخ',
    copiedBtn: 'تم النسخ',
    envSnippetTitle: 'إعدادات البيئة (.env) للربط الخارجي',
    apiEndpointsTitle: 'دليل الـ REST API وربط قاعدة البيانات',
    resetAllDefaults: 'استعادة جميع الإعدادات الافتراضية',
    savingToServer: 'متزامن مع قاعدة بيانات السيرفر',
  },
} as const;

const LANG_STORAGE_KEY = 'teen_patti_dashboard_lang';

function loadInitialLang(): DashboardLang {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    // ignore
  }
  return 'en';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  open,
  standalone = false,
  config,
  balance,
  roundNumber,
  phase,
  timeLeft,
  userBets,
  pots,
  stats,
  apiBase,
  serverConnected,
  adminToken,
  onAdminTokenChange,
  onApiBaseChange,
  onChangeConfig,
  onSyncServerState,
  onSetBalance,
  onRevealNow,
  onResetStats,
  onResetDefaults,
  onOpenStandaloneAdmin,
  onBackToGame,
  onClose,
}) => {
  const [lang, setLang] = useState<DashboardLang>(loadInitialLang);
  const [activeTab, setActiveTab] = useState<DashboardTab>('seats');

  // Auth states
  const [authChecked, setAuthChecked] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [backendReachable, setBackendReachable] = useState(serverConnected);
  const [localBypass, setLocalBypass] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Remote API URL editor
  const [apiInput, setApiInput] = useState(apiBase);

  // Server Players & Sync states
  const [players, setPlayers] = useState<ServerPlayerRecord[]>([]);
  const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null);
  const [editingBalanceVal, setEditingBalanceVal] = useState<string>('');
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Coin Icon Upload states
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [coinUploading, setCoinUploading] = useState(false);
  const [coinMessage, setCoinMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Copy states
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const t = DICT[lang];
  const isRtl = lang === 'ar';

  const handleToggleLang = (nextLang: DashboardLang) => {
    setLang(nextLang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, nextLang);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    setApiInput(apiBase);
  }, [apiBase]);

  // Check admin auth status on open / apiBase change
  const checkAuthStatus = useCallback(async () => {
    setAuthError(null);
    try {
      const status = await fetchAdminStatus(apiBase);
      setSetupRequired(status.setupRequired);
      setBackendReachable(true);
    } catch {
      setBackendReachable(false);
    } finally {
      setAuthChecked(true);
    }
  }, [apiBase]);

  useEffect(() => {
    if (!open && !standalone) return;
    checkAuthStatus();
  }, [open, standalone, checkAuthStatus]);

  // Fetch server admin overview when authenticated
  const refreshAdminOverview = useCallback(async () => {
    if (!adminToken || !backendReachable) return;
    try {
      const overview = await fetchAdminOverview(apiBase, adminToken);
      setPlayers(overview.players);
      onSyncServerState({
        config: overview.config,
        stats: overview.stats,
        history: overview.history,
        currentRoundNumber: overview.currentRoundNumber,
      });
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 401) {
        onAdminTokenChange(null);
      }
    }
  }, [adminToken, backendReachable, apiBase, onSyncServerState, onAdminTokenChange]);

  useEffect(() => {
    if (!adminToken || !backendReachable || (!open && !standalone)) return;
    refreshAdminOverview();
    const interval = window.setInterval(refreshAdminOverview, 8000);
    return () => window.clearInterval(interval);
  }, [adminToken, backendReachable, open, standalone, refreshAdminOverview]);

  // Debounced server config save
  const saveTimerRef = useRef<number | null>(null);
  const persistConfigToServer = useCallback(
    (nextConfig: GameControlConfig) => {
      if (!adminToken || !backendReachable) return;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(async () => {
        try {
          await saveAdminConfig(apiBase, adminToken, nextConfig);
          setSyncNotice(t.savingToServer);
          window.setTimeout(() => setSyncNotice(null), 1500);
        } catch (err) {
          const status = (err as Error & { status?: number }).status;
          if (status === 401) {
            onAdminTokenChange(null);
          }
        }
      }, 220);
    },
    [adminToken, backendReachable, apiBase, t.savingToServer, onAdminTokenChange]
  );

  const updateConfig = useCallback(
    (updater: (prev: GameControlConfig) => GameControlConfig) => {
      onChangeConfig((prev) => {
        const next = updater(prev);
        persistConfigToServer(next);
        return next;
      });
    },
    [onChangeConfig, persistConfigToServer]
  );

  if (!open && !standalone) return null;

  const isUnlocked = Boolean(adminToken) || (!backendReachable && localBypass);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (password.trim().length < 6) {
      setAuthError(t.passwordTooShort);
      return;
    }
    if (setupRequired && password !== confirmPassword) {
      setAuthError(t.passwordMismatch);
      return;
    }

    setAuthLoading(true);
    try {
      const res = setupRequired
        ? await setupAdminPassword(apiBase, password.trim())
        : await loginAdmin(apiBase, password.trim());
      onAdminTokenChange(res.token);
      setSetupRequired(false);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleApplyApiUrl = () => {
    const cleaned = saveApiBase(apiInput);
    onApiBaseChange(cleaned);
    setLocalBypass(false);
  };

  // Coin icon upload handler (validates PNG/JPEG/WebP, max 512KB, uploads to server DB or local blob fallback)
  const handleCoinFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setCoinMessage(null);
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedMimes.includes(file.type)) {
      setCoinMessage({ type: 'err', text: t.coinInvalidType });
      return;
    }
    if (file.size > 512 * 1024) {
      setCoinMessage({ type: 'err', text: t.coinTooLarge });
      return;
    }

    setCoinUploading(true);
    try {
      if (adminToken && backendReachable) {
        const arrayBuf = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const res = await uploadAdminCoinIcon(apiBase, adminToken, base64);
        onChangeConfig((prev) => ({ ...prev, coinIconUrl: res.coinIconUrl }));
        setCoinMessage({ type: 'ok', text: t.coinUpdated });
      } else {
        // Static/local preview fallback using object URL
        const blobUrl = URL.createObjectURL(file);
        onChangeConfig((prev) => ({ ...prev, coinIconUrl: blobUrl }));
        setCoinMessage({ type: 'ok', text: t.coinUpdated });
      }
    } catch (err) {
      setCoinMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Upload failed',
      });
    } finally {
      setCoinUploading(false);
    }
  };

  const handleResetCoinIcon = async () => {
    setCoinMessage(null);
    setCoinUploading(true);
    try {
      if (adminToken && backendReachable) {
        const res = await deleteAdminCoinIcon(apiBase, adminToken);
        onChangeConfig((prev) => ({ ...prev, coinIconUrl: res.coinIconUrl }));
      } else {
        onChangeConfig((prev) => ({ ...prev, coinIconUrl: DEFAULT_COIN_ICON }));
      }
      setCoinMessage({ type: 'ok', text: t.coinReset });
    } catch (err) {
      setCoinMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Reset failed',
      });
    } finally {
      setCoinUploading(false);
    }
  };

  const handleResetServerStats = async () => {
    onResetStats();
    if (adminToken && backendReachable) {
      try {
        const res = await resetAdminStats(apiBase, adminToken);
        onSyncServerState({ stats: res.stats });
      } catch {
        // ignore
      }
    }
  };

  const handleResetAllDefaults = async () => {
    onResetDefaults();
    if (adminToken && backendReachable) {
      try {
        const res = await resetAdminConfig(apiBase, adminToken);
        onSyncServerState({ config: res.config });
      } catch {
        // ignore
      }
    }
  };

  const handleSavePlayerBalance = async (playerId: string) => {
    if (!adminToken || !backendReachable) return;
    const num = Number(editingBalanceVal);
    if (!Number.isFinite(num) || num < 0) return;
    try {
      const res = await updateAdminPlayer(apiBase, adminToken, playerId, {
        balance: Math.floor(num),
      });
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? res.player : p))
      );
      setEditingBalanceId(null);
    } catch {
      // ignore
    }
  };

  const handleCopyText = (key: string, value: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1600);
  };

  const probs = getNormalizedWinProbs(config.winRates);
  const netHouseProfit = stats.totalWagered - stats.totalPayouts;
  const resolvedCoinPreview = resolveCoinIconSrc(config.coinIconUrl, apiBase);
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-game-server.com';
  const adminDirectUrl = `${currentOrigin}/admin`;
  const envSnippet = `# Deploy standalone Admin Dashboard on Vercel / Netlify
VITE_APP_MODE=admin
VITE_API_BASE_URL=${apiBase || currentOrigin}

# On your Teen Patti Game Server (.env)
ADMIN_DASHBOARD_PASSWORD=your-strong-secret-password
CORS_ORIGINS=https://your-external-admin-url.vercel.app
DATABASE_FILE=teen-patti-db.json`;

  const containerClass = standalone
    ? 'w-full max-w-[920px] min-h-[92dvh] max-h-[96dvh] bg-[#0d1117] text-[#e6edf3] border border-[#2d3748] rounded-xl flex flex-col overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.75)]'
    : 'w-full max-w-[440px] lg:w-[435px] h-full lg:h-[95dvh] lg:max-h-[780px] bg-[#0d1117] text-[#e6edf3] border-l lg:border border-[#2d3748] lg:rounded-[10px] flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.75)]';

  return (
    <aside
      dir={isRtl ? 'rtl' : 'ltr'}
      aria-label={t.title}
      className={containerClass}
    >
      {/* ================= TOP HEADER ================= */}
      <div className="px-4 py-3 bg-gradient-to-r from-[#161b22] via-[#1c2330] to-[#161b22] border-b border-[#2d3748] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f59e0b] to-[#b45309] flex items-center justify-center shadow-md shrink-0">
            <Sliders className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-bold text-white leading-tight truncate">
              {t.title}
            </h2>
            <p className="text-[11px] text-[#94a3b8] leading-tight truncate">
              {t.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* EN | AR Language Switcher */}
          <div
            className="inline-flex items-center rounded-lg bg-[#0d1117] border border-[#30363d] p-0.5"
            role="group"
            aria-label="Dashboard Language"
          >
            <button
              type="button"
              onClick={() => handleToggleLang('en')}
              className={`px-2 py-1 rounded-md text-[10.5px] font-bold transition-colors cursor-pointer ${
                lang === 'en'
                  ? 'bg-amber-500 text-[#0d1117]'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => handleToggleLang('ar')}
              className={`px-2 py-1 rounded-md text-[10.5px] font-bold transition-colors cursor-pointer ${
                lang === 'ar'
                  ? 'bg-amber-500 text-[#0d1117]'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              عربي
            </button>
          </div>

          {standalone && onBackToGame && (
            <button
              type="button"
              onClick={onBackToGame}
              className="px-2.5 py-1.5 rounded-lg bg-[#1f2937] hover:bg-[#374151] text-[11px] font-semibold text-amber-300 border border-amber-500/30 cursor-pointer transition-colors"
            >
              {t.backToGame}
            </button>
          )}

          {!standalone && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Dashboard"
              className="w-8 h-8 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ================= STATUS BAR ================= */}
      <div className="px-4 py-2 bg-[#121720] border-b border-[#21262d] flex flex-wrap items-center justify-between gap-2 text-[11.5px] shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold border ${
              backendReachable
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                backendReachable ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            {backendReachable ? t.serverOnline : t.serverOffline}
          </span>

          {!standalone && (
            <span className="text-[#cbd5e1] tabular-nums">
              {t.round} <strong className="text-amber-400">#{roundNumber}</strong> ·{' '}
              {phase === 'BETTING'
                ? `${t.betting} (${timeLeft}s)`
                : phase === 'REVEAL'
                ? t.reveal
                : phase === 'FLIPPING'
                ? t.flipping
                : t.connecting}
            </span>
          )}

          {syncNotice && (
            <span className="text-[10.5px] text-emerald-400 font-semibold">
              ✓ {syncNotice}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!standalone && isUnlocked && (
            <button
              type="button"
              onClick={onRevealNow}
              disabled={phase !== 'BETTING'}
              className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 text-amber-300 border border-amber-500/40 font-semibold flex items-center gap-1 cursor-pointer transition-colors text-[11px]"
            >
              <Zap className="w-3.5 h-3.5" />
              {t.revealNow}
            </button>
          )}

          {adminToken && (
            <button
              type="button"
              onClick={() => onAdminTokenChange(null)}
              title={t.signOut}
              className="px-2 py-1 rounded-md bg-[#1f2937] hover:bg-red-900/40 text-[#cbd5e1] hover:text-red-300 border border-[#30363d] text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:inline">{t.signOut}</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= AUTH GATE (WHEN LOCKED) ================= */}
      {!isUnlocked ? (
        <div className="flex-1 overflow-y-auto p-5 flex flex-col justify-center">
          <div className="max-w-[380px] w-full mx-auto space-y-4">
            <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-white">
                    {setupRequired ? t.authSetupTitle : t.authLoginTitle}
                  </h3>
                  <p className="text-[11.5px] text-[#94a3b8] leading-snug mt-0.5">
                    {setupRequired ? t.authSetupDesc : t.authLoginDesc}
                  </p>
                </div>
              </div>

              {backendReachable ? (
                <form onSubmit={handleAuthSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[11.5px] font-semibold text-[#cbd5e1] mb-1">
                      {t.passwordLabel}
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.passwordPlaceholder}
                      autoComplete={setupRequired ? 'new-password' : 'current-password'}
                      className="w-full px-3 py-2 rounded-lg bg-[#0d1117] border border-[#30363d] text-[13px] text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {setupRequired && (
                    <div>
                      <label className="block text-[11.5px] font-semibold text-[#cbd5e1] mb-1">
                        {t.confirmPasswordLabel}
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t.passwordPlaceholder}
                        autoComplete="new-password"
                        className="w-full px-3 py-2 rounded-lg bg-[#0d1117] border border-[#30363d] text-[13px] text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  )}

                  {authError && (
                    <div className="px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-[12px] font-medium">
                      {authError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading || !authChecked}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 disabled:opacity-50 text-[#0d1117] font-extrabold text-[13px] cursor-pointer transition-all"
                  >
                    {authLoading ? '...' : setupRequired ? t.setupBtn : t.loginBtn}
                  </button>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/35 text-amber-200 text-[12px] leading-relaxed">
                    {t.offlineAuthNotice}
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocalBypass(true)}
                    className="w-full py-2.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-white border border-[#30363d] font-bold text-[12.5px] cursor-pointer transition-colors"
                  >
                    {t.continueLocalBtn}
                  </button>
                </div>
              )}
            </div>

            {/* External Game Server Connector */}
            <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3.5 space-y-2">
              <label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#94a3b8]">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                {t.remoteServerUrl}
              </label>
              <div className="flex gap-2" dir="ltr">
                <input
                  type="url"
                  value={apiInput}
                  onChange={(e) => setApiInput(e.target.value)}
                  placeholder="https://your-game-server.com"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-[12px] text-white focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={handleApplyApiUrl}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[12px] font-bold cursor-pointer shrink-0"
                >
                  {t.applyServerUrl}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ================= NAVIGATION TABS ================= */}
          <div className="grid grid-cols-4 bg-[#161b22] border-b border-[#2d3748] p-1 gap-1 shrink-0">
            {[
              { id: 'seats' as const, label: t.tabSeats, icon: Crown },
              { id: 'elements' as const, label: t.tabElements, icon: Coins },
              { id: 'analytics' as const, label: t.tabAnalytics, icon: BarChart3 },
              { id: 'server' as const, label: t.tabServer, icon: Database },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1.5 rounded-lg text-[11px] sm:text-[12px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all truncate ${
                    active
                      ? 'bg-[#2563eb] text-white shadow-sm'
                      : 'text-[#94a3b8] hover:text-white hover:bg-[#21262d]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ================= SCROLLABLE TAB BODY ================= */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4 history-scroll">
            {/* ==================== TAB 1: SEATS & ODDS ==================== */}
            {activeTab === 'seats' && (
              <>
                {/* Outcome Mode Selector */}
                <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-amber-300">
                    <Sparkles className="w-4 h-4" />
                    {t.outcomeModeTitle}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'weighted', title: t.modeWeighted, desc: t.modeWeightedDesc },
                        { id: 'fair', title: t.modeFair, desc: t.modeFairDesc },
                        { id: 'lowest_bet', title: t.modeLowest, desc: t.modeLowestDesc },
                        { id: 'highest_bet', title: t.modeHighest, desc: t.modeHighestDesc },
                      ] as { id: OutcomeMode; title: string; desc: string }[]
                    ).map((m) => {
                      const selected = config.outcomeMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            updateConfig((prev) => ({ ...prev, outcomeMode: m.id }))
                          }
                          className={`p-2 rounded-lg border text-start transition-all cursor-pointer ${
                            selected
                              ? 'bg-[#1d4ed8]/25 border-[#3b82f6] text-white'
                              : 'bg-[#0d1117] border-[#262c36] text-[#94a3b8] hover:border-[#475569]'
                          }`}
                        >
                          <div className="text-[12px] font-bold">{m.title}</div>
                          <div className="text-[10.5px] opacity-80 leading-tight mt-0.5">
                            {m.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Per-Seat Win/Loss Rates & Multipliers */}
                <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3 space-y-3">
                  <div>
                    <h3 className="text-[13px] font-bold text-white">
                      {t.seatControlTitle}
                    </h3>
                    <p className="text-[11px] text-[#94a3b8] mt-0.5">
                      {t.seatControlHint}
                    </p>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: t.presetZero, rates: { A: 0, B: 0, C: 0 }, danger: true },
                      { label: t.presetBalanced, rates: { A: 33.3, B: 33.3, C: 33.4 }, danger: false },
                      { label: t.presetFocusA, rates: { A: 60, B: 20, C: 20 }, danger: false },
                      { label: t.presetFocusB, rates: { A: 20, B: 60, C: 20 }, danger: false },
                      { label: t.presetFocusC, rates: { A: 20, B: 20, C: 60 }, danger: false },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          updateConfig((prev) => ({
                            ...prev,
                            outcomeMode: 'weighted',
                            winRates: preset.rates,
                          }))
                        }
                        className={`px-2 py-1 rounded-md text-[10.5px] font-semibold border cursor-pointer ${
                          preset.danger
                            ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/40'
                            : 'bg-[#21262d] hover:bg-[#30363d] text-[#cbd5e1] border-[#30363d]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {config.outcomeMode === 'weighted' &&
                    probs.A + probs.B + probs.C === 0 && (
                      <div className="px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[11.5px] font-semibold">
                        {t.zeroWinBanner}
                      </div>
                    )}

                  {/* Individual Seat Cards */}
                  <div className="space-y-2.5">
                    {SEATS.map((seat) => {
                      const info = SEAT_CONFIG[seat];
                      const exactWin = probs[seat];
                      const lossRate = Math.max(0, 100 - exactWin);
                      const mult = config.multipliers[seat];

                      return (
                        <div
                          key={seat}
                          className="rounded-lg bg-[#0d1117] border border-[#262c36] p-2.5 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <img
                                src={info.throneImg}
                                alt={info.name}
                                className="w-7 h-7 object-contain"
                              />
                              <div>
                                <div className="text-[12.5px] font-bold text-white leading-tight">
                                  {lang === 'ar' ? info.arabicName : info.name}
                                </div>
                                <div className="text-[10.5px] text-[#94a3b8] tabular-nums">
                                  {t.normalized}:{' '}
                                  <span
                                    className={`font-bold ${
                                      exactWin > 0 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    {exactWin.toFixed(1)}%
                                  </span>{' '}
                                  · {t.lossRate}:{' '}
                                  <span className="text-rose-400 font-bold">
                                    {lossRate.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Independent Multiplier Control */}
                            <div className="flex items-center gap-1 bg-[#161b22] border border-[#30363d] rounded-md px-2 py-1">
                              <span className="text-[10.5px] text-[#94a3b8]">
                                {t.multiplier}
                              </span>
                              <input
                                type="number"
                                step="0.1"
                                min="1.1"
                                max="20"
                                value={mult}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  if (!Number.isNaN(v)) {
                                    updateConfig((prev) => ({
                                      ...prev,
                                      multipliers: {
                                        ...prev.multipliers,
                                        [seat]: Math.max(1.1, Math.min(20, v)),
                                      },
                                    }));
                                  }
                                }}
                                className="w-12 bg-transparent text-amber-300 font-extrabold text-[12.5px] text-center focus:outline-none tabular-nums"
                                dir="ltr"
                              />
                              <span className="text-[11px] font-bold text-amber-400">×</span>
                            </div>
                          </div>

                          {/* Manual Win Rate Input + Slider (0% - 100%) */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-[#94a3b8]">{t.winRate} (0–100%)</span>
                              <div className="flex items-center gap-1 bg-[#161b22] border border-[#30363d] rounded px-1.5 py-0.5" dir="ltr">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.5}
                                  value={exactWin}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const parsed = raw === '' ? 0 : parseFloat(raw);
                                    if (!Number.isNaN(parsed)) {
                                      const clamped = Math.max(0, Math.min(100, parsed));
                                      updateConfig((prev) => ({
                                        ...prev,
                                        outcomeMode: 'weighted',
                                        winRates: {
                                          ...prev.winRates,
                                          [seat]: clamped,
                                        },
                                      }));
                                    }
                                  }}
                                  className="w-14 bg-transparent text-white font-extrabold text-[12px] text-center focus:outline-none tabular-nums"
                                />
                                <span className="text-[11px] font-bold text-[#94a3b8]">%</span>
                              </div>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={0.5}
                              value={exactWin}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                updateConfig((prev) => ({
                                  ...prev,
                                  outcomeMode: 'weighted',
                                  winRates: {
                                    ...prev.winRates,
                                    [seat]: val,
                                  },
                                }));
                              }}
                              className="w-full accent-amber-400 cursor-pointer"
                            />
                            <div className="h-1.5 w-full rounded-full bg-[#21262d] overflow-hidden">
                              <div
                                className={`h-full ${info.barClass} transition-all duration-200`}
                                style={{ width: `${Math.min(100, exactWin)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Show Multiplier on Board Toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#262c36]">
                    <div>
                      <div className="text-[12px] font-bold text-white">
                        {t.showMultOnBoard}
                      </div>
                      <div className="text-[10.5px] text-[#94a3b8]">{t.showMultDesc}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={config.showMultipliersOnBoard}
                      onClick={() =>
                        updateConfig((prev) => ({
                          ...prev,
                          showMultipliersOnBoard: !prev.showMultipliersOnBoard,
                        }))
                      }
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
                        config.showMultipliersOnBoard ? 'bg-emerald-500' : 'bg-[#30363d]'
                      }`}
                    >
                      <span
                        className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          config.showMultipliersOnBoard
                            ? isRtl
                              ? '-translate-x-5'
                              : 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Manual Winner Override */}
                <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3 space-y-2.5">
                  <div className="text-[12.5px] font-bold text-white flex items-center justify-between">
                    <span>{t.forceWinnerTitle}</span>
                    {config.forceNextWinner && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {t.forcedActive} {config.forceNextWinner}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        updateConfig((prev) => ({
                          ...prev,
                          forceNextWinner: null,
                          lockForcedWinner: false,
                        }))
                      }
                      className={`py-2 rounded-lg text-[11.5px] font-bold border cursor-pointer transition-colors ${
                        config.forceNextWinner === null
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : 'bg-[#0d1117] text-[#94a3b8] border-[#262c36]'
                      }`}
                    >
                      {t.randomMode}
                    </button>
                    {SEATS.map((seat) => (
                      <button
                        key={seat}
                        type="button"
                        onClick={() =>
                          updateConfig((prev) => ({ ...prev, forceNextWinner: seat }))
                        }
                        className={`py-2 rounded-lg text-[12px] font-extrabold border cursor-pointer transition-colors ${
                          config.forceNextWinner === seat
                            ? 'bg-amber-500 text-[#0d1117] border-amber-300'
                            : 'bg-[#0d1117] text-[#cbd5e1] border-[#262c36] hover:border-amber-500/50'
                        }`}
                      >
                        Seat {seat}
                      </button>
                    ))}
                  </div>
                  {config.forceNextWinner && (
                    <button
                      type="button"
                      onClick={() =>
                        updateConfig((prev) => ({
                          ...prev,
                          lockForcedWinner: !prev.lockForcedWinner,
                        }))
                      }
                      className={`w-full py-1.5 px-3 rounded-lg border text-[11.5px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                        config.lockForcedWinner
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                          : 'bg-[#0d1117] border-[#262c36] text-[#94a3b8]'
                      }`}
                    >
                      {config.lockForcedWinner ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5" />
                      )}
                      {t.lockForced}
                    </button>
                  )}
                </div>
              </>
            )}

            {/* ==================== TAB 2: GAME ELEMENTS ==================== */}
            {activeTab === 'elements' && (
              <>
                {/* CUSTOM COIN ICON UPLOADER */}
                <div className="rounded-xl bg-[#161b22] border border-amber-500/35 p-3.5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[13px] font-bold text-amber-300 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4" />
                        {t.coinIconTitle}
                      </h3>
                      <p className="text-[11px] text-[#94a3b8] leading-relaxed mt-0.5">
                        {t.coinIconDesc}
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-xl bg-[#0d1117] border-2 border-amber-500/40 flex items-center justify-center p-2 shrink-0 shadow-inner">
                      <img
                        src={resolvedCoinPreview}
                        alt="Active Coin Icon"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleCoinFileChange}
                    className="hidden"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={coinUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-[#0d1117] font-extrabold text-[12px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {coinUploading ? t.uploading : t.uploadCoinBtn}
                    </button>
                    <button
                      type="button"
                      disabled={coinUploading}
                      onClick={handleResetCoinIcon}
                      className="py-2 px-3 rounded-lg bg-[#21262d] hover:bg-[#30363d] disabled:opacity-50 text-[#cbd5e1] border border-[#30363d] font-bold text-[12px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t.resetCoinBtn}
                    </button>
                  </div>

                  {coinMessage && (
                    <div
                      className={`px-3 py-2 rounded-lg text-[11.5px] font-semibold border ${
                        coinMessage.type === 'ok'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-red-500/15 border-red-500/40 text-red-300'
                      }`}
                    >
                      {coinMessage.text}
                    </div>
                  )}
                </div>

                {/* 4 Betting Chips */}
                <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3 space-y-2.5">
                  <div className="text-[12.5px] font-bold text-white flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-400" />
                    {t.chipsTitle}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {config.chipValues.map((val, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg bg-[#0d1117] border border-[#262c36] p-2 flex items-center justify-between gap-2"
                      >
                        <span className="text-[11px] font-bold text-[#94a3b8]">
                          #{idx + 1}
                        </span>
                        <input
                          type="number"
                          min={100}
                          step={100}
                          value={val}
                          onChange={(e) => {
                            const num = parseInt(e.target.value, 10);
                            if (!Number.isNaN(num) && num >= 100) {
                              updateConfig((prev) => {
                                const nextChips = [...prev.chipValues] as [
                                  number,
                                  number,
                                  number,
                                  number
                                ];
                                nextChips[idx] = num;
                                return { ...prev, chipValues: nextChips };
                              });
                            }
                          }}
                          dir="ltr"
                          className="w-24 bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-right text-[12px] font-bold text-amber-300 tabular-nums focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timers */}
                <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3 space-y-3">
                  <div className="text-[12.5px] font-bold text-white flex items-center gap-1.5">
                    <Timer className="w-4 h-4 text-cyan-400" />
                    {t.timersTitle}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11.5px]">
                      <span className="text-[#94a3b8]">{t.bettingSeconds}</span>
                      <span className="font-bold text-white tabular-nums">
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
                        updateConfig((prev) => ({
                          ...prev,
                          roundDuration: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11.5px]">
                      <span className="text-[#94a3b8]">{t.revealSeconds}</span>
                      <span className="font-bold text-white tabular-nums">
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
                        updateConfig((prev) => ({
                          ...prev,
                          revealDuration: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Live Table Bots */}
                <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[12.5px] font-bold text-white flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-purple-400" />
                        {t.botsTitle}
                      </div>
                      <div className="text-[10.5px] text-[#94a3b8]">{t.botsDesc}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={config.botsEnabled}
                      onClick={() =>
                        updateConfig((prev) => ({
                          ...prev,
                          botsEnabled: !prev.botsEnabled,
                        }))
                      }
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
                        config.botsEnabled ? 'bg-emerald-500' : 'bg-[#30363d]'
                      }`}
                    >
                      <span
                        className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          config.botsEnabled
                            ? isRtl
                              ? '-translate-x-5'
                              : 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  {config.botsEnabled && (
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'low', label: t.botLow },
                          { id: 'medium', label: t.botMedium },
                          { id: 'high', label: t.botHigh },
                        ] as { id: BotActivityLevel; label: string }[]
                      ).map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() =>
                            updateConfig((prev) => ({ ...prev, botActivity: lvl.id }))
                          }
                          className={`py-1.5 rounded-md text-[11.5px] font-bold cursor-pointer border ${
                            config.botActivity === lvl.id
                              ? 'bg-purple-600 text-white border-purple-400'
                              : 'bg-[#0d1117] text-[#94a3b8] border-[#262c36]'
                          }`}
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Player Profile & Balance */}
                <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3 space-y-2.5">
                  <div className="text-[12.5px] font-bold text-white flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-400" />
                    {t.profileTitle}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10.5px] text-[#94a3b8] mb-1">
                        {t.playerName}
                      </label>
                      <input
                        type="text"
                        value={config.playerName}
                        onChange={(e) =>
                          updateConfig((prev) => ({
                            ...prev,
                            playerName: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-[12px] text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] text-[#94a3b8] mb-1">
                        {t.playerId}
                      </label>
                      <input
                        type="text"
                        value={config.userId}
                        onChange={(e) =>
                          updateConfig((prev) => ({
                            ...prev,
                            userId: e.target.value,
                          }))
                        }
                        dir="ltr"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-[12px] text-white tabular-nums focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                  {!standalone && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11.5px] text-[#94a3b8]">
                        {t.currentBalance}:{' '}
                        <strong className="text-amber-300 tabular-nums">
                          {balance.toLocaleString('en-US')}
                        </strong>
                      </span>
                      <div className="flex gap-1">
                        {[100_000, 1_000_000].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => onSetBalance(amt)}
                            className="px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[10.5px] font-bold text-emerald-300 border border-[#30363d] cursor-pointer"
                          >
                            {formatCoins(amt)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ==================== TAB 3: ANALYTICS & PLAYERS ==================== */}
            {activeTab === 'analytics' && (
              <>
                {/* 4 Live KPI Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3">
                    <div className="text-[10.5px] text-[#94a3b8]">{t.kpiRounds}</div>
                    <div className="text-[18px] font-extrabold text-white tabular-nums mt-0.5">
                      {stats.roundsPlayed}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3">
                    <div className="text-[10.5px] text-[#94a3b8]">{t.kpiWagered}</div>
                    <div className="text-[18px] font-extrabold text-amber-300 tabular-nums mt-0.5">
                      {formatCoins(stats.totalWagered)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3">
                    <div className="text-[10.5px] text-[#94a3b8]">{t.kpiPayouts}</div>
                    <div className="text-[18px] font-extrabold text-cyan-300 tabular-nums mt-0.5">
                      {formatCoins(stats.totalPayouts)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3">
                    <div className="text-[10.5px] text-[#94a3b8]">{t.kpiNetProfit}</div>
                    <div
                      className={`text-[18px] font-extrabold tabular-nums mt-0.5 ${
                        netHouseProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {netHouseProfit >= 0 ? '+' : '-'}
                      {formatCoins(Math.abs(netHouseProfit))}
                    </div>
                  </div>
                </div>

                {/* Current Round Exposure */}
                {!standalone && (
                  <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3 space-y-2">
                    <div className="text-[12px] font-bold text-white">
                      {t.exposureTitle}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {SEATS.map((seat) => (
                        <div
                          key={seat}
                          className="rounded-lg bg-[#0d1117] border border-[#262c36] p-2 text-center"
                        >
                          <div className="text-[12px] font-bold text-amber-300">
                            Seat {seat}
                          </div>
                          <div className="text-[11px] text-[#cbd5e1] tabular-nums mt-0.5">
                            {t.betLabel}: {formatCoins(userBets[seat])}
                          </div>
                          <div className="text-[10px] text-[#94a3b8] tabular-nums">
                            {t.potLabel}: {formatCoins(pots[seat])}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actual vs Target Win Rates */}
                <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3 space-y-2.5">
                  <div className="text-[12px] font-bold text-white">
                    {t.actualVsTarget}
                  </div>
                  {SEATS.map((seat) => {
                    const wins = stats.seatWins[seat] || 0;
                    const actualPct =
                      stats.roundsPlayed > 0 ? (wins / stats.roundsPlayed) * 100 : 0;
                    const targetPct = probs[seat];
                    return (
                      <div key={seat} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-bold text-white">Seat {seat}</span>
                          <span className="text-[#94a3b8] tabular-nums">
                            {wins} {t.winsLabel} ({actualPct.toFixed(1)}%) · Target{' '}
                            {targetPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#0d1117] overflow-hidden">
                          <div
                            className={`h-full ${SEAT_CONFIG[seat].barClass}`}
                            style={{ width: `${Math.min(100, actualPct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Server Players Database Table */}
                <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[12.5px] font-bold text-white flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-cyan-400" />
                      {t.playersTitle} ({players.length})
                    </div>
                    {adminToken && backendReachable && (
                      <button
                        type="button"
                        onClick={refreshAdminOverview}
                        className="px-2 py-1 rounded-md bg-[#21262d] hover:bg-[#30363d] text-[11px] font-semibold text-[#cbd5e1] flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {t.refreshPlayers}
                      </button>
                    )}
                  </div>

                  {players.length === 0 ? (
                    <p className="text-[11.5px] text-[#94a3b8] py-3 text-center">
                      {t.noPlayersYet}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {players.map((p) => {
                        const isOnline = Date.now() - p.lastSeenAt < 35_000;
                        const isEditing = editingBalanceId === p.id;
                        const winRate =
                          p.totalRounds > 0
                            ? Math.round((p.winsCount / p.totalRounds) * 100)
                            : 0;
                        return (
                          <div
                            key={p.id}
                            className="rounded-lg bg-[#0d1117] border border-[#262c36] p-2.5 flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                      isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                                    }`}
                                  />
                                  <span className="text-[12.5px] font-bold text-white truncate">
                                    {p.name}
                                  </span>
                                  <span className="text-[10px] text-[#64748b] tabular-nums">
                                    ({p.id.slice(0, 10)})
                                  </span>
                                </div>
                                <div className="text-[10.5px] text-[#94a3b8] tabular-nums mt-0.5">
                                  {t.colRounds}: {p.totalRounds} · {t.colWinLoss}:{' '}
                                  <span className="text-emerald-400">{p.winsCount}</span> /{' '}
                                  <span className="text-rose-400">{p.lossesCount}</span> (
                                  {winRate}%)
                                </div>
                              </div>

                              {isEditing ? (
                                <div className="flex items-center gap-1" dir="ltr">
                                  <input
                                    type="number"
                                    min={0}
                                    value={editingBalanceVal}
                                    onChange={(e) => setEditingBalanceVal(e.target.value)}
                                    className="w-24 px-2 py-1 rounded bg-[#161b22] border border-amber-400 text-[11.5px] text-white tabular-nums"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSavePlayerBalance(p.id)}
                                    className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                                  >
                                    {t.saveBal}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBalanceId(p.id);
                                    setEditingBalanceVal(String(p.balance));
                                  }}
                                  className="px-2.5 py-1 rounded-md bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] text-amber-300 font-extrabold text-[12px] tabular-nums cursor-pointer"
                                >
                                  {formatCoins(p.balance)}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleResetServerStats}
                  className="w-full py-2 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-rose-300 border border-rose-500/30 text-[12px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t.resetStatsBtn}
                </button>
              </>
            )}

            {/* ==================== TAB 4: SERVER & EXTERNAL DB ==================== */}
            {activeTab === 'server' && (
              <>
                {/* Server & DB Status */}
                <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13px] font-bold text-white flex items-center gap-1.5">
                      <Server className="w-4 h-4 text-emerald-400" />
                      {t.serverStatusTitle}
                    </div>
                    {!standalone && onOpenStandaloneAdmin && (
                      <button
                        type="button"
                        onClick={onOpenStandaloneAdmin}
                        className="px-2.5 py-1 rounded-md bg-[#2563eb]/20 hover:bg-[#2563eb]/35 text-blue-300 border border-blue-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {t.openFullPage}
                      </button>
                    )}
                  </div>

                  <div className="rounded-lg bg-[#0d1117] border border-[#262c36] p-2.5 text-[11.5px] space-y-1">
                    <div className="text-[#94a3b8]">{t.dbEngine}</div>
                    <div className="font-semibold text-emerald-300">{t.dbEngineValue}</div>
                  </div>

                  {/* Remote API Base URL */}
                  <div className="space-y-1.5">
                    <label className="block text-[11.5px] font-semibold text-[#cbd5e1]">
                      {t.remoteServerUrl}
                    </label>
                    <div className="flex gap-2" dir="ltr">
                      <input
                        type="url"
                        value={apiInput}
                        onChange={(e) => setApiInput(e.target.value)}
                        placeholder={currentOrigin}
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-[12px] text-white focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        type="button"
                        onClick={handleApplyApiUrl}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[12px] font-bold cursor-pointer shrink-0"
                      >
                        {t.applyServerUrl}
                      </button>
                    </div>
                  </div>

                  {adminToken && backendReachable && (
                    <button
                      type="button"
                      onClick={() => downloadDatabaseBackup(apiBase, adminToken)}
                      className="w-full py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[12px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {t.downloadBackup}
                    </button>
                  )}
                </div>

                {/* External Standalone Deployment Guide */}
                <div className="rounded-xl bg-[#161b22] border border-[#2d3748] p-3.5 space-y-3">
                  <div>
                    <h3 className="text-[13px] font-bold text-amber-300 flex items-center gap-1.5">
                      <Globe className="w-4 h-4" />
                      {t.externalDeployTitle}
                    </h3>
                    <p className="text-[11px] text-[#94a3b8] leading-relaxed mt-0.5">
                      {t.externalDeployDesc}
                    </p>
                  </div>

                  {/* Direct /admin URL */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-[#cbd5e1]">
                      {t.directAdminUrl}
                    </div>
                    <div className="flex items-center gap-1.5" dir="ltr">
                      <code className="flex-1 min-w-0 truncate px-2.5 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-[11.5px] text-cyan-300">
                        {adminDirectUrl}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopyText('adminUrl', adminDirectUrl)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedKey === 'adminUrl' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiedKey === 'adminUrl' ? t.copiedBtn : t.copyBtn}
                      </button>
                    </div>
                  </div>

                  {/* Copyable .env snippet */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#cbd5e1]">
                        {t.envSnippetTitle}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyText('env', envSnippet)}
                        className="text-[11px] font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === 'env' ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        {copiedKey === 'env' ? t.copiedBtn : t.copyBtn}
                      </button>
                    </div>
                    <pre
                      dir="ltr"
                      className="p-2.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-[10.5px] text-[#cbd5e1] overflow-x-auto leading-relaxed font-mono"
                    >
                      {envSnippet}
                    </pre>
                  </div>

                  {/* Developer REST API & DB Adapter Reference */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-[#cbd5e1]">
                      {t.apiEndpointsTitle}
                    </div>
                    <div
                      dir="ltr"
                      className="p-2.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-[10.5px] text-[#94a3b8] font-mono space-y-1"
                    >
                      <div>GET  /api/config · POST /api/rounds/resolve</div>
                      <div>GET  /api/admin/overview · PUT /api/admin/config</div>
                      <div>POST /api/admin/coin-icon · DELETE /api/admin/coin-icon</div>
                      <div>PUT  /api/admin/players/:id · GET /api/admin/export</div>
                      <div className="text-emerald-400 pt-1">
                        DB Adapter: src/server/db.ts (ITeenPattiDatabase)
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ================= FOOTER ================= */}
          <div className="px-4 py-2.5 bg-[#161b22] border-t border-[#2d3748] flex items-center justify-between gap-2 shrink-0">
            <span className="text-[11px] text-[#94a3b8] flex items-center gap-1">
              <Languages className="w-3.5 h-3.5" />
              {lang === 'en' ? 'English (Default)' : 'العربية'}
            </span>
            <button
              type="button"
              onClick={handleResetAllDefaults}
              className="px-2.5 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#cbd5e1] border border-[#30363d] text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              {t.resetAllDefaults}
            </button>
          </div>
        </>
      )}
    </aside>
  );
};
