'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TimeSettings from '@/app/components/TimeSettings';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [workTime, setWorkTime] = useState(25);
  const [breakTime, setBreakTime] = useState(5);
  const router = useRouter();

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      // URLクエリとして時間設定を追加
      const query = `?work=${workTime}&break=${breakTime}`;
      router.push(`/room/${roomId.trim()}${query}`);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-800">
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-2 text-white">Pomodoro Timer</h1>
        <p className="text-lg text-gray-400 mb-8">Create or Join a Room</p>
      </div>
      <form onSubmit={joinRoom} className="flex flex-col items-center">
        <input
          type="text"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Enter Room Name"
          className="text-black text-center text-2xl p-2 border rounded mb-4"
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded text-lg"
        >
          Join Room
        </button>
      </form>
      <TimeSettings 
        workTime={workTime} 
        setWorkTime={setWorkTime} 
        breakTime={breakTime} 
        setBreakTime={setBreakTime} 
      />
    </main>
  );
}
