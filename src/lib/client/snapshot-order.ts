export function shouldAcceptSnapshotVersion(latestVersion: number | null, incomingVersion: number) {
  return latestVersion === null || incomingVersion >= latestVersion;
}
