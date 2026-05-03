import React from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MapPage from './pages/MapPage.jsx';

function AppInner() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
        background: '#070c18',
      }}>
        <div style={{ fontSize: '2.5rem' }}>📍</div>
        <div style={{
          fontFamily: 'Syne, sans-serif',
          color: '#00d4ff',
          fontSize: '1.2rem',
          letterSpacing: '0.1em',
        }}>
          LIVETRACK
        </div>
        <div style={{
          width: '120px',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, #00d4ff, transparent)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <style>{`
          @keyframes pulse { 0%,100%{opacity:0.3}50%{opacity:1} }
        `}</style>
      </div>
    );
  }

  return user ? <MapPage /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
