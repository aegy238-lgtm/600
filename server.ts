import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { dealRoundHands, MAX_BET_SEATS_PER_ROUND, SeatId } from './src/engine/teenPatti.ts';
import { createDatabase } from './src/server/db.ts';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Ephemeral in-memory signing secret if SESSION_SECRET is not provided
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_UPLOAD_BYTES = 512 * 1024; // 512 KB max for custom coin icon
const ALLOWED_TOPUP_PACKS = new Set([10_000, 50_000, 200_000, 1_000_000]);

const db = createDatabase();

// ================= PASSWORD HASHING & VERIFICATION =================

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPasswordHash(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hexKey] = parts;
  const expectedBuf = Buffer.from(hexKey, 'hex');
  const actualBuf = crypto.scryptSync(password, salt, 64);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

function getEnvAdminPassword(): string | null {
  const val = process.env.ADMIN_DASHBOARD_PASSWORD;
  if (typeof val === 'string' && val.trim().length > 0) {
    return val.trim();
  }
  return null;
}

function isAdminSetupRequired(): boolean {
  if (getEnvAdminPassword()) return false;
  return !db.getAdminPasswordHash();
}

function verifyAdminPassword(candidate: string): boolean {
  const envPass = getEnvAdminPassword();
  if (envPass) {
    const a = Buffer.from(candidate, 'utf-8');
    const b = Buffer.from(envPass, 'utf-8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
  const storedHash = db.getAdminPasswordHash();
  if (!storedHash) return false;
  return verifyPasswordHash(candidate, storedHash);
}

// ================= HMAC BEARER TOKENS =================

function issueAdminToken(): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = Buffer.from(
    JSON.stringify({ role: 'admin', exp: expiresAt, nonce })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return { token: `${payload}.${sig}`, expiresAt };
}

function verifyAdminToken(token: string): boolean {
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0 || dotIdx === token.length - 1) return false;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const a = Buffer.from(sig, 'utf-8');
  const b = Buffer.from(expectedSig, 'utf-8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      role?: string;
      exp?: number;
    };
    return decoded.role === 'admin' && typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

// ================= RATE LIMITER FOR AUTH ROUTES =================

const authAttempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 12;

function checkAuthRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    next();
    return;
  }
  if (entry.count >= AUTH_MAX_ATTEMPTS) {
    res.status(429).json({
      error: 'Too many authentication attempts. Please try again later.',
    });
    return;
  }
  entry.count += 1;
  next();
}

// ================= IMAGE MAGIC-BYTE VALIDATION =================

function detectValidatedImageMime(
  buf: Buffer
): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buf.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }

  // WEBP: RIFF....WEBP
  if (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

// ================= PLAYER ID VALIDATION =================

function sanitizePlayerId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^[a-zA-Z0-9_-]{3,48}$/.test(trimmed)) return null;
  return trimmed;
}

// ================= CORS ALLOWLIST =================

function getAllowedOrigins(): Set<string> {
  const raw = process.env.CORS_ORIGINS || '';
  const list = raw
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return new Set(list);
}

