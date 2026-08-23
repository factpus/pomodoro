export interface SnapshotWatermark {
  version: number;
  serverNow: number;
}

export interface SnapshotAcceptance {
  timer: boolean;
  metadata: boolean;
}

export function shouldAcceptSnapshot(latest: SnapshotWatermark | null, incoming: SnapshotWatermark) {
  return latest === null
    || incoming.version > latest.version
    || (incoming.version === latest.version && incoming.serverNow >= latest.serverNow);
}

export function snapshotAcceptance(
  latestTimer: SnapshotWatermark | null,
  latestAuthenticated: SnapshotWatermark | null,
  incoming: SnapshotWatermark,
  authenticated: boolean,
) {
  return {
    timer: shouldAcceptSnapshot(latestTimer, incoming),
    metadata: authenticated && shouldAcceptSnapshot(latestAuthenticated, incoming),
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
