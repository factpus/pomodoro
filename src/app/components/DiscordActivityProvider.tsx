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
  authenticated: boolean;
  participants: number;
  error: string;
  invite: () => Promise<void>;
  setTimerPresence: (input: PresenceInput) => Promise<void>;
}

type ConnectionStage = 'sdk-ready' | 'authorize' | 'token-exchange' | 'authenticate';

const connectionStageLabels: Record<ConnectionStage, string> = {
  'sdk-ready': 'SDK初期化',
  authorize: 'Discord認可',
  'token-exchange': 'OAuthトークン交換',
  authenticate: 'Discord認証',
};

const ActivityContext = createContext<ActivityContextValue>({
  embedded: false,
  authenticated: false,
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
  const accessTokenRef = useRef<string | null>(null);
  const activityQueryRef = useRef('');
  const [embedded, setEmbedded] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [participants, setParticipants] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const applicationId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
    const params = new URLSearchParams(window.location.search);
    if (!applicationId || !params.has('frame_id') || !params.has('instance_id') || !params.has('platform')) return;
    activityQueryRef.current = window.location.search;
    let cancelled = false;
    let cleanup: (() => Promise<unknown>) | undefined;

    void (async () => {
      let stage: ConnectionStage = 'sdk-ready';
      try {
        const { DiscordSDK, Events } = await import('@discord/embedded-app-sdk');
        const sdk = new DiscordSDK(applicationId, { disableConsoleLogOverride: true });
        sdkRef.current = sdk;
        await sdk.ready();
        if (cancelled) return;
        setEmbedded(true);

        stage = 'authorize';
        const { code } = await sdk.commands.authorize({
          client_id: applicationId,
          response_type: 'code',
          state: '',
          prompt: 'none',
          scope: ['identify', 'rpc.activities.write'],
        });
        stage = 'token-exchange';
        const token = await responseJson<{ accessToken: string }>(await fetch('/api/discord/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        }));
        stage = 'authenticate';
        const authentication = await sdk.commands.authenticate({ access_token: token.accessToken });
        if (!authentication) throw new Error('Discordユーザーを認証できませんでした。');
        if (cancelled) return;
        accessTokenRef.current = token.accessToken;
        setAuthenticated(true);

        const updateParticipants = (data: { participants: unknown[] }) => {
          if (!cancelled) setParticipants(data.participants.length);
        };
        try {
          updateParticipants(await sdk.commands.getInstanceConnectedParticipants());
          if (cancelled) return;
          await sdk.subscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, updateParticipants);
          if (cancelled) await sdk.unsubscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, updateParticipants);
          else cleanup = () => sdk.unsubscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, updateParticipants);
        } catch (caught) {
          console.warn('[Discord Activity] participant tracking failed', caught);
        }
      } catch (caught) {
        console.error(`[Discord Activity] connection failed at ${stage}`, caught);
        if (!cancelled) {
          const detail = caught instanceof Error ? `: ${caught.message}` : '';
          setEmbedded(true);
          setError(`Discordとの接続に失敗しました（${connectionStageLabels[stage]}）${detail}`);
        }
      }
    })();

    return () => {
      cancelled = true;
      accessTokenRef.current = null;
      if (cleanup) void cleanup();
    };
  }, []);

  useEffect(() => {
    if (!authenticated || pathname !== '/') return;
    const sdk = sdkRef.current;
    const accessToken = accessTokenRef.current;
    if (!sdk || !accessToken) return;
    const controller = new AbortController();
    setError('');

    void (async () => {
      try {
        const result = await responseJson<{ snapshot: RoomSnapshot; hostToken: string | null }>(await fetch('/api/discord/activity-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ instanceId: sdk.instanceId, clientId: clientId() }),
          signal: controller.signal,
        }));
        if (controller.signal.aborted) return;
        if (result.hostToken) sessionStorage.setItem(hostTokenKey(result.snapshot.roomId), result.hostToken);
        router.replace(`/room/${result.snapshot.roomId}${activityQueryRef.current}`);
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Discordルームへ参加できませんでした。');
      }
    })();

    return () => controller.abort();
  }, [authenticated, pathname, router]);

  const invite = useCallback(async () => {
    if (!sdkRef.current) throw new Error('Discord Activityに接続されていません。');
    await sdkRef.current.commands.openInviteDialog();
  }, []);

  const setTimerPresence = useCallback(async (input: PresenceInput) => {
    if (!sdkRef.current || !authenticated) return;
    await sdkRef.current.commands.setActivity({
      activity: {
        type: 0,
        details: input.details,
        state: input.state,
        timestamps: input.endsAt ? { end: input.endsAt } : undefined,
        instance: true,
      },
    });
  }, [authenticated]);

  const value = useMemo(() => ({ embedded, authenticated, participants, error, invite, setTimerPresence }), [authenticated, embedded, error, invite, participants, setTimerPresence]);
  return <ActivityContext.Provider value={value}>{children}{embedded && error && pathname === '/' && <p className="activity-global-error" role="alert">{error} Web版として操作できます。</p>}</ActivityContext.Provider>;
}
