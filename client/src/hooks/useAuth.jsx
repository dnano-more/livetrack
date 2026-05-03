/**
 * Auth context
 *
 * On load, checks URL for ?token=... (from OIDC callback redirect).
 * Stores token in memory only (not localStorage) for security.
 * Falls back to /auth/me for session-based auth.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  const login = useCallback(() => {
    window.location.href = `${API}/auth/login`;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    window.location.href = `${API}/auth/logout`;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Check URL for token from OIDC callback
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');

        if (urlToken) {
          // Clean URL
          window.history.replaceState({}, '', window.location.pathname);
          setToken(urlToken);

          // Decode user from JWT payload (no verification needed client-side, server verifies)
          const [, payload] = urlToken.split('.');
          const user = JSON.parse(atob(payload + '=='.slice((payload.length % 4) * -1 || 4)));
          setUser({ sub: user.sub, name: user.name, email: user.email, avatar: user.avatar });
          return;
        }

        // Try existing session
        const { data: me } = await axios.get(`${API}/auth/me`, { withCredentials: true });
        setUser(me);
        const { data: tk } = await axios.get(`${API}/auth/token`, { withCredentials: true });
        setToken(tk.token);
      } catch {
        // Not authenticated
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AuthCtx.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
