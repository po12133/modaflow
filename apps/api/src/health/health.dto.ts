import { ApiProperty } from '@nestjs/swagger';

export class DatabaseHealthDto {
  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  status!: 'up' | 'down';

  @ApiProperty({ example: 3, description: 'Round-trip time of the probe query (ms)' })
  latencyMs!: number;
}

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'error'], example: 'ok' })
  status!: 'ok' | 'error';

  @ApiProperty({ example: 'modaflow-api' })
  service!: string;

  @ApiProperty({ enum: ['development', 'staging', 'production'], example: 'production' })
  environment!: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: 42, description: 'Process uptime in seconds' })
  uptime!: number;

  @ApiProperty({ type: DatabaseHealthDto })
  database!: DatabaseHealthDto;
}
