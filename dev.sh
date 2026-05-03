#!/usr/bin/env bash
# LiveTrack local dev bootstrap (without Docker)
# Usage: ./dev.sh

set -e

echo "📍 LiveTrack – Dev Startup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check node
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org"
  exit 1
fi

# Check Kafka (optional, warn if missing)
if ! nc -z localhost 9092 2>/dev/null; then
  echo "⚠️  Kafka not reachable on localhost:9092"
  echo "   Starting Kafka via Docker Compose..."
  docker compose up zookeeper kafka -d
  echo "   Waiting for Kafka to be ready..."
  sleep 10
fi

# Install server deps
if [ ! -d "server/node_modules" ]; then
  echo "📦 Installing server dependencies..."
  (cd server && npm install)
fi

# Install client deps
if [ ! -d "client/node_modules" ]; then
  echo "📦 Installing client dependencies..."
  (cd client && npm install)
fi

# Copy env files if needed
[ ! -f server/.env ] && cp server/.env.example server/.env && echo "✅ Created server/.env"
[ ! -f client/.env ] && cp client/.env.example client/.env && echo "✅ Created client/.env"

echo ""
echo "🚀 Starting services..."
echo "   Server:  http://localhost:3001"
echo "   Client:  http://localhost:5173"
echo "   Kafka UI (if running): http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop all."
echo ""

# Start both in parallel
trap "kill 0" SIGINT
(cd server && npm run dev) &
(cd client && npm run dev) &
wait
