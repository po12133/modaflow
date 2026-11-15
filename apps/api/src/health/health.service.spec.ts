import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  const ping = vi.fn<() => Promise<void>>();
  let service: HealthService;

  beforeEach(async () => {
    ping.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: { ping } },
        { provide: ConfigService, useValue: { get: () => 'staging' } },
      ],
    }).compile();
    service = moduleRef.get(HealthService);
  });

  it('reports ok when the database responds', async () => {
    ping.mockResolvedValue();
    const result = await service.check();
    expect(result.status).toBe('ok');
    expect(result.database.status).toBe('up');
    expect(result.environment).toBe('staging');
  });

  it('reports error when the database is unreachable', async () => {
    ping.mockRejectedValue(new Error('connection refused'));
    const result = await service.check();
    expect(result.status).toBe('error');
    expect(result.database.status).toBe('down');
  });
});
