import { HttpStatus, Injectable } from '@nestjs/common';
import { PasswordService } from '../../auth/password.service.js';
import { AppError } from '../../common/app-error.js';
import { secretHint } from '../../common/secret-box.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { IntegrationRow, IntegrationSection } from '../../integrations/integration-config.js';
import { IntegrationConfigService } from '../../integrations/integration-config.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { SectionDto } from './dto.js';
import { describeSection, SECTION_FIELDS, sectionColumns } from './integration-fields.js';
import { type TestResult, testAi, testEmail, testStorage } from './integration-testers.js';

const PLAIN_MARK = 'plain:';
const MISSING: Record<IntegrationSection, string> = {
  storage: 'Faltan datos: bucket, Access Key ID y Secret Access Key son obligatorios.',
  ai: 'Falta la llave de la API de Claude.',
  email: 'Faltan datos: servidor SMTP y correo remitente son obligatorios.',
};

@Injectable()
export class AdminIntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationConfigService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  async view() {
    const row = await this.prisma.integrationSettings.findUniqueOrThrow({ where: { id: 1 }, include: { updatedBy: { select: { name: true } } } });
    const resolved = this.integrations.resolve(row);
    const readable = (blob: string) => this.integrations.decrypt(blob) !== null;
    const section = (s: IntegrationSection) => ({ active: resolved[s] !== null, ...describeSection(s, row, this.integrations.env, readable) });
    return {
      encryptionReady: this.integrations.canEncrypt,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy?.name ?? null,
      storage: section('storage'),
      ai: section('ai'),
      email: section('email'),
    };
  }

  async update(section: IntegrationSection, dto: SectionDto, staffId: string, ip: string | null) {
    await this.reauth(staffId, dto.currentPassword);
    const { plain, secrets } = SECTION_FIELDS[section];
    const input = dto as unknown as Record<string, unknown>;
    const row = await this.prisma.integrationSettings.findUniqueOrThrow({ where: { id: 1 } });
    const data: Record<string, unknown> = {};
    const changed: Record<string, unknown> = {};
    const replaced: string[] = [];
    for (const [name, f] of Object.entries(plain)) {
      if (input[name] === undefined) continue;
      const value = input[name] === '' ? null : input[name];
      if (value !== row[f.column]) changed[name] = data[f.column] = value;
    }
    for (const [name, f] of Object.entries(secrets)) {
      const value = input[name];
      if (value === undefined || (value === null && !row[f.enc])) continue;
      if (typeof value === 'string') {
        if (!this.integrations.canEncrypt) throw new AppError(HttpStatus.SERVICE_UNAVAILABLE, 'ENCRYPTION_KEY_MISSING', 'Falta SETTINGS_ENCRYPTION_KEY en el servidor: no se pueden guardar llaves desde el panel.');
        data[f.enc] = this.integrations.encrypt(value);
        data[f.hint] = secretHint(value);
      } else {
        data[f.enc] = data[f.hint] = null;
      }
      replaced.push(name);
    }
    if (Object.keys(data).length > 0) {
      await this.prisma.integrationSettings.update({ where: { id: 1 }, data: { ...(data as Prisma.IntegrationSettingsUpdateInput), updatedBy: { connect: { id: staffId } } } });
      await this.audit.record({ actorId: staffId, action: 'INTEGRATION_UPDATED', entityType: 'Integration', entityId: section, after: { changed, credentialsReplaced: replaced }, ip });
      await this.integrations.refresh();
    }
    return this.view();
  }

  async reset(section: IntegrationSection, currentPassword: string, staffId: string, ip: string | null) {
    await this.reauth(staffId, currentPassword);
    const data = Object.fromEntries(sectionColumns(section).map((c) => [c, null]));
    await this.prisma.integrationSettings.update({ where: { id: 1 }, data: { ...(data as Prisma.IntegrationSettingsUpdateInput), updatedBy: { connect: { id: staffId } } } });
    await this.audit.record({ actorId: staffId, action: 'INTEGRATION_RESET', entityType: 'Integration', entityId: section, after: { source: 'env' }, ip });
    await this.integrations.refresh();
    return this.view();
  }

  async test(section: IntegrationSection, dto: SectionDto, staffId: string, ip: string | null): Promise<TestResult> {
    const staff = await this.reauth(staffId, dto.currentPassword);
    const row: IntegrationRow = { ...(await this.prisma.integrationSettings.findUniqueOrThrow({ where: { id: 1 } })) };
    const input = dto as unknown as Record<string, unknown>;
    const draft = row as unknown as Record<string, unknown>;
    const { plain, secrets } = SECTION_FIELDS[section];
    for (const [name, f] of Object.entries(plain)) if (input[name] !== undefined) draft[f.column] = input[name] === '' ? null : input[name];
    for (const [name, f] of Object.entries(secrets)) if (input[name] !== undefined) draft[f.enc] = typeof input[name] === 'string' ? `${PLAIN_MARK}${input[name] as string}` : null;
    const candidate = this.integrations.resolve(row, (blob) => (blob.startsWith(PLAIN_MARK) ? blob.slice(PLAIN_MARK.length) : this.integrations.decrypt(blob)));
    let result: TestResult;
    if (section === 'storage') result = candidate.storage ? await testStorage(candidate.storage) : { ok: false, message: MISSING.storage };
    else if (section === 'ai') result = candidate.ai ? await testAi(candidate.ai) : { ok: false, message: MISSING.ai };
    else result = candidate.email ? await testEmail(candidate.email, staff.email) : { ok: false, message: MISSING.email };
    await this.audit.record({ actorId: staffId, action: 'INTEGRATION_TESTED', entityType: 'Integration', entityId: section, after: { ok: result.ok }, result: result.ok ? 'SUCCESS' : 'FAILURE', ip });
    return result;
  }

  private async reauth(staffId: string, password: string) {
    const staff = await this.prisma.staff.findUniqueOrThrow({ where: { id: staffId }, select: { email: true, passwordHash: true } });
    if (!staff.passwordHash || !(await this.passwords.verify(staff.passwordHash, password))) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'INVALID_PASSWORD', 'Tu contraseña actual no es correcta.', { errors: { currentPassword: ['Tu contraseña actual no es correcta.'] } });
    }
    return staff;
  }
}
