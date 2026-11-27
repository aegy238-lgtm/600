import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import 'dotenv/config';
import { db } from './src/server/db.ts';
import type { BetOption } from './src/server/db.ts';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Ephemeral HMAC signing secret (falls back to cryptographically strong random bytes in memory)
const SESSION_SECRET = process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

const WHEEL_SLICES: Array<{ index: number; option: BetOption }> = [
  { index: 0, option: 'plum' },
  { index: 1, option: 'watermelon' },
  { index: 2, option: 'plum' },
  { index: 3, option: 'seven' },
  { index: 4, option: 'watermelon' },
  { index: 5, option: 'plum' },
  { index: 6, option: 'watermelon' },
  { index: 7, option: 'plum' },
  { index: 8, option: 'watermelon' },
];

const MULTIPLIERS: Record<BetOption, number> = {
  watermelon: 2,
  seven: 8,
  plum: 2,
};

// ---------------- Auth Token Helpers ----------------

function signAdminToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ role: 'admin', exp: Date.now() + TOKEN_TTL_MS })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  if (!payload || !sig) return false;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return decoded.role === 'admin' && typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const bufA = crypto.createHash('sha256').update(a).digest();
  const bufB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(bufA, bufB);
}

function getEnvAdminPassword(): string | null {
  const raw = process.env.ADMIN_DASHBOARD_PASSWORD?.trim();
  return raw && raw.length > 0 ? raw : null;
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Invalid or expired admin session' });
    return;
  }
  next();
}

// ---------------- Input Sanitization Helpers ----------------

const PLAYER_ID_REGEX = /^[a-zA-Z0-9_-]{4,64}$/;

function sanitizePlayerId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return PLAYER_ID_REGEX.test(trimmed) ? trimmed : null;
}

function sanitizePlayerName(raw: unknown): string {
  if (typeof raw !== 'string') return 'Player';
  const cleaned = raw.replace(/[<>]/g, '').trim().slice(0, 24);
  return cleaned || 'Player';
}

function sanitizeBets(raw: unknown): Record<BetOption, number> {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const cleanNum = (v: unknown) => {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(100_000_000, Math.floor(n));
  };
  return {
    watermelon: cleanNum(obj.watermelon),
    seven: cleanNum(obj.seven),
    plum: cleanNum(obj.plum),
  };
}

// ---------------- CORS Configuration (Explicit Allowlist, No Wildcard on Auth) ----------------

function parseAllowedOrigins(): Set<string> {
  const set = new Set<string>();
  const envOrigins = process.env.CORS_ORIGINS || '';
  for (const item of envOrigins.split(',')) {
    const clean = item.trim().replace(/\/$/, '');
    if (clean && /^https?:\/\//i.test(clean)) {
      set.add(clean);
    }
  }
  if (process.env.APP_URL) {
    set.add(process.env.APP_URL.trim().replace(/\/$/, ''));
  }
  return set;
}

