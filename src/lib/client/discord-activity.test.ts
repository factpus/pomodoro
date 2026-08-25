import { describe, expect, it } from 'vitest';
import { isDiscordActivityLaunch } from './discord-activity';

describe('isDiscordActivityLaunch', () => {
  it('accepts a complete Discord Activity query', () => {
    expect(isDiscordActivityLaunch('?frame_id=frame&instance_id=instance&platform=desktop')).toBe(true);
  });

  it('rejects a query with a missing parameter', () => {
    expect(isDiscordActivityLaunch('?frame_id=frame&instance_id=instance')).toBe(false);
  });

  it('rejects empty required values', () => {
    expect(isDiscordActivityLaunch('?frame_id=&instance_id=instance&platform=desktop')).toBe(false);
  });
});
