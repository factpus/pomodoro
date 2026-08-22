import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { RoomRecord } from '@/lib/timer/types';
import { discordRequestSignal, waitForDiscordRateLimit } from './discord-rate-limit';

type EncryptedSecret = NonNullable<RoomRecord['discordWebhook']>;

export class IntegrationConfigurationError extends Error {}
export class DiscordWebhookError extends Error {
  constructor(message: string, public readonly status?: number, public readonly permanent = false) {
    super(message);
  }
}

function encryptionKey() {
  const configured = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!configured) {
    throw new IntegrationConfigurationError('Discord連携用の暗号鍵が設定されていません。');
  }

  const key = /^[0-9a-f]{64}$/i.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64');
  if (key.length !== 32) {
    throw new IntegrationConfigurationError('Discord連携用の暗号鍵は32バイトで設定してください。');
  }
  return key;
}

export function validateDiscordWebhookUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DiscordWebhookError('Discord Webhook URLの形式が正しくありません。');
  }

  const path = url.pathname.split('/').filter(Boolean);
  if (url.protocol !== 'https:' || url.hostname !== 'discord.com' || path[0] !== 'api' || path[1] !== 'webhooks' || path.length !== 4) {
    throw new DiscordWebhookError('discord.comのWebhook URLを入力してください。');
  }
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function encryptWebhookUrl(value: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

function decryptWebhookUrl(secret: EncryptedSecret) {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(secret.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(secret.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export async function postDiscordWebhook(secret: EncryptedSecret, content: string) {
  const url = `${decryptWebhookUrl(secret)}?wait=true`;
  const deadline = Date.now() + 10_000;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          username: 'Pomodoro Together',
          allowed_mentions: { parse: [] },
        }),
        signal: discordRequestSignal(deadline),
      });
    } catch {
      throw new DiscordWebhookError('Discordへ接続できませんでした。URLと接続状態を確認してください。');
    }
    if (response.ok) return;
    if (response.status === 429 && attempt === 0 && await waitForDiscordRateLimit(response, deadline)) {
      continue;
    }
    const permanent = response.status === 401 || response.status === 404;
    throw new DiscordWebhookError(`Discordへの送信に失敗しました（${response.status}）。`, response.status, permanent);
  }
}
