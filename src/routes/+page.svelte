<script lang="ts">
	import {
		buildMonthGrid,
		dayNameOf,
		isoDate,
		shortDate,
		WORKOUT_DAYS,
		type DayName
	} from '$lib/dates';
	import { goto } from '$app/navigation';

	let { data } = $props();

	let viewMonth = $state(new Date());
	let grid = $derived(buildMonthGrid(viewMonth));

	const sessionsByDate = $derived(new Map(data.sessions.map((s) => [s.date, s])));
	const daysByName = $derived(new Map(data.days.map((d) => [d.dayName, d])));

	const todayName = dayNameOf(new Date()) as DayName;
	const todayDay = $derived(daysByName.get(todayName));
	const todaysSession = $derived(sessionsByDate.get(data.today));

	function statusForDay(date: Date | null): {
		isWorkout: boolean;
		title: string | null;
		completed: boolean;
		started: boolean;
	} {
		if (!date) return { isWorkout: false, title: null, completed: false, started: false };
		const name = dayNameOf(date) as DayName;
		const day = daysByName.get(name);
		const sess = sessionsByDate.get(isoDate(date));
		return {
			isWorkout: WORKOUT_DAYS.includes(name) && day != null,
			title: day?.title ?? null,
			completed: !!sess?.completedAt,
			started: !!sess && !sess.completedAt
		};
	}

	function open(date: Date | null) {
		if (!date) return;
		const name = dayNameOf(date) as DayName;
		if (!WORKOUT_DAYS.includes(name)) return;
		goto(`/workout/${isoDate(date)}`);
	}

	function prevMonth() {
		viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
	}
	function nextMonth() {
		viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
	}
</script>

<h1>Fitness</h1>

{#if todayDay}
	<div class="today card">
		<div class="row between">
			<div>
				<div class="dim">Today · {shortDate(data.today)}</div>
				<h2>{todayDay.title}</h2>
			</div>
			<a href={`/workout/${data.today}`} class="cta">
				{todaysSession?.completedAt ? '✓ Done' : todaysSession ? 'Resume' : 'Start'}
			</a>
		</div>
	</div>
{:else}
	<div class="today card rest">
		<div class="dim">Today · {shortDate(data.today)}</div>
		<h2>Rest day</h2>
		<p class="dim">Nothing scheduled. Try a 30-min walk.</p>
	</div>
{/if}

<div class="card month">
	<div class="row between month-header">
		<button class="ghost" onclick={prevMonth}>‹</button>
		<h2 style="margin:0">{viewMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</h2>
		<button class="ghost" onclick={nextMonth}>›</button>
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
					class:workout={status.isWorkout}
					class:completed={status.completed}
					class:started={status.started}
					class:today={cell && isoDate(cell) === data.today}
					disabled={!cell || !status.isWorkout}
					onclick={() => open(cell)}
					title={status.title ?? ''}
				>
					{#if cell}
						<span class="num">{cell.getDate()}</span>
						{#if status.completed}<span class="dot done">✓</span>{/if}
						{#if status.started && !status.completed}<span class="dot started">·</span>{/if}
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
				<div class="dim">
					Last: {data.lastWeight.weightKg} kg on {shortDate(data.lastWeight.date)}
				</div>
			{:else}
				<div class="dim">No entries yet</div>
			{/if}
		</div>
		<a href="/bodyweight" class="cta">Log</a>
	</div>
</div>

<style>
	.today {
		margin-bottom: var(--gap);
	}
	.today.rest h2 {
		color: var(--text-dim);
	}
	.cta {
		background: var(--accent);
		color: #052e16;
		font-weight: 600;
		padding: 10px 18px;
		border-radius: var(--radius);
		display: inline-block;
	}
	.month {
		margin: var(--gap) 0;
	}
	.month-header {
		margin-bottom: var(--gap);
	}
	.month-header button {
		min-width: 44px;
		padding: 8px;
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
	}
	.cell {
		aspect-ratio: 1;
		border-radius: var(--radius-sm);
		background: transparent;
		border: 1px solid transparent;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4px;
		min-height: 44px;
		gap: 2px;
		color: var(--text-dim);
	}
	.cell.workout {
		background: var(--bg-elev-2);
		color: var(--text);
		border-color: var(--border);
	}
	.cell.workout:not(:disabled) {
		cursor: pointer;
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
		font-size: 0.95rem;
	}
	.cell .dot {
		font-size: 0.7rem;
		line-height: 1;
	}
	.cell .dot.done {
		color: var(--accent);
	}
	.cell .dot.started {
		color: var(--warn);
	}
</style>
