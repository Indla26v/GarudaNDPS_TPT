import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';

const isVercel = process.env.VERCEL === '1';
const uploadsDir = isVercel 
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype.includes('spreadsheet') ||
      file.mimetype.includes('excel') ||
      file.originalname.match(/\.(xlsx|xls|csv)$/i);
    cb(null, !!ok);
  },
});

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

export const uploadPhoto = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      // ── SECURITY FIX #18: Sanitize filename extension
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `photo-${uniqueSuffix}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    // ── SECURITY FIX #18: Reject SVG and enforce allowed extensions
    const ext = path.extname(file.originalname).toLowerCase();
    const isImageMime = file.mimetype.startsWith('image/') && !file.mimetype.includes('svg');
    const isValidExt = ALLOWED_IMAGE_EXTENSIONS.includes(ext);
    
    if (isImageMime && isValidExt) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, GIF, and WEBP images are allowed.') as any, false);
    }
  }
});

export const uploadDocument = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      // ── SECURITY FIX #18: Sanitize filename extension
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `doc-${uniqueSuffix}${ext}`);
    }
  }),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (_req, file, cb) => {
    // Block potentially dangerous scripts/HTML
    if (file.mimetype.includes('html') || file.mimetype.includes('javascript') || file.mimetype.includes('svg') || path.extname(file.originalname).toLowerCase() === '.svg') {
      return cb(new Error('Invalid file type.') as any, false);
    }

    const ok =
      file.mimetype.startsWith('image/') ||
      file.mimetype === 'application/pdf' ||
      file.mimetype.includes('msword') ||
      file.mimetype.includes('officedocument') ||
      file.originalname.match(/\.(pdf|doc|docx|jpg|jpeg|png|txt|webp)$/i);
    cb(null, !!ok);
  }
});

// ── Finance statement upload (CSV / XLSX / PDF) ────────────────────────
// Held in memory so the parser can read the buffer directly.
export const uploadStatement = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const okExt = ['.csv', '.xlsx', '.xls', '.pdf'].includes(ext);
    const okMime =
      file.mimetype.includes('spreadsheet') ||
      file.mimetype.includes('excel') ||
      file.mimetype.includes('csv') ||
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/vnd.ms-excel';
    if (okExt || okMime) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV, XLSX, and PDF statements are allowed.') as any, false);
    }
  }
});
