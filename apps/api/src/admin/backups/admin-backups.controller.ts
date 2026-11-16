import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AppError } from '../../common/app-error.js';
import { clientIp } from '../../common/client-ip.js';
import { CurrentStaff, type StaffContext } from '../auth/staff-context.js';
import { AdminArea, SuperadminOnly } from '../staff-roles.guard.js';
import { BackupsService } from './backups.service.js';

export const MAX_BACKUP_BYTES = 500 * 1024 * 1024;

const backupUpload = FileInterceptor('file', { limits: { fileSize: MAX_BACKUP_BYTES, files: 1, fields: 1 } });

@ApiTags('admin')
@AdminArea()
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('admin/backups')
export class AdminBackupsController {
  constructor(private readonly backups: BackupsService) {}

  @Get()
  @ApiOperation({ summary: 'Backups cifrados (base de datos completa + inventario de archivos) y estado de la configuración' })
  list() {
    return this.backups.list();
  }

  @Post()
  @SuperadminOnly()
  @ApiOperation({ summary: 'Crear un backup ahora (se guarda cifrado en el S3 configurado)' })
  create(@CurrentStaff() a: StaffContext, @Req() req: Request) {
    return this.backups.start(a.staffId, clientIp(req));
  }

  @Post('import')
  @SuperadminOnly()
  @UseInterceptors(backupUpload)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Importar un archivo .mfbackup (se verifica con la clave del servidor y se guarda en el S3)' })
  import(@UploadedFile() file: Express.Multer.File | undefined, @CurrentStaff() a: StaffContext, @Req() req: Request) {
    if (!file) throw new AppError(HttpStatus.BAD_REQUEST, 'INVALID_BACKUP', 'Selecciona el archivo .mfbackup.');
    return this.backups.import(file.buffer, a.staffId, clientIp(req));
  }

  @Post(':id/download')
  @SuperadminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enlace temporal (5 min) para descargar el backup cifrado' })
  download(@Param('id', new ParseUUIDPipe()) id: string, @CurrentStaff() a: StaffContext, @Req() req: Request) {
    return this.backups.download(id, a.staffId, clientIp(req));
  }

  @Delete(':id')
  @SuperadminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un backup y su archivo del S3' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string, @CurrentStaff() a: StaffContext, @Req() req: Request) {
    await this.backups.remove(id, a.staffId, clientIp(req));
  }
}
