<script lang="ts">
	import { untrack } from 'svelte';
	import { enqueueSet, newClientId, type SetPayload } from '$lib/stores/syncQueue';
	import { startRest } from '$lib/stores/timer';
	import { showToast } from '$lib/stores/toast';

	let {
		sessionId,
		exerciseTemplateId,
		exerciseName,
		setNumber,
		restSeconds,
		isAmrap,
		suggestedWeight,
		existingSet
	}: {
		sessionId: number;
		exerciseTemplateId: number;
		exerciseName: string;
		setNumber: number;
		restSeconds: number;
		isAmrap: boolean;
		suggestedWeight: number | null;
		existingSet: { weight: number | null; reps: number | null; feltEasy: boolean } | undefined;
	} = $props();

	let weight = $state<number | null>(
		untrack(() => existingSet?.weight ?? suggestedWeight ?? null)
	);
	let reps = $state<number | null>(untrack(() => existingSet?.reps ?? null));
	let feltEasy = $state(untrack(() => existingSet?.feltEasy ?? false));
	let logged = $state(untrack(() => !!existingSet));
	let saving = $state(false);

	async function logIt() {
		if (logged || saving) return;
		if (reps == null) {
			showToast('Enter reps', 'error');
			return;
		}
		saving = true;
		const payload: SetPayload = {
			sessionId,
			exerciseTemplateId,
			setNumber,
			weight: weight,
			reps: reps,
			feltEasy: feltEasy,
			clientId: newClientId()
		};
		await enqueueSet(payload);
		startRest(restSeconds, exerciseName);
		logged = true;
		saving = false;
	}

	function unlock() {
		logged = false;
	}
</script>

<div class="set" class:logged>
	<div class="setno">#{setNumber}</div>

	{#if !isAmrap}
		<div class="field">
			<label for={`w-${exerciseTemplateId}-${setNumber}`}>Weight</label>
			<input
				id={`w-${exerciseTemplateId}-${setNumber}`}
				type="number"
				inputmode="decimal"
				step="0.5"
				bind:value={weight}
				disabled={logged}
			/>
		</div>
	{/if}

	<div class="field">
		<label for={`r-${exerciseTemplateId}-${setNumber}`}>Reps</label>
		<input
			id={`r-${exerciseTemplateId}-${setNumber}`}
			type="number"
			inputmode="numeric"
			bind:value={reps}
			disabled={logged}
		/>
	</div>

	<label class="easy">
		<input type="checkbox" bind:checked={feltEasy} disabled={logged} />
		Easy
	</label>

	{#if logged}
		<button class="ghost" onclick={unlock}>Edit</button>
	{:else}
		<button class="primary" onclick={logIt} disabled={saving}>
			{saving ? '…' : 'Log'}
		</button>
	{/if}
</div>

<style>
	.set {
		display: grid;
		grid-template-columns: 28px 1fr 1fr auto auto;
		gap: var(--gap-sm);
		align-items: end;
		padding: var(--gap-sm) 0;
		border-top: 1px solid var(--border);
	}
	.set:first-child {
		border-top: none;
	}
	.set.logged {
		opacity: 0.7;
	}
	.setno {
		font-weight: 600;
		color: var(--text-dim);
		padding-bottom: 12px;
	}
	.field {
		min-width: 0;
	}
	.field input {
		padding: 8px;
	}
	label {
		margin-bottom: 2px;
		font-size: 0.7rem;
	}
	.easy {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		font-size: 0.75rem;
	}
	.easy input {
		width: 22px;
		height: 22px;
		min-height: 22px;
		padding: 0;
	}
	button {
		padding: 8px 12px;
		min-height: 44px;
	}
</style>
