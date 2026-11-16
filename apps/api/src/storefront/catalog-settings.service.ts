import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { Prisma } from '../generated/prisma/client.js';
import { imageKeys, processProductImage } from '../images/image-processing.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import type { UpdateCatalogSettingsDto } from './dto/settings.dto.js';
import { slugForName, slugRace } from '../stores/store-address.js';
import { StorefrontAccessService } from './storefront-access.service.js';

@Injectable()
export class CatalogSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly access: StorefrontAccessService,
  ) {}

  private async store(tenantId: string) {
    const store = await this.prisma.store.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    if (!store) throw new AppError(HttpStatus.NOT_FOUND, 'STORE_NOT_FOUND', 'No se encontró la tienda.');
    const settings = await this.prisma.catalogSettings.upsert({
      where: { storeId: store.id },
      create: { tenantId, storeId: store.id },
      update: {},
    });
    return { store, settings };
  }

  async get(tenantId: string) {
    const [{ store, settings }, online] = await Promise.all([this.store(tenantId), this.access.isOnline(tenantId)]);
    const [logo, cover] = await Promise.all([this.url(settings.logoKey), this.url(settings.coverKey)]);
    return {
      name: store.name,
      slug: store.slug,
      publicCode: store.publicCode,
      description: store.description,
      whatsapp: store.whatsapp,
      city: store.city,
      primaryColor: store.primaryColor,
      secondaryColor: settings.secondaryColor,
      welcomeMessage: settings.welcomeMessage,
      outOfStock: settings.outOfStock,
      status: settings.status,
      logoUrl: logo,
      coverUrl: cover,
      publicPath: `/${store.slug}`,
      permanentPath: `/${store.publicCode}`,
      planAllowsCatalog: online,
      isPublic: online && settings.status === 'PUBLISHED',
    };
  }

  async update(tenantId: string, dto: UpdateCatalogSettingsDto) {
    await this.access.assertManage(tenantId);
    const { store, settings } = await this.store(tenantId);
    const slug = dto.name !== undefined ? await slugForName(this.prisma, dto.name, store) : undefined;
    try {
      await this.prisma.$transaction([
        this.prisma.store.update({
          where: { id: store.id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(slug && slug !== store.slug ? { slug } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.whatsapp !== undefined ? { whatsapp: dto.whatsapp } : {}),
            ...(dto.primaryColor !== undefined ? { primaryColor: dto.primaryColor } : {}),
          },
        }),
        this.prisma.catalogSettings.update({
          where: { id: settings.id },
          data: {
            ...(dto.secondaryColor !== undefined ? { secondaryColor: dto.secondaryColor } : {}),
            ...(dto.welcomeMessage !== undefined ? { welcomeMessage: dto.welcomeMessage } : {}),
            ...(dto.outOfStock !== undefined ? { outOfStock: dto.outOfStock } : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
          },
        }),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw slugRace();
      }
      throw error;
    }
    return this.get(tenantId);
  }

  async uploadMedia(tenantId: string, kind: 'logo' | 'cover', file: Buffer) {
    if (kind === 'cover') await this.access.assertManage(tenantId);
    this.storage.assertConfigured();
    const { settings } = await this.store(tenantId);
    const processed = await processProductImage(file);
    const storageKey = `tenants/${tenantId}/catalog/${kind}-${randomUUID()}`;
    const keys = imageKeys(storageKey);
    await this.storage.put(keys.main, processed.main, processed.contentType);
    await this.storage.put(keys.thumb, processed.thumb, processed.contentType);
    const previous = kind === 'logo' ? settings.logoKey : settings.coverKey;
    await this.prisma.catalogSettings.update({ where: { id: settings.id }, data: kind === 'logo' ? { logoKey: storageKey } : { coverKey: storageKey } });
    if (previous) await this.removeObjects(previous);
    return this.get(tenantId);
  }

  async removeMedia(tenantId: string, kind: 'logo' | 'cover') {
    if (kind === 'cover') await this.access.assertManage(tenantId);
    const { settings } = await this.store(tenantId);
    const previous = kind === 'logo' ? settings.logoKey : settings.coverKey;
    await this.prisma.catalogSettings.update({ where: { id: settings.id }, data: kind === 'logo' ? { logoKey: null } : { coverKey: null } });
    if (previous) await this.removeObjects(previous);
    return this.get(tenantId);
  }

  async url(storageKey: string | null, variant: 'main' | 'thumb' = 'main'): Promise<string | null> {
    if (!storageKey) return null;
    try {
      return await this.storage.fileUrl(imageKeys(storageKey)[variant]);
    } catch {
      return null;
    }
  }

  private async removeObjects(storageKey: string) {
    const keys = imageKeys(storageKey);
    try {
      await this.storage.deleteMany([keys.main, keys.thumb]);
    } catch {
      return;
    }
  }
}
