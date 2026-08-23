import { describe, expect, it, vi } from 'vitest';
import {
  AUDIO_PREFERENCES_KEY,
  DEFAULT_AMBIENT_MUTED,
  DEFAULT_AMBIENT_VOLUME,
  readAudioPreferences,
  writeAudioPreferences,
} from './audio-preferences';

describe('audio preferences', () => {
  it('uses quiet, muted defaults when no preference exists', () => {
    expect(readAudioPreferences({ getItem: () => null, setItem: vi.fn() })).toEqual({
      volume: DEFAULT_AMBIENT_VOLUME,
      muted: DEFAULT_AMBIENT_MUTED,
    });
    expect(readAudioPreferences(null)).toEqual({ volume: DEFAULT_AMBIENT_VOLUME, muted: DEFAULT_AMBIENT_MUTED });
  });

  it('restores valid saved preferences', () => {
    const storage = { getItem: () => JSON.stringify({ volume: 0.45, muted: false }), setItem: vi.fn() };
    expect(readAudioPreferences(storage)).toEqual({ volume: 0.45, muted: false });
  });

  it('falls back per field for malformed or out-of-range preferences', () => {
    const storage = { getItem: () => JSON.stringify({ volume: 4, muted: 'no' }), setItem: vi.fn() };
    expect(readAudioPreferences(storage)).toEqual({ volume: DEFAULT_AMBIENT_VOLUME, muted: DEFAULT_AMBIENT_MUTED });
  });

  it('persists both volume and mute state without surfacing storage failures', () => {
    const setItem = vi.fn();
    writeAudioPreferences({ getItem: () => null, setItem }, { volume: 0.3, muted: false });
    expect(setItem).toHaveBeenCalledWith(AUDIO_PREFERENCES_KEY, JSON.stringify({ volume: 0.3, muted: false }));

    expect(() => writeAudioPreferences({ getItem: () => null, setItem: () => { throw new Error('blocked'); } }, { volume: 0.3, muted: false })).not.toThrow();
    expect(() => writeAudioPreferences(null, { volume: 0.3, muted: false })).not.toThrow();
  });
});
