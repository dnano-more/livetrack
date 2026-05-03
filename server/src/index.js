import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import session from 'express-session';
import { initSocketServer } from './socket/socketServer.js';
import { initKafkaProducer } from './kafka/producer.js';
import { startSocketConsumer } from './kafka/socketConsumer.js';
import { startDbConsumer } from './kafka/dbConsumer.js';
import { initDatabase } from './db/database.js';
import authRouter from './auth/authRouter.js';
import apiRouter from './api/apiRouter.js';

const app = express();
const httpServer = createServer(app);

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(','),
  credentials: true,
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000, // 8h
  },
}));

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth', authRouter);
app.use('/api', apiRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ─── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    console.log('🗄️  Initializing database...');
    await initDatabase();

    console.log('📨 Connecting Kafka producer...');
    await initKafkaProducer();

    console.log('🔌 Starting Socket.IO server...');
    await initSocketServer(httpServer);

    console.log('📡 Starting Socket broadcast consumer...');
    await startSocketConsumer();

    console.log('💾 Starting DB persistence consumer...');
    await startDbConsumer();

    const PORT = process.env.PORT || 3001;
    httpServer.listen(PORT, () => {
      console.log(`\n🚀 LiveTrack server running on http://localhost:${PORT}`);
      console.log(`   Auth:    http://localhost:${PORT}/auth/login`);
      console.log(`   Health:  http://localhost:${PORT}/health\n`);
    });
  } catch (err) {
    console.error('❌ Bootstrap failed:', err);
    process.exit(1);
  }
}

bootstrap();
