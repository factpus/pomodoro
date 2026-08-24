import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { commandRoom, createRoom, heartbeat, joinDiscordActivityRoom, RoomForbiddenError } from './room-store';

const settings = {
  focusSeconds: 25 * 60,
  shortBreakSeconds: 5 * 60,
  longBreakSeconds: 15 * 60,
  longBreakEvery: 4,
};

describe('Discord Activity rooms', () => {
  it('maps one Activity instance to one room and restores only the creator host token', async () => {
    const instanceId = randomUUID();
    const creatorToken = 'creator-recovery-token';
    const creatorClientId = randomUUID();
    const first = await joinDiscordActivityRoom(instanceId, creatorClientId, creatorToken, 1_800_000_000_000);
    const retry = await joinDiscordActivityRoom(instanceId, creatorClientId, creatorToken, 1_800_000_000_500);
    const second = await joinDiscordActivityRoom(instanceId, randomUUID(), 'another-user-token', 1_800_000_001_000);
    const otherInstance = await joinDiscordActivityRoom(randomUUID(), randomUUID(), 'other-instance-token', 1_800_000_001_500);
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
    expect(second.snapshot.participantCount).toBe(2);
    expect(otherInstance.snapshot.roomId).not.toBe(first.snapshot.roomId);
  });
});

describe('shared room membership and host continuity', () => {
  it('allows active participants to control the timer but rejects non-members', async () => {
    const roomId = `shared-${randomUUID()}`;
    const hostClientId = randomUUID();
    const participantClientId = randomUUID();
    const created = await createRoom(roomId, settings, hostClientId, 1_800_000_100_000);
    await heartbeat(roomId, participantClientId, null, 1_800_000_101_000);

    const started = await commandRoom(roomId, 'start', participantClientId, null, 1_800_000_102_000);
    expect(started.state.isRunning).toBe(true);
    expect(started.role).toBe('participant');

    await expect(commandRoom(roomId, 'pause', randomUUID(), created.hostToken, 1_800_000_103_000))
      .rejects.toBeInstanceOf(RoomForbiddenError);
  });

  it('atomically hands the host token to the first participant that detects a disconnected host', async () => {
    const roomId = `handoff-${randomUUID()}`;
    const hostClientId = randomUUID();
    const firstParticipantId = randomUUID();
    const secondParticipantId = randomUUID();
    const created = await createRoom(roomId, settings, hostClientId, 1_800_000_200_000);
    await heartbeat(roomId, firstParticipantId, null, 1_800_000_201_000);
    await heartbeat(roomId, secondParticipantId, null, 1_800_000_202_000);

    const [claimed, follower] = await Promise.all([
      heartbeat(roomId, firstParticipantId, null, 1_800_000_216_000),
      heartbeat(roomId, secondParticipantId, null, 1_800_000_216_000),
    ]);
    expect(claimed.hostToken).toBeTruthy();
    expect(claimed.snapshot.role).toBe('host');
    expect(follower.hostToken).toBeNull();
    expect(follower.snapshot.role).toBe('participant');

    const formerHost = await heartbeat(roomId, hostClientId, created.hostToken, 1_800_000_216_002);
    expect(formerHost.hostToken).toBeNull();
    expect(formerHost.snapshot.role).toBe('participant');
  });
});
