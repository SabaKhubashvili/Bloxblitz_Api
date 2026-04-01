import type { Request } from 'express';

/**
 * Best-effort client IP for API requests (matches edge / proxy headers).
 */
export function clientIpFromRequest(req: Request): string | null {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return cf.trim();

  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();

  const raw = req.socket?.remoteAddress;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();

  return null;
}
