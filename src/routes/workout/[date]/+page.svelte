<script lang="ts">
	import { goto } from '$app/navigation';
	import RestTimer from '$lib/components/RestTimer.svelte';
	import SetRow from '$lib/components/SetRow.svelte';
	import { shortDate } from '$lib/dates';
	import { showToast } from '$lib/stores/toast';

	let { data } = $props();

	let mode = $state<'overview' | 'guided'>('overview');
	let activeIdx = $state(0);

	const sessionId = $derived(data.isWorkoutDay ? data.session.id : null);

	const setsByExercise = $derived.by(() => {
		const map = new Map<number, typeof data.sets>();
		if (!data.isWorkoutDay) return map;
		for (const s of data.sets) {
			const arr = map.get(s.exerciseTemplateId) ?? [];
			arr.push(s);
			map.set(s.exerciseTemplateId, arr);
		}
		return map;
	});

	const suggestionsByExercise = $derived.by(() => {
		const map = new Map<number, { weight: number | null; bumped: boolean; reason: string }>();
		if (!data.isWorkoutDay) return map;
		for (const s of data.suggestions) {
			map.set(s.exerciseTemplateId, s.suggestion);
		}
		return map;
	});

	function startGuided() {
		mode = 'guided';
		activeIdx = 0;
	}

	function next() {
		if (!data.isWorkoutDay) return;
		if (activeIdx < data.exercises.length - 1) {
			activeIdx += 1;
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} else {
			finishSession();
		}
	}

	function prev() {
		if (activeIdx > 0) activeIdx -= 1;
	}

	async function finishSession() {
		if (!sessionId) return;
		try {
			const res = await fetch('/api/sessions', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ sessionId, complete: true })
			});
			if (res.ok) {
				showToast('Workout complete', 'success');
				goto('/');
			}
		} catch {
			showToast('Could not save completion — will retry', 'error');
		}
	}
</script>

<a href="/" class="back">← Back</a>

{#if !data.isWorkoutDay}
	<h1>Rest day</h1>
	<p class="dim">{data.dayName}, {shortDate(data.date)}</p>
	<p>No workout scheduled for this day.</p>
{:else}
	<RestTimer />

	<h1>{data.day.title}</h1>
	<div class="dim">{data.dayName}, {shortDate(data.date)}</div>

	{#if mode === 'overview'}
		<div class="row" style="margin: var(--gap) 0;">
			<button class="primary" style="flex: 1" onclick={startGuided}>
				Start Workout
			</button>
		</div>

		<div class="col">
			{#each data.exercises as ex, i}
				{@const exSets = setsByExercise.get(ex.id) ?? []}
				{@const done = exSets.length >= ex.defaultSets}
				<button
					class="exrow card"
					onclick={() => {
						mode = 'guided';
						activeIdx = i;
					}}
				>
					<div class="row between">
						<div>
							<div class="exname">{i + 1}. {ex.name}</div>
							<div class="meta dim">
								{ex.defaultSets} × {ex.repLow == null ? 'AMRAP' : `${ex.repLow}–${ex.repHigh}`}
								&nbsp;·&nbsp; {ex.restSeconds}s rest
							</div>
						</div>
						<div class="status">
							{#if done}
								<span class="check">✓</span>
							{:else}
								<span class="count">{exSets.length}/{ex.defaultSets}</span>
							{/if}
						</div>
					</div>
				</button>
			{/each}
		</div>

		<div class="row" style="margin-top: var(--gap-lg);">
			<button class="ghost" style="flex: 1" onclick={finishSession}>
				Mark workout complete
			</button>
		</div>
	{:else}
		{@const ex = data.exercises[activeIdx]}
		{@const exSets = setsByExercise.get(ex.id) ?? []}
		{@const suggestion = suggestionsByExercise.get(ex.id)}
		{@const isAmrap = ex.repLow == null}

		<div class="progress dim">Exercise {activeIdx + 1} of {data.exercises.length}</div>

		<div class="card exhead">
			<h2>{ex.name}</h2>
			<div class="meta">
				<span class="tag">{ex.defaultSets} sets</span>
				<span class="tag">
					{isAmrap ? 'AMRAP' : `${ex.repLow}–${ex.repHigh} reps`}
				</span>
				<span class="tag">{ex.restSeconds}s rest</span>
			</div>
			{#if ex.notesMd}
				<div class="cue">{ex.notesMd}</div>
			{/if}
			{#if suggestion?.bumped}
				<div class="suggest">
					🎯 Suggested: <b>{suggestion.weight}</b> · {suggestion.reason}
				</div>
			{:else if suggestion?.weight != null}
				<div class="suggest dim">
					Last time: {suggestion.weight}
				</div>
			{/if}
		</div>

		<div class="card sets">
			{#each Array(ex.defaultSets) as _, i}
				{@const setNumber = i + 1}
				{@const existing = exSets.find((s) => s.setNumber === setNumber)}
				<SetRow
					sessionId={data.session.id}
					exerciseTemplateId={ex.id}
					exerciseName={ex.name}
					{setNumber}
					restSeconds={ex.restSeconds}
					{isAmrap}
					suggestedWeight={suggestion?.weight ?? null}
					existingSet={existing}
				/>
			{/each}
		</div>

		<div class="row" style="margin-top: var(--gap);">
			<button class="ghost" onclick={prev} disabled={activeIdx === 0}>‹ Prev</button>
			<a href={`/exercise/${ex.id}`} class="ghost-link">History</a>
			<button class="primary" style="flex: 1" onclick={next}>
				{activeIdx === data.exercises.length - 1 ? 'Finish workout' : 'Next exercise →'}
			</button>
		</div>
	{/if}
{/if}

<style>
	.back {
		display: inline-block;
		padding: 8px 0;
		color: var(--text-dim);
		font-size: 0.9rem;
	}
	.exrow {
		text-align: left;
		cursor: pointer;
		padding: var(--gap);
		width: 100%;
	}
	.exname {
		font-weight: 600;
	}
	.meta {
		font-size: 0.85rem;
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-top: 4px;
	}
	.status .check {
		color: var(--accent);
		font-size: 1.5rem;
	}
	.status .count {
		color: var(--text-dim);
	}
	.progress {
		font-size: 0.85rem;
		margin: var(--gap) 0 4px;
	}
	.exhead h2 {
		margin-bottom: var(--gap-sm);
	}
	.cue {
		margin-top: var(--gap);
		padding: 10px 12px;
		background: rgba(245, 158, 11, 0.12);
		border-left: 3px solid var(--warn);
		border-radius: var(--radius-sm);
		font-size: 0.9rem;
		line-height: 1.4;
	}
	.suggest {
		margin-top: var(--gap-sm);
		font-size: 0.9rem;
	}
	.sets {
		margin-top: var(--gap);
	}
	.ghost-link {
		display: inline-flex;
		align-items: center;
		padding: 12px 16px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
		min-height: 44px;
	}
</style>
