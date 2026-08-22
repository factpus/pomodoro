import 'server-only';

async function retryAfterSeconds(response: Response) {
  const header = response.headers.get('retry-after');
  const headerValue = header === null ? Number.NaN : Number(header);
  if (Number.isFinite(headerValue) && headerValue >= 0) return headerValue;

  const body = await response.clone().json().catch(() => null) as { retry_after?: number } | null;
  return typeof body?.retry_after === 'number' && Number.isFinite(body.retry_after) && body.retry_after >= 0
    ? body.retry_after
    : 1;
}

export async function waitForDiscordRateLimit(response: Response, deadline: number) {
  const delayMs = Math.ceil((await retryAfterSeconds(response)) * 1_000);
  if (delayMs >= deadline - Date.now()) return false;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return true;
}

export function discordRequestSignal(deadline: number) {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) return AbortSignal.abort();
  return AbortSignal.timeout(Math.min(5_000, remainingMs));
}
