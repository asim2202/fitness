import { listPhotos } from '$lib/server/queries';

export async function load() {
  return { photos: listPhotos() };
}
