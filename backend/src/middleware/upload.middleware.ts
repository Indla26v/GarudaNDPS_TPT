import multer from 'multer';

export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype.includes('spreadsheet') ||
      file.mimetype.includes('excel') ||
      file.originalname.match(/\.(xlsx|xls|csv)$/i);
    cb(null, !!ok);
  },
});
