<script lang="ts">
	import { untrack } from 'svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import { invalidateAll } from '$app/navigation';
	import { shortDate } from '$lib/dates';
	import { showToast } from '$lib/stores/toast';

	let { data } = $props();

	let date = $state(untrack(() => data.today));
	let weight = $state<number | null>(untrack(() => data.entries.at(-1)?.weightKg ?? null));
	let waist = $state<number | null>(untrack(() => data.entries.at(-1)?.waistCm ?? null));
	let note = $state('');
	let saving = $state(false);

	const labels = $derived(data.entries.map((e) => shortDate(e.date)));
	const weights = $derived(data.entries.map((e) => e.weightKg));
	const waists = $derived(data.entries.map((e) => e.waistCm));
	const hasWaist = $derived(waists.some((w) => w != null));

	async function save() {
		if (weight == null) {
			showToast('Enter a weight', 'error');
			return;
		}
		saving = true;
		try {
			const res = await fetch('/api/bodyweight', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ date, weightKg: weight, waistCm: waist, note })
			});
			if (res.ok) {
				showToast('Saved', 'success');
				note = '';
				await invalidateAll();
			} else {
				showToast('Save failed', 'error');
			}
		} catch {
			showToast('Network error', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<a href="/" class="back">← Back</a>
<h1>Bodyweight</h1>

<div class="card">
	<h3>Log entry</h3>
	<div class="grid">
		<div>
			<label for="d">Date</label>
			<input id="d" type="date" bind:value={date} max={data.today} />
		</div>
		<div>
			<label for="w">Weight (kg)</label>
			<input id="w" type="number" inputmode="decimal" step="0.1" bind:value={weight} />
		</div>
		<div>
			<label for="wc">Waist (cm) — optional</label>
			<input id="wc" type="number" inputmode="decimal" step="0.5" bind:value={waist} />
		</div>
	</div>
	<div style="margin-top: var(--gap);">
		<label for="n">Note</label>
		<input id="n" type="text" bind:value={note} placeholder="e.g. fasted" />
	</div>
	<button
		class="primary"
		style="width: 100%; margin-top: var(--gap);"
		onclick={save}
		disabled={saving}
	>
		{saving ? 'Saving…' : 'Save'}
	</button>
</div>

{#if data.entries.length === 0}
	<div class="card" style="margin-top: var(--gap);">
		<p class="dim">No entries yet — log one above.</p>
	</div>
{:else}
	<div class="card" style="margin-top: var(--gap);">
		<h3>Weight (last 90 days)</h3>
		<LineChart {labels} values={weights} label="kg" />
	</div>

	{#if hasWaist}
		<div class="card" style="margin-top: var(--gap);">
			<h3>Waist (last 90 days)</h3>
			<LineChart {labels} values={waists} label="cm" color="#3b82f6" />
		</div>
	{/if}

	<div class="card" style="margin-top: var(--gap);">
		<h3>Recent entries</h3>
		<table>
			<thead>
				<tr>
					<th>Date</th>
					<th>Weight</th>
					<th>Waist</th>
					<th>Note</th>
				</tr>
			</thead>
			<tbody>
				{#each [...data.entries].reverse().slice(0, 14) as e}
					<tr>
						<td>{shortDate(e.date)}</td>
						<td>{e.weightKg} kg</td>
						<td>{e.waistCm == null ? '—' : `${e.waistCm} cm`}</td>
						<td class="dim">{e.note}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.back {
		display: inline-block;
		padding: 8px 0;
		color: var(--text-dim);
		font-size: 0.9rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: var(--gap-sm);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	th,
	td {
		padding: 6px 4px;
		text-align: left;
		border-bottom: 1px solid var(--border);
		font-size: 0.9rem;
	}
	th {
		color: var(--text-dim);
		font-weight: normal;
	}
</style>
