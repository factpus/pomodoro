'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import io from 'socket.io-client';
import VolumeControl from './VolumeControl';

const socket = io();

interface TimerState {
  time: number;
  isActive: boolean;
  phase: 'work' | 'break';
}

const Timer = ({ roomId }: { roomId: string }) => {
  const [state, setState] = useState<TimerState>({ time: 25 * 60, isActive: false, phase: 'work' });
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0.5); // ボリュームの状態を追加 (0.0 to 1.0)
  const searchParams = useSearchParams();

  const workAudioRef = useRef<HTMLAudioElement>(null);
  const breakAudioRef = useRef<HTMLAudioElement>(null);
  const [isInteracted, setIsInteracted] = useState(false);

  useEffect(() => {
    socket.on('timer:tick', (newState: TimerState) => {
      setState(newState);
    });

    if (roomId) {
      const workTime = searchParams.get('work');
      const breakTime = searchParams.get('break');
      socket.emit('room:join', {
        roomId,
        settings: {
          workTime: workTime ? parseInt(workTime, 10) : null,
          breakTime: breakTime ? parseInt(breakTime, 10) : null,
        }
      });
    }

    return () => {
      socket.off('timer:tick');
    };
  }, [roomId, searchParams]);

  // オーディオのミュートとボリュームを同期
  useEffect(() => {
    const workAudio = workAudioRef.current;
    const breakAudio = breakAudioRef.current;
    if (workAudio) {
        workAudio.muted = isMuted;
        workAudio.volume = volume;
    }
    if (breakAudio) {
        breakAudio.muted = isMuted;
        breakAudio.volume = volume;
    }
  }, [isMuted, volume]);

  // 曲の再生/停止を管理
  useEffect(() => {
    if (!isInteracted) return;

    const workAudio = workAudioRef.current;
    const breakAudio = breakAudioRef.current;

    if (state.isActive) {
      if (state.phase === 'work') {
        workAudio?.play().catch(e => console.error("Audio play failed:", e));
        breakAudio?.pause();
      } else {
        breakAudio?.play().catch(e => console.error("Audio play failed:", e));
        workAudio?.pause();
      }
    } else {
      workAudio?.pause();
      breakAudio?.pause();
    }
  }, [state.isActive, state.phase, isInteracted]);

  const handleInteraction = () => {
    if (!isInteracted) {
      workAudioRef.current?.load();
      breakAudioRef.current?.load();
      setIsInteracted(true);
    }
  };

  const handleToggle = () => {
    handleInteraction();
    if (state.isActive) {
      socket.emit('timer:pause', roomId);
    } else {
      socket.emit('timer:start', roomId);
    }
  };

  const handleReset = () => {
    handleInteraction();
    socket.emit('timer:reset', roomId);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const phaseText = state.phase === 'work' ? 'Work Time' : 'Break Time';
  const bgColor = state.phase === 'work' ? 'bg-red-500' : 'bg-green-500';

  return (
    <div className="relative">
      <VolumeControl 
        isMuted={isMuted} 
        setIsMuted={setIsMuted} 
        volume={volume} 
        setVolume={setVolume} 
      />
      <div className={`p-8 rounded-lg transition-colors duration-500 ${bgColor}`}>
          <h2 className="text-3xl font-bold text-white mb-4 text-center">{phaseText}</h2>
          <div className="text-9xl font-bold mb-8 text-white text-center">{formatTime(state.time)}</div>
          <div className="flex justify-center space-x-4">
              <button
              onClick={handleToggle}
              className="bg-white text-gray-800 font-bold py-2 px-4 rounded w-32"
              >
              {state.isActive ? 'Pause' : 'Start'}
              </button>
              <button
              onClick={handleReset}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded w-32"
              >
              Reset
              </button>
          </div>
      </div>
      {/* 非表示のオーディオプレーヤー */}
      <audio ref={workAudioRef} src="/music/work.mp3" loop preload="auto"></audio>
      <audio ref={breakAudioRef} src="/music/break.mp3" loop preload="auto"></audio>
    </div>
  );
};

export default Timer;
