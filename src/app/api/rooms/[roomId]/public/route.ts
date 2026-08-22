import { NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api';
import { getPublicRoom } from '@/lib/server/room-store';
import { roomIdSchema } from '@/lib/timer/validation';

export async function GET(_request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const roomId = roomIdSchema.parse((await context.params).roomId);
    const response = NextResponse.json(await getPublicRoom(roomId));
    response.headers.set('Cache-Control', 'public, s-maxage=1, stale-while-revalidate=1');
    return response;
  } catch (error) {
    return apiError(error);
  }
}
