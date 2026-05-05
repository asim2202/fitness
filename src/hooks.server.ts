import { runMigrations } from '$lib/server/db';
import { seedIfEmpty } from '$lib/server/seed';

let bootstrapped = false;

function bootstrap(): void {
  if (bootstrapped) return;
  runMigrations();
  seedIfEmpty();
  bootstrapped = true;
}

bootstrap();

export async function handle({
  event,
  resolve
}: {
  event: import('@sveltejs/kit').RequestEvent;
  resolve: (event: import('@sveltejs/kit').RequestEvent) => Promise<Response>;
}): Promise<Response> {
  return resolve(event);
}
