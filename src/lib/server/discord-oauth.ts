import 'server-only';

export class DiscordOAuthConfigurationError extends Error {}
export class DiscordOAuthError extends Error {}

function credentials() {
  const clientId = configuredClientId();
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientSecret) {
    throw new DiscordOAuthConfigurationError('Discord ActivityのOAuth設定が完了していません。');
  }
  return { clientId, clientSecret };
}

function configuredClientId() {
  const clientId = process.env.DISCORD_APPLICATION_ID ?? process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  if (!clientId) throw new DiscordOAuthConfigurationError('Discord ActivityのOAuth設定が完了していません。');
  return clientId;
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
  const clientId = configuredClientId();
  let response: Response;
  try {
    response = await fetch('https://discord.com/api/v10/oauth2/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new DiscordOAuthError('Discordユーザーを確認できませんでした。');
  }
  const authorization = await response.json().catch(() => null) as {
    application?: { id?: string };
    scopes?: string[];
    user?: { id?: string };
  } | null;
  const scopes = new Set(authorization?.scopes ?? []);
  if (
    !response.ok
    || authorization?.application?.id !== clientId
    || !authorization.user?.id
    || !scopes.has('identify')
    || !scopes.has('rpc.activities.write')
  ) {
    throw new DiscordOAuthError('Discordの認証が無効です。');
  }
  return { id: authorization.user.id };
}
