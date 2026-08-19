import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function createHostToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokenMatches(token: string | null, expectedHash: string): boolean {
  if (!token) return false;
  const actual = Buffer.from(hashToken(token));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function bearerToken(request: Request): string | null {
  const value = request.headers.get('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7).trim() || null : null;
}

export function requestIp(request: Request): string {
  return (
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}
