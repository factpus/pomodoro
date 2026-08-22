import { NextResponse } from 'next/server';
import { apiError, rateLimited } from '@/lib/server/api';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { acceptHostTransfer } from '@/lib/server/room-store';
import { requestIp } from '@/lib/server/security';
import { hostTransferClientSchema, roomIdSchema } from '@/lib/timer/validation';

export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const rate = await checkRateLimit(`host-transfer:${requestIp(request)}`, 20, 60);
    if (!rate.allowed) return rateLimited(rate.retryAfter);
    const roomId = roomIdSchema.parse((await context.params).roomId);
    const input = hostTransferClientSchema.parse(await request.json());
    return NextResponse.json(await acceptHostTransfer(roomId, input.clientId));
  } catch (error) {
    return apiError(error);
  }
}
