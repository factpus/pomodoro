import Timer from '@/app/components/Timer';
import { roomIdSchema } from '@/lib/timer/validation';
import { notFound } from 'next/navigation';

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const parsed = roomIdSchema.safeParse((await params).roomId);
  if (!parsed.success) notFound();
  return <Timer roomId={parsed.data} />;
}
