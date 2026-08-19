import { NextResponse } from 'next/server';
import { apiError, rateLimited } from '@/lib/server/api';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { heartbeat } from '@/lib/server/room-store';
import { bearerToken, requestIp } from '@/lib/server/security';
import { heartbeatSchema, roomIdSchema } from '@/lib/timer/validation';

export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const rate = await checkRateLimit(`heartbeat:${requestIp(request)}`, 600, 60);
    if (!rate.allowed) return rateLimited(rate.retryAfter);
    const roomId = roomIdSchema.parse((await context.params).roomId);
    const input = heartbeatSchema.parse(await request.json());
    return NextResponse.json(await heartbeat(roomId, input.clientId, bearerToken(request)));
  } catch (error) {
    return apiError(error);
  }
}
