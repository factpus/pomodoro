import 'server-only';

import { randomUUID } from 'node:crypto';
import type { Redis } from '@upstash/redis';
import { advanceTimer, applyTimerCommand, createTimerState, toPublicTimerState } from '@/lib/timer/model';
import type { HeartbeatResult, PublicRoomSnapshot, RoomRecord, RoomSnapshot, TimerCommand, TimerSettings } from '@/lib/timer/types';
import { redisClient, storageMode } from './redis';
import { createHostToken, hashToken, tokenMatches } from './security';
import { DiscordWebhookError, encryptWebhookUrl, postDiscordWebhook, validateDiscordWebhookUrl } from './discord-webhook';
import { logServerEvent } from './observability';

const ROOM_TTL_SECONDS = 24 * 60 * 60;
const PARTICIPANT_TTL_MS = 15_000;
const HOST_TRANSFER_TTL_MS = 60_000;
const LOCK_TTL_MS = 3_000;

export class RoomNotFoundError extends Error {}
export class RoomAlreadyExistsError extends Error {}
export class RoomForbiddenError extends Error {}
export class RoomBusyError extends Error {}
export class StorageUnavailableError extends Error {}
export class HostTransferUnavailableError extends Error {}

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
  const next = {
    ...room,
    participants: Object.fromEntries(
      Object.entries(room.participants).filter(([, seenAt]) => seenAt >= cutoff),
    ),
  };
  if (next.pendingHostTransfer && (
    next.pendingHostTransfer.expiresAt <= now ||
    !next.participants[next.pendingHostTransfer.targetClientId]
  )) {
    delete next.pendingHostTransfer;
  }
  return next;
}

function participantLabel(clientId: string) {
  return `参加者 ${clientId.replaceAll('-', '').slice(-4).toUpperCase()}`;
}

function participantCandidateId(room: RoomRecord, clientId: string) {
  return hashToken(`${room.hostTokenHash}:${clientId}`).slice(0, 32);
}

function snapshot(room: RoomRecord, token: string | null, now: number, clientId?: string): RoomSnapshot {
  const role = tokenMatches(token, room.hostTokenHash) ? 'host' : 'participant';
  const participants = role === 'host'
    ? Object.keys(room.participants)
      .filter((id) => id !== room.hostClientId)
      .sort()
      .map((id) => ({ candidateId: participantCandidateId(room, id), label: participantLabel(id) }))
    : undefined;
  const transfer = room.pendingHostTransfer;
  const hostTransfer = transfer
    ? role === 'host'
      ? {
          direction: 'outgoing' as const,
          targetLabel: participantLabel(transfer.targetClientId),
          expiresAt: transfer.expiresAt,
        }
      : clientId === transfer.targetClientId
        ? { direction: 'incoming' as const, expiresAt: transfer.expiresAt }
        : undefined
    : undefined;
  return {
    roomId: room.roomId,
    generation: room.createdAt,
    revision: room.revision ?? 0,
    state: toPublicTimerState(room.state, now),
    participantCount: Object.keys(room.participants).length,
    role,
    storage: storageMode(),
    integrations: {
      discordWebhookAvailable: Boolean(process.env.INTEGRATION_ENCRYPTION_KEY),
      discordWebhookConnected: Boolean(room.discordWebhook),
    },
    participants,
    hostTransfer,
  };
}

const phaseNames = { focus: '集中', shortBreak: '小休憩', longBreak: '長休憩' } as const;

async function notifyDiscord(room: RoomRecord, content: string) {
  if (!room.discordWebhook) return;
  try {
    await postDiscordWebhook(room.discordWebhook, content);
  } catch (error) {
    logServerEvent('warn', 'discord.webhook_failed', {
      room: hashToken(room.roomId).slice(0, 12),
      status: error instanceof DiscordWebhookError ? error.status : undefined,
      permanent: error instanceof DiscordWebhookError ? error.permanent : false,
    });
    if (error instanceof DiscordWebhookError && error.permanent) {
      await removeFailedDiscordWebhook(room).catch(() => undefined);
    }
  }
}

function sameWebhook(left: NonNullable<RoomRecord['discordWebhook']>, right: NonNullable<RoomRecord['discordWebhook']>) {
  return left.ciphertext === right.ciphertext && left.iv === right.iv && left.tag === right.tag;
}

