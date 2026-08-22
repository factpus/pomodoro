import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptWebhookUrl, postDiscordWebhook } from './discord-webhook';

beforeEach(() => {
  process.env.INTEGRATION_ENCRYPTION_KEY = 'ab'.repeat(32);
});

afterEach(() => {
  delete process.env.INTEGRATION_ENCRYPTION_KEY;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Discord Webhook delivery', () => {
  it('retries one rate-limited request', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const delivery = postDiscordWebhook(encryptWebhookUrl('https://discord.com/api/webhooks/1/token'), 'start');
    await vi.advanceTimersByTimeAsync(100);
    await delivery;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('marks missing Webhooks as permanently invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    const delivery = postDiscordWebhook(encryptWebhookUrl('https://discord.com/api/webhooks/1/token'), 'start');
    await expect(delivery).rejects.toMatchObject({ status: 404, permanent: true });
  });
});