function isOriginAllowed(req: Request, origin: string): boolean {
  const normalized = origin.replace(/\/+$/, '');
  const allowed = getAllowedOrigins();
  if (allowed.has(normalized)) return true;

  // Allow same-host origin
  const hostHeader = (req.headers['x-forwarded-host'] || req.headers.host || '')
    .toString()
    .split(',')[0]
    .trim();
  if (hostHeader) {
    try {
      const parsed = new URL(normalized);
      if (parsed.host === hostHeader) return true;
    } catch {
      return false;
    }
  }
  return false;
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Invalid or expired admin session.' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Scoped CORS for /api/* (supports external standalone Admin Dashboard URL via CORS_ORIGINS)
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && isOriginAllowed(req, origin)) {
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

  // ================= PUBLIC GAME API =================

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      game: 'Teen Patti Royal',
      database: 'JsonFileTeenPattiDatabase',
      serverTime: new Date().toISOString(),
    });
  });

  app.get('/api/config', (_req, res) => {
    res.json({
      config: db.getConfig(),
      currentRoundNumber: db.getCurrentRoundNumber(),
      history: db.getHistory(),
      stats: db.getStats(),
    });
  });

  app.get('/api/assets/coin-icon', (_req, res) => {
    const iconFile = db.getUploadedCoinIconPath();
    if (!iconFile) {
      res.redirect(302, '/assets/hd/icon-pearl.png');
      return;
    }
    res.setHeader('Content-Type', iconFile.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(iconFile.filePath).pipe(res);
  });

  app.post('/api/players/heartbeat', (req, res) => {
    const playerId = sanitizePlayerId(req.body?.playerId);
    if (!playerId) {
      res.status(400).json({ error: 'Valid playerId is required.' });
      return;
    }
    const name = typeof req.body?.name === 'string' ? req.body.name : undefined;
    const player = db.upsertPlayerHeartbeat(playerId, name);
    res.json({
      player,
      config: db.getConfig(),
      currentRoundNumber: db.getCurrentRoundNumber(),
      history: db.getHistory(),
      stats: db.getStats(),
    });
  });

  app.post('/api/players/topup', (req, res) => {
    const playerId = sanitizePlayerId(req.body?.playerId);
    const amount = Number(req.body?.amount);
    if (!playerId || !ALLOWED_TOPUP_PACKS.has(amount)) {
      res.status(400).json({ error: 'Invalid playerId or top-up package amount.' });
      return;
    }
    const player = db.topUpPlayer(playerId, amount);
    res.json({ player });
  });

  app.post('/api/players/reset', (req, res) => {
    const playerId = sanitizePlayerId(req.body?.playerId);
    if (!playerId) {
      res.status(400).json({ error: 'Valid playerId is required.' });
      return;
    }
    const player = db.resetPlayerBalance(playerId, 100_000);
    res.json({ player });
  });

  app.post('/api/rounds/resolve', (req, res) => {
    const playerId = sanitizePlayerId(req.body?.playerId);
    if (!playerId) {
      res.status(400).json({ error: 'Valid playerId is required.' });
      return;
    }

    const rawBets = req.body?.bets as Partial<Record<SeatId, unknown>> | undefined;
    const bets: Record<SeatId, number> = {
      A: Math.max(0, Math.floor(Number(rawBets?.A) || 0)),
      B: Math.max(0, Math.floor(Number(rawBets?.B) || 0)),
      C: Math.max(0, Math.floor(Number(rawBets?.C) || 0)),
    };

    const activeBetSeats = (['A', 'B', 'C'] as SeatId[]).filter((s) => bets[s] > 0);
    if (activeBetSeats.length > MAX_BET_SEATS_PER_ROUND) {
      res.status(400).json({
        error: `You can only bet on up to ${MAX_BET_SEATS_PER_ROUND} seats per round.`,
      });
      return;
    }

    const playerName = typeof req.body?.playerName === 'string' ? req.body.playerName : undefined;
    const player = db.upsertPlayerHeartbeat(playerId, playerName);
    const totalBet = bets.A + bets.B + bets.C;

    if (!Number.isSafeInteger(totalBet) || totalBet > player.balance) {
      res.status(400).json({
        error: 'Insufficient balance for submitted bets.',
        balance: player.balance,
      });
      return;
    }

    const cfg = db.getConfig();
    const recentWinners = db
      .getHistory()
      .slice(0, 5)
      .map((item) => item.winner);
    const dealt = dealRoundHands({
      outcomeMode: cfg.outcomeMode,
      globalWinRate: cfg.globalWinRate,
      winRates: cfg.winRates,
      forceWinner: cfg.forceNextWinner,
      userBets: bets,
      multipliers: cfg.multipliers,
      recentWinners,
    });

    const winningSeat = dealt.winner;
    const seatMultiplier = cfg.multipliers[winningSeat];
    const betOnWinner = bets[winningSeat];
    const payout = betOnWinner > 0 ? Math.round(betOnWinner * seatMultiplier) : 0;

    const saved = db.recordRoundResolution({
      playerId,
      playerName,
      winner: winningSeat,
      winningRank: dealt.hands[winningSeat].rankName,
      userBetTotal: totalBet,
      payout,
      multiplierUsed: seatMultiplier,
      clearOneShotForcedWinner: true,
    });

    res.json({
      hands: dealt.hands,
      winner: winningSeat,
      seatMultiplier,
      totalBet,
      payout,
      newBalance: saved.player.balance,
      history: saved.history,
      nextRoundNumber: saved.nextRoundNumber,
      stats: saved.stats,
      config: saved.config,
    });
  });

  // ================= ADMIN AUTH API =================

  app.get('/api/admin/status', (_req, res) => {
    res.json({
      setupRequired: isAdminSetupRequired(),
      envManaged: Boolean(getEnvAdminPassword()),
    });
  });

  app.post('/api/admin/setup', checkAuthRateLimit, (req, res) => {
    if (!isAdminSetupRequired()) {
      res.status(409).json({
        error: 'Admin password is already configured. Please sign in instead.',
      });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({
        error: 'Password must be between 6 and 128 characters.',
      });
      return;
    }

    db.setAdminPasswordHash(hashPassword(password));
    const { token, expiresAt } = issueAdminToken();
    res.status(201).json({ token, expiresAt });
  });

  app.post('/api/admin/login', checkAuthRateLimit, (req, res) => {
    if (isAdminSetupRequired()) {
      res.status(409).json({
        error: 'Admin password has not been set up yet.',
        setupRequired: true,
      });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    if (!password || !verifyAdminPassword(password)) {
      res.status(401).json({ error: 'Incorrect admin password.' });
      return;
    }

    const { token, expiresAt } = issueAdminToken();
    res.json({ token, expiresAt });
  });

  // ================= PROTECTED ADMIN API =================

  app.get('/api/admin/overview', requireAdminAuth, (_req, res) => {
    res.json({
      config: db.getConfig(),
      stats: db.getStats(),
      players: db.listPlayers(),
      history: db.getHistory(),
      currentRoundNumber: db.getCurrentRoundNumber(),
      uploadedCoinIcon: db.getUploadedCoinIcon(),
    });
  });

  app.put('/api/admin/config', requireAdminAuth, (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      res.status(400).json({ error: 'Invalid config payload.' });
      return;
    }
    const updated = db.updateConfig(req.body);
    res.json({ config: updated });
  });

  app.post('/api/admin/config/reset', requireAdminAuth, (_req, res) => {
    const config = db.resetConfig();
    res.json({ config });
  });

  app.post('/api/admin/stats/reset', requireAdminAuth, (_req, res) => {
    const stats = db.resetStats();
    res.json({ stats });
  });

  app.post('/api/admin/coin-icon', requireAdminAuth, (req, res) => {
    const dataBase64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64.trim() : '';
    if (!dataBase64 || dataBase64.length > Math.ceil(MAX_UPLOAD_BYTES * 1.4)) {
      res.status(400).json({
        error: 'Image file is missing or exceeds the 512 KB maximum size.',
      });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(dataBase64, 'base64');
    } catch {
      res.status(400).json({ error: 'Invalid base64 image payload.' });
      return;
    }

    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
      res.status(400).json({
        error: 'Decoded image must be smaller than 512 KB.',
      });
      return;
    }

    const detectedMime = detectValidatedImageMime(buffer);
    if (!detectedMime) {
      res.status(400).json({
        error: 'Unsupported file format. Please upload a valid PNG, JPEG, or WebP image.',
      });
      return;
    }

    const saved = db.saveUploadedCoinIcon(buffer, detectedMime);
    res.json({
      coinIconUrl: saved.url,
      config: db.getConfig(),
      uploadedCoinIcon: saved.meta,
    });
  });

  app.delete('/api/admin/coin-icon', requireAdminAuth, (_req, res) => {
    const config = db.clearUploadedCoinIcon();
    res.json({
      coinIconUrl: config.coinIconUrl,
      config,
    });
  });

  app.put('/api/admin/players/:playerId', requireAdminAuth, (req, res) => {
    const playerId = sanitizePlayerId(req.params.playerId);
    if (!playerId) {
      res.status(400).json({ error: 'Invalid player ID.' });
      return;
    }
    const patch: { balance?: number; name?: string } = {};
    if (req.body?.balance !== undefined) {
      const bal = Number(req.body.balance);
      if (!Number.isFinite(bal) || bal < 0) {
        res.status(400).json({ error: 'Balance must be a non-negative number.' });
        return;
      }
      patch.balance = Math.floor(bal);
    }
    if (typeof req.body?.name === 'string') {
      patch.name = req.body.name;
    }

    const updated = db.updatePlayer(playerId, patch);
    if (!updated) {
      res.status(404).json({ error: 'Player not found.' });
      return;
    }
    res.json({ player: updated });
  });

  app.get('/api/admin/export', requireAdminAuth, (_req, res) => {
    const snapshot = db.exportPublicSnapshot();
    res.setHeader('Content-Disposition', 'attachment; filename="teen-patti-db-backup.json"');
    res.json(snapshot);
  });

  // Return 404 JSON for unmatched /api/* routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // ================= FRONTEND SERVING (VITE DEV / PROD DIST) =================

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Teen Patti Royal] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Teen Patti Royal server:', err);
  process.exit(1);
});
