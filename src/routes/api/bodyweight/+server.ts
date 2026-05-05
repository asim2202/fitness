import { json, error } from '@sveltejs/kit';
import { listBodyweightInRange, upsertBodyweight } from '$lib/server/queries';

export async function GET({ url }) {
  const start =
    url.searchParams.get('start') ??
    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const end = url.searchParams.get('end') ?? new Date().toISOString().slice(0, 10);
  return json(listBodyweightInRange(start, end));
}

export async function POST({ request }) {
  const body = await request.json();
  const date = String(body.date ?? '');
  const weightKg = Number(body.weightKg);
  if (!date || !Number.isFinite(weightKg)) error(400, 'date and weightKg required');
  const created = upsertBodyweight({
    date,
    weightKg,
    waistCm: body.waistCm == null ? null : Number(body.waistCm),
    note: String(body.note ?? '')
  });
  return json(created);
}
