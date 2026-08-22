'use client';

import type { PublicRoomSnapshot, RoomSnapshot, TimerCommand } from '@/lib/timer/types';

export interface CreateRoomInput {
  roomId?: string;
  settings: {
    focusMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    longBreakEvery: number;
  };
}

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? '通信に失敗しました。');
  return body;
}

function auth(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function createSharedRoom(input: CreateRoomInput, id: string) {
  return parse<{ snapshot: RoomSnapshot; hostToken: string }>(
    await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': id },
      body: JSON.stringify(input),
    }),
  );
}

export async function fetchRoom(roomId: string, token: string | null, signal?: AbortSignal) {
  return parse<RoomSnapshot>(await fetch(`/api/rooms/${encodeURIComponent(roomId)}`, { headers: auth(token), cache: 'no-store', signal }));
}

export async function fetchPublicRoom(roomId: string, signal?: AbortSignal) {
  return parse<PublicRoomSnapshot>(await fetch(`/api/rooms/${encodeURIComponent(roomId)}/public`, { signal }));
}

export async function sendHeartbeat(roomId: string, id: string, token: string | null) {
  return parse<RoomSnapshot>(await fetch(`/api/rooms/${encodeURIComponent(roomId)}/heartbeat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(token) }, body: JSON.stringify({ clientId: id }),
  }));
}

export async function sendCommand(roomId: string, command: TimerCommand, id: string, token: string | null) {
  return parse<RoomSnapshot>(await fetch(`/api/rooms/${encodeURIComponent(roomId)}/commands`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(token) }, body: JSON.stringify({ command, clientId: id }),
  }));
}

export async function connectDiscordWebhook(roomId: string, webhookUrl: string, token: string | null) {
  return parse<RoomSnapshot>(await fetch(`/api/rooms/${encodeURIComponent(roomId)}/integrations/discord-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: JSON.stringify({ webhookUrl }),
  }));
}

export async function disconnectDiscordWebhook(roomId: string, token: string | null) {
  return parse<RoomSnapshot>(await fetch(`/api/rooms/${encodeURIComponent(roomId)}/integrations/discord-webhook`, {
    method: 'DELETE',
    headers: auth(token),
  }));
}

export async function requestHostTransfer(roomId: string, clientId: string, targetCandidateId: string, token: string | null) {
  return parse<RoomSnapshot>(await fetch(`/api/rooms/${encodeURIComponent(roomId)}/host-transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: JSON.stringify({ clientId, targetCandidateId }),
  }));
}

export async function cancelHostTransfer(roomId: string, clientId: string, token: string | null) {
  return parse<RoomSnapshot>(await fetch(`/api/rooms/${encodeURIComponent(roomId)}/host-transfer`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: JSON.stringify({ clientId }),
  }));
}

export async function acceptHostTransfer(roomId: string, clientId: string) {
  return parse<{ snapshot: RoomSnapshot; hostToken: string }>(await fetch(`/api/rooms/${encodeURIComponent(roomId)}/host-transfer/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  }));
}
