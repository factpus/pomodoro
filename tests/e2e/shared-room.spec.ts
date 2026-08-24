import { expect, test } from '@playwright/test';

test('two clients share state and every active participant can control the timer', async ({ browser }) => {
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
  await expect(guestPage.getByRole('button', { name: 'タイマーを開始' })).toBeEnabled();
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

  await guestPage.getByRole('button', { name: 'タイマーを開始' }).click();
  await expect(hostPage.getByRole('button', { name: 'タイマーを一時停止' })).toBeVisible();
  await expect(guestPage.getByRole('button', { name: 'タイマーを一時停止' })).toBeVisible({ timeout: 3_000 });

  await guest.setOffline(true);
  await hostPage.getByRole('button', { name: 'タイマーを一時停止' }).click();
  await guest.setOffline(false);
  await expect(guestPage.getByText('同期中', { exact: true })).toBeVisible({ timeout: 8_000 });
  await expect(guestPage.getByRole('button', { name: 'タイマーを開始' })).toBeVisible();

  await hostPage.reload();
  await expect(hostPage.getByRole('button', { name: 'ホスト' })).toBeVisible();
  const oldHostToken = await hostPage.evaluate((id) => sessionStorage.getItem(`pomodoro-together-host:${id}`), roomId);
  expect(oldHostToken).toBeTruthy();
  await hostPage.getByRole('button', { name: 'ホスト' }).click();
  await hostPage.getByRole('button', { name: /参加者 [A-F0-9]{4}.*移譲する/ }).click();
  const spoofedAccept = await hostPage.request.post(`/api/rooms/${roomId}/host-transfer/accept`, {
    data: { clientId: crypto.randomUUID() },
  });
  expect(spoofedAccept.status()).toBe(409);
  await expect(guestPage.getByText('ホストを引き継ぎますか？')).toBeVisible({ timeout: 12_000 });
  await guestPage.getByRole('button', { name: '引き継ぐ' }).click();
  await expect(guestPage.getByRole('button', { name: 'ホスト' })).toBeVisible();
  const revokedCommand = await hostPage.request.post(`/api/rooms/${roomId}/commands`, {
    headers: { Authorization: `Bearer ${oldHostToken}` },
    data: { command: 'start', clientId: crypto.randomUUID() },
  });
  expect(revokedCommand.status()).toBe(403);
  await expect(hostPage.getByText('参加者', { exact: true })).toBeVisible({ timeout: 12_000 });
  await expect(hostPage.getByRole('button', { name: 'タイマーを開始' })).toBeEnabled();
  await guestPage.getByRole('button', { name: 'タイマーを開始' }).click();
  await expect(guestPage.getByRole('button', { name: 'タイマーを一時停止' })).toBeVisible();

  await host.close();
  await guest.close();
});

test('a remaining participant automatically becomes host after the host disconnects', async ({ browser }) => {
  test.setTimeout(45_000);
  const host = await browser.newContext();
  const guest = await browser.newContext();
  const hostPage = await host.newPage();
  const guestPage = await guest.newPage();
  const roomId = `handoff-${Date.now()}`;

  await hostPage.goto('/');
  await hostPage.getByRole('textbox', { name: 'ルーム名', exact: true }).fill(roomId);
  await hostPage.getByRole('button', { name: 'ルームを作る' }).click();
  await expect(hostPage.getByRole('button', { name: 'ホスト' })).toBeVisible();

  await guestPage.goto(`/room/${roomId}`);
  await expect(guestPage.getByText('参加者', { exact: true })).toBeVisible();
  await hostPage.close();

  await expect(guestPage.getByRole('button', { name: 'ホスト' })).toBeVisible({ timeout: 30_000 });
  const inheritedToken = await guestPage.evaluate((id) => sessionStorage.getItem(`pomodoro-together-host:${id}`), roomId);
  expect(inheritedToken).toBeTruthy();

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

test('health endpoint reports the local fallback without caching', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'degraded', storage: 'memory' });
  expect(response.headers()['cache-control']).toBe('no-store');
});

test('ambient audio starts quiet and preserves the device preference', async ({ page }) => {
  const roomId = `audio-${Date.now()}`;
  await page.goto('/');
  await page.getByRole('textbox', { name: 'ルーム名', exact: true }).fill(roomId);
  await page.getByRole('button', { name: 'ルームを作る' }).click();

  const volume = page.getByRole('slider', { name: '環境音の音量' });
  await expect(volume).toHaveValue('0.2');
  await page.getByRole('button', { name: '環境音のミュートを解除' }).click();
  await volume.fill('0.45');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pomodoro-together:audio-preferences'))).toBe(JSON.stringify({ volume: 0.45, muted: false }));

  await page.reload();
  await expect(page.getByRole('slider', { name: '環境音の音量' })).toHaveValue('0.45');
  await expect(page.getByRole('button', { name: '環境音をミュート' })).toBeVisible();
});
