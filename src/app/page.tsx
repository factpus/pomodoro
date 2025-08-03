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
      const query = `?work=${workTime}&break=${breakTime}`;
      router.push(`/room/${roomId.trim()}${query}`);
    }
  };

  const generateRandomRoomId = () => {
    const randomId = Math.random().toString(36).substring(2, 8);
    setRoomId(randomId);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-4 sm:p-8">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl p-8 space-y-8">
        
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-white">Pomodoro Together</h1>
          <p className="text-gray-400 mt-2">Create or join a room to start focusing.</p>
        </div>

        <TimeSettings 
          workTime={workTime} 
          setWorkTime={setWorkTime} 
          breakTime={breakTime} 
          setBreakTime={setBreakTime} 
        />

        <form onSubmit={joinRoom} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="roomId" className="text-sm font-medium text-gray-300">Room Name</label>
            <div className="flex space-x-2">
              <input
                id="roomId"
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="your-room-name"
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                required
              />
              <button type="button" onClick={generateRandomRoomId} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition">
                🎲
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-800"
          >
            Join & Start Focusing
          </button>
        </form>
      </div>

      <footer className="text-center mt-8 text-gray-500">
          <p>Made by factpus</p>
      </footer>
    </main>
  );
}
