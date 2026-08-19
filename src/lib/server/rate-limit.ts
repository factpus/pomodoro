import 'server-only';

import { redisClient } from './redis';

interface RateEntry {
  count: number;
  expiresAt: number;
}

const globalRateState = globalThis as typeof globalThis & {
  __pomodoroRateLimits?: Map<string, RateEntry>;
};
const memoryLimits = globalRateState.__pomodoroRateLimits ?? new Map<string, RateEntry>();
globalRateState.__pomodoroRateLimits = memoryLimits;

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const redis = redisClient();
  if (redis) {
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const redisKey = `pomodoro:rate:${key}:${bucket}`;
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSeconds + 1);
    return { allowed: count <= limit, retryAfter: windowSeconds };
  }

  const now = Date.now();
  const current = memoryLimits.get(key);
  if (!current || current.expiresAt <= now) {
    memoryLimits.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfter: windowSeconds };
  }
  current.count += 1;
  return {
    allowed: current.count <= limit,
    retryAfter: Math.max(1, Math.ceil((current.expiresAt - now) / 1000)),
  };
}
