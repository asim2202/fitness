<script lang="ts">
	import { remainingMs, isRunning, timerState, skipRest } from '$lib/stores/timer';

	let secs = $derived(Math.ceil($remainingMs / 1000));
	let pct = $derived(
		$timerState.durationMs > 0
			? Math.max(0, Math.min(100, ($remainingMs / $timerState.durationMs) * 100))
			: 0
	);
</script>

{#if $isRunning}
	<div class="timer">
		<div class="bar" style="width: {pct}%"></div>
		<div class="row between content">
			<div>
				<div class="label">Rest</div>
				<div class="ex dim">{$timerState.exerciseName ?? ''}</div>
			</div>
			<div class="time">{secs}s</div>
			<button class="ghost skip" onclick={skipRest}>Skip</button>
		</div>
	</div>
{/if}

<style>
	.timer {
		position: sticky;
		top: 0;
		z-index: 30;
		background: var(--bg-elev-2);
		border: 1px solid var(--accent);
		border-radius: var(--radius);
		overflow: hidden;
		margin-bottom: var(--gap);
	}
	.bar {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		background: rgba(34, 197, 94, 0.15);
		transition: width 0.25s linear;
	}
	.content {
		position: relative;
		padding: 10px 14px;
	}
	.label {
		font-weight: 600;
	}
	.ex {
		font-size: 0.85rem;
	}
	.time {
		font-size: 2rem;
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		color: var(--accent);
	}
	.skip {
		min-height: 40px;
	}
</style>
