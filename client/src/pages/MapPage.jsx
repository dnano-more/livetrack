import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useSocket } from '../hooks/useSocket.js';
import { useGeolocation } from '../hooks/useGeolocation.js';
import LiveMap from '../components/LiveMap.jsx';
import Sidebar from '../components/Sidebar.jsx';
import StatusBar from '../components/StatusBar.jsx';

const USER_COLORS = [
  '#00d4ff', '#7c3aed', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#3b82f6', '#8b5cf6',
];

function colorForUser(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

export default function MapPage() {
  const { user, token, logout } = useAuth();

  // { userId → { userId, userName, lat, lng, accuracy, timestamp, color, isMe } }
  const [trackedUsers, setTrackedUsers] = useState({});
  const [sharing, setSharing]           = useState(false);
  const [mapCenter, setMapCenter]       = useState([20, 0]);
  const [mapZoom, setMapZoom]           = useState(3);
  const hasCenteredRef                  = useRef(false);

  // ── Roster from server ───────────────────────────────────────────────────────
  const handleRoster = useCallback((users) => {
    setTrackedUsers(prev => {
      const next = { ...prev };
      for (const u of users) {
        if (u.lat !== null && u.lng !== null) {
          next[u.userId] = {
            ...u,
            color: colorForUser(u.userId),
            isMe:  u.userId === user?.sub,
          };
        }
      }
      return next;
    });
  }, [user?.sub]);

  const handleLocationUpdate = useCallback((data) => {
    setTrackedUsers(prev => ({
      ...prev,
      [data.userId]: {
        ...prev[data.userId],
        ...data,
        color: colorForUser(data.userId),
        isMe:  data.userId === user?.sub,
      },
    }));
  }, [user?.sub]);

  const handleUserJoined = useCallback((data) => {
    console.log(`[map] User joined: ${data.userName}`);
  }, []);

  const handleUserLeft = useCallback((data) => {
    setTrackedUsers(prev => {
      const next = { ...prev };
      delete next[data.userId];
      return next;
    });
  }, []);

  // ── Socket ───────────────────────────────────────────────────────────────────
  const { connected, socketError, startSending, stopSending, updateLocation } = useSocket({
    token,
    onLocationUpdate: handleLocationUpdate,
    onUserJoined:     handleUserJoined,
    onUserLeft:       handleUserLeft,
    onRoster:         handleRoster,
  });

  // ── Geolocation ──────────────────────────────────────────────────────────────
  const handlePosition = useCallback((coords) => {
    updateLocation(coords);

    // Center map on first fix
    if (!hasCenteredRef.current) {
      setMapCenter([coords.lat, coords.lng]);
      setMapZoom(15);
      hasCenteredRef.current = true;
    }

    // Update own marker
    setTrackedUsers(prev => ({
      ...prev,
      [user.sub]: {
        ...prev[user.sub],
        userId:    user.sub,
        userName:  user.name,
        lat:       coords.lat,
        lng:       coords.lng,
        accuracy:  coords.accuracy,
        timestamp: coords.timestamp,
        color:     colorForUser(user.sub),
        isMe:      true,
      },
    }));
  }, [updateLocation, user]);

  const { position, geoError, geoStatus, requestLocation, stopTracking } = useGeolocation({
    onPosition: handlePosition,
  });

  // ── Share toggle ─────────────────────────────────────────────────────────────
  const toggleSharing = useCallback(() => {
    if (sharing) {
      stopSending();
      stopTracking();
      setSharing(false);
    } else {
      requestLocation();
      startSending();
      setSharing(true);
    }
  }, [sharing, stopSending, stopTracking, requestLocation, startSending]);

  // ── Center on me ─────────────────────────────────────────────────────────────
  const centerOnMe = useCallback(() => {
    if (position) {
      setMapCenter([position.lat, position.lng]);
      setMapZoom(16);
    }
  }, [position]);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Sidebar */}
      <Sidebar
        user={user}
        trackedUsers={trackedUsers}
        sharing={sharing}
        connected={connected}
        onToggleSharing={toggleSharing}
        onLogout={logout}
        onCenterUser={(u) => {
          if (u.lat && u.lng) {
            setMapCenter([u.lat, u.lng]);
            setMapZoom(15);
          }
        }}
      />

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <LiveMap
          center={mapCenter}
          zoom={mapZoom}
          trackedUsers={Object.values(trackedUsers).filter(u => u.lat !== null)}
          myUserId={user?.sub}
        />

        {/* Center-on-me button */}
        {position && (
          <button
            onClick={centerOnMe}
            title="Center on my location"
            style={{
              position: 'absolute',
              bottom: '32px',
              right: '16px',
              zIndex: 1000,
              width: '44px',
              height: '44px',
              background: '#0d1526',
              border: '1px solid #1a2d50',
              borderRadius: '10px',
              color: '#00d4ff',
              fontSize: '1.2rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#00d4ff'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#1a2d50'}
          >
            🎯
          </button>
        )}

        {/* Status bar */}
        <StatusBar
          connected={connected}
          sharing={sharing}
          geoStatus={geoStatus}
          geoError={geoError}
          socketError={socketError}
          userCount={Object.keys(trackedUsers).length}
        />
      </div>
    </div>
  );
}
