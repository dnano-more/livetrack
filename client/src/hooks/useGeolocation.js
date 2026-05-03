/**
 * useGeolocation – wraps the browser Geolocation API
 *
 * Returns:
 *  - position: { lat, lng, accuracy, timestamp } | null
 *  - geoError: string | null
 *  - geoStatus: 'idle' | 'requesting' | 'active' | 'denied' | 'unsupported'
 *  - requestLocation: () => void
 *  - stopTracking:    () => void
 */

import { useState, useRef, useCallback } from 'react';

export function useGeolocation({ onPosition }) {
  const [position,  setPosition]  = useState(null);
  const [geoError,  setGeoError]  = useState(null);
  const [geoStatus, setGeoStatus] = useState('idle');
  const watchIdRef = useRef(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus('unsupported');
      setGeoError('Geolocation is not supported by this browser');
      return;
    }

    setGeoStatus('requesting');
    setGeoError(null);

    // First do a one-shot to get position quickly
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          accuracy:  pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        setPosition(coords);
        setGeoStatus('active');
        onPosition?.(coords);
      },
      (err) => handleGeoError(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Then watch for updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          accuracy:  pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        setPosition(coords);
        setGeoStatus('active');
        onPosition?.(coords);
      },
      (err) => handleGeoError(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 }
    );
  }, [onPosition]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setGeoStatus('idle');
    }
  }, []);

  function handleGeoError(err) {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        setGeoStatus('denied');
        setGeoError('Location permission denied. Please allow location access in browser settings.');
        break;
      case err.POSITION_UNAVAILABLE:
        setGeoError('Location unavailable. Check your GPS/network.');
        break;
      case err.TIMEOUT:
        setGeoError('Location request timed out. Retrying...');
        break;
      default:
        setGeoError(`Location error: ${err.message}`);
    }
  }

  return { position, geoError, geoStatus, requestLocation, stopTracking };
}
