# 📍 LiveTrack — Real-Time Location Tracking System

> A production-grade real-time location sharing platform built with **Socket.IO**, **Apache Kafka**, **OIDC/OAuth 2.0**, and **React + Leaflet**. Demonstrates event-driven architecture with independent consumer groups for broadcast and persistence.

---

## 🗺️ Architecture Overview

```
Browser (React)
    │
    │  JWT in socket handshake
    ▼
Socket.IO Server (Express)
    │
    │  publishLocationEvent()
    ▼
Apache Kafka  ──── topic: location-updates ────┐
                                                │
               ┌────────────────────────────────┤
               │                                │
     Consumer Group A                  Consumer Group B
   (socket-broadcaster)               (db-persister)
               │                                │
               │  io.emit('location:update')    │  batch writes
               ▼                                ▼
     All connected clients               SQLite / DB
     (map markers update)           (location history log)
```

### Why Kafka — Not Direct DB Writes?

| Concern | Direct DB | With Kafka |
|---|---|---|
| Throughput | 1,000 riders × 1 update/4s = 250 writes/s stress on DB | Kafka handles 100k+ events/s; DB consumer batches writes |
| Blast radius | DB slow → Socket slow → Clients lag | DB slow → only DB consumer lags; broadcast unaffected |
| Fan-out | Need 2 writes per event (broadcast + log) | One publish, N independent consumers |
| Replay | Impossible | Reprocess missed events from any offset |
| Scaling | Hard | Add consumers / partitions independently |

This is exactly how **Uber/Lyft driver location** systems work: GPS events hit a Kafka stream, one consumer updates the rider's map, another updates the ETA model, another logs for ML training — all independent, all at different speeds.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Auth** | OIDC / OAuth 2.0 (`jose`) + demo mode |
| **Realtime** | Socket.IO 4 (WebSocket with polling fallback) |
| **Message Broker** | Apache Kafka (KafkaJS) |
| **Backend** | Node.js 20, Express 4 |
| **Database** | SQLite (`better-sqlite3`) — swap for TimescaleDB in prod |
| **Frontend** | React 18, Vite 5 |
| **Maps** | Leaflet + React-Leaflet |
| **Container** | Docker + Docker Compose |

---

## 🚀 Quick Start (Docker — Recommended)

### Prerequisites
- Docker Desktop ≥ 4.x
- Node.js 20+, Python 3 (for better-sqlite3 build)
- Windows users: npm install --global windows-build-tools

```bash
git clone <repo-url> livetrack
cd livetrack

# Copy env files
cp server/.env.example server/.env
cp client/.env.example client/.env

# Start everything
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |
| Kafka UI | http://localhost:8080 |

In demo mode, click **SIGN IN** and choose a demo user — no credentials needed.

---

## 🔧 Local Development (Without Docker)

### Prerequisites
- Node.js 20+
- Kafka running locally (see below)

### 1. Start Kafka locally

```bash
# Using KRaft (no Zookeeper, Kafka 3.x+)
brew install kafka            # macOS
kafka-storage format --config /opt/homebrew/etc/kafka/kraft/server.properties \
  --cluster-id $(kafka-storage random-uuid)
kafka-server-start /opt/homebrew/etc/kafka/kraft/server.properties
```

Or use the Docker Compose Kafka-only profile:
```bash
docker compose up zookeeper kafka kafka-ui -d
```

### 2. Server

```bash
cd server
cp .env.example .env       # Edit as needed
npm install
npm run dev
```

### 3. Client

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173.

---

## 🔑 Environment Variables

### Server (`server/.env`)

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3001` |
| `DEMO_MODE` | Skip OIDC, use demo users | `true` |
| `OIDC_ISSUER` | OIDC provider base URL | — |
| `OIDC_CLIENT_ID` | OAuth client ID | — |
| `OIDC_CLIENT_SECRET` | OAuth client secret | — |
| `OIDC_REDIRECT_URI` | Callback URL | `http://localhost:3001/auth/callback` |
| `JWT_SECRET` | Internal JWT signing key (≥32 chars) | required |
| `SESSION_SECRET` | Express session secret | required |
| `KAFKA_BROKERS` | Comma-separated broker addresses | `localhost:9092` |
| `KAFKA_TOPIC_LOCATION` | Topic for location events | `location-updates` |
| `KAFKA_CONSUMER_GROUP_SOCKET` | Broadcast consumer group ID | `socket-broadcaster` |
| `KAFKA_CONSUMER_GROUP_DB` | DB consumer group ID | `db-persister` |
| `DB_PATH` | SQLite file path | `./livetrack.db` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | `http://localhost:5173` |

