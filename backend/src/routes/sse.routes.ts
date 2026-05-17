import { Router } from 'express';
import { sseConnect, getConnectedClientCount } from '../controllers/sse.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// SSE connection endpoint (authenticated)
router.get('/connect', authenticate, sseConnect);

// Health check for SSE (public)
router.get('/status', (req, res) => {
  res.json({ connectedClients: getConnectedClientCount() });
});

export default router;
