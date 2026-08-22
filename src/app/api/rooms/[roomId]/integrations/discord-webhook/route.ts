import { NextResponse } from 'next/server';
import { apiError, rateLimited } from '@/lib/server/api';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { connectDiscordWebhook, disconnectDiscordWebhook } from '@/lib/server/room-store';
import { bearerToken, requestIp } from '@/lib/server/security';
import { discordWebhookSchema, roomIdSchema } from '@/lib/timer/validation';

export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const rate = await checkRateLimit(`integration:${requestIp(request)}`, 10, 60);
    if (!rate.allowed) return rateLimited(rate.retryAfter);
    const roomId = roomIdSchema.parse((await context.params).roomId);
    const input = discordWebhookSchema.parse(await request.json());
    return NextResponse.json(await connectDiscordWebhook(roomId, bearerToken(request), input.webhookUrl));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const rate = await checkRateLimit(`integration:${requestIp(request)}`, 10, 60);
    if (!rate.allowed) return rateLimited(rate.retryAfter);
    const roomId = roomIdSchema.parse((await context.params).roomId);
    return NextResponse.json(await disconnectDiscordWebhook(roomId, bearerToken(request)));
  } catch (error) {
    return apiError(error);
  }
}
