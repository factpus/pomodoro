import 'server-only';

import { createPublicKey, verify } from 'node:crypto';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function verifyDiscordRequest(body: string, signature: string | null, timestamp: string | null) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey || !signature || !timestamp) return false;
  if (!/^[a-f0-9]{64}$/i.test(publicKey) || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKey, 'hex')]),
      format: 'der',
      type: 'spki',
    });
    return verify(null, Buffer.from(timestamp + body), key, Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

export interface DiscordInteraction {
  id: string;
  type: number;
  application_id?: string;
  token?: string;
  data?: {
    name?: string;
    options?: Array<{ name: string; value?: string | number | boolean }>;
  };
}

export async function postDiscordRoomInvite(applicationId: string, interactionToken: string, roomId: string, inviteUrl: string) {
  const url = `https://discord.com/api/v10/webhooks/${encodeURIComponent(applicationId)}/${encodeURIComponent(interactionToken)}`;
  const body = JSON.stringify({
    content: `🍅 **Pomodoro Together**\nルーム **${roomId}** で一緒に集中しよう。`,
    allowed_mentions: { parse: [] },
    components: [{ type: 1, components: [{ type: 2, style: 5, label: 'ルームに参加', url: inviteUrl }] }],
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(5_000) });
    if (response.ok) return;
    if (response.status === 429 && attempt === 0) {
      const seconds = Number(response.headers.get('retry-after') ?? 1);
      await new Promise((resolve) => setTimeout(resolve, Number.isFinite(seconds) ? Math.min(2_000, Math.max(100, seconds * 1_000)) : 1_000));
      continue;
    }
    throw new Error(`Discord invite followup failed (${response.status})`);
  }
}

export function integerOption(interaction: DiscordInteraction, name: string, fallback: number) {
  const value = interaction.data?.options?.find((option) => option.name === name)?.value;
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback;
}
