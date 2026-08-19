'use client';

import type { RoomSnapshot, TimerCommand } from '@/lib/timer/types';

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
