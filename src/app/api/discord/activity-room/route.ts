import { NextResponse } from 'next/server';
import { apiError, rateLimited } from '@/lib/server/api';
import { deriveDiscordActivityHostToken, verifyDiscordAccessToken } from '@/lib/server/discord-oauth';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { joinDiscordActivityRoom } from '@/lib/server/room-store';
import { bearerToken, requestIp } from '@/lib/server/security';
import { discordActivityRoomSchema } from '@/lib/timer/validation';

export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit(`discord-activity:${requestIp(request)}`, 30, 60);
    if (!rate.allowed) return rateLimited(rate.retryAfter);
    const accessToken = bearerToken(request);
    if (!accessToken) return NextResponse.json({ error: 'Discord認証が必要です。' }, { status: 401 });
    const input = discordActivityRoomSchema.parse(await request.json());
    const discordUser = await verifyDiscordAccessToken(accessToken);
    const recoveryToken = deriveDiscordActivityHostToken(input.instanceId, discordUser.id);
    return NextResponse.json(await joinDiscordActivityRoom(input.instanceId, input.clientId, recoveryToken), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
