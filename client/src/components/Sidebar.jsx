import React, { useState } from 'react';

function timeAgo(ts) {
  if (!ts) return 'never';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10)  return 'just now';
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function UserCard({ user, isMe, onCenter }) {
  return (
    <div
      onClick={() => user.lat && onCenter(user)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '10px',
        background: isMe ? `${user.color}0a` : 'transparent',
        border: `1px solid ${isMe ? user.color + '22' : '#1a2d50'}`,
        cursor: user.lat ? 'pointer' : 'default',
        transition: 'all 0.15s',
        marginBottom: '6px',
      }}
      onMouseEnter={e => {
        if (user.lat) e.currentTarget.style.background = `${user.color}15`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = isMe ? `${user.color}0a` : 'transparent';
      }}
    >
      {/* Avatar */}
      <div style={{
        width: '34px',
        height: '34px',
        borderRadius: '50%',
        background: `${user.color}22`,
        border: `2px solid ${user.color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Syne, sans-serif',
        fontWeight: 700,
        fontSize: '11px',
        color: user.color,
        flexShrink: 0,
        boxShadow: isMe ? `0 0 12px ${user.color}44` : 'none',
      }}>
        {(user.userName || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 600,
          fontSize: '0.82rem',
          color: user.color,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {user.userName} {isMe && <span style={{ color: '#64748b', fontSize: '0.7rem' }}>(you)</span>}
        </div>
        <div style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: '0.67rem',
          color: '#64748b',
          marginTop: '2px',
        }}>
          {user.lat
            ? `${user.lat.toFixed(4)}, ${user.lng.toFixed(4)}`
            : 'No position yet'
          }
        </div>
      </div>

      <div style={{
        fontFamily: 'Space Mono, monospace',
        fontSize: '0.62rem',
        color: '#334155',
        textAlign: 'right',
        flexShrink: 0,
      }}>
        {timeAgo(user.timestamp)}
      </div>
    </div>
  );
}

export default function Sidebar({
  user, trackedUsers, sharing, connected,
  onToggleSharing, onLogout, onCenterUser,
}) {
  const [collapsed, setCollapsed] = useState(false);

  const userList = Object.values(trackedUsers).sort((a, b) => {
    if (a.isMe) return -1;
    if (b.isMe) return 1;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

  if (collapsed) {
    return (
      <div style={{
        width: '48px',
        background: '#0d1526',
        borderRight: '1px solid #1a2d50',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: '12px',
      }}>
        <button
          onClick={() => setCollapsed(false)}
          style={iconBtn}
          title="Expand sidebar"
        >›</button>
        <span style={{ fontSize: '1.1rem' }} title={`${userList.length} users`}>👥</span>
        <span
          style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: connected ? '#10b981' : '#ef4444',
            marginTop: '4px',
          }}
          title={connected ? 'Connected' : 'Disconnected'}
        />
      </div>
    );
  }

  return (
    <div style={{
      width: '280px',
      minWidth: '280px',
      background: '#0d1526',
      borderRight: '1px solid #1a2d50',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 16px 16px',
        borderBottom: '1px solid #1a2d50',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: '1.25rem',
              letterSpacing: '0.06em',
              background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>📍 LIVETRACK</h1>
            <div style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.65rem',
              color: '#334155',
              letterSpacing: '0.1em',
              marginTop: '2px',
            }}>
              REAL-TIME LOCATION
            </div>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            style={{ ...iconBtn, fontSize: '1rem' }}
            title="Collapse sidebar"
          >‹</button>
        </div>

        {/* User info */}
        <div style={{
          marginTop: '14px',
          padding: '10px 12px',
          background: '#0f1a30',
          borderRadius: '10px',
          border: '1px solid #1a2d50',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            width: '32px', height: '32px',
            borderRadius: '50%',
            background: '#00d4ff22',
            border: '2px solid #00d4ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '11px',
            color: '#00d4ff',
            flexShrink: 0,
          }}>
            {(user?.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 600,
              fontSize: '0.82rem',
              color: '#e2e8f0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>{user?.name}</div>
            <div style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.65rem',
              color: '#64748b',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>{user?.email}</div>
          </div>
        </div>
      </div>

      {/* Connection status */}
      <div style={{
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid #1a2d50',
      }}>
        <div style={{
          width: '7px', height: '7px',
          borderRadius: '50%',
          background: connected ? '#10b981' : '#ef4444',
          boxShadow: connected ? '0 0 8px #10b981' : '0 0 8px #ef4444',
          animation: connected ? 'none' : 'blink 1s ease-in-out infinite',
        }} />
        <span style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: '0.68rem',
          color: connected ? '#10b981' : '#ef4444',
          letterSpacing: '0.05em',
        }}>
          {connected ? 'CONNECTED' : 'DISCONNECTED'}
        </span>
        <span style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: '0.65rem',
          color: '#334155',
          marginLeft: 'auto',
        }}>
          {userList.length} online
        </span>
        <style>{`@keyframes blink { 0%,100%{opacity:1}50%{opacity:0.3} }`}</style>
      </div>

      {/* Share toggle */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a2d50' }}>
        <button
          onClick={onToggleSharing}
          disabled={!connected}
          style={{
            width: '100%',
            padding: '12px',
            background: sharing
              ? 'linear-gradient(135deg, #10b98122, #059669)22'
              : 'linear-gradient(135deg, #00d4ff15, #7c3aed15)',
            border: `1px solid ${sharing ? '#10b98144' : '#00d4ff33'}`,
            borderRadius: '10px',
            color: sharing ? '#10b981' : '#00d4ff',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '0.85rem',
            letterSpacing: '0.06em',
            cursor: connected ? 'pointer' : 'not-allowed',
            opacity: connected ? 1 : 0.5,
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {sharing ? '⏹ STOP SHARING' : '▶ SHARE LOCATION'}
        </button>
        {sharing && (
          <div style={{
            marginTop: '8px',
            fontFamily: 'Space Mono, monospace',
            fontSize: '0.65rem',
            color: '#10b981',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}>
            <span style={{
              display: 'inline-block',
              width: '6px', height: '6px',
              borderRadius: '50%',
              background: '#10b981',
              animation: 'blink 1s ease-in-out infinite',
            }} />
            Broadcasting every 4 seconds via Kafka
          </div>
        )}
      </div>

      {/* User list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        <div style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: '0.65rem',
          color: '#334155',
          letterSpacing: '0.12em',
          marginBottom: '10px',
        }}>
          ACTIVE USERS ({userList.length})
        </div>

        {userList.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '24px 0',
            fontFamily: 'Space Mono, monospace',
            fontSize: '0.75rem',
            color: '#334155',
          }}>
            No users online yet
          </div>
        ) : (
          userList.map(u => (
            <UserCard
              key={u.userId}
              user={u}
              isMe={u.userId === user?.sub}
              onCenter={onCenterUser}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #1a2d50',
        display: 'flex',
        gap: '8px',
      }}>
        <button
          onClick={onLogout}
          style={{
            flex: 1,
            padding: '9px',
            background: 'transparent',
            border: '1px solid #1a2d50',
            borderRadius: '8px',
            color: '#64748b',
            fontFamily: 'Space Mono, monospace',
            fontSize: '0.7rem',
            cursor: 'pointer',
            letterSpacing: '0.06em',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#ef4444';
            e.currentTarget.style.color = '#ef4444';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#1a2d50';
            e.currentTarget.style.color = '#64748b';
          }}
        >
          SIGN OUT
        </button>
      </div>
    </div>
  );
}

const iconBtn = {
  background: 'transparent',
  border: 'none',
  color: '#64748b',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '6px',
  fontSize: '1.2rem',
  transition: 'color 0.15s',
};
