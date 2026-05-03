/**
 * SQLite Database Module (Location History Persistence)
 *
 * In a production system this would be replaced with:
 *  - TimescaleDB or InfluxDB for time-series location data
 *  - PostGIS for spatial queries
 *  - Redis for active user state
 *
 * SQLite is used here to make local setup zero-dependency.
 */

import Database from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = process.env.DB_PATH || './livetrack.db';
let db = null;

export async function initDatabase() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // Write-Ahead Logging for concurrent reads
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS location_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT    NOT NULL,
      user_name   TEXT    NOT NULL,
      lat         REAL    NOT NULL,
      lng         REAL    NOT NULL,
      accuracy    REAL    DEFAULT 0,
      timestamp   INTEGER NOT NULL,
      created_at  INTEGER DEFAULT (unixepoch('now') * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_loc_user_ts ON location_history(user_id, timestamp DESC);

    CREATE TABLE IF NOT EXISTS active_users (
      user_id     TEXT    PRIMARY KEY,
      user_name   TEXT    NOT NULL,
      email       TEXT,
      last_lat    REAL,
      last_lng    REAL,
      last_seen   INTEGER NOT NULL,
      updated_at  INTEGER DEFAULT (unixepoch('now') * 1000)
    );
  `);

  console.log(`✅ SQLite database ready: ${DB_PATH}`);
  return db;
}

export async function saveLocationEvent(event) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(`
    INSERT INTO location_history (user_id, user_name, lat, lng, accuracy, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    event.userId,
    event.userName || 'Unknown',
    event.lat,
    event.lng,
    event.accuracy ?? 0,
    event.timestamp || Date.now(),
  );
}

export async function upsertActiveUser(event) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(`
    INSERT INTO active_users (user_id, user_name, email, last_lat, last_lng, last_seen)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      user_name = excluded.user_name,
      last_lat  = excluded.last_lat,
      last_lng  = excluded.last_lng,
      last_seen = excluded.last_seen,
      updated_at = unixepoch('now') * 1000
  `);
  stmt.run(
    event.userId,
    event.userName || 'Unknown',
    event.email    || '',
    event.lat,
    event.lng,
    event.timestamp || Date.now(),
  );
}

export async function getLocationHistory(userId, limit = 100) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(`
    SELECT user_id, user_name, lat, lng, accuracy, timestamp
    FROM location_history
    WHERE user_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(userId, limit);
}

export async function getActiveUsers() {
  if (!db) throw new Error('DB not initialized');
  const staleThreshold = Date.now() - 300_000; // 5 minutes
  const stmt = db.prepare(`
    SELECT user_id, user_name, email, last_lat, last_lng, last_seen
    FROM active_users
    WHERE last_seen > ?
    ORDER BY last_seen DESC
  `);
  return stmt.all(staleThreshold);
}
