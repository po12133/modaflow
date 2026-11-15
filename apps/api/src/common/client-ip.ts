import type { Request } from 'express';

export function clientIp(req: Request): string | null {
  return (req.ip ?? req.socket.remoteAddress ?? null)?.slice(0, 64) ?? null;
}
