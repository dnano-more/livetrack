import React from 'react';
import { useAuth } from '../hooks/useAuth.jsx';

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#070c18',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated background grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }} />

      {/* Glowing orbs */}
      <div style={{
        position: 'absolute',
        top: '20%', left: '10%',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%', right: '10%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      {/* Login card */}
      <div style={{
        position: 'relative',
        background: '#0d1526',
        border: '1px solid #1a2d50',
        borderRadius: '20px',
        padding: '52px 48px',
        width: '420px',
        textAlign: 'center',
        boxShadow: '0 0 80px rgba(0,212,255,0.06)',
      }}>
        {/* Logo */}
        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📍</div>
        <h1 style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 800,
          fontSize: '2.2rem',
          letterSpacing: '0.06em',
          background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '8px',
        }}>
          LIVETRACK
        </h1>
        <p style={{
          color: '#64748b',
          fontFamily: 'Space Mono, monospace',
          fontSize: '0.75rem',
          letterSpacing: '0.15em',
          marginBottom: '40px',
        }}>
          REAL-TIME LOCATION SHARING
        </p>

        {/* Feature badges */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '40px',
          flexWrap: 'wrap',
        }}>
          {['Socket.IO', 'Kafka', 'OIDC Auth'].map(t => (
            <span key={t} style={{
              background: '#0f1a30',
              border: '1px solid #1a2d50',
              borderRadius: '20px',
              padding: '4px 12px',
              fontSize: '0.7rem',
              color: '#94a3b8',
              fontFamily: 'Space Mono, monospace',
              letterSpacing: '0.05em',
            }}>{t}</span>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={login}
          style={{
            width: '100%',
            padding: '16px',
            background: 'linear-gradient(135deg, #00d4ff22, #7c3aed22)',
            border: '1px solid #00d4ff44',
            borderRadius: '12px',
            color: '#00d4ff',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '1rem',
            letterSpacing: '0.08em',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.target.style.background = 'linear-gradient(135deg, #00d4ff33, #7c3aed33)';
            e.target.style.borderColor = '#00d4ff88';
            e.target.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.target.style.background = 'linear-gradient(135deg, #00d4ff22, #7c3aed22)';
            e.target.style.borderColor = '#00d4ff44';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          SIGN IN TO CONTINUE →
        </button>

        <p style={{
          marginTop: '20px',
          fontSize: '0.7rem',
          color: '#334155',
          fontFamily: 'Space Mono, monospace',
        }}>
          Demo mode: no credentials required
        </p>
      </div>
    </div>
  );
}
