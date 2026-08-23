export interface SnapshotWatermark {
  generation: number;
  revision: number;
  version: number;
  serverNow: number;
}

export interface SnapshotAcceptance {
  timer: boolean;
  metadata: boolean;
}

export function shouldAcceptSnapshot(latest: SnapshotWatermark | null, incoming: SnapshotWatermark) {
  return latest === null
    || incoming.generation > latest.generation
    || (incoming.generation === latest.generation && (
      incoming.version > latest.version
      || (incoming.version === latest.version && incoming.serverNow >= latest.serverNow)
    ));
}

export function snapshotAcceptance(
  latestTimer: SnapshotWatermark | null,
  latestAuthenticated: SnapshotWatermark | null,
  incoming: SnapshotWatermark,
  authenticated: boolean,
) {
  return {
    timer: shouldAcceptSnapshot(latestTimer, incoming),
    metadata: authenticated
      && (latestTimer === null || incoming.generation >= latestTimer.generation)
      && (latestAuthenticated === null
        || incoming.generation > latestAuthenticated.generation
        || (incoming.generation === latestAuthenticated.generation
          && incoming.revision > latestAuthenticated.revision)),
  };
}

export function mergeAuthenticatedSnapshot<T extends { state: unknown }>(
  current: T | null,
  incoming: T,
  acceptance: SnapshotAcceptance,
) {
  if (!current || (acceptance.timer && acceptance.metadata)) return incoming;
  if (acceptance.metadata) return { ...incoming, state: current.state };
  if (acceptance.timer) return { ...current, state: incoming.state };
  return current;
}

export function shouldRevokeHostToken(
  currentToken: string | null,
  requestToken: string | null | undefined,
  responseRole: 'host' | 'participant',
) {
  return responseRole === 'participant'
    && currentToken !== null
    && requestToken !== undefined
    && requestToken === currentToken;
}

export function isCredentialContextCurrent(
  currentToken: string | null,
  requestToken: string | null | undefined,
) {
  return requestToken === undefined || requestToken === currentToken;
}
