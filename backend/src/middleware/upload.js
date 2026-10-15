import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

/**
 * Single-image upload held in memory (the files are chest X-rays of at most a
 * few MB and go straight to private storage).
 *
 * The client's Content-Type and file name are not trusted: the type is decided
 * from the file's own magic bytes in `sniffImage`.
 */
export function imageUpload(maxBytes) {
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 10, fieldSize: 4 * 1024 },
  }).single('image');

  return (req, res, next) => {
    parser(req, res, (error) => {
      if (error) return next(error);
      if (!req.file) return next(ApiError.validation({ image: ['An image file is required.'] }));
      next();
    });
  };
}

/** Identify JPEG or PNG from content. Returns null for anything else. */
export function sniffImage(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, index) => buffer[index] === byte)) {
    return { mime: 'image/png', ext: 'png' };
  }
  return null;
}
