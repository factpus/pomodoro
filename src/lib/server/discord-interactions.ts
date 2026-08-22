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
  data?: {
    name?: string;
    options?: Array<{ name: string; value?: string | number | boolean }>;
  };
}

export function integerOption(interaction: DiscordInteraction, name: string, fallback: number) {
  const value = interaction.data?.options?.find((option) => option.name === name)?.value;
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback;
}
