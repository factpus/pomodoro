import 'server-only';

export class DiscordOAuthConfigurationError extends Error {}
export class DiscordOAuthError extends Error {}

function credentials() {
  const clientId = process.env.DISCORD_APPLICATION_ID ?? process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new DiscordOAuthConfigurationError('Discord ActivityのOAuth設定が完了していません。');
  }
  return { clientId, clientSecret };
}

export async function exchangeDiscordCode(code: string) {
  const { clientId, clientSecret } = credentials();
  let response: Response;
  try {
    response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new DiscordOAuthError('Discord認証サーバーへ接続できませんでした。');
  }
  const result = await response.json().catch(() => null) as { access_token?: string; expires_in?: number } | null;
  if (!response.ok || !result?.access_token) throw new DiscordOAuthError('Discordの認証コードを確認できませんでした。');
  return { accessToken: result.access_token, expiresIn: result.expires_in ?? 0 };
}

export async function verifyDiscordAccessToken(accessToken: string) {
  let response: Response;
  try {
    response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new DiscordOAuthError('Discordユーザーを確認できませんでした。');
  }
  const user = await response.json().catch(() => null) as { id?: string; username?: string; global_name?: string | null } | null;
  if (!response.ok || !user?.id) throw new DiscordOAuthError('Discordの認証が無効です。');
  return { id: user.id };
}
