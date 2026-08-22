import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { joinDiscordActivityRoom } from './room-store';

describe('Discord Activity rooms', () => {
  it('maps one Activity instance to one room and assigns only the first host', async () => {
    const instanceId = randomUUID();
    const first = await joinDiscordActivityRoom(instanceId, randomUUID(), 1_800_000_000_000);
    const second = await joinDiscordActivityRoom(instanceId, randomUUID(), 1_800_000_001_000);
    expect(first.snapshot.roomId).toBe(second.snapshot.roomId);
    expect(first.snapshot.role).toBe('host');
    expect(first.hostToken).toBeTruthy();
    expect(second.snapshot.role).toBe('participant');
    expect(second.hostToken).toBeNull();
  });
});
