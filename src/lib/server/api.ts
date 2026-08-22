import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  RoomAlreadyExistsError,
  RoomBusyError,
  RoomForbiddenError,
  RoomNotFoundError,
  StorageUnavailableError,
  HostTransferUnavailableError,
} from './room-store';
import { DiscordWebhookError, IntegrationConfigurationError } from './discord-webhook';
import { DiscordOAuthConfigurationError, DiscordOAuthError } from './discord-oauth';
import { logServerEvent } from './observability';

export function apiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message ?? '入力内容を確認してください。' },
      { status: 400 },
    );
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: 'JSON形式が正しくありません。' }, { status: 400 });
  }
  if (error instanceof RoomNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof RoomAlreadyExistsError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof HostTransferUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof RoomForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof RoomBusyError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof StorageUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof DiscordWebhookError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof IntegrationConfigurationError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof DiscordOAuthConfigurationError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof DiscordOAuthError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  logServerEvent('error', 'api.unhandled_error', {
    error: error instanceof Error ? error.name : 'unknown',
    message: error instanceof Error ? error.message.slice(0, 200) : undefined,
  });
  return NextResponse.json({ error: 'サーバーで問題が発生しました。' }, { status: 500 });
}

export function rateLimited(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: '操作が多すぎます。少し待ってから再試行してください。' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}
