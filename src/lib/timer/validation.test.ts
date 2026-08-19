import { describe, expect, it } from 'vitest';
import { createRoomSchema, roomIdSchema } from './validation';

describe('room validation', () => {
  it.each(['team-a', 'abc123', 'a'])('accepts valid room id %s', (value) => expect(roomIdSchema.parse(value)).toBe(value));
  it.each(['../secret', '日本語', '-starts', 'ends-', 'a'.repeat(51)])('rejects invalid room id %s', (value) => expect(roomIdSchema.safeParse(value).success).toBe(false));

  it('rejects durations outside safe bounds', () => {
    expect(createRoomSchema.safeParse({ settings: { focusMinutes: 0, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 } }).success).toBe(false);
    expect(createRoomSchema.safeParse({ settings: { focusMinutes: 25, shortBreakMinutes: 61, longBreakMinutes: 15, longBreakEvery: 4 } }).success).toBe(false);
  });
});
