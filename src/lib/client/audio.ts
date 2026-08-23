interface LoadableMedia {
  load: () => void;
}

export function prepareAudioOnce(prepared: boolean, media: Array<LoadableMedia | null>) {
  if (prepared) return true;
  for (const item of media) item?.load();
  return true;
}