async function removeFailedDiscordWebhook(failedRoom: RoomRecord) {
  if (!failedRoom.discordWebhook) return;
  const redis = roomDatabase();
  if (redis) {
    await withRedisLock(redis, failedRoom.roomId, async () => {
      const current = await readRedis(redis, failedRoom.roomId);
      if (!current?.discordWebhook || !sameWebhook(current.discordWebhook, failedRoom.discordWebhook!)) return;
      delete current.discordWebhook;
      current.updatedAt = Date.now();
      await writeRedis(redis, current);
    });
    return;
  }
  const current = memoryRooms.get(failedRoom.roomId);
  if (current?.discordWebhook && sameWebhook(current.discordWebhook, failedRoom.discordWebhook)) {
    delete current.discordWebhook;
    current.updatedAt = Date.now();
    writeMemory(current);
  }
}

async function readRedis(redis: Redis, roomId: string): Promise<RoomRecord | null> {
  return redis.get<RoomRecord>(roomKey(roomId));
}

async function writeRedis(redis: Redis, room: RoomRecord): Promise<void> {
  room.revision = (room.revision ?? 0) + 1;
  await redis.set(roomKey(room.roomId), room, { ex: ROOM_TTL_SECONDS });
}

function writeMemory(room: RoomRecord) {
  room.revision = (room.revision ?? 0) + 1;
  memoryRooms.set(room.roomId, room);
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
    revision: 1,
    hostTokenHash: hashToken(hostToken),
    hostClientId: clientId,
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
  return { snapshot: snapshot(room, hostToken, now, clientId), hostToken };
}

export async function joinDiscordActivityRoom(instanceId: string, clientId: string, recoveryToken: string, now = Date.now()) {
  const roomId = `activity-${hashToken(instanceId).slice(0, 24)}`;
  const redis = roomDatabase();

  const joinOrCreate = (current: RoomRecord | null) => {
    if (current) {
      const room = pruneParticipants(current, now);
      room.participants[clientId] = now;
      room.state = advanceTimer(room.state, now);
      room.updatedAt = now;
      const hostToken = tokenMatches(recoveryToken, room.hostTokenHash) ? recoveryToken : null;
      if (hostToken) room.hostClientId = clientId;
      return { room, hostToken };
    }
    const hostToken = recoveryToken;
    const room: RoomRecord = {
      roomId,
      revision: 0,
      hostTokenHash: hashToken(hostToken),
      hostClientId: clientId,
      state: createTimerState({ focusSeconds: 25 * 60, shortBreakSeconds: 5 * 60, longBreakSeconds: 15 * 60, longBreakEvery: 4 }, now),
      participants: { [clientId]: now },
      createdAt: now,
      updatedAt: now,
    };
    return { room, hostToken };
  };

  if (redis) {
    const result = await withRedisLock(redis, roomId, async () => {
      const result = joinOrCreate(await readRedis(redis, roomId));
      await writeRedis(redis, result.room);
      return result;
    });
    return {
      snapshot: snapshot(result.room, result.hostToken, now, clientId),
      hostToken: result.hostToken,
    };
  }

  const result = joinOrCreate(memoryRooms.get(roomId) ?? null);
  writeMemory(result.room);
  return {
    snapshot: snapshot(result.room, result.hostToken, now, clientId),
    hostToken: result.hostToken,
  };
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
  writeMemory(room);
  return snapshot(room, token, now);
}

export async function getPublicRoom(roomId: string, now = Date.now()): Promise<PublicRoomSnapshot> {
  const room = await getRoom(roomId, null, now);
  return {
    roomId: room.roomId,
    generation: room.generation,
    revision: room.revision,
    state: room.state,
    participantCount: room.participantCount,
    storage: room.storage,
    integrations: room.integrations,
  };
}