### Client (`client/.env`)

| Variable | Description | Default |
|---|---|---|
| `VITE_SERVER_URL` | Backend URL | `http://localhost:3001` |

---

## 🔐 OIDC / OAuth 2.0 Setup

### Option A: Demo Mode (default)

Set `DEMO_MODE=true` (or omit `OIDC_CLIENT_ID`).  
Users pick a demo persona at `/auth/demo`.  
No external provider needed.

### Option B: Auth0

1. Create an application in Auth0 (Regular Web Application)
2. Set **Allowed Callback URLs** to `http://localhost:3001/auth/callback`
3. Set **Allowed Logout URLs** to `http://localhost:5173`

```env
DEMO_MODE=false
OIDC_ISSUER=https://YOUR_TENANT.auth0.com
OIDC_CLIENT_ID=your_client_id
OIDC_CLIENT_SECRET=your_client_secret
OIDC_REDIRECT_URI=http://localhost:3001/auth/callback
```

### Option C: Any OIDC Provider (Okta, Keycloak, Google, etc.)

Point `OIDC_ISSUER` to any provider exposing a `.well-known/openid-configuration` endpoint. The server auto-discovers all endpoints.

### Auth Flow Detail

```
1. User clicks "Sign In"
2. Frontend → GET /auth/login
3. Server generates state + nonce, redirects to OIDC provider
4. User authenticates at provider
5. Provider → GET /auth/callback?code=...&state=...
6. Server exchanges code for ID token at token endpoint
7. Server validates ID token: signature (JWKS), issuer, audience, nonce
8. Server issues short-lived HS256 JWT (8h)
9. Frontend stores JWT in memory (NOT localStorage)
10. JWT presented in Socket.IO handshake: { auth: { token } }
11. Socket middleware verifies JWT on every connection
```

---

## 🔌 Socket Event Reference

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `location:send` | `{ lat, lng, accuracy }` | Send current GPS coordinates |
| `ping:location` | — | Keepalive, updates lastSeen |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `location:update` | `{ userId, userName, lat, lng, accuracy, timestamp }` | Broadcasted location update |
| `user:joined` | `{ userId, userName, socketId, ts }` | User connected |
| `user:left` | `{ userId, userName, ts, reason? }` | User disconnected or stale |
| `users:roster` | `Array<UserEntry>` | Full list of active users on connect |
| `error` | `{ code, message }` | Validation or auth error |

---

## 📨 Kafka Event Flow

```
location-updates topic
  │
  ├── Key: userId              ← ensures ordered per-user processing
  ├── Value: JSON              ← { userId, userName, lat, lng, accuracy, timestamp }
  └── Compression: GZIP
```

### Consumer Groups

```
location-updates
    │
    ├── [socket-broadcaster] ← eachBatch, drops stale (>30s), io.emit() 
    │                           Offset committed independently
    │
    └── [db-persister]       ← eachMessage, buffered 20 msgs / 2s flush
                                Writes to location_history + active_users
```

**Kafka UI** available at http://localhost:8080 — inspect topics, consumer lag, and messages live.

---

## 📡 API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/login` | — | Start OIDC login |
| `GET` | `/auth/callback` | — | OIDC redirect callback |
| `GET` | `/auth/me` | Session | Current user info |
| `GET` | `/auth/token` | Session | Get JWT for socket |
| `GET` | `/auth/logout` | — | Clear session |
| `GET` | `/auth/demo` | — | Demo user picker |
| `GET` | `/api/history/:userId` | JWT | Location history (last 100) |
| `GET` | `/api/active` | JWT | Active users from DB |
| `GET` | `/health` | — | Server health check |

---

## 🗄️ Database Schema

