import { NextResponse } from 'next/server';
import { redisClient } from '@/lib/server/redis';
import { logServerEvent } from '@/lib/server/observability';

export async function GET() {
  const redis = redisClient();
  if (!redis) {
    const production = process.env.NODE_ENV === 'production';
    return NextResponse.json(
      { status: production ? 'unavailable' : 'degraded', storage: 'memory' },
      { status: production ? 503 : 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  try {
    await redis.ping();
    return NextResponse.json({ status: 'ok', storage: 'redis' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logServerEvent('error', 'health.redis_failed', { error: error instanceof Error ? error.name : 'unknown' });
    return NextResponse.json({ status: 'unavailable', storage: 'redis' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
