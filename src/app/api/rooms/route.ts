import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { apiError, rateLimited } from '@/lib/server/api';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { createRoom } from '@/lib/server/room-store';
import { requestIp } from '@/lib/server/security';
import { createRoomSchema, minutesToSettings } from '@/lib/timer/validation';

export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit(`create:${requestIp(request)}`, 10, 60);
    if (!rate.allowed) return rateLimited(rate.retryAfter);
    const input = createRoomSchema.parse(await request.json());
    const clientId = request.headers.get('x-client-id') ?? crypto.randomUUID();
    const roomId = input.roomId ?? randomBytes(5).toString('hex');
    const result = await createRoom(roomId, minutesToSettings(input.settings), clientId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
