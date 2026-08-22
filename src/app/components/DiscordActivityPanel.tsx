'use client';

import { useEffect, useRef, useState } from 'react';
import type { DiscordSDK } from '@discord/embedded-app-sdk';

export default function DiscordActivityPanel() {
  const sdkRef = useRef<DiscordSDK | null>(null);
  const [embedded, setEmbedded] = useState(false);
  const [participants, setParticipants] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
    const params = new URLSearchParams(window.location.search);
    if (!clientId || !params.has('frame_id') || !params.has('instance_id') || !params.has('platform')) return;
    let cancelled = false;
    let cleanup: (() => Promise<unknown>) | undefined;

    void import('@discord/embedded-app-sdk').then(async ({ DiscordSDK, Events }) => {
      try {
        const sdk = new DiscordSDK(clientId, { disableConsoleLogOverride: true });
        sdkRef.current = sdk;
        const update = (data: { participants: unknown[] }) => setParticipants(data.participants.length);
        await sdk.ready();
        if (cancelled) return;
        setEmbedded(true);
        update(await sdk.commands.getInstanceConnectedParticipants());
        await sdk.subscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, update);
        cleanup = () => sdk.unsubscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, update);
      } catch {
        if (!cancelled) setMessage('Discordとの接続を確認できませんでした。Web版として利用できます。');
      }
    });

    return () => {
      cancelled = true;
      if (cleanup) void cleanup();
    };
  }, []);

  if (!embedded && !message) return null;

  async function invite() {
    setMessage('');
    try {
      await sdkRef.current?.commands.openInviteDialog();
    } catch {
      setMessage('招待画面を開けませんでした。上のリンク共有を利用してください。');
    }
  }

  return (
    <div className="activity-panel">
      {embedded && <><span>Discord Activity ・ {participants}人接続</span><button type="button" onClick={() => void invite()}>ボイスチャンネルへ招待</button></>}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
