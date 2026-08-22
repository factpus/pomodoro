import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exchangeDiscordCode, verifyDiscordAccessToken } from './discord-oauth';

beforeEach(() => {
  process.env.DISCORD_APPLICATION_ID = 'app-id';
  process.env.DISCORD_CLIENT_SECRET = 'client-secret';
});

afterEach(() => {
  delete process.env.DISCORD_APPLICATION_ID;
  delete process.env.DISCORD_CLIENT_SECRET;
  vi.unstubAllGlobals();
});

describe('Discord OAuth', () => {
  it('exchanges an authorization code without exposing the client secret in headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'access', expires_in: 3600 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(exchangeDiscordCode('code')).resolves.toEqual({ accessToken: 'access', expiresIn: 3600 });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(String(init.body)).toContain('client_secret=client-secret');
  });

  it('verifies the Discord user for an Activity room', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      application: { id: 'app-id' },
      scopes: ['identify', 'rpc.activities.write'],
      user: { id: '42' },
    }), { status: 200 })));
    await expect(verifyDiscordAccessToken('access')).resolves.toEqual({ id: '42' });
  });

  it('rejects a token issued to another Discord application', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      application: { id: 'other-app' },
      scopes: ['identify', 'rpc.activities.write'],
      user: { id: '42' },
    }), { status: 200 })));
    await expect(verifyDiscordAccessToken('access')).rejects.toThrow('Discordの認証が無効です。');
  });

  it('rejects a token without the Activity presence scope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      application: { id: 'app-id' },
      scopes: ['identify'],
      user: { id: '42' },
    }), { status: 200 })));
    await expect(verifyDiscordAccessToken('access')).rejects.toThrow('Discordの認証が無効です。');
  });
});
