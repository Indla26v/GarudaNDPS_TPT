import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import authRoutes from './routes/auth.routes';
import offendersRoutes from './routes/offenders.routes';
import dashboardRoutes from './routes/dashboard.routes';
import policeStationRoutes from './routes/police_station.routes';
import casesRoutes from './routes/cases.routes';
import deletionRoutes from './routes/deletion.routes';
import editRequestRoutes from './routes/edit_request.routes';
import adminRoutes from './routes/admin.routes';
import sseRoutes from './routes/sse.routes';
import enforcementRoutes from './routes/enforcement.routes';
import { warmUpConnection } from './config/prisma';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Serve static uploads
const isVercel = process.env.VERCEL === '1';
const uploadsDir = isVercel 
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(process.cwd(), 'uploads');
app.use('/api/uploads', express.static(uploadsDir));

// ── Public routes ─────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ── Protected routes ──────────────────────────────────────────────────
app.use('/api/offenders', offendersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/police-stations', policeStationRoutes);
app.use('/api/cases', casesRoutes);

// ── Workflow routes ───────────────────────────────────────────────────
app.use('/api/deletion-requests', deletionRoutes);
app.use('/api/edit-requests', editRequestRoutes);

// ── Admin routes ──────────────────────────────────────────────────────
app.use('/api/admin', adminRoutes);

// ── Real-time (SSE) routes ────────────────────────────────────────────
app.use('/api/sse', sseRoutes);

// ── Enforcement routes ────────────────────────────────────────────────
app.use('/api/enforcement', enforcementRoutes);

// ── Wake-up endpoint (warms Neon DB from sleep) ───────────────────────
app.get('/api/wake', async (req, res) => {
  const start = Date.now();
  const ok = await warmUpConnection();
  const elapsed = Date.now() - start;
  if (ok) {
    res.json({ status: 'ok', dbReady: true, latencyMs: elapsed });
  } else {
    res.status(503).json({ status: 'error', dbReady: false, latencyMs: elapsed });
  }
});

// ── Health check ──────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Garuda API is running smoothly!' });
});

const PORT = process.env.PORT || 8081;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
