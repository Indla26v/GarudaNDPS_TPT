import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, refresh, logout, getMe } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ── SECURITY FIX #14: Rate limit authentication endpoints
// Prevents brute-force credential stuffing across all accounts.
// Without this, an attacker can attempt 5 logins per username (triggering lockout)
// and move to the next, effectively brute-forcing across the entire user base.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minute window
  max: 20,                    // 20 requests per window per IP
  message: { message: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,      // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,       // Disable X-RateLimit-* headers
});

router.post('/login', authLimiter, login);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

export default router;
