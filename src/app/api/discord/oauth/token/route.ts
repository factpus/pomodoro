import { NextResponse } from 'next/server';
import { apiError, rateLimited } from '@/lib/server/api';
import { exchangeDiscordCode } from '@/lib/server/discord-oauth';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { requestIp } from '@/lib/server/security';
import { discordOAuthCodeSchema } from '@/lib/timer/validation';

export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit(`discord-oauth:${requestIp(request)}`, 20, 60);
    if (!rate.allowed) return rateLimited(rate.retryAfter);
    const input = discordOAuthCodeSchema.parse(await request.json());
    const result = await exchangeDiscordCode(input.code);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
