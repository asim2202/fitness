<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import RestTimer from '$lib/components/RestTimer.svelte';
	import SetRow from '$lib/components/SetRow.svelte';
	import { shortDate } from '$lib/dates';
	import { showToast } from '$lib/stores/toast';

	let { data } = $props();

	let mode = $state<'overview' | 'guided'>('overview');
	let activeIdx = $state(0);

	const setsByExercise = $derived.by(() => {
		const map = new Map<number, NonNullable<typeof data.sets>>();
		if (data.mode !== 'session') return map;
		for (const s of data.sets) {
			const arr = map.get(s.exerciseTemplateId) ?? [];
			arr.push(s);
			map.set(s.exerciseTemplateId, arr);
		}
		return map;
	});

	const suggestionsByExercise = $derived.by(() => {
		const map = new Map<
			number,
			{
				bumped: boolean;
				bumpAmount: number;
				reason: string;
				perSet: { setNumber: number; weight: number | null; reps: number | null }[];
			}
		>();
		if (data.mode !== 'session') return map;
		for (const s of data.suggestions) map.set(s.exerciseTemplateId, s.suggestion);
		return map;
	});

	function pick(dayId: number) {
		goto(`/workout/${data.date}?pick=${dayId}`, { replaceState: true });
	}

	function next() {
		if (data.mode !== 'session') return;
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
		if (data.mode !== 'session') return;
		try {
			const res = await fetch('/api/sessions', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ sessionId: data.session.id, complete: true })
			});
			if (res.ok) {
				showToast('Workout complete', 'success');
				goto('/');
			}
		} catch {
			showToast('Could not save completion — will retry', 'error');
		}
	}

	async function abandonSession() {
		if (data.mode !== 'session') return;
		if (!confirm('Discard this workout session and pick a different one?')) return;
		const res = await fetch(`/api/sessions?id=${data.session.id}`, { method: 'DELETE' });
		if (res.ok) {
			showToast('Session removed', 'info');
			await invalidateAll();
			mode = 'overview';
			activeIdx = 0;
		} else {
			showToast('Could not remove session', 'error');
		}
	}
</script>

<a href="/" class="back">← Back</a>

{#if data.mode === 'picker'}
	<h1>Pick a workout</h1>
	<div class="dim">{data.dayName}, {shortDate(data.date)}</div>

	<div class="picker">
		{#each data.templates as tpl}
			<button class="pick card" onclick={() => pick(tpl.id)}>
				<div class="pick-title">{tpl.title}</div>
				<div class="dim small">Default day: {tpl.dayName}</div>
			</button>
		{/each}
	</div>
{:else}
	<RestTimer />

	<h1>{data.day.title}</h1>
	<div class="dim">{data.dayName}, {shortDate(data.date)}</div>

	{#if mode === 'overview'}
		<div class="row" style="margin: var(--gap) 0; gap: var(--gap-sm);">
			<button
				class="primary"
				style="flex: 1;"
				onclick={() => {
					mode = 'guided';
					activeIdx = 0;
				}}
			>
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

		<div class="col" style="margin-top: var(--gap-lg);">
			<button class="ghost" onclick={finishSession}>Mark workout complete</button>
			<button class="ghost danger-ghost" onclick={abandonSession}>
				Discard &amp; pick different workout
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
				<div class="suggest">🎯 {suggestion.reason}</div>
			{:else if suggestion?.perSet?.length}
				<div class="suggest dim">
					Last time:
					{suggestion.perSet
						.map((s) => `${s.weight ?? '–'}×${s.reps ?? '–'}`)
						.join(' · ')}
				</div>
			{/if}
		</div>

		<div class="card sets">
			{#each Array(ex.defaultSets) as _, i (`${ex.id}-${i + 1}`)}
				{@const setNumber = i + 1}
				{@const existing = exSets.find((s) => s.setNumber === setNumber)}
				{@const perSet = suggestion?.perSet?.find((s) => s.setNumber === setNumber)}
				<SetRow
					sessionId={data.session.id}
					exerciseTemplateId={ex.id}
					exerciseName={ex.name}
					{setNumber}
					restSeconds={ex.restSeconds}
					{isAmrap}
					suggestedWeight={perSet?.weight ?? null}
					suggestedReps={perSet?.reps ?? null}
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
	.small {
		font-size: 0.8rem;
	}
	.picker {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--gap-sm);
		margin-top: var(--gap);
	}
	.pick {
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-height: 84px;
		cursor: pointer;
	}
	.pick-title {
		font-weight: 600;
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
	.danger-ghost {
		color: var(--danger);
		border-color: var(--danger);
	}
</style>
