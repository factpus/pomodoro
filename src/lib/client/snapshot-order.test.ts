import { describe, expect, it } from 'vitest';
import { isCredentialContextCurrent, mergeAuthenticatedSnapshot, shouldAcceptSnapshot, shouldRevokeHostToken, snapshotAcceptance } from './snapshot-order';

describe('shouldAcceptSnapshot', () => {
  it('accepts the first snapshot', () => {
    expect(shouldAcceptSnapshot(null, { generation: 10, revision: 1, version: 1, serverNow: 1_000 })).toBe(true);
  });

  it('accepts a newer version regardless of request completion order', () => {
    expect(shouldAcceptSnapshot(
      { generation: 10, revision: 1, version: 4, serverNow: 2_000 },
      { generation: 10, revision: 2, version: 5, serverNow: 1_000 },
    )).toBe(true);
  });

  it('rejects a stale response that arrives after a command response', () => {
    expect(shouldAcceptSnapshot(
      { generation: 10, revision: 2, version: 5, serverNow: 2_000 },
      { generation: 10, revision: 1, version: 4, serverNow: 3_000 },
    )).toBe(false);
  });

  it('orders equal-version snapshots by server time', () => {
    const latest = { generation: 10, revision: 1, version: 5, serverNow: 2_000 };
    expect(shouldAcceptSnapshot(latest, { generation: 10, revision: 1, version: 5, serverNow: 2_001 })).toBe(true);
    expect(shouldAcceptSnapshot(latest, { generation: 10, revision: 2, version: 5, serverNow: 1_999 })).toBe(false);
  });

  it('accepts a recreated room and rejects responses from the previous generation', () => {
    const previous = { generation: 10, revision: 20, version: 20, serverNow: 2_000 };
    expect(shouldAcceptSnapshot(previous, { generation: 11, revision: 1, version: 1, serverNow: 3_000 })).toBe(true);
    expect(shouldAcceptSnapshot(
      { generation: 11, revision: 1, version: 1, serverNow: 3_000 },
      { generation: 10, revision: 21, version: 21, serverNow: 3_001 },
    )).toBe(false);
  });
});

describe('snapshotAcceptance', () => {
  it('accepts authenticated metadata even when a newer public timer snapshot arrived first', () => {
    expect(snapshotAcceptance(
      { generation: 10, revision: 3, version: 5, serverNow: 2_000 },
      null,
      { generation: 10, revision: 2, version: 5, serverNow: 1_999 },
      true,
    )).toEqual({ timer: false, metadata: true });
  });

  it('does not accept metadata from an older authenticated response', () => {
    expect(snapshotAcceptance(
      { generation: 10, revision: 3, version: 5, serverNow: 2_000 },
      { generation: 10, revision: 3, version: 5, serverNow: 2_000 },
      { generation: 10, revision: 2, version: 5, serverNow: 1_999 },
      true,
    )).toEqual({ timer: false, metadata: false });
  });

  it('never treats a public snapshot as authenticated metadata', () => {
    expect(snapshotAcceptance(null, null, { generation: 10, revision: 1, version: 1, serverNow: 1_000 }, false))
      .toEqual({ timer: true, metadata: false });
  });

  it('rejects authenticated metadata from a previous room generation', () => {
    expect(snapshotAcceptance(
      { generation: 11, revision: 1, version: 1, serverNow: 3_000 },
      { generation: 10, revision: 20, version: 20, serverNow: 2_000 },
      { generation: 10, revision: 21, version: 21, serverNow: 3_001 },
      true,
    )).toEqual({ timer: false, metadata: false });
  });

  it('orders authenticated metadata by commit revision rather than request time', () => {
    expect(snapshotAcceptance(
      { generation: 10, revision: 3, version: 5, serverNow: 2_000 },
      { generation: 10, revision: 3, version: 5, serverNow: 2_000 },
      { generation: 10, revision: 2, version: 5, serverNow: 2_500 },
      true,
    )).toEqual({ timer: true, metadata: false });
  });
});

describe('mergeAuthenticatedSnapshot', () => {
  const current = { state: 'newer timer', role: 'participant', hostTransfer: 'incoming' };
  const incoming = { state: 'older timer', role: 'host', hostTransfer: 'complete' };

  it('preserves current timer state while applying newly accepted host metadata', () => {
    expect(mergeAuthenticatedSnapshot(current, incoming, { timer: false, metadata: true }))
      .toEqual({ state: 'newer timer', role: 'host', hostTransfer: 'complete' });
  });

  it('does not regress metadata when only timer state is accepted', () => {
    expect(mergeAuthenticatedSnapshot(current, incoming, { timer: true, metadata: false }))
      .toEqual({ state: 'older timer', role: 'participant', hostTransfer: 'incoming' });
  });
});

describe('shouldRevokeHostToken', () => {
  it('does not revoke a new token from a response requested with the old token', () => {
    expect(shouldRevokeHostToken('new-token', 'old-token', 'participant')).toBe(false);
  });

  it('revokes a rejected token when the response tested the current token', () => {
    expect(shouldRevokeHostToken('revoked-token', 'revoked-token', 'participant')).toBe(true);
  });

  it('does not infer credential validity from responses without request context', () => {
    expect(shouldRevokeHostToken('current-token', undefined, 'participant')).toBe(false);
  });
});

describe('isCredentialContextCurrent', () => {
  it('rejects role metadata produced with an obsolete token', () => {
    expect(isCredentialContextCurrent('new-token', 'old-token')).toBe(false);
    expect(isCredentialContextCurrent('new-token', null)).toBe(false);
  });

  it('accepts metadata produced with the current token', () => {
    expect(isCredentialContextCurrent('current-token', 'current-token')).toBe(true);
    expect(isCredentialContextCurrent(null, null)).toBe(true);
  });

  it('accepts server-authorized responses that do not use the current token', () => {
    expect(isCredentialContextCurrent('new-token', undefined)).toBe(true);
  });
});
