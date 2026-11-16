import { Injectable } from '@nestjs/common';
import { imageKeys } from '../images/image-processing.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

@Injectable()
export class PaymentInfoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async paymentInfo(planCode?: string) {
    const [s, plan] = await Promise.all([
      this.prisma.platformSettings.findUniqueOrThrow({ where: { id: 1 } }),
      planCode ? this.prisma.plan.findUnique({ where: { code: planCode }, select: { paymentQrKey: true } }) : null,
    ]);
    const qrKey = plan?.paymentQrKey ?? s.qrImageKey;
    return {
      methods: [...(s.qrEnabled ? ['QR' as const] : []), ...(s.transferEnabled ? ['TRANSFER' as const] : [])],
      accountHolder: s.accountHolder,
      bankName: s.bankName,
      accountNumber: s.transferEnabled ? s.accountNumber : null,
      accountType: s.transferEnabled ? s.accountType : null,
      instructions: s.paymentInstructions,
      qrImageUrl: s.qrEnabled && qrKey ? await this.storage.fileUrl(imageKeys(qrKey).main).catch(() => null) : null,
      supportWhatsapp: s.supportWhatsapp,
      currency: s.currency,
    };
  }
}
