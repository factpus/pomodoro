import { describe, expect, it, vi } from 'vitest';
import { prepareAudioOnce } from './audio';

describe('prepareAudioOnce', () => {
  it('loads each track only on the first user interaction', () => {
    const focus = { load: vi.fn() };
    const rest = { load: vi.fn() };

    const prepared = prepareAudioOnce(false, [focus, rest]);
    prepareAudioOnce(prepared, [focus, rest]);

    expect(focus.load).toHaveBeenCalledTimes(1);
    expect(rest.load).toHaveBeenCalledTimes(1);
  });
});
