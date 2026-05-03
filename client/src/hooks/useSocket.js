/**
 * useSocket – manages Socket.IO connection lifecycle
 *
 * - Authenticates using JWT in handshake (auth.token)
 * - Tracks connection state
 * - Emits location:send at SEND_INTERVAL_MS (default 4 s)
 * - Listens for location:update, user:joined, user:left, users:roster
 * - Auto-reconnects on disconnect
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL       = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const SEND_INTERVAL_MS = 4000; // How often to send GPS coordinates

export function useSocket({ token, onLocationUpdate, onUserJoined, onUserLeft, onRoster }) {
  const socketRef      = useRef(null);
  const intervalRef    = useRef(null);
  const locationRef    = useRef(null); // Latest GPS coords
  const [connected, setConnected]   = useState(false);
  const [socketError, setSocketError] = useState(null);

  // ── Connect ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const socket = io(SERVER_URL, {
      auth:        { token },
      transports:  ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay:    1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[socket] Connected:', socket.id);
      setConnected(true);
      setSocketError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('[socket] Disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[socket] Connection error:', err.message);
      setSocketError(err.message);
    });

    socket.on('error', (err) => {
      console.warn('[socket] Server error:', err);
    });

    socket.on('location:update', (data) => onLocationUpdate?.(data));
    socket.on('user:joined',     (data) => onUserJoined?.(data));
    socket.on('user:left',       (data) => onUserLeft?.(data));
    socket.on('users:roster',    (data) => onRoster?.(data));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token]);

  // ── Location Sending Loop ─────────────────────────────────────────────────────
  const startSending = useCallback(() => {
    if (intervalRef.current) return; // Already running

    intervalRef.current = setInterval(() => {
      const socket = socketRef.current;
      const loc    = locationRef.current;
      if (!socket?.connected || !loc) return;

      socket.emit('location:send', {
        lat:      loc.lat,
        lng:      loc.lng,
        accuracy: loc.accuracy,
      });
    }, SEND_INTERVAL_MS);

    console.log('[socket] Location sending loop started');
  }, []);

  const stopSending = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('[socket] Location sending loop stopped');
    }
  }, []);

  const updateLocation = useCallback((coords) => {
    locationRef.current = coords;
  }, []);

  return {
    connected,
    socketError,
    startSending,
    stopSending,
    updateLocation,
    socket: socketRef,
  };
}
