import { NextResponse } from 'next/server';
import { apiError, rateLimited } from '@/lib/server/api';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { commandRoom } from '@/lib/server/room-store';
import { bearerToken, requestIp } from '@/lib/server/security';
import { roomIdSchema, timerCommandSchema } from '@/lib/timer/validation';

export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const rate = await checkRateLimit(`command:${requestIp(request)}`, 120, 60);
    if (!rate.allowed) return rateLimited(rate.retryAfter);
    const roomId = roomIdSchema.parse((await context.params).roomId);
    const input = timerCommandSchema.parse(await request.json());
    const result = await commandRoom(roomId, input.command, input.clientId, bearerToken(request));
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
