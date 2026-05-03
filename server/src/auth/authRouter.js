/**
 * OIDC / OAuth 2.0 Authentication Router
 *
 * Flow:
 *  1. GET /auth/login       → Redirect to OIDC provider's authorization endpoint
 *  2. GET /auth/callback    → OIDC provider redirects back with `code`
 *  3. Server exchanges code for tokens, validates ID token
 *  4. Issues a short-lived JWT (used by Socket.IO handshake)
 *  5. GET /auth/logout      → Clears session
 *  6. GET /auth/me          → Returns current user info
 *  7. GET /auth/token       → Returns JWT for socket auth
 */

import { Router } from 'express';
import { SignJWT, jwtVerify, createRemoteJWKSet, decodeJwt } from 'jose';
import axios from 'axios';
import { randomBytes } from 'crypto';

const router = Router();

// ─── OIDC Config ───────────────────────────────────────────────────────────────
const OIDC_ISSUER        = process.env.OIDC_ISSUER        || 'https://demo.duendesoftware.com';
const OIDC_CLIENT_ID     = process.env.OIDC_CLIENT_ID     || 'interactive.public';
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || '';
const OIDC_REDIRECT_URI  = process.env.OIDC_REDIRECT_URI  || 'http://localhost:3001/auth/callback';
const OIDC_SCOPES        = process.env.OIDC_SCOPES        || 'openid profile email';
const JWT_SECRET_RAW     = process.env.JWT_SECRET         || 'dev-secret-at-least-32-chars-xxxx';
const JWT_SECRET         = new TextEncoder().encode(JWT_SECRET_RAW);

let oidcConfig = null; // Cached OIDC discovery document

async function getOidcConfig() {
  if (oidcConfig) return oidcConfig;
  const url = `${OIDC_ISSUER}/.well-known/openid-configuration`;
  const { data } = await axios.get(url, { timeout: 5000 });
  oidcConfig = data;
  return data;
}

// ─── DEMO MODE (no real OIDC provider needed for local dev) ────────────────────
const DEMO_MODE = process.env.DEMO_MODE === 'true' || !process.env.OIDC_CLIENT_ID;

const DEMO_USERS = [
  { sub: 'demo-user-1', name: 'Alice Chen',    email: 'alice@demo.local',   avatar: 'AC' },
  { sub: 'demo-user-2', name: 'Bob Martinez',  email: 'bob@demo.local',     avatar: 'BM' },
  { sub: 'demo-user-3', name: 'Carol Johnson', email: 'carol@demo.local',   avatar: 'CJ' },
  { sub: 'demo-user-4', name: 'David Kim',     email: 'david@demo.local',   avatar: 'DK' },
];

// ─── Issue internal JWT ────────────────────────────────────────────────────────
async function issueJwt(userPayload) {
  return new SignJWT({ ...userPayload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRY || '8h')
    .setIssuer('livetrack')
    .sign(JWT_SECRET);
}

// ─── Verify internal JWT (exported for socket middleware) ──────────────────────
export async function verifyJwt(token) {
  const { payload } = await jwtVerify(token, JWT_SECRET, { issuer: 'livetrack' });
  return payload;
}

// ─── Routes ────────────────────────────────────────────────────────────────────

// GET /auth/login
router.get('/login', async (req, res) => {
  if (DEMO_MODE) {
    // Demo: show user picker page
    return res.redirect(`/auth/demo`);
  }

  try {
    const config = await getOidcConfig();
    const state = randomBytes(16).toString('hex');
    const nonce = randomBytes(16).toString('hex');

    req.session.oidcState = state;
    req.session.oidcNonce = nonce;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id:     OIDC_CLIENT_ID,
      redirect_uri:  OIDC_REDIRECT_URI,
      scope:         OIDC_SCOPES,
      state,
      nonce,
    });

    res.redirect(`${config.authorization_endpoint}?${params}`);
  } catch (err) {
    console.error('Login redirect error:', err.message);
    res.status(500).json({ error: 'OIDC provider unreachable', detail: err.message });
  }
});

