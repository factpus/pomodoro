import { describe, expect, it } from 'vitest';
import { shouldAcceptSnapshot } from './snapshot-order';

describe('shouldAcceptSnapshot', () => {
  it('accepts the first snapshot', () => {
    expect(shouldAcceptSnapshot(null, { version: 1, serverNow: 1_000 })).toBe(true);
  });

  it('accepts a newer version regardless of request completion order', () => {
    expect(shouldAcceptSnapshot(
      { version: 4, serverNow: 2_000 },
      { version: 5, serverNow: 1_000 },
    )).toBe(true);
  });

  it('rejects a stale response that arrives after a command response', () => {
    expect(shouldAcceptSnapshot(
      { version: 5, serverNow: 2_000 },
      { version: 4, serverNow: 3_000 },
    )).toBe(false);
  });

  it('orders equal-version snapshots by server time', () => {
    const latest = { version: 5, serverNow: 2_000 };
    expect(shouldAcceptSnapshot(latest, { version: 5, serverNow: 2_001 })).toBe(true);
    expect(shouldAcceptSnapshot(latest, { version: 5, serverNow: 1_999 })).toBe(false);
  });
});
