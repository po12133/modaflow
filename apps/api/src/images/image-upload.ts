import { HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppError } from '../common/app-error.js';
import { MAX_UPLOAD_BYTES } from './image-processing.js';

export const imageUpload = FileInterceptor('file', {
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 2 },
  fileFilter: (_req, file, cb) =>
    /^image\/(jpeg|png|webp)$/.test(file.mimetype)
      ? cb(null, true)
      : cb(new AppError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'INVALID_IMAGE', 'Usa imágenes JPG, PNG o WebP.'), false),
});