// GET /auth/demo – demo user picker (HTML page)
router.get('/demo', (_req, res) => {
  const buttons = DEMO_USERS.map(u =>
    `<a href="/auth/demo/login?sub=${u.sub}" class="btn">
      <span class="avatar">${u.avatar}</span>
      <span>${u.name}</span>
    </a>`
  ).join('');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>LiveTrack – Demo Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: #0a0e1a;
      color: #e0e6ff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #111827;
      border: 1px solid #1e2d4a;
      border-radius: 16px;
      padding: 40px;
      width: 380px;
      text-align: center;
    }
    h1 { font-size: 2rem; font-weight: 700; color: #38bdf8; margin-bottom: 8px; }
    p { color: #94a3b8; margin-bottom: 32px; font-size: 0.9rem; }
    .btn {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 14px 20px;
      margin-bottom: 12px;
      background: #1e2d4a;
      border: 1px solid #2e4166;
      border-radius: 10px;
      color: #e0e6ff;
      text-decoration: none;
      font-size: 1rem;
      transition: background 0.2s, border-color 0.2s;
    }
    .btn:hover { background: #253a60; border-color: #38bdf8; }
    .avatar {
      width: 36px; height: 36px;
      background: #38bdf8;
      color: #0a0e1a;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.75rem; flex-shrink: 0;
    }
    .note { font-size: 0.75rem; color: #64748b; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📍 LiveTrack</h1>
    <p>Demo mode — choose a user to log in as</p>
    ${buttons}
    <p class="note">No real credentials required in demo mode</p>
  </div>
</body>
</html>`);
});

// GET /auth/demo/login?sub=...
router.get('/demo/login', async (req, res) => {
  const user = DEMO_USERS.find(u => u.sub === req.query.sub);
  if (!user) return res.status(400).json({ error: 'Unknown demo user' });

  req.session.user = user;
  const token = await issueJwt(user);
  req.session.token = token;

  // Redirect to frontend with token in query (frontend stores in memory)
  const frontendOrigin = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',')[0];
  res.redirect(`${frontendOrigin}?token=${token}`);
});

// GET /auth/callback – real OIDC callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) return res.status(400).json({ error });
  if (!code)  return res.status(400).json({ error: 'No authorization code' });
  if (state !== req.session.oidcState) {
    return res.status(400).json({ error: 'State mismatch – possible CSRF' });
  }

  try {
    const config = await getOidcConfig();

    // Exchange code for tokens
    const params = new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: OIDC_REDIRECT_URI,
      client_id:    OIDC_CLIENT_ID,
      ...(OIDC_CLIENT_SECRET && { client_secret: OIDC_CLIENT_SECRET }),
    });

    const { data: tokens } = await axios.post(config.token_endpoint, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    // Validate ID token
    const JWKS = createRemoteJWKSet(new URL(config.jwks_uri));
    const { payload: claims } = await jwtVerify(tokens.id_token, JWKS, {
      issuer:   OIDC_ISSUER,
      audience: OIDC_CLIENT_ID,
    });

    if (claims.nonce !== req.session.oidcNonce) {
      return res.status(400).json({ error: 'Nonce mismatch' });
    }

    const user = {
      sub:    claims.sub,
      name:   claims.name   || claims.preferred_username || 'Unknown',
      email:  claims.email  || '',
      avatar: ((claims.name || 'U')[0]).toUpperCase(),
    };

    req.session.user  = user;
    const token = await issueJwt(user);
    req.session.token = token;

    const frontendOrigin = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',')[0];
    res.redirect(`${frontendOrigin}?token=${token}`);
  } catch (err) {
    console.error('OIDC callback error:', err.message);
    res.status(500).json({ error: 'Token exchange failed', detail: err.message });
  }
});

// GET /auth/me
router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json(req.session.user);
});

// GET /auth/token – returns JWT so frontend can use for socket auth
router.get('/token', (req, res) => {
  if (!req.session.token) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ token: req.session.token });
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  const frontendOrigin = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',')[0];
  res.redirect(frontendOrigin);
});

export default router;
