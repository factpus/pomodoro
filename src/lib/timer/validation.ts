import { z } from 'zod';

export const ROOM_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

export const roomIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(50)
  .regex(ROOM_ID_PATTERN, 'ルーム名は半角英数字とハイフンを使用してください。');

export const timerSettingsSchema = z.object({
  focusMinutes: z.number().int().min(1).max(180),
  shortBreakMinutes: z.number().int().min(1).max(60),
  longBreakMinutes: z.number().int().min(1).max(120),
  longBreakEvery: z.number().int().min(2).max(8),
});

export const createRoomSchema = z.object({
  roomId: roomIdSchema.optional(),
  settings: timerSettingsSchema,
});

export const heartbeatSchema = z.object({
  clientId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(30).optional(),
});

export const timerCommandSchema = z.object({
  command: z.enum(['start', 'pause', 'reset', 'skip']),
  clientId: z.string().uuid(),
});

export const discordWebhookSchema = z.object({
  webhookUrl: z.string().trim().url('Webhook URLを確認してください。').max(500),
});

export function minutesToSettings(input: z.infer<typeof timerSettingsSchema>) {
  return {
    focusSeconds: input.focusMinutes * 60,
    shortBreakSeconds: input.shortBreakMinutes * 60,
    longBreakSeconds: input.longBreakMinutes * 60,
    longBreakEvery: input.longBreakEvery,
  };
}
