'use client';

interface Props {
  volume: number;
  setVolume: (volume: number) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  onInteraction: () => void;
}

export default function VolumeControl({ volume, setVolume, isMuted, setIsMuted, onInteraction }: Props) {
  return (
    <div className="volume-control">
      <button type="button" className="icon-button small" onClick={() => { onInteraction(); setIsMuted(!isMuted); }} aria-label={isMuted ? '環境音のミュートを解除' : '環境音をミュート'}>
        {isMuted ? '🔇' : '🔊'}
      </button>
      <label className="sr-only" htmlFor="volume">環境音の音量</label>
      <input id="volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => { onInteraction(); setVolume(Number(event.target.value)); }} aria-valuetext={`${Math.round(volume * 100)}%`} />
    </div>
  );
}