function isOriginAllowed(origin: string | undefined, reqHost: string | undefined): boolean {
  if (!origin) return true; // Same-origin non-CORS request
  const normalized = origin.replace(/\/$/, '');
  const allowlist = parseAllowedOrigins();
  if (allowlist.has(normalized)) return true;

  // Allow same host (HTTP/HTTPS)
  if (reqHost) {
    try {
      const parsed = new URL(normalized);
      if (parsed.host === reqHost) return true;
      if (
        !IS_PROD &&
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

// ---------------- Controlled Win/Loss Spin Engine (0% - 100%) ----------------

function resolveControlledSpin(
  bets: Record<BetOption, number>,
  winRatePct: number,
  lucky77BonusChance: number
): {
  winningSliceIndex: number;
  winningOption: BetOption;
  bonusOption: BetOption | null;
  outcome: 'win' | 'loss' | 'no_bet';
} {
  const totalCost = bets.watermelon + bets.seven + bets.plum;
  const allOptions: BetOption[] = ['watermelon', 'seven', 'plum'];

  if (totalCost <= 0) {
    const slice = WHEEL_SLICES[Math.floor(Math.random() * WHEEL_SLICES.length)];
    const bonusOption: BetOption | null =
      slice.option === 'seven' && Math.random() * 100 < lucky77BonusChance
        ? Math.random() < 0.5
          ? 'watermelon'
          : 'plum'
        : null;
    return {
      winningSliceIndex: slice.index,
      winningOption: slice.option,
      bonusOption,
      outcome: 'no_bet',
    };
  }

  const betOptions = allOptions.filter((opt) => bets[opt] > 0);
  const unbetOptions = allOptions.filter((opt) => bets[opt] === 0);

  // Clamp winRatePct strictly to 0..100
  const rate = Math.max(0, Math.min(100, winRatePct));
  const shouldPlayerWin = rate === 100 ? true : rate === 0 ? false : Math.random() * 100 < rate;

  let chosenOption: BetOption;

  if (shouldPlayerWin) {
    // Pick among the options the player bet on (favoring highest-return or weighted by wheel slices)
    const matchingSlices = WHEEL_SLICES.filter((s) => betOptions.includes(s.option));
    const slice = matchingSlices[Math.floor(Math.random() * matchingSlices.length)];
    chosenOption = slice.option;
    const bonusOption: BetOption | null =
      chosenOption === 'seven' && Math.random() * 100 < lucky77BonusChance
        ? Math.random() < 0.5
          ? 'watermelon'
          : 'plum'
        : null;
    return {
      winningSliceIndex: slice.index,
      winningOption: chosenOption,
      bonusOption,
      outcome: 'win',
    };
  } else {
    // Player loses: pick an option the player did NOT bet on (or lowest payout option if all 3 bet)
    if (unbetOptions.length > 0) {
      const losingSlices = WHEEL_SLICES.filter((s) => unbetOptions.includes(s.option));
      const slice = losingSlices[Math.floor(Math.random() * losingSlices.length)];
      return {
        winningSliceIndex: slice.index,
        winningOption: slice.option,
        bonusOption: null,
        outcome: 'loss',
      };
    }

    // Player hedged all 3 boxes: pick whichever option returns the smallest payout
    const sortedByPayout = [...allOptions].sort(
      (a, b) => bets[a] * MULTIPLIERS[a] - bets[b] * MULTIPLIERS[b]
    );
    chosenOption = sortedByPayout[0];
    const slices = WHEEL_SLICES.filter((s) => s.option === chosenOption);
    const slice = slices[Math.floor(Math.random() * slices.length)];
    const payout = bets[chosenOption] * MULTIPLIERS[chosenOption];
    return {
      winningSliceIndex: slice.index,
      winningOption: chosenOption,
      bonusOption: null,
      outcome: payout >= totalCost ? 'win' : 'loss',
    };
  }
}

// ---------------- Express App & Routes ----------------

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '64kb' }));

  // Basic security headers for API responses
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // In-memory brute-force rate limiter for admin auth routes
  const authAttempts = new Map<string, { count: number; resetAt: number }>();
  const AUTH_WINDOW_MS = 15 * 60 * 1000;
  const AUTH_MAX_ATTEMPTS = 12;

  const checkAdminRateLimit = (req: Request, res: Response): boolean => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = authAttempts.get(ip);
    if (record && record.resetAt > now && record.count >= AUTH_MAX_ATTEMPTS) {
      res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
      return false;
    }
    return true;
  };

  const recordFailedAdminAttempt = (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = authAttempts.get(ip);
    if (!record || record.resetAt <= now) {
      authAttempts.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    } else {
      record.count += 1;
    }
  };

  const clearAdminAttempts = (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    authAttempts.delete(ip);
  };

  // Scoped CORS middleware for external standalone dashboard support
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    const reqHost = req.headers['x-forwarded-host']?.toString() || req.headers.host;
    if (origin && isOriginAllowed(origin, reqHost)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // ---- Public Game API ----

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.get('/api/config', (_req, res) => {
    res.json({
      settings: db.getSettings(),
      currentRoundNumber: db.getCurrentRoundNumber(),
      history: db.getGlobalHistory(),
    });
  });

  app.post('/api/players/heartbeat', (req, res) => {
    const playerId = sanitizePlayerId(req.body?.playerId);
    if (!playerId) {
      res.status(400).json({ error: 'Invalid playerId' });
      return;
    }
    const name = sanitizePlayerName(req.body?.name);
    const existing = db.getPlayer(playerId);
    // Server owns balance after initial player creation; new players start at default 100,000 coins
    const authoritativeBalance = existing ? existing.balance : 100000;

    const player = db.upsertPlayerHeartbeat({ id: playerId, name, balance: authoritativeBalance });
    res.json({
      player,
      settings: db.getSettings(),
    });
  });

  app.post('/api/players/reset', (req, res) => {
    const playerId = sanitizePlayerId(req.body?.playerId);
    if (!playerId) {
      res.status(400).json({ error: 'Invalid playerId' });
      return;
    }
    const name = sanitizePlayerName(req.body?.name);
    const player = db.upsertPlayerHeartbeat({
      id: playerId,
      name,
      balance: 100000,
    });
    res.json({ player });
  });

  const ALLOWED_REFILL_PACKS = new Set([10000, 100000, 500000, 1000000]);

  app.post('/api/players/refill', (req, res) => {
    const playerId = sanitizePlayerId(req.body?.playerId);
    if (!playerId) {
      res.status(400).json({ error: 'Invalid playerId' });
      return;
    }
    const name = sanitizePlayerName(req.body?.name);
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || !ALLOWED_REFILL_PACKS.has(Math.floor(amount))) {
      res.status(400).json({ error: 'Invalid refill pack amount' });
      return;
    }
    const existing = db.getPlayer(playerId);
    const currentBal = existing ? existing.balance : 100000;
    const player = db.upsertPlayerHeartbeat({
      id: playerId,
      name,
      balance: Math.min(1_000_000_000, currentBal + Math.floor(amount)),
    });
    res.json({ player });
  });

  app.post('/api/rounds/resolve', (req, res) => {
    const playerId = sanitizePlayerId(req.body?.playerId);
    if (!playerId) {
      res.status(400).json({ error: 'Invalid playerId' });
      return;
    }
    const playerName = sanitizePlayerName(req.body?.playerName);
    const bets = sanitizeBets(req.body?.bets);
    const roundNumber =
      typeof req.body?.roundNumber === 'number' && Number.isFinite(req.body.roundNumber)
        ? Math.max(1, Math.floor(req.body.roundNumber))
        : db.getCurrentRoundNumber();

    const settings = db.getSettings();
    const existingPlayer = db.getPlayer(playerId);
    const serverBalanceBeforeBet = existingPlayer ? existingPlayer.balance : 100000;
    const totalCost = bets.watermelon + bets.seven + bets.plum;

    if (totalCost > serverBalanceBeforeBet) {
      res.status(400).json({ error: 'Insufficient balance for requested bets' });
      return;
    }

    const effectiveWinRate =
      existingPlayer && existingPlayer.customWinRate !== null
        ? existingPlayer.customWinRate
        : settings.winRate;

    const spin = resolveControlledSpin(bets, effectiveWinRate, settings.lucky77BonusChance);

    let totalWin = bets[spin.winningOption] * MULTIPLIERS[spin.winningOption];
    if (spin.bonusOption) {
      totalWin += bets[spin.bonusOption] * MULTIPLIERS[spin.bonusOption];
    }

    const finalBalance = Math.min(1_000_000_000, serverBalanceBeforeBet - totalCost + totalWin);
    const recorded = db.recordRound({
      roundNumber,
      playerId,
      playerName,
      bets,
      winningOption: spin.winningOption,
      bonusOption: spin.bonusOption,
      winningSliceIndex: spin.winningSliceIndex,
      totalCost,
      totalWin,
      netPlayerProfit: totalWin - totalCost,
      appliedWinRate: effectiveWinRate,
      outcome: spin.outcome,
      newBalance: finalBalance,
    });

    res.json({
      winningSliceIndex: spin.winningSliceIndex,
      winningOption: spin.winningOption,
      bonusOption: spin.bonusOption,
      totalCost,
      totalWin,
      newBalance: recorded.player.balance,
      history: recorded.history,
      nextRoundNumber: recorded.roundNumber,
    });
  });

  // ---- Admin Authentication Routes ----

  app.get('/api/admin/status', (_req, res) => {
    const envConfigured = getEnvAdminPassword() !== null;
    const claimed = db.getAdminPasswordHash() !== null;
    res.json({
      needsSetup: !envConfigured && !claimed,
      envManaged: envConfigured,
    });
  });

  app.post('/api/admin/setup', (req, res) => {
    if (!checkAdminRateLimit(req, res)) return;
    if (getEnvAdminPassword() !== null) {
      res.status(409).json({ error: 'Admin password is managed by server environment variable' });
      return;
    }
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
      return;
    }
    const claimed = db.claimAdminPasswordHash(password);
    if (!claimed) {
      recordFailedAdminAttempt(req);
      res.status(409).json({ error: 'Admin password has already been initialized' });
      return;
    }
    clearAdminAttempts(req);
    res.json({ ok: true, token: signAdminToken() });
  });

  app.post('/api/admin/login', (req, res) => {
    if (!checkAdminRateLimit(req, res)) return;
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password) {
      res.status(400).json({ error: 'Password is required' });
      return;
    }
    const envPass = getEnvAdminPassword();
    let valid = false;
    if (envPass !== null) {
      valid = constantTimeStringEqual(password, envPass);
    } else {
      valid = db.verifyClaimedAdminPassword(password);
    }

    if (!valid) {
      recordFailedAdminAttempt(req);
      res.status(401).json({ error: 'Invalid admin password' });
      return;
    }
    clearAdminAttempts(req);
    res.json({ ok: true, token: signAdminToken() });
  });

  // ---- Protected Admin Dashboard API ----

  app.get('/api/admin/overview', requireAdminAuth, (_req, res) => {
    const players = db.listPlayers();
    const roundLogs = db.getRoundLogs(80);
    const settings = db.getSettings();
    const now = Date.now();
    const onlineThresholdMs = 35_000;

    let totalWagered = 0;
    let totalWon = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let onlineCount = 0;

    const enrichedPlayers = players.map((p) => {
      const isOnline = now - p.lastSeenAt <= onlineThresholdMs;
      if (isOnline) onlineCount += 1;
      totalWagered += p.totalWagered;
      totalWon += p.totalWon;
      totalWins += p.winsCount;
      totalLosses += p.lossesCount;
      return {
        ...p,
        isOnline,
      };
    });

    const totalPlayedRounds = totalWins + totalLosses;
    const realizedWinRate =
      totalPlayedRounds > 0 ? Number(((totalWins / totalPlayedRounds) * 100).toFixed(1)) : 0;

    res.json({
      settings,
      kpis: {
        onlinePlayers: onlineCount,
        totalPlayers: players.length,
        totalWagered,
        totalPayouts: totalWon,
        houseProfit: totalWagered - totalWon,
        totalPlayedRounds,
        realizedWinRate,
        realizedLossRate: totalPlayedRounds > 0 ? Number((100 - realizedWinRate).toFixed(1)) : 0,
      },
      players: enrichedPlayers,
      roundLogs,
      currentRoundNumber: db.getCurrentRoundNumber(),
    });
  });

  app.put('/api/admin/settings', requireAdminAuth, (req, res) => {
    const { winRate, lucky77BonusChance, bettingDurationSec } = req.body ?? {};
    const patch: {
      winRate?: number;
      lucky77BonusChance?: number;
      bettingDurationSec?: number;
    } = {};

    if (winRate !== undefined) {
      const n = Number(winRate);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        res.status(400).json({ error: 'winRate must be a number between 0 and 100' });
        return;
      }
      patch.winRate = Math.round(n);
    }

    if (lucky77BonusChance !== undefined) {
      const n = Number(lucky77BonusChance);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        res.status(400).json({ error: 'lucky77BonusChance must be between 0 and 100' });
        return;
      }
      patch.lucky77BonusChance = Math.round(n);
    }

    if (bettingDurationSec !== undefined) {
      const n = Number(bettingDurationSec);
      if (!Number.isFinite(n) || n < 5 || n > 30) {
        res.status(400).json({ error: 'bettingDurationSec must be between 5 and 30' });
        return;
      }
      patch.bettingDurationSec = Math.round(n);
    }

    const updated = db.updateSettings(patch);
    res.json({ settings: updated });
  });

  app.put('/api/admin/players/:playerId', requireAdminAuth, (req, res) => {
    const playerId = sanitizePlayerId(req.params.playerId);
    if (!playerId) {
      res.status(400).json({ error: 'Invalid playerId' });
      return;
    }

    const patch: { balance?: number; customWinRate?: number | null; name?: string } = {};
    if (req.body?.balance !== undefined) {
      const bal = Number(req.body.balance);
      if (!Number.isFinite(bal) || bal < 0 || bal > 1_000_000_000) {
        res.status(400).json({ error: 'Invalid balance' });
        return;
      }
      patch.balance = Math.floor(bal);
    }
    if (req.body?.customWinRate !== undefined) {
      if (req.body.customWinRate === null || req.body.customWinRate === '') {
        patch.customWinRate = null;
      } else {
        const rate = Number(req.body.customWinRate);
        if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
          res.status(400).json({ error: 'customWinRate must be 0..100 or null' });
          return;
        }
        patch.customWinRate = Math.round(rate);
      }
    }
    if (typeof req.body?.name === 'string') {
      patch.name = sanitizePlayerName(req.body.name);
    }

    const updated = db.updatePlayerAdmin(playerId, patch);
    if (!updated) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    res.json({ player: updated });
  });

  app.delete('/api/admin/players/:playerId', requireAdminAuth, (req, res) => {
    const playerId = sanitizePlayerId(req.params.playerId);
    if (!playerId) {
      res.status(400).json({ error: 'Invalid playerId' });
      return;
    }
    const ok = db.deletePlayer(playerId);
    if (!ok) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/admin/export', requireAdminAuth, (_req, res) => {
    const snapshot = db.exportAll();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="lucky-wheel-db-export.json"');
    res.send(JSON.stringify(snapshot, null, 2));
  });

  // ---- Frontend Serving (Vite Dev Middleware or Static Dist) ----

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lucky Fruit Wheel 77 server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
