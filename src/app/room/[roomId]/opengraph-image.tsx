import { ImageResponse } from 'next/og';
import { getPublicRoom } from '@/lib/server/room-store';
import { roomIdSchema } from '@/lib/timer/validation';

export const alt = 'Pomodoro Togetherの共有ルーム';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ roomId: string }> }) {
  const parsed = roomIdSchema.safeParse((await params).roomId);
  const roomId = parsed.success ? parsed.data : 'shared-room';
  let settings = '仲間と同じリズムで集中しよう';

  if (parsed.success) {
    try {
      const room = await getPublicRoom(roomId);
      settings = `集中 ${Math.max(1, Math.round(room.state.focusSeconds / 60))}分  •  休憩 ${Math.max(1, Math.round(room.state.shortBreakSeconds / 60))}分`;
    } catch {
      // The room may expire between sharing and preview generation.
    }
  }

  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 90, color: '#f8fafc', background: 'radial-gradient(circle at 15% 0%, #164e63, #070b17 60%)', fontFamily: 'sans-serif' }}>
      <div style={{ color: '#67e8f9', fontSize: 28, letterSpacing: 6, textTransform: 'uppercase' }}>Join the focus room</div>
      <div style={{ marginTop: 28, fontSize: 54, color: '#cbd5e1' }}>Pomodoro Together</div>
      <div style={{ marginTop: 22, fontSize: 80, fontWeight: 800, letterSpacing: -3 }}>#{roomId}</div>
      <div style={{ marginTop: 38, display: 'flex', border: '2px solid #334155', borderRadius: 999, padding: '14px 28px', fontSize: 30 }}>{settings}</div>
    </div>,
    size,
  );
}
