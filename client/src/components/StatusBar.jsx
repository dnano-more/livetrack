import React from 'react';

export default function StatusBar({ connected, sharing, geoStatus, geoError, socketError, userCount }) {
  const hasError = geoError || socketError;

  return (
    <div style={{
      position: 'absolute',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
    }}>
      {/* Main status pill */}
      <div style={{
        background: 'rgba(13,21,38,0.92)',
        border: `1px solid ${hasError ? '#ef4444' : connected ? '#1a2d50' : '#ef444444'}`,
        borderRadius: '20px',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        fontFamily: 'Space Mono, monospace',
        fontSize: '0.68rem',
      }}>
        {/* Socket */}
        <StatusDot active={connected} label={connected ? 'SOCKET' : 'OFFLINE'} color={connected ? '#10b981' : '#ef4444'} />

        <div style={{ width: '1px', height: '12px', background: '#1a2d50' }} />

        {/* Sharing */}
        <StatusDot
          active={sharing}
          label={sharing ? (geoStatus === 'active' ? 'GPS LIVE' : 'SHARING') : 'IDLE'}
          color={sharing && geoStatus === 'active' ? '#00d4ff' : '#334155'}
        />

        {userCount > 0 && (
          <>
            <div style={{ width: '1px', height: '12px', background: '#1a2d50' }} />
            <span style={{ color: '#64748b' }}>{userCount} online</span>
          </>
        )}
      </div>

      {/* Error pill */}
      {hasError && (
        <div style={{
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '20px',
          padding: '6px 14px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          fontFamily: 'Space Mono, monospace',
          fontSize: '0.65rem',
          color: '#ef4444',
          maxWidth: '300px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          ⚠ {geoError || socketError}
        </div>
      )}
    </div>
  );
}

function StatusDot({ active, label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '6px', height: '6px',
        borderRadius: '50%',
        background: color,
        boxShadow: active ? `0 0 6px ${color}` : 'none',
        animation: active ? 'pulseAnim 2s ease-in-out infinite' : 'none',
      }} />
      <span style={{ color: active ? color : '#334155', letterSpacing: '0.06em' }}>{label}</span>
      <style>{`@keyframes pulseAnim { 0%,100%{opacity:1}50%{opacity:0.6} }`}</style>
    </div>
  );
}
