<script lang="ts">
	import { buildMonthGrid, isoDate, shortDate } from '$lib/dates';
	import { goto } from '$app/navigation';
	import {
		queueEntries,
		discardQueued,
		replayQueue
	} from '$lib/stores/syncQueue';

	let { data } = $props();

	let viewMonth = $state(new Date());
	let grid = $derived(buildMonthGrid(viewMonth));

	const sessionsByDate = $derived(new Map(data.sessions.map((s) => [s.date, s])));
	const daysById = $derived(new Map(data.days.map((d) => [d.id, d])));

	const todaysSession = $derived(sessionsByDate.get(data.today));
	const todaysTemplate = $derived(
		todaysSession ? daysById.get(todaysSession.dayId) : null
	);

	function open(date: Date | null) {
		if (!date) return;
		goto(`/workout/${isoDate(date)}`);
	}

	function pickToday(dayId: number) {
		goto(`/workout/${data.today}?pick=${dayId}`);
	}

	function statusForDay(date: Date | null) {
		if (!date) return null;
		const sess = sessionsByDate.get(isoDate(date));
		if (!sess) return null;
		const tpl = daysById.get(sess.dayId);
		return {
			completed: !!sess.completedAt,
			started: !sess.completedAt,
			title: tpl?.title ?? '',
			short: tpl?.title?.replace(/[^A-Z+]/g, '').slice(0, 4) ?? ''
		};
	}

	function prevMonth() {
		viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
	}
	function nextMonth() {
		viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
	}
</script>

<h1>Fitness</h1>

{#if $queueEntries.length > 0}
	<div class="card queue">
		<div class="row between" style="margin-bottom: var(--gap-sm);">
			<h3 style="margin: 0;">{$queueEntries.length} unsynced set{$queueEntries.length > 1 ? 's' : ''}</h3>
			<button class="primary" onclick={() => replayQueue()}>Retry all</button>
		</div>
		<div class="dim small" style="margin-bottom: var(--gap-sm);">
			Sets that didn't make it to the server. Will retry automatically.
		</div>
		{#each $queueEntries as entry (entry.payload.clientId)}
			<div class="qrow">
				<div>
					<div>Set {entry.payload.setNumber} · weight {entry.payload.weight ?? '–'} · reps {entry.payload.reps ?? '–'}</div>
					<div class="dim small">
						{entry.attempts} attempt{entry.attempts === 1 ? '' : 's'}
						· {Math.round((Date.now() - entry.enqueuedAt) / 60000)}m ago
					</div>
				</div>
				<button class="danger mini" onclick={() => discardQueued(entry.payload.clientId)}>×</button>
			</div>
		{/each}
	</div>
{/if}

<div class="card today">
	<div class="dim small">Today · {shortDate(data.today)}</div>
	{#if todaysTemplate}
		<div class="row between" style="margin-top: 6px;">
			<h2 style="margin: 0;">{todaysTemplate.title}</h2>
			<a href={`/workout/${data.today}`} class="cta">
				{todaysSession?.completedAt ? '✓ Done' : 'Resume'}
			</a>
		</div>
	{:else}
		<h2 style="margin-top: 6px;">What today?</h2>
		<div class="picker">
			{#each data.days as d}
				<button class="pick" onclick={() => pickToday(d.id)}>
					<div class="pick-name">{d.title}</div>
					<div class="pick-sub dim">{d.dayName}</div>
				</button>
			{/each}
		</div>
		<div class="dim small" style="margin-top: var(--gap-sm); text-align: center;">
			Or just rest — nothing to log on rest days.
		</div>
	{/if}
</div>

<div class="card month">
	<div class="row between month-header">
		<button class="ghost arrow" onclick={prevMonth}>‹</button>
		<h2 style="margin:0">
			{viewMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
		</h2>
		<button class="ghost arrow" onclick={nextMonth}>›</button>
	</div>
	<div class="dow">
		{#each ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as d}
			<div>{d}</div>
		{/each}
	</div>
	{#each grid as week}
		<div class="week">
			{#each week as cell}
				{@const status = statusForDay(cell)}
				<button
					type="button"
					class="cell"
					class:empty={!cell}
					class:completed={status?.completed}
					class:started={status?.started}
					class:today={cell && isoDate(cell) === data.today}
					disabled={!cell}
					onclick={() => open(cell)}
					title={status?.title ?? ''}
				>
					{#if cell}
						<span class="num">{cell.getDate()}</span>
						{#if status}
							<span class="badge" class:done={status.completed} class:started={status.started}>
								{status.short || (status.completed ? '✓' : '·')}
							</span>
						{/if}
					{/if}
				</button>
			{/each}
		</div>
	{/each}
</div>

<div class="card">
	<div class="row between">
		<div>
			<h3 style="margin:0">Bodyweight</h3>
			{#if data.lastWeight}
				<div class="dim small">
					Last: {data.lastWeight.weightKg} kg on {shortDate(data.lastWeight.date)}
				</div>
			{:else}
				<div class="dim small">No entries yet</div>
			{/if}
		</div>
		<a href="/bodyweight" class="cta">Log</a>
	</div>
</div>

<style>
	.today {
		margin-bottom: var(--gap);
	}
	.small {
		font-size: 0.85rem;
	}
	.cta {
		background: var(--accent);
		color: #052e16;
		font-weight: 600;
		padding: 10px 18px;
		border-radius: var(--radius);
		display: inline-block;
	}
	.picker {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--gap-sm);
		margin-top: var(--gap-sm);
	}
	.pick {
		text-align: left;
		padding: 12px;
		min-height: 64px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		align-items: flex-start;
	}
	.pick-name {
		font-weight: 600;
		font-size: 0.95rem;
		line-height: 1.2;
	}
	.pick-sub {
		font-size: 0.75rem;
	}
	.month {
		margin: var(--gap) 0;
	}
	.month-header {
		margin-bottom: var(--gap);
	}
	.arrow {
		min-width: 44px;
		min-height: 44px;
		padding: 0;
	}
	.dow {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		text-align: center;
		color: var(--text-dim);
		font-size: 0.75rem;
		margin-bottom: 4px;
	}
	.week {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 4px;
		margin-bottom: 4px;
	}
	.cell {
		height: 56px;
		min-height: 0;
		border-radius: var(--radius-sm);
		background: var(--bg-elev);
		border: 1px solid transparent;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		padding: 4px;
		gap: 0;
		color: var(--text-dim);
		overflow: hidden;
	}
	.cell:not(:disabled) {
		cursor: pointer;
		color: var(--text);
	}
	.cell.completed {
		background: rgba(34, 197, 94, 0.18);
		border-color: var(--accent);
	}
	.cell.started {
		border-color: var(--warn);
	}
	.cell.today {
		outline: 2px solid var(--info);
		outline-offset: -2px;
	}
	.cell.empty {
		visibility: hidden;
	}
	.cell .num {
		font-size: 0.9rem;
		line-height: 1;
	}
	.cell .badge {
		font-size: 0.55rem;
		font-weight: 600;
		line-height: 1;
		padding: 2px 4px;
		border-radius: 3px;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cell .badge.done {
		background: var(--accent);
		color: #052e16;
	}
	.cell .badge.started {
		background: var(--warn);
		color: #1f1300;
	}
	.queue {
		border-color: var(--warn);
		margin-bottom: var(--gap);
	}
	.qrow {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--gap-sm);
		padding: 6px 0;
		border-top: 1px solid var(--border);
	}
	button.mini {
		min-height: 32px;
		padding: 4px 10px;
		font-size: 0.85rem;
	}
</style>
