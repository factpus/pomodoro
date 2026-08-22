import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createRoom } from '@/lib/server/room-store';
import { DiscordInteraction, integerOption, verifyDiscordRequest } from '@/lib/server/discord-interactions';
import { minutesToSettings, timerSettingsSchema } from '@/lib/timer/validation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.text();
  if (!verifyDiscordRequest(body, request.headers.get('x-signature-ed25519'), request.headers.get('x-signature-timestamp'))) {
    return new NextResponse('invalid request signature', { status: 401 });
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(body) as DiscordInteraction;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (interaction.type === 1) return NextResponse.json({ type: 1 });
  if (interaction.type !== 2 || interaction.data?.name !== 'pomodoro') {
    return NextResponse.json({ type: 4, data: { content: '未対応のコマンドです。', flags: 64 } });
  }

  try {
    const input = timerSettingsSchema.parse({
      focusMinutes: integerOption(interaction, 'focus', 25),
      shortBreakMinutes: integerOption(interaction, 'break', 5),
      longBreakMinutes: integerOption(interaction, 'long_break', 15),
      longBreakEvery: integerOption(interaction, 'long_break_every', 4),
    });
    const roomId = `discord-${interaction.id.slice(-32).toLowerCase()}`;
    const result = await createRoom(roomId, minutesToSettings(input), randomUUID());
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin).replace(/\/$/, '');
    const hostUrl = `${baseUrl}/room/${roomId}#hostToken=${encodeURIComponent(result.hostToken)}`;
    const inviteUrl = `${baseUrl}/room/${roomId}`;
    return NextResponse.json({
      type: 4,
      data: {
        flags: 64,
        content: `🍅 ルーム **${roomId}** を作成しました。\nホスト用ボタンは実行した本人だけに表示されています。開いた後、アプリ内の共有ボタンから参加者へ ${inviteUrl} を送ってください。`,
        allowed_mentions: { parse: [] },
        components: [{ type: 1, components: [{ type: 2, style: 5, label: 'ホストとして開く', url: hostUrl }] }],
      },
    });
  } catch (error) {
    console.error('Discord command failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ type: 4, data: { content: 'ルームを作成できませんでした。しばらく待って再試行してください。', flags: 64 } });
  }
}
