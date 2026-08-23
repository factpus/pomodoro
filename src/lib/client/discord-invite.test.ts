import { describe, expect, it } from 'vitest';
import { getInviteAvailability } from './discord-invite';

describe('Discord Activity invite availability', () => {
  it('waits for authentication', () => {
    expect(getInviteAvailability({ authenticated: false, guildId: 'guild', channelId: 'channel', canCreateInvite: true })).toBe('checking');
  });

  it('requires a guild voice-channel context', () => {
    expect(getInviteAvailability({ authenticated: true, guildId: null, channelId: 'channel' })).toBe('voice-channel-required');
    expect(getInviteAvailability({ authenticated: true, guildId: 'guild', channelId: null })).toBe('voice-channel-required');
  });

  it('reflects invite permission and an inconclusive permission check', () => {
    expect(getInviteAvailability({ authenticated: true, guildId: 'guild', channelId: 'channel', canCreateInvite: true })).toBe('ready');
    expect(getInviteAvailability({ authenticated: true, guildId: 'guild', channelId: 'channel', canCreateInvite: false })).toBe('permission-required');
    expect(getInviteAvailability({ authenticated: true, guildId: 'guild', channelId: 'channel' })).toBe('unknown');
  });
});
