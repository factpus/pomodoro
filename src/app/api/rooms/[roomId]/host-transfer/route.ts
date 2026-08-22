import { NextResponse } from 'next/server';
import { apiError, rateLimited } from '@/lib/server/api';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { cancelHostTransfer, requestHostTransfer } from '@/lib/server/room-store';
import { bearerToken, requestIp } from '@/lib/server/security';
import { hostTransferClientSchema, hostTransferRequestSchema, roomIdSchema } from '@/lib/timer/validation';

export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const rate = await checkRateLimit(`host-transfer:${requestIp(request)}`, 20, 60);
    if (!rate.allowed) return rateLimited(rate.retryAfter);
    const roomId = roomIdSchema.parse((await context.params).roomId);
    const input = hostTransferRequestSchema.parse(await request.json());
    return NextResponse.json(await requestHostTransfer(roomId, input.clientId, input.targetCandidateId, bearerToken(request)));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const rate = await checkRateLimit(`host-transfer:${requestIp(request)}`, 20, 60);
    if (!rate.allowed) return rateLimited(rate.retryAfter);
    const roomId = roomIdSchema.parse((await context.params).roomId);
    const input = hostTransferClientSchema.parse(await request.json());
    return NextResponse.json(await cancelHostTransfer(roomId, input.clientId, bearerToken(request)));
  } catch (error) {
    return apiError(error);
  }
}
