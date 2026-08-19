import { NextResponse } from 'next/server';
import { apiError, rateLimited } from '@/lib/server/api';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { getRoom } from '@/lib/server/room-store';
import { bearerToken, requestIp } from '@/lib/server/security';
import { roomIdSchema } from '@/lib/timer/validation';

export async function GET(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const rate = await checkRateLimit(`read:${requestIp(request)}`, 600, 60);
    if (!rate.allowed) return rateLimited(rate.retryAfter);
    const roomId = roomIdSchema.parse((await context.params).roomId);
    return NextResponse.json(await getRoom(roomId, bearerToken(request)));
  } catch (error) {
    return apiError(error);
  }
}
