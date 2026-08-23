import { generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { postDiscordRoomInvite, verifyDiscordRequest } from './discord-interactions';

afterEach(() => {
  delete process.env.DISCORD_PUBLIC_KEY;
  vi.useRealTimers();
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

  it('waits for Discord\'s full retry interval before posting the room button again', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ retry_after: 3 }), { status: 429 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const delivery = postDiscordRoomInvite('app', 'token', 'room-a', 'https://example.com/room/room-a');
    await vi.advanceTimersByTimeAsync(2_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await delivery;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
