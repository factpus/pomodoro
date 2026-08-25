const activityQueryParameters = ['frame_id', 'instance_id', 'platform'] as const;

export function isDiscordActivityLaunch(search: string) {
  const params = new URLSearchParams(search);
  return activityQueryParameters.every((name) => Boolean(params.get(name)));
}
