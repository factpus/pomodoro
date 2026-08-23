import { describe, expect, it } from 'vitest';
import { shouldAcceptSnapshotVersion } from './snapshot-order';

describe('shouldAcceptSnapshotVersion', () => {
  it('accepts the first snapshot', () => {
    expect(shouldAcceptSnapshotVersion(null, 1)).toBe(true);
  });

  it('accepts equal and newer versions', () => {
    expect(shouldAcceptSnapshotVersion(4, 4)).toBe(true);
    expect(shouldAcceptSnapshotVersion(4, 5)).toBe(true);
  });

  it('rejects a stale response that arrives after a command response', () => {
    expect(shouldAcceptSnapshotVersion(5, 4)).toBe(false);
  });
});
