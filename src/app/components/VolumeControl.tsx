'use client';

import { useState } from 'react';

interface VolumeControlProps {
  volume: number;
  setVolume: (volume: number) => void;
  isMuted: boolean;
  setIsMuted: (isMuted: boolean) => void;
}

const VolumeControl: React.FC<VolumeControlProps> = ({ volume, setVolume, isMuted, setIsMuted }) => {
  const [isSliderVisible, setIsSliderVisible] = useState(false);

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div 
      className="absolute top-4 left-4 flex items-center overflow-hidden rounded-full bg-gray-700 transition-all duration-300"
      onMouseEnter={() => setIsSliderVisible(true)}
      onMouseLeave={() => setIsSliderVisible(false)}
      style={{ width: isSliderVisible ? '160px' : '40px' }} // スライダー表示時に幅を広げる
    >
      {/* ミュートボタンを先に配置 */}
      <button 
        onClick={handleMuteToggle}
        className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition flex-shrink-0"
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
        </svg>
        
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
          </svg>
        )}
        </button>
        {/* スライダーをボタンの後に配置 */}
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className={`
            h-1 w-24 
            cursor-pointer 
            accent-red-500 
            bg-gray-300 
            rounded-full
            transition-transform duration-300 
            ${isSliderVisible ? 'translate-x-0' : 'translate-x-full'} 
            ml-2
          `} 
        />
    </div>
  );
}

export default VolumeControl;
