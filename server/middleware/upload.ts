// Multer middleware — supplier document uploads in memory (single field "file", size/type limits).
import type { NextFunction, Request, Response } from "express";
import multer from "multer";

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const storage = multer.memoryStorage();

const MAGIC_BYTES: Record<string, number[][]> = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "image/jpeg": [[0xff, 0xd8, 0xff]], // JFIF/EXIF
  "image/jpg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]], // .PNG
  "application/msword": [[0xd0, 0xcf, 0x11, 0xe0]], // OLE2
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [[0x50, 0x4b, 0x03, 0x04]], // ZIP (docx)
};

export const supplierDocumentUpload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

// Runs multer only for multipart requests so application/json bodies still reach express.json().
export function uploadSupplierDocumentIfMultipart(req: Request, res: Response, next: NextFunction): void {
  const ct = String(req.headers["content-type"] ?? "").toLowerCase();
  if (ct.includes("multipart/form-data")) {
    supplierDocumentUpload.single("file")(req, res, next);
    return;
  }
  next();
}

export function validateFileMagicBytes(req: Request, res: Response, next: NextFunction): void {
  if (!req.file) {
    next();
    return;
  }

  const expected = MAGIC_BYTES[req.file.mimetype];
  if (!expected) {
    res.status(400).json({ error: "Unsupported file type" });
    return;
  }

  const buf = req.file.buffer;
  const match = expected.some((sig) => sig.every((byte, i) => buf[i] === byte));

  if (!match) {
    res.status(400).json({ error: "File content does not match declared type" });
    return;
  }

  next();
}
