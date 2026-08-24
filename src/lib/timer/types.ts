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
  revision: number;
  hostTokenHash: string;
  hostClientId?: string;
  hostLastSeenAt?: number;
  state: TimerState;
  participants: Record<string, number>;
  pendingHostTransfer?: {
    targetClientId: string;
    requestedAt: number;
    expiresAt: number;
  };
  discordWebhook?: {
    ciphertext: string;
    iv: string;
    tag: string;
  };
  createdAt: number;
  updatedAt: number;
}

export interface ParticipantSummary {
  candidateId: string;
  label: string;
}

export type HostTransferSnapshot =
  | { direction: 'outgoing'; targetLabel: string; expiresAt: number }
  | { direction: 'incoming'; expiresAt: number };

export interface RoomSnapshot {
  roomId: string;
  generation: number;
  revision: number;
  state: PublicTimerState;
  participantCount: number;
  role: 'host' | 'participant';
  storage: 'redis' | 'memory';
  integrations: {
    discordWebhookAvailable: boolean;
    discordWebhookConnected: boolean;
  };
  participants?: ParticipantSummary[];
  hostTransfer?: HostTransferSnapshot;
}

export interface HeartbeatResult {
  snapshot: RoomSnapshot;
  hostToken: string | null;
}

export type PublicRoomSnapshot = Omit<RoomSnapshot, 'role' | 'participants' | 'hostTransfer'>;
