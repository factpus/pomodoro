import { expect, test } from '@playwright/test';

test('two clients share state while only the host can control it', async ({ browser }) => {
  const host = await browser.newContext();
  const guest = await browser.newContext();
  const hostPage = await host.newPage();
  const guestPage = await guest.newPage();
  const roomId = `e2e-${Date.now()}`;

  await hostPage.goto('/');
  await hostPage.getByRole('textbox', { name: 'ルーム名', exact: true }).fill(roomId);
  await hostPage.getByRole('button', { name: 'ルームを作る' }).click();
  await expect(hostPage).toHaveURL(new RegExp(`/room/${roomId}$`));
  await expect(hostPage.getByText('ホスト', { exact: true })).toBeVisible();

  await guestPage.goto(`/room/${roomId}`);
  await expect(guestPage.getByText('参加者', { exact: true })).toBeVisible();
  await expect(guestPage.getByRole('button', { name: 'タイマーを開始' })).toBeDisabled();
  const forbidden = await guestPage.request.post(`/api/rooms/${roomId}/commands`, {
    data: { command: 'start', clientId: crypto.randomUUID() },
  });
  expect(forbidden.status()).toBe(403);
  const forbiddenIntegration = await guestPage.request.post(`/api/rooms/${roomId}/integrations/discord-webhook`, {
    data: { webhookUrl: 'https://discord.com/api/webhooks/1/not-a-real-token' },
  });
  expect(forbiddenIntegration.status()).toBe(403);
  const publicSnapshot = await guestPage.request.get(`/api/rooms/${roomId}/public`);
  expect(publicSnapshot.status()).toBe(200);
  expect((await publicSnapshot.json()).role).toBeUndefined();
  expect(publicSnapshot.headers()['cache-control']).toContain('s-maxage=1');

  await hostPage.getByRole('button', { name: 'タイマーを開始' }).click();
  await expect(hostPage.getByRole('button', { name: 'タイマーを一時停止' })).toBeVisible();
  await expect(guestPage.getByRole('button', { name: 'タイマーを一時停止' })).toBeVisible({ timeout: 3_000 });

  await guest.setOffline(true);
  await hostPage.getByRole('button', { name: 'タイマーを一時停止' }).click();
  await guest.setOffline(false);
  await expect(guestPage.getByText('同期中', { exact: true })).toBeVisible({ timeout: 8_000 });
  await expect(guestPage.getByRole('button', { name: 'タイマーを開始' })).toBeVisible();

  await host.close();
  await guest.close();
});

test('API rejects invalid room settings', async ({ request }) => {
  const response = await request.post('/api/rooms', {
    headers: { 'X-Client-Id': crypto.randomUUID() },
    data: { roomId: '../invalid', settings: { focusMinutes: 0, shortBreakMinutes: 99, longBreakMinutes: 15, longBreakEvery: 1 } },
  });
  expect(response.status()).toBe(400);
});
