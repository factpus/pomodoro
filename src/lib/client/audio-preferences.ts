export const DEFAULT_AMBIENT_VOLUME = 0.2;
export const DEFAULT_AMBIENT_MUTED = true;
export const AUDIO_PREFERENCES_KEY = 'pomodoro-together:audio-preferences';

export interface AudioPreferences {
  volume: number;
  muted: boolean;
}

interface PreferenceStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function validVolume(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function browserAudioPreferenceStorage(): PreferenceStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readAudioPreferences(storage: PreferenceStorage | null): AudioPreferences {
  try {
    const parsed = JSON.parse(storage?.getItem(AUDIO_PREFERENCES_KEY) ?? 'null') as Partial<AudioPreferences> | null;
    return {
      volume: validVolume(parsed?.volume) ? parsed.volume : DEFAULT_AMBIENT_VOLUME,
      muted: typeof parsed?.muted === 'boolean' ? parsed.muted : DEFAULT_AMBIENT_MUTED,
    };
  } catch {
    return { volume: DEFAULT_AMBIENT_VOLUME, muted: DEFAULT_AMBIENT_MUTED };
  }
}

export function writeAudioPreferences(storage: PreferenceStorage | null, preferences: AudioPreferences) {
  try {
    storage?.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be unavailable in private browsing or a restricted iframe.
  }
}
