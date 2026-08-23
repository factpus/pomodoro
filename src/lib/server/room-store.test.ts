import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { joinDiscordActivityRoom } from './room-store';

describe('Discord Activity rooms', () => {
  it('maps one Activity instance to one room and restores only the creator host token', async () => {
    const instanceId = randomUUID();
    const creatorToken = 'creator-recovery-token';
    const first = await joinDiscordActivityRoom(instanceId, randomUUID(), creatorToken, 1_800_000_000_000);
    const retry = await joinDiscordActivityRoom(instanceId, randomUUID(), creatorToken, 1_800_000_000_500);
    const second = await joinDiscordActivityRoom(instanceId, randomUUID(), 'another-user-token', 1_800_000_001_000);
    expect(first.snapshot.roomId).toBe(second.snapshot.roomId);
    expect(first.snapshot.generation).toBe(1_800_000_000_000);
    expect(second.snapshot.generation).toBe(first.snapshot.generation);
    expect(first.snapshot.revision).toBe(1);
    expect(retry.snapshot.revision).toBe(2);
    expect(second.snapshot.revision).toBe(3);
    expect(first.snapshot.role).toBe('host');
    expect(first.hostToken).toBe(creatorToken);
    expect(retry.snapshot.role).toBe('host');
    expect(retry.hostToken).toBe(creatorToken);
    expect(second.snapshot.role).toBe('participant');
    expect(second.hostToken).toBeNull();
  });
});
