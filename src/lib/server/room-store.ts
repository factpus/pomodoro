import 'server-only';

import { randomUUID } from 'node:crypto';
import type { Redis } from '@upstash/redis';
import { advanceTimer, applyTimerCommand, createTimerState, toPublicTimerState } from '@/lib/timer/model';
import type { RoomRecord, RoomSnapshot, TimerCommand, TimerSettings } from '@/lib/timer/types';
import { redisClient, storageMode } from './redis';
import { createHostToken, hashToken, tokenMatches } from './security';

const ROOM_TTL_SECONDS = 24 * 60 * 60;
const PARTICIPANT_TTL_MS = 15_000;
const LOCK_TTL_MS = 3_000;

export class RoomNotFoundError extends Error {}
export class RoomAlreadyExistsError extends Error {}
export class RoomForbiddenError extends Error {}
export class RoomBusyError extends Error {}
export class StorageUnavailableError extends Error {}

const globalRoomState = globalThis as typeof globalThis & {
  __pomodoroRooms?: Map<string, RoomRecord>;
};
const memoryRooms = globalRoomState.__pomodoroRooms ?? new Map<string, RoomRecord>();
globalRoomState.__pomodoroRooms = memoryRooms;

function roomDatabase(): Redis | null {
  const redis = redisClient();
  if (!redis && process.env.NODE_ENV === 'production') {
    throw new StorageUnavailableError('共有ストレージが設定されていません。管理者に連絡してください。');
  }
  return redis;
}

function roomKey(roomId: string) {
  return `pomodoro:room:${roomId}`;
}

function pruneParticipants(room: RoomRecord, now: number): RoomRecord {
  const cutoff = now - PARTICIPANT_TTL_MS;
  return {
    ...room,
    participants: Object.fromEntries(
      Object.entries(room.participants).filter(([, seenAt]) => seenAt >= cutoff),
    ),
  };
}

function snapshot(room: RoomRecord, token: string | null, now: number): RoomSnapshot {
  return {
    roomId: room.roomId,
    state: toPublicTimerState(room.state, now),
    participantCount: Object.keys(room.participants).length,
    role: tokenMatches(token, room.hostTokenHash) ? 'host' : 'participant',
    storage: storageMode(),
  };
}

async function readRedis(redis: Redis, roomId: string): Promise<RoomRecord | null> {
  return redis.get<RoomRecord>(roomKey(roomId));
}

async function writeRedis(redis: Redis, room: RoomRecord): Promise<void> {
  await redis.set(roomKey(room.roomId), room, { ex: ROOM_TTL_SECONDS });
}

async function withRedisLock<T>(redis: Redis, roomId: string, action: () => Promise<T>): Promise<T> {
  const key = `${roomKey(roomId)}:lock`;
  const lockId = randomUUID();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const acquired = await redis.set(key, lockId, { nx: true, px: LOCK_TTL_MS });
    if (acquired === 'OK') {
      try {
        return await action();
      } finally {
        await redis.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          [key],
          [lockId],
        );
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 25 + attempt * 5));
  }
  throw new RoomBusyError('ルームが混雑しています。少し待って再試行してください。');
}

export async function createRoom(
  roomId: string,
  settings: TimerSettings,
  clientId: string,
  now = Date.now(),
): Promise<{ snapshot: RoomSnapshot; hostToken: string }> {
  const hostToken = createHostToken();
  const room: RoomRecord = {
    roomId,
    hostTokenHash: hashToken(hostToken),
    state: createTimerState(settings, now),
    participants: { [clientId]: now },
    createdAt: now,
    updatedAt: now,
  };
  const redis = roomDatabase();
  if (redis) {
    const created = await redis.set(roomKey(roomId), room, { nx: true, ex: ROOM_TTL_SECONDS });
    if (created !== 'OK') throw new RoomAlreadyExistsError('そのルーム名は既に使われています。');
  } else {
    if (memoryRooms.has(roomId)) throw new RoomAlreadyExistsError('そのルーム名は既に使われています。');
    memoryRooms.set(roomId, room);
  }
  return { snapshot: snapshot(room, hostToken, now), hostToken };
}

export async function getRoom(
  roomId: string,
  token: string | null,
  now = Date.now(),
): Promise<RoomSnapshot> {
  const redis = roomDatabase();
  if (redis) {
    const current = await readRedis(redis, roomId);
    if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
    const room = pruneParticipants({ ...current, state: advanceTimer(current.state, now) }, now);
    return snapshot(room, token, now);
  }
  const current = memoryRooms.get(roomId);
  if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
  const room = pruneParticipants({ ...current, state: advanceTimer(current.state, now) }, now);
  memoryRooms.set(roomId, room);
  return snapshot(room, token, now);
}

export async function heartbeat(
  roomId: string,
  clientId: string,
  token: string | null,
  now = Date.now(),
): Promise<RoomSnapshot> {
  const redis = roomDatabase();
  const update = (current: RoomRecord) => {
    const room = pruneParticipants(current, now);
    room.participants[clientId] = now;
    room.state = advanceTimer(room.state, now);
    room.updatedAt = now;
    return room;
  };
  if (redis) {
    return withRedisLock(redis, roomId, async () => {
      const current = await readRedis(redis, roomId);
      if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
      const room = update(current);
      await writeRedis(redis, room);
      return snapshot(room, token, now);
    });
  }
  const current = memoryRooms.get(roomId);
  if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
  const room = update(current);
  memoryRooms.set(roomId, room);
  return snapshot(room, token, now);
}

export async function commandRoom(
  roomId: string,
  command: TimerCommand,
  clientId: string,
  token: string | null,
  now = Date.now(),
): Promise<RoomSnapshot> {
  const update = (current: RoomRecord) => {
    if (!tokenMatches(token, current.hostTokenHash)) {
      throw new RoomForbiddenError('タイマーを操作できるのはホストだけです。');
    }
    const room = pruneParticipants(current, now);
    room.participants[clientId] = now;
    room.state = applyTimerCommand(room.state, command, now);
    room.updatedAt = now;
    return room;
  };
  const redis = roomDatabase();
  if (redis) {
    return withRedisLock(redis, roomId, async () => {
      const current = await readRedis(redis, roomId);
      if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
      const room = update(current);
      await writeRedis(redis, room);
      return snapshot(room, token, now);
    });
  }
  const current = memoryRooms.get(roomId);
  if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
  const room = update(current);
  memoryRooms.set(roomId, room);
  return snapshot(room, token, now);
}
