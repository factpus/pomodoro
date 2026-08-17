'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import io from 'socket.io-client';
import VolumeControl from './VolumeControl';

const realtimeServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
const socket = realtimeServerUrl
  ? io(realtimeServerUrl, { autoConnect: false })
  : null;

interface TimerState {
  time: number;
  isActive: boolean;
  phase: 'work' | 'break';
  completedPomodoros: number;
}

const Timer = ({ roomId }: { roomId: string }) => {
  const searchParams = useSearchParams();
  const workDuration = useMemo(
    () => Math.max(1, Number(searchParams.get('work')) || 25) * 60,
    [searchParams],
  );
  const breakDuration = useMemo(
    () => Math.max(1, Number(searchParams.get('break')) || 5) * 60,
    [searchParams],
  );
  const [state, setState] = useState<TimerState>({ time: workDuration, isActive: false, phase: 'work', completedPomodoros: 0 });
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0.5);

  const workAudioRef = useRef<HTMLAudioElement>(null);
  const breakAudioRef = useRef<HTMLAudioElement>(null);
  const [isInteracted, setIsInteracted] = useState(false);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleStateChanged = (newState: TimerState) => {
      setState(newState);
    };

    const handleTick = (data: { time: number }) => {
      setState(prevState => ({ ...prevState, time: data.time }));
    };

    // イベントリスナーを登録
    socket.on('timer:stateChanged', handleStateChanged);
    socket.on('timer:tick', handleTick);

    // 接続が確立されたらルームに参加する
    const onConnect = () => {
      setIsRealtimeConnected(true);
      if (roomId) {
        socket.emit('room:join', {
          roomId,
          settings: {
            workTime: workDuration / 60,
            breakTime: breakDuration / 60,
          }
        });
      }
    };

    const onDisconnect = () => setIsRealtimeConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.connect();

    // すでに接続済みの場合は手動で呼び出す
    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('timer:stateChanged', handleStateChanged);
      socket.off('timer:tick', handleTick);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, [roomId, workDuration, breakDuration]);

  useEffect(() => {
    if (!state.isActive || isRealtimeConnected) return;

    const timer = window.setInterval(() => {
      setState((previousState) => {
        if (previousState.time > 1) {
          return { ...previousState, time: previousState.time - 1 };
        }

        const completedWork = previousState.phase === 'work';
        return {
          ...previousState,
          phase: completedWork ? 'break' : 'work',
          time: completedWork ? breakDuration : workDuration,
          completedPomodoros: previousState.completedPomodoros + (completedWork ? 1 : 0),
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [state.isActive, isRealtimeConnected, workDuration, breakDuration]);

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
    if (socket && isRealtimeConnected && state.isActive) {
      socket.emit('timer:pause', roomId);
    } else if (socket && isRealtimeConnected) {
      socket.emit('timer:start', roomId);
    } else {
      setState((previousState) => ({ ...previousState, isActive: !previousState.isActive }));
    }
  };

  const handleReset = () => {
    handleInteraction();
    if (socket && isRealtimeConnected) {
      socket.emit('timer:reset', roomId);
    } else {
      setState({ time: workDuration, isActive: false, phase: 'work', completedPomodoros: 0 });
    }
  };

  const handleTogglePhase = () => {
    handleInteraction();
    if (socket && isRealtimeConnected) {
      socket.emit('timer:togglePhase', roomId);
    } else {
      setState((previousState) => ({
        ...previousState,
        phase: previousState.phase === 'work' ? 'break' : 'work',
        time: previousState.phase === 'work' ? breakDuration : workDuration,
      }));
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const phaseText = state.phase === 'work' ? 'Focus' : 'Break';
  const phaseColor = state.phase === 'work' ? 'text-red-400' : 'text-green-400';

  return (
    <div className="w-full max-w-2xl mx-auto bg-gray-900 rounded-2xl shadow-2xl p-8 flex flex-col items-center text-white relative">
      <div className="absolute top-4 left-4">
        <VolumeControl 
          isMuted={isMuted} 
          setIsMuted={setIsMuted} 
          volume={volume} 
          setVolume={setVolume}
          onInteraction={handleInteraction} // ★追加
        />
      </div>

      <div className="text-center mb-8">
        <h2 className={`text-3xl font-bold ${phaseColor} transition-colors duration-500`}>{phaseText}</h2>
        <p className="text-gray-400">Room: {roomId}</p>
        <p className="mt-2 text-xs text-gray-500">
          {isRealtimeConnected ? 'Shared mode' : 'Local mode'}
        </p>
      </div>

      <div className="text-8xl sm:text-9xl font-bold mb-8 tabular-nums">
        {formatTime(state.time)}
      </div>

      <div className="flex items-center justify-center space-x-4 sm:space-x-8 mb-8">
        <button
          onClick={handleReset}
          className="p-4 bg-gray-800 hover:bg-gray-700 rounded-full transition-all duration-300 transform hover:scale-110"
          aria-label="Reset Timer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 4l16 16" /></svg>
        </button>

        <button
          onClick={handleToggle}
          className={`p-6 rounded-full transition-all duration-300 transform hover:scale-110 text-white ${state.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
          aria-label={state.isActive ? 'Pause Timer' : 'Start Timer'}
        >
          {state.isActive ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
          )}
        </button>

        <button
          onClick={handleTogglePhase}
          className="p-4 bg-gray-800 hover:bg-gray-700 rounded-full transition-all duration-300 transform hover:scale-110"
          aria-label="Toggle Phase"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
        </button>
      </div>

      <div className="text-2xl text-yellow-400 flex items-center space-x-2">
        <span>🍅</span>
        <span>x</span>
        <span className="font-bold">{state.completedPomodoros}</span>
      </div>

      {/* Hidden audio players */}
      <audio ref={workAudioRef} src="/music/work.wav" loop preload="auto"></audio>
      <audio ref={breakAudioRef} src="/music/break.wav" loop preload="auto"></audio>
    </div>
  );
};

export default Timer;
