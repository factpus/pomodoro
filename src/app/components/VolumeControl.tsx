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
      className="absolute top-4 right-4 flex items-center"
      onMouseEnter={() => setIsSliderVisible(true)}
      onMouseLeave={() => setIsSliderVisible(false)}
    >
      {isSliderVisible && (
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="
            h-1 w-24 
            cursor-pointer 
            accent-red-500 
            mr-2 
            bg-gray-300 
            rounded-full
          "
        />
      )}
      <button 
        onClick={handleMuteToggle}
        className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition"
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15.586a1 1 0 01.707-.293h.01a1 1 0 01.707.293l.293.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l.293-.293a1 1 0 01.707-.293h.01a1 1 0 01.707.293L3 16.586V6a1 1 0 012 0v10.586l.414-.414zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.414 21.414a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414l2 2a1 1 0 010 1.414zM12 19a7 7 0 007-7" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.586a1 1 0 01.707-.293h.01a1 1 0 01.707.293l.293.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l.293-.293a1 1 0 01.707-.293h.01a1 1 0 01.707.293L3 16.586V6a1 1 0 012 0v10.586l.414-.414zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default VolumeControl;