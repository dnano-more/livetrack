import { Router } from 'express';
import { verifyJwt } from '../auth/authRouter.js';
import { getLocationHistory, getActiveUsers } from '../db/database.js';

const router = Router();

// JWT auth middleware for REST endpoints
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    req.user = await verifyJwt(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/history/:userId – location history for a user
router.get('/history/:userId', requireAuth, async (req, res) => {
  try {
    const rows = await getLocationHistory(req.params.userId, 100);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/active – currently active users
router.get('/active', requireAuth, async (req, res) => {
  try {
    const users = await getActiveUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
