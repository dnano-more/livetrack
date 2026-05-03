/**
 * LiveMap – Leaflet map with animated user markers
 *
 * Uses custom DivIcon markers so we can style them freely.
 * Marker positions update smoothly via CSS transitions on lat/lng change.
 */

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

// Fix default icon URLs (Vite asset bundling issue)
delete L.Icon.Default.prototype._getIconUrl;

function createUserIcon(user) {
  const initials = (user.userName || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const color    = user.color || '#00d4ff';
  const isMe     = user.isMe;

  const html = `
    <div style="
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
    ">
      <div style="
        width: ${isMe ? 44 : 38}px;
        height: ${isMe ? 44 : 38}px;
        background: ${color}22;
        border: 2.5px solid ${color};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Syne', sans-serif;
        font-weight: 700;
        font-size: ${isMe ? '13px' : '11px'};
        color: ${color};
        box-shadow: 0 0 ${isMe ? 16 : 10}px ${color}55;
        ${isMe ? `animation: pulse-ring 2s ease-in-out infinite;` : ''}
      ">
        ${initials}
      </div>
      <div style="
        width: 0; height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 8px solid ${color};
        margin-top: -1px;
      "></div>
      <div style="
        position: absolute;
        top: ${isMe ? 48 : 42}px;
        background: rgba(13,21,38,0.9);
        border: 1px solid ${color}44;
        border-radius: 6px;
        padding: 2px 6px;
        font-family: 'Space Mono', monospace;
        font-size: 9px;
        color: ${color};
        white-space: nowrap;
        pointer-events: none;
      ">
        ${isMe ? '● ' : ''}${user.userName}
      </div>
    </div>
    <style>
      @keyframes pulse-ring {
        0%, 100% { box-shadow: 0 0 16px ${color}55; }
        50%       { box-shadow: 0 0 28px ${color}99, 0 0 48px ${color}33; }
      }
    </style>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize:    [isMe ? 44 : 38, isMe ? 44 : 38],
    iconAnchor:  [isMe ? 22 : 19, isMe ? 52 : 46],
    popupAnchor: [0, -50],
  });
}

function popupContent(user) {
  const ts  = user.timestamp ? new Date(user.timestamp).toLocaleTimeString() : '—';
  const acc = user.accuracy  ? `±${Math.round(user.accuracy)}m`              : '—';
  return `
    <div style="font-family: 'Space Mono', monospace; font-size: 11px; color: #e2e8f0;">
      <div style="font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px;
                  color: ${user.color}; margin-bottom: 6px;">
        ${user.isMe ? '● ' : ''}${user.userName}
      </div>
      <div style="color: #64748b; margin-bottom: 2px;">📍 ${user.lat?.toFixed(6)}, ${user.lng?.toFixed(6)}</div>
      <div style="color: #64748b; margin-bottom: 2px;">🎯 Accuracy: ${acc}</div>
      <div style="color: #64748b;">🕐 ${ts}</div>
    </div>
  `;
}

export default function LiveMap({ center, zoom, trackedUsers, myUserId }) {
  const mapRef     = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({}); // userId → L.Marker

  // ── Init Map ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center:    center || [20, 0],
      zoom:      zoom   || 3,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstance.current = map;
    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // ── Center / zoom ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance.current || !center) return;
    mapInstance.current.setView(center, zoom, { animate: true });
  }, [center, zoom]);

  // ── Update markers ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const seen = new Set();

    for (const user of trackedUsers) {
      if (!user.lat || !user.lng) continue;
      seen.add(user.userId);

      if (markersRef.current[user.userId]) {
        // Smoothly move existing marker
        const marker = markersRef.current[user.userId];
        marker.setLatLng([user.lat, user.lng]);
        marker.setIcon(createUserIcon(user));
        marker.getPopup()?.setContent(popupContent(user));
      } else {
        // Create new marker
        const marker = L.marker([user.lat, user.lng], { icon: createUserIcon(user) })
          .bindPopup(popupContent(user), { maxWidth: 220 })
          .addTo(map);
        markersRef.current[user.userId] = marker;
      }
    }

    // Remove stale markers
    for (const [userId, marker] of Object.entries(markersRef.current)) {
      if (!seen.has(userId)) {
        marker.remove();
        delete markersRef.current[userId];
      }
    }
  }, [trackedUsers]);

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
