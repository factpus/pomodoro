'use client';

const CLIENT_ID_KEY = 'pomodoro-together-client-id';

export function clientId(): string {
  const existing = sessionStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(CLIENT_ID_KEY, created);
  return created;
}

export function hostTokenKey(roomId: string): string {
  return `pomodoro-together-host:${roomId}`;
}
