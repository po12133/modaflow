import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CurrentAuth } from '../auth/decorators.js';
import { AppError } from '../common/app-error.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { RequireActiveSubscription } from '../subscriptions/subscription.guard.js';
import { CurrentTenant, TenantScoped } from '../tenancy/decorators.js';
import { MAX_UPLOAD_BYTES } from './image-processing.js';
import { ImagesService } from './images.service.js';

class UploadImageDto {
  @ApiProperty({ description: 'Id del producto (o borrador generado por el cliente al crear uno nuevo)' })
  @IsUUID('4')
  productId!: string;
}

export class ImageViewDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, type: String, description: 'URL firmada (temporal) de la versión principal' })
  url!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'URL firmada (temporal) de la miniatura' })
  thumbUrl!: string | null;
  @ApiProperty() width!: number;
  @ApiProperty() height!: number;
  @ApiProperty() position!: number;
  @ApiProperty() isPrimary!: boolean;
}

const ACCEPTED_MIME = /^image\/(jpeg|png|webp)$/;

@ApiTags('product-images')
@TenantScoped()
@Controller('product-images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Post()
  @RequireActiveSubscription()
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 },
      // First filter on the declared type; the real content is verified by decoding it.
      fileFilter: (_req, file, cb) => {
        if (ACCEPTED_MIME.test(file.mimetype)) cb(null, true);
        else
          cb(
            new AppError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'INVALID_IMAGE', 'Usa fotos JPG, PNG o WebP.'),
            false,
          );
      },
    }),
  )
  @ApiOperation({ summary: 'Subir una foto de prenda (máx. 10 MB; se optimiza a WebP y se guarda en S3)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'productId'],
      properties: { file: { type: 'string', format: 'binary' }, productId: { type: 'string', format: 'uuid' } },
    },
  })
  @ApiCreatedResponse({ type: ImageViewDto })
  async upload(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body() dto: UploadImageDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<ImageViewDto> {
    if (!file) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'INVALID_IMAGE', 'Selecciona una foto.');
    }
    return this.images.upload(tenant.tenantId, auth.userId, dto.productId, file.buffer);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una foto que aún no se guardó con un producto' })
  @ApiNoContentResponse()
  async deletePending(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.images.deletePending(tenant.tenantId, id);
  }
}
