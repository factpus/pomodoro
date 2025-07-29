'use client';

import Timer from '@/app/components/Timer';
import { useParams } from 'next/navigation';

export default function RoomPage() {
  const params = useParams();
  const roomId = Array.isArray(params.roomId) ? params.roomId[0] : params.roomId;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-800">
      <h1 className="text-5xl font-bold mb-4 text-white">Pomodoro Timer</h1>
      <p className="text-xl mb-12 text-gray-400">Room: {roomId}</p>
      {roomId && <Timer roomId={roomId} />}
    </main>
  );
}
