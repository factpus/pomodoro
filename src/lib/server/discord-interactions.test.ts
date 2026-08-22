import { generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { postDiscordRoomInvite, verifyDiscordRequest } from './discord-interactions';

afterEach(() => {
  delete process.env.DISCORD_PUBLIC_KEY;
  vi.unstubAllGlobals();
});

describe('Discord interactions', () => {
  it('accepts a valid Ed25519 signature and rejects a changed body', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const rawPublicKey = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
    const timestamp = '1720000000';
    const body = '{"type":1}';
    process.env.DISCORD_PUBLIC_KEY = rawPublicKey;
    const signature = sign(null, Buffer.from(timestamp + body), privateKey).toString('hex');
    expect(verifyDiscordRequest(body, signature, timestamp)).toBe(true);
    expect(verifyDiscordRequest(`${body} `, signature, timestamp)).toBe(false);
  });

  it('posts a public room button without mentions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await postDiscordRoomInvite('app', 'interaction-token', 'room-a', 'https://example.com/room/room-a');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.allowed_mentions).toEqual({ parse: [] });
    expect(body.components[0].components[0].url).toBe('https://example.com/room/room-a');
  });
});