```sql
-- Append-only location log (consumed by Kafka db-persister group)
CREATE TABLE location_history (
  id        INTEGER PRIMARY KEY,
  user_id   TEXT    NOT NULL,
  user_name TEXT    NOT NULL,
  lat       REAL    NOT NULL,
  lng       REAL    NOT NULL,
  accuracy  REAL    DEFAULT 0,
  timestamp INTEGER NOT NULL     -- Unix ms from client
);

-- Mutable "last known" state per user
CREATE TABLE active_users (
  user_id   TEXT    PRIMARY KEY,
  user_name TEXT    NOT NULL,
  email     TEXT,
  last_lat  REAL,
  last_lng  REAL,
  last_seen INTEGER NOT NULL
);
```

---

## 🧹 Stale User Handling

- **Socket server**: Checks all entries every 15 s; removes users with `lastSeen` > 60 s
- **On disconnect**: Immediately removes user and emits `user:left`
- **DB consumer**: `getActiveUsers()` only returns entries with `last_seen` within last 5 minutes
- **Kafka consumer**: Drops messages older than 30 s before broadcasting

---

## 🏗️ Project Structure

```
livetrack/
├── docker-compose.yml
├── server/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js                  ← Bootstrap (server + kafka + socket)
│       ├── auth/
│       │   └── authRouter.js         ← OIDC + demo auth, JWT issuance
│       ├── api/
│       │   └── apiRouter.js          ← REST endpoints (history, active)
│       ├── socket/
│       │   └── socketServer.js       ← Socket.IO + auth middleware + stale cleanup
│       ├── kafka/
│       │   ├── producer.js           ← Kafka producer (publishes location events)
│       │   ├── socketConsumer.js     ← Consumer group A: broadcasts to Socket.IO
│       │   └── dbConsumer.js         ← Consumer group B: batched DB writes
│       └── db/
│           └── database.js           ← SQLite schema + query helpers
└── client/
    ├── Dockerfile
    ├── nginx.conf
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── index.css
        ├── pages/
        │   ├── LoginPage.jsx         ← Auth entry point
        │   └── MapPage.jsx           ← Main map + state orchestration
        ├── components/
        │   ├── LiveMap.jsx           ← Leaflet map + animated markers
        │   ├── Sidebar.jsx           ← User list + share toggle
        │   └── StatusBar.jsx         ← Connection / GPS status overlay
        └── hooks/
            ├── useAuth.jsx           ← OIDC auth context
            ├── useSocket.js          ← Socket.IO lifecycle + send loop
            └── useGeolocation.js     ← Browser GPS wrapper
```

---

## 🧠 Design Decisions

### Why partition Kafka by userId?
All location events from the same user land on the same partition, ensuring strict ordering per user without global ordering overhead. Consumer parallelism scales by user, not by event volume.

### Why memory-only token storage?
JWTs stored in `localStorage` are readable by any JS (XSS risk). In-memory storage is cleared on tab close and inaccessible to injected scripts.

### Why SQLite instead of a "real" DB?
Zero-dependency local setup. Production should use **TimescaleDB** (geo time-series), **PostGIS** (spatial queries), or **InfluxDB**. The `database.js` module is the only file that changes.

### Why 4-second location send interval?
GPS accuracy rarely improves faster than 1–4 s for walking speeds. 4 s balances freshness vs. Kafka/network load. Uber uses ~4 s for drivers at speed.

---

## ⚠️ Assumptions & Limitations

- **SQLite** is for demonstration; not suitable for multi-instance deployments
- **Single Kafka broker** — production needs ≥3 brokers for replication
- **No rate limiting** on location events — add `socket.io-rate-limiter` in production
- **No HTTPS** in dev — required for `navigator.geolocation` in production (browsers block GPS on HTTP)
- Stale detection is 60 s server-side; GPS accuracy varies by device
- Location history is not paginated (capped at last 100 rows per query)
- No end-to-end encryption of location data in transit (use TLS in prod)

---

## 📹 Demo Video

> _Record a demo with OBS / Loom:_
> 1. Open two browser windows with different demo users
> 2. Enable location sharing in both
> 3. Show markers appearing and moving on the map
> 4. Show Kafka UI (localhost:8080) with messages flowing
> 5. Show the SQLite DB growing via `sqlite3 livetrack.db "SELECT COUNT(*) FROM location_history"`

---

## 📄 License

MIT
