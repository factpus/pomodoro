import 'server-only';

type LogLevel = 'info' | 'warn' | 'error';
type LogValue = string | number | boolean | null | undefined;

export function logServerEvent(level: LogLevel, event: string, details: Record<string, LogValue> = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'pomodoro-together',
    level,
    event,
    ...details,
  });
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.info(entry);
}
