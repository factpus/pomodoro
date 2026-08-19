import { describe, expect, it } from 'vitest';
import { advanceTimer, applyTimerCommand, createTimerState, remainingSeconds } from './model';

const settings = { focusSeconds: 25 * 60, shortBreakSeconds: 5 * 60, longBreakSeconds: 15 * 60, longBreakEvery: 4 };

describe('timer model', () => {
  it('starts, pauses and resumes from the authoritative end time', () => {
    let state = createTimerState(settings, 1_000);
    state = applyTimerCommand(state, 'start', 2_000);
    expect(state.phaseEndsAt).toBe(1_502_000);
    state = applyTimerCommand(state, 'pause', 12_000);
    expect(state.isRunning).toBe(false);
    expect(state.pausedRemainingSeconds).toBe(1_490);
    expect(remainingSeconds(state, 99_000)).toBe(1_490);
  });

  it('advances focus to a short break and increments completion count', () => {
    const started = applyTimerCommand(createTimerState(settings, 0), 'start', 0);
    const advanced = advanceTimer(started, 1_500_000);
    expect(advanced.phase).toBe('shortBreak');
    expect(advanced.completedPomodoros).toBe(1);
    expect(advanced.phaseEndsAt).toBe(1_800_000);
  });

  it('uses a long break after the configured number of focus sessions', () => {
    let state = applyTimerCommand(createTimerState({ ...settings, focusSeconds: 1, shortBreakSeconds: 1, longBreakSeconds: 10 }, 0), 'start', 0);
    state = advanceTimer(state, 7_000);
    expect(state.completedPomodoros).toBe(4);
    expect(state.phase).toBe('longBreak');
    expect(state.phaseEndsAt).toBe(17_000);
  });

  it('resets all progress and stops the timer', () => {
    const progressed = { ...createTimerState(settings, 0), completedPomodoros: 3, phase: 'shortBreak' as const };
    const reset = applyTimerCommand(progressed, 'reset', 3_000);
    expect(reset).toMatchObject({ phase: 'focus', isRunning: false, completedPomodoros: 0, pausedRemainingSeconds: 1_500 });
  });
});