export async function heartbeat(
  roomId: string,
  clientId: string,
  token: string | null,
  now = Date.now(),
): Promise<HeartbeatResult> {
  const redis = roomDatabase();
  const update = (current: RoomRecord) => {
    const room = pruneParticipants(current, now);
    room.participants[clientId] = now;
    let issuedHostToken: string | null = null;
    if (tokenMatches(token, room.hostTokenHash)) {
      room.hostClientId = clientId;
    } else if (!room.hostClientId || !room.participants[room.hostClientId]) {
      issuedHostToken = createHostToken();
      room.hostTokenHash = hashToken(issuedHostToken);
      room.hostClientId = clientId;
      delete room.pendingHostTransfer;
    }
    room.state = advanceTimer(room.state, now);
    room.updatedAt = now;
    return { room, issuedHostToken };
  };
  if (redis) {
    const result = await withRedisLock(redis, roomId, async () => {
      const current = await readRedis(redis, roomId);
      if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
      const previousPhase = current.state.phase;
      const updateResult = update(current);
      await writeRedis(redis, updateResult.room);
      return { ...updateResult, phaseChanged: previousPhase !== updateResult.room.state.phase };
    });
    if (result.phaseChanged) {
      await notifyDiscord(result.room, `🍅 **${phaseNames[result.room.state.phase]}を開始しました**\nルーム: ${roomId}`);
    }
    return {
      snapshot: snapshot(result.room, result.issuedHostToken ?? token, now, clientId),
      hostToken: result.issuedHostToken,
    };
  }
  const current = memoryRooms.get(roomId);
  if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
  const previousPhase = current.state.phase;
  const result = update(current);
  writeMemory(result.room);
  if (previousPhase !== result.room.state.phase) {
    await notifyDiscord(result.room, `🍅 **${phaseNames[result.room.state.phase]}を開始しました**\nルーム: ${roomId}`);
  }
  return {
    snapshot: snapshot(result.room, result.issuedHostToken ?? token, now, clientId),
    hostToken: result.issuedHostToken,
  };
}

export async function commandRoom(
  roomId: string,
  command: TimerCommand,
  clientId: string,
  token: string | null,
  now = Date.now(),
): Promise<RoomSnapshot> {
  const update = (current: RoomRecord) => {
    const room = pruneParticipants(current, now);
    if (!Object.hasOwn(room.participants, clientId)) {
      throw new RoomForbiddenError('タイマーを操作できるのは接続中の参加者だけです。');
    }
    room.participants[clientId] = now;
    room.state = applyTimerCommand(room.state, command, now);
    room.updatedAt = now;
    return room;
  };
  const redis = roomDatabase();
  if (redis) {
    const room = await withRedisLock(redis, roomId, async () => {
      const current = await readRedis(redis, roomId);
      if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
      const room = update(current);
      await writeRedis(redis, room);
      return room;
    });
    await notifyCommand(room, command);
    return snapshot(room, token, now, clientId);
  }
  const current = memoryRooms.get(roomId);
  if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
  const room = update(current);
  writeMemory(room);
  await notifyCommand(room, command);
  return snapshot(room, token, now, clientId);
}

async function notifyCommand(room: RoomRecord, command: TimerCommand) {
  const content = command === 'start'
    ? `▶️ **${phaseNames[room.state.phase]}を開始しました**\nルーム: ${room.roomId}`
    : command === 'skip'
      ? `⏭️ **${phaseNames[room.state.phase]}へ進みました**\nルーム: ${room.roomId}`
      : command === 'reset'
        ? `↺ **タイマーをリセットしました**\nルーム: ${room.roomId}`
        : null;
  if (content) await notifyDiscord(room, content);
}

export async function connectDiscordWebhook(roomId: string, token: string | null, webhookUrl: string, now = Date.now()) {
  const currentSnapshot = await getRoom(roomId, token, now);
  if (currentSnapshot.role !== 'host') throw new RoomForbiddenError('Discord通知を設定できるのはホストだけです。');

  const secret = encryptWebhookUrl(validateDiscordWebhookUrl(webhookUrl));
  await postDiscordWebhook(secret, `✅ **Discord通知を接続しました**\nルーム: ${roomId}`);

  const redis = roomDatabase();
  if (redis) {
    const room = await withRedisLock(redis, roomId, async () => {
      const current = await readRedis(redis, roomId);
      if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
      if (!tokenMatches(token, current.hostTokenHash)) throw new RoomForbiddenError('Discord通知を設定できるのはホストだけです。');
      current.discordWebhook = secret;
      current.updatedAt = now;
      await writeRedis(redis, current);
      return current;
    });
    return snapshot(room, token, now);
  }

  const room = memoryRooms.get(roomId);
  if (!room) throw new RoomNotFoundError('ルームが見つかりません。');
  if (!tokenMatches(token, room.hostTokenHash)) throw new RoomForbiddenError('Discord通知を設定できるのはホストだけです。');
  room.discordWebhook = secret;
  room.updatedAt = now;
  writeMemory(room);
  return snapshot(room, token, now);
}

