import Timer from '@/app/components/Timer';
import { getPublicRoom } from '@/lib/server/room-store';
import { roomIdSchema } from '@/lib/timer/validation';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type RoomPageProps = { params: Promise<{ roomId: string }> };

export async function generateMetadata({ params }: RoomPageProps): Promise<Metadata> {
  const parsed = roomIdSchema.safeParse((await params).roomId);
  if (!parsed.success) return { title: 'ルームが見つかりません' };

  try {
    const room = await getPublicRoom(parsed.data);
    const focusMinutes = Math.max(1, Math.round(room.state.focusSeconds / 60));
    const breakMinutes = Math.max(1, Math.round(room.state.shortBreakSeconds / 60));
    const title = `「${room.roomId}」に参加`;
    const description = `集中${focusMinutes}分・休憩${breakMinutes}分。仲間と同じタイマーで作業しよう。`;
    return {
      title,
      description,
      robots: { index: false, follow: false },
      openGraph: { title, description, type: 'website' },
      twitter: { card: 'summary_large_image', title, description },
    };
  } catch {
    return {
      title: `「${parsed.data}」に参加`,
      description: '仲間と同じタイマーで集中と休憩のリズムを揃えよう。',
      robots: { index: false, follow: false },
    };
  }
}

export default async function RoomPage({ params }: RoomPageProps) {
  const parsed = roomIdSchema.safeParse((await params).roomId);
  if (!parsed.success) notFound();
  return <Timer roomId={parsed.data} />;
}
