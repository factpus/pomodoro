export type InviteAvailability = 'checking' | 'ready' | 'voice-channel-required' | 'permission-required' | 'unknown';

interface InviteContext {
  authenticated: boolean;
  guildId: string | null;
  channelId: string | null;
  canCreateInvite?: boolean;
}

export function getInviteAvailability({ authenticated, guildId, channelId, canCreateInvite }: InviteContext): InviteAvailability {
  if (!authenticated) return 'checking';
  if (!guildId || !channelId) return 'voice-channel-required';
  if (canCreateInvite === undefined) return 'unknown';
  return canCreateInvite ? 'ready' : 'permission-required';
}
