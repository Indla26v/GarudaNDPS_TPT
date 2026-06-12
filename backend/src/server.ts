import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import cookieParser from 'cookie-parser';
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
app.set('trust proxy', 1); // Required for secure cookies behind reverse proxies (e.g., Vercel, AWS)

// ── SECURITY FIX #3: Restrict CORS to known frontend origins only
// Wildcard cors() allows any website to make authenticated API requests.
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,                // Production frontend (from env)
  'https://garudandps-tpt.vercel.app',      // Default Vercel production deployment
  'http://localhost:5173',                  // Vite dev server
  'http://localhost:3000',                  // Alternate dev server
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, mobile apps)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: Origin ${origin} is not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── SECURITY FIX #16 (bonus): Security headers
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // Disabled in favor of CSP; legacy header
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ── SECURITY FIX #13 (partial): Explicit JSON body size limit
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Serve static uploads
const isVercel = process.env.VERCEL === '1';
const uploadsDir = isVercel 
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(process.cwd(), 'uploads');
// ── SECURITY FIX #18: Serve uploads with strict security headers
app.use('/api/uploads', (req, res, next) => {
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "script-src 'none'; object-src 'none'; base-uri 'none';");
  next();
}, express.static(uploadsDir));

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
