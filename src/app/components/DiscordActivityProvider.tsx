'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { DiscordSDK } from '@discord/embedded-app-sdk';
import { clientId, hostTokenKey } from '@/lib/client/identity';
import type { RoomSnapshot } from '@/lib/timer/types';

interface PresenceInput {
  details: string;
  state: string;
  endsAt?: number;
}

interface ActivityContextValue {
  embedded: boolean;
  participants: number;
  error: string;
  invite: () => Promise<void>;
  setTimerPresence: (input: PresenceInput) => Promise<void>;
}

const ActivityContext = createContext<ActivityContextValue>({
  embedded: false,
  participants: 0,
  error: '',
  invite: async () => undefined,
  setTimerPresence: async () => undefined,
});

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Discord連携に失敗しました。');
  return body;
}

export function useDiscordActivity() {
  return useContext(ActivityContext);
}

export default function DiscordActivityProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sdkRef = useRef<DiscordSDK | null>(null);
  const authenticatedRef = useRef(false);
  const [embedded, setEmbedded] = useState(false);
  const [participants, setParticipants] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const applicationId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
    const params = new URLSearchParams(window.location.search);
    if (!applicationId || !params.has('frame_id') || !params.has('instance_id') || !params.has('platform')) return;
    let cancelled = false;
    let cleanup: (() => Promise<unknown>) | undefined;

    void import('@discord/embedded-app-sdk').then(async ({ DiscordSDK, Events }) => {
      try {
        const sdk = new DiscordSDK(applicationId, { disableConsoleLogOverride: true });
        sdkRef.current = sdk;
        await sdk.ready();
        if (cancelled) return;
        setEmbedded(true);

        const updateParticipants = (data: { participants: unknown[] }) => setParticipants(data.participants.length);
        updateParticipants(await sdk.commands.getInstanceConnectedParticipants());
        await sdk.subscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, updateParticipants);
        cleanup = () => sdk.unsubscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, updateParticipants);

        const { code } = await sdk.commands.authorize({
          client_id: applicationId,
          response_type: 'code',
          state: '',
          prompt: 'none',
          scope: ['identify', 'rpc.activities.write'],
        });
        const token = await responseJson<{ accessToken: string }>(await fetch('/api/discord/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        }));
        const authentication = await sdk.commands.authenticate({ access_token: token.accessToken });
        if (!authentication) throw new Error('Discordユーザーを認証できませんでした。');
        authenticatedRef.current = true;

        if (window.location.pathname === '/') {
          const result = await responseJson<{ snapshot: RoomSnapshot; hostToken: string | null }>(await fetch('/api/discord/activity-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.accessToken}` },
            body: JSON.stringify({ instanceId: sdk.instanceId, clientId: clientId() }),
          }));
          if (result.hostToken) sessionStorage.setItem(hostTokenKey(result.snapshot.roomId), result.hostToken);
          router.replace(`/room/${result.snapshot.roomId}${window.location.search}`);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Discordとの接続に失敗しました。');
      }
    });

    return () => {
      cancelled = true;
      authenticatedRef.current = false;
      if (cleanup) void cleanup();
    };
  }, [router]);

  const invite = useCallback(async () => {
    if (!sdkRef.current) throw new Error('Discord Activityに接続されていません。');
    await sdkRef.current.commands.openInviteDialog();
  }, []);

  const setTimerPresence = useCallback(async (input: PresenceInput) => {
    if (!sdkRef.current || !authenticatedRef.current) return;
    await sdkRef.current.commands.setActivity({
      activity: {
        type: 0,
        details: input.details,
        state: input.state,
        timestamps: input.endsAt ? { end: Math.floor(input.endsAt / 1000) } : undefined,
        instance: true,
      },
    });
  }, []);

  const value = useMemo(() => ({ embedded, participants, error, invite, setTimerPresence }), [embedded, error, invite, participants, setTimerPresence]);
  return <ActivityContext.Provider value={value}>{children}{embedded && error && pathname === '/' && <p className="activity-global-error" role="alert">{error} Web版として操作できます。</p>}</ActivityContext.Provider>;
}
