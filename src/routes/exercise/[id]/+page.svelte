<script lang="ts">
	import LineChart from '$lib/components/LineChart.svelte';
	import { shortDate } from '$lib/dates';

	let { data } = $props();

	const ordered = $derived([...data.history].sort((a, b) => a.date.localeCompare(b.date)));
	const labels = $derived(ordered.map((s) => shortDate(s.date)));
	const topSetWeights = $derived(
		ordered.map((s) => {
			const w = s.sets.map((x) => x.weight ?? 0);
			return w.length ? Math.max(...w) : null;
		})
	);
</script>

<a href="/" class="back">← Back</a>
<h1>{data.exercise.name}</h1>
<div class="dim">
	{data.exercise.defaultSets} × {data.exercise.repLow == null
		? 'AMRAP'
		: `${data.exercise.repLow}–${data.exercise.repHigh}`}
	&nbsp;·&nbsp; {data.exercise.restSeconds}s rest
</div>

{#if data.history.length === 0}
	<div class="card" style="margin-top: var(--gap);">
		<p class="dim">No sessions logged yet.</p>
	</div>
{:else}
	<div class="card" style="margin-top: var(--gap);">
		<h3>Top set over time</h3>
		<LineChart {labels} values={topSetWeights} label="Top set" />
	</div>

	<div class="col" style="margin-top: var(--gap);">
		{#each data.history as s}
			<div class="card">
				<div class="row between">
					<h3 style="margin:0">{shortDate(s.date)}</h3>
					<span class="dim">{s.sets.length} sets</span>
				</div>
				<table>
					<thead>
						<tr>
							<th>#</th>
							<th>Weight</th>
							<th>Reps</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each s.sets as set}
							<tr>
								<td>{set.setNumber}</td>
								<td>{set.weight ?? '—'}</td>
								<td>{set.reps ?? '—'}</td>
								<td>{set.feltEasy ? '✓ easy' : ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/each}
	</div>
{/if}

<style>
	.back {
		display: inline-block;
		padding: 8px 0;
		color: var(--text-dim);
		font-size: 0.9rem;
	}
	table {
		width: 100%;
		margin-top: var(--gap-sm);
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
