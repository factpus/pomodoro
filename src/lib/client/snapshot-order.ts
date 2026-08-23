export interface SnapshotWatermark {
  version: number;
  serverNow: number;
}

export function shouldAcceptSnapshot(latest: SnapshotWatermark | null, incoming: SnapshotWatermark) {
  return latest === null
    || incoming.version > latest.version
    || (incoming.version === latest.version && incoming.serverNow >= latest.serverNow);
}
