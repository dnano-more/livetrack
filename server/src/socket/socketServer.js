/**
 * Socket.IO Server
 *
 * Authentication: Every socket connection must present a valid JWT
 * in the handshake (auth.token).  The JWT is verified before the
 * connection is accepted – unauthenticated sockets are rejected.
 *
 * Why user ID instead of socket ID?
 * ─────────────────────────────────
 * Socket IDs change on every reconnect.  Other clients would lose
 * track of a user if we identified by socket.id.  We use the stable
 * sub (subject) from the JWT as the canonical user identifier.
 *
 * Stale user cleanup:
 * Users are removed from the "active" map if no location update is
 * received within STALE_THRESHOLD_MS.  On disconnect we also emit a
 * "user left" event so frontends can remove the marker immediately.
 */

import { Server } from 'socket.io';
import { verifyJwt } from '../auth/authRouter.js';
import { publishLocationEvent } from '../kafka/producer.js';

const ALLOWED_ORIGINS      = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
const STALE_THRESHOLD_MS   = 60_000; // Remove user after 60 s without update
const STALE_CHECK_INTERVAL = 15_000;

let io = null;

// In-memory registry of currently connected authenticated users
// { userId → { socketId, user, lastSeen, lat, lng } }
const connectedUsers = new Map();

export function getSocketIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export function getConnectedUsers() {
  return connectedUsers;
}

export async function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin:      ALLOWED_ORIGINS,
      credentials: true,
    },
    pingTimeout:  20000,
    pingInterval: 10000,
  });

  // ─── Auth Middleware ─────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const user  = await verifyJwt(token);
      socket.user = user; // Attach to socket for downstream handlers
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ─── Connection Handler ──────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const { sub: userId, name: userName, email } = socket.user;
    console.log(`[socket] Connected: ${userName} (${userId}) – socket ${socket.id}`);

    // Register user (overwrite if reconnecting)
    connectedUsers.set(userId, {
      socketId:  socket.id,
      userId,
      userName,
      email,
      lastSeen:  Date.now(),
      lat:       null,
      lng:       null,
    });

    // Notify everyone about the new user
    io.emit('user:joined', { userId, userName, socketId: socket.id, ts: Date.now() });

    // Send current user roster to the newcomer
    socket.emit('users:roster', Array.from(connectedUsers.values()));

    // ── location:update event ─────────────────────────────────────────────────
    socket.on('location:send', async (payload) => {
      const { lat, lng, accuracy } = payload || {};

      // Input validation
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        socket.emit('error', { code: 'INVALID_LOCATION', message: 'lat/lng must be numbers' });
        return;
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        socket.emit('error', { code: 'OUT_OF_RANGE', message: 'Coordinates out of valid range' });
        return;
      }

      const timestamp = Date.now();

      // Update in-memory state
      const entry = connectedUsers.get(userId);
      if (entry) {
        entry.lat      = lat;
        entry.lng      = lng;
        entry.lastSeen = timestamp;
        entry.accuracy = accuracy;
      }

      // Publish to Kafka (async, non-blocking for socket response)
      try {
        await publishLocationEvent({
          userId,
          userName,
          email,
          lat,
          lng,
          accuracy: accuracy ?? 0,
          timestamp,
        });
      } catch (err) {
        console.error(`[socket] Kafka publish failed for ${userId}:`, err.message);
        // Don't reject the socket event – Kafka failure shouldn't break the client
        // In prod: write to a fallback buffer / DLQ
      }
    });

    // ── ping / keepalive ──────────────────────────────────────────────────────
    socket.on('ping:location', () => {
      const entry = connectedUsers.get(userId);
      if (entry) entry.lastSeen = Date.now();
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[socket] Disconnected: ${userName} – reason: ${reason}`);
      connectedUsers.delete(userId);
      io.emit('user:left', { userId, userName, ts: Date.now() });
    });
  });

  // ─── Stale User Cleanup ──────────────────────────────────────────────────────
  setInterval(() => {
    const now      = Date.now();
    let   removed  = 0;

    for (const [userId, entry] of connectedUsers) {
      if (now - entry.lastSeen > STALE_THRESHOLD_MS) {
        connectedUsers.delete(userId);
        io.emit('user:left', { userId, userName: entry.userName, ts: now, reason: 'stale' });
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[socket] Removed ${removed} stale users`);
    }
  }, STALE_CHECK_INTERVAL);

  return io;
}
