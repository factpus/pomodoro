export type TimerPhase = 'focus' | 'shortBreak' | 'longBreak';

export type TimerCommand = 'start' | 'pause' | 'reset' | 'skip';

export interface TimerSettings {
  focusSeconds: number;
  shortBreakSeconds: number;
  longBreakSeconds: number;
  longBreakEvery: number;
}

export interface TimerState extends TimerSettings {
  phase: TimerPhase;
  isRunning: boolean;
  phaseEndsAt: number | null;
  pausedRemainingSeconds: number;
  completedPomodoros: number;
  cyclePosition: number;
  version: number;
  updatedAt: number;
}

export interface PublicTimerState extends TimerState {
  remainingSeconds: number;
  serverNow: number;
}

export interface RoomRecord {
  roomId: string;
  hostTokenHash: string;
  state: TimerState;
  participants: Record<string, number>;
  discordWebhook?: {
    ciphertext: string;
    iv: string;
    tag: string;
  };
  createdAt: number;
  updatedAt: number;
}

export interface RoomSnapshot {
  roomId: string;
  state: PublicTimerState;
  participantCount: number;
  role: 'host' | 'participant';
  storage: 'redis' | 'memory';
  integrations: {
    discordWebhookAvailable: boolean;
    discordWebhookConnected: boolean;
  };
}

export type PublicRoomSnapshot = Omit<RoomSnapshot, 'role'>;