export async function disconnectDiscordWebhook(roomId: string, token: string | null, now = Date.now()) {
  const redis = roomDatabase();
  if (redis) {
    const room = await withRedisLock(redis, roomId, async () => {
      const current = await readRedis(redis, roomId);
      if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
      if (!tokenMatches(token, current.hostTokenHash)) throw new RoomForbiddenError('Discord通知を解除できるのはホストだけです。');
      delete current.discordWebhook;
      current.updatedAt = now;
      await writeRedis(redis, current);
      return current;
    });
    return snapshot(room, token, now);
  }

  const room = memoryRooms.get(roomId);
  if (!room) throw new RoomNotFoundError('ルームが見つかりません。');
  if (!tokenMatches(token, room.hostTokenHash)) throw new RoomForbiddenError('Discord通知を解除できるのはホストだけです。');
  delete room.discordWebhook;
  room.updatedAt = now;
  writeMemory(room);
  return snapshot(room, token, now);
}

export async function requestHostTransfer(
  roomId: string,
  clientId: string,
  targetCandidateId: string,
  token: string | null,
  now = Date.now(),
) {
  const update = (current: RoomRecord) => {
    if (!tokenMatches(token, current.hostTokenHash)) {
      throw new RoomForbiddenError('ホストを移譲できるのは現在のホストだけです。');
    }
    const room = pruneParticipants(current, now);
    room.participants[clientId] = now;
    room.hostClientId = clientId;
    const targetClientId = Object.keys(room.participants).find(
      (id) => id !== clientId && participantCandidateId(room, id) === targetCandidateId,
    );
    if (!targetClientId) {
      throw new HostTransferUnavailableError('対象の参加者が接続していません。');
    }
    room.pendingHostTransfer = {
      targetClientId,
      requestedAt: now,
      expiresAt: now + HOST_TRANSFER_TTL_MS,
    };
    room.updatedAt = now;
    return room;
  };

  const redis = roomDatabase();
  if (redis) {
    const room = await withRedisLock(redis, roomId, async () => {
      const current = await readRedis(redis, roomId);
      if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
      const room = update(current);
      await writeRedis(redis, room);
      return room;
    });
    return snapshot(room, token, now, clientId);
  }

  const current = memoryRooms.get(roomId);
  if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
  const room = update(current);
  writeMemory(room);
  return snapshot(room, token, now, clientId);
}

export async function cancelHostTransfer(
  roomId: string,
  clientId: string,
  token: string | null,
  now = Date.now(),
) {
  const update = (current: RoomRecord) => {
    if (!tokenMatches(token, current.hostTokenHash)) {
      throw new RoomForbiddenError('移譲を取り消せるのは現在のホストだけです。');
    }
    const room = pruneParticipants(current, now);
    room.participants[clientId] = now;
    room.hostClientId = clientId;
    delete room.pendingHostTransfer;
    room.updatedAt = now;
    return room;
  };

  const redis = roomDatabase();
  if (redis) {
    const room = await withRedisLock(redis, roomId, async () => {
      const current = await readRedis(redis, roomId);
      if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
      const room = update(current);
      await writeRedis(redis, room);
      return room;
    });
    return snapshot(room, token, now, clientId);
  }

  const current = memoryRooms.get(roomId);
  if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
  const room = update(current);
  writeMemory(room);
  return snapshot(room, token, now, clientId);
}

export async function acceptHostTransfer(roomId: string, clientId: string, now = Date.now()) {
  const update = (current: RoomRecord) => {
    const room = pruneParticipants(current, now);
    const transfer = room.pendingHostTransfer;
    if (!transfer || transfer.targetClientId !== clientId || transfer.expiresAt <= now) {
      throw new HostTransferUnavailableError('ホスト移譲の依頼が見つからないか、期限切れです。');
    }
    const hostToken = createHostToken();
    room.hostTokenHash = hashToken(hostToken);
    room.hostClientId = clientId;
    room.participants[clientId] = now;
    delete room.pendingHostTransfer;
    room.updatedAt = now;
    return { room, hostToken };
  };

  const redis = roomDatabase();
  if (redis) {
    const result = await withRedisLock(redis, roomId, async () => {
      const current = await readRedis(redis, roomId);
      if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
      const result = update(current);
      await writeRedis(redis, result.room);
      return result;
    });
    return { snapshot: snapshot(result.room, result.hostToken, now, clientId), hostToken: result.hostToken };
  }

  const current = memoryRooms.get(roomId);
  if (!current) throw new RoomNotFoundError('ルームが見つかりません。');
  const result = update(current);
  writeMemory(result.room);
  return { snapshot: snapshot(result.room, result.hostToken, now, clientId), hostToken: result.hostToken };
}
