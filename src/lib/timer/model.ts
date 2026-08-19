import type {
  PublicTimerState,
  TimerCommand,
  TimerPhase,
  TimerSettings,
  TimerState,
} from './types';

const MAX_TRANSITIONS_PER_SYNC = 10_000;

export function createTimerState(settings: TimerSettings, now: number): TimerState {
  return {
    ...settings,
    phase: 'focus',
    isRunning: false,
    phaseEndsAt: null,
    pausedRemainingSeconds: settings.focusSeconds,
    completedPomodoros: 0,
    cyclePosition: 0,
    version: 1,
    updatedAt: now,
  };
}

export function durationForPhase(state: TimerState, phase: TimerPhase): number {
  if (phase === 'focus') return state.focusSeconds;
  if (phase === 'longBreak') return state.longBreakSeconds;
  return state.shortBreakSeconds;
}

export function remainingSeconds(state: TimerState, now: number): number {
  if (!state.isRunning || state.phaseEndsAt === null) {
    return Math.max(0, state.pausedRemainingSeconds);
  }

  return Math.max(0, Math.ceil((state.phaseEndsAt - now) / 1000));
}

function nextCompletedPhase(state: TimerState): TimerPhase {
  if (state.phase !== 'focus') return 'focus';

  const nextCompleted = state.completedPomodoros + 1;
  return nextCompleted % state.longBreakEvery === 0 ? 'longBreak' : 'shortBreak';
}

export function advanceTimer(input: TimerState, now: number): TimerState {
  if (!input.isRunning || input.phaseEndsAt === null || input.phaseEndsAt > now) {
    return input;
  }

  let state = { ...input };
  let transitions = 0;

  while (
    state.isRunning &&
    state.phaseEndsAt !== null &&
    state.phaseEndsAt <= now &&
    transitions < MAX_TRANSITIONS_PER_SYNC
  ) {
    const previousEnd = state.phaseEndsAt;
    const completedFocus = state.phase === 'focus';
    const phase = nextCompletedPhase(state);
    const completedPomodoros = state.completedPomodoros + (completedFocus ? 1 : 0);
    const cyclePosition = completedPomodoros % state.longBreakEvery;

    state = {
      ...state,
      phase,
      completedPomodoros,
      cyclePosition,
      phaseEndsAt: previousEnd + durationForPhase(state, phase) * 1000,
      pausedRemainingSeconds: durationForPhase(state, phase),
      version: state.version + 1,
      updatedAt: now,
    };
    transitions += 1;
  }

  if (transitions === MAX_TRANSITIONS_PER_SYNC && state.phaseEndsAt !== null && state.phaseEndsAt <= now) {
    const phase: TimerPhase = 'focus';
    state = {
      ...state,
      phase,
      phaseEndsAt: now + state.focusSeconds * 1000,
      pausedRemainingSeconds: state.focusSeconds,
      version: state.version + 1,
      updatedAt: now,
    };
  }

  return state;
}

export function applyTimerCommand(input: TimerState, command: TimerCommand, now: number): TimerState {
  const state = advanceTimer(input, now);

  if (command === 'start') {
    if (state.isRunning) return state;
    return {
      ...state,
      isRunning: true,
      phaseEndsAt: now + Math.max(1, state.pausedRemainingSeconds) * 1000,
      version: state.version + 1,
      updatedAt: now,
    };
  }

  if (command === 'pause') {
    if (!state.isRunning) return state;
    return {
      ...state,
      isRunning: false,
      phaseEndsAt: null,
      pausedRemainingSeconds: remainingSeconds(state, now),
      version: state.version + 1,
      updatedAt: now,
    };
  }

  if (command === 'reset') {
    return {
      ...state,
      phase: 'focus',
      isRunning: false,
      phaseEndsAt: null,
      pausedRemainingSeconds: state.focusSeconds,
      completedPomodoros: 0,
      cyclePosition: 0,
      version: state.version + 1,
      updatedAt: now,
    };
  }

  const phase: TimerPhase = state.phase === 'focus' ? 'shortBreak' : 'focus';
  const duration = durationForPhase(state, phase);
  return {
    ...state,
    phase,
    phaseEndsAt: state.isRunning ? now + duration * 1000 : null,
    pausedRemainingSeconds: duration,
    version: state.version + 1,
    updatedAt: now,
  };
}

export function toPublicTimerState(input: TimerState, now: number): PublicTimerState {
  const state = advanceTimer(input, now);
  return {
    ...state,
    remainingSeconds: remainingSeconds(state, now),
    serverNow: now,
  };
}

