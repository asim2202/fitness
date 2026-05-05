<script lang="ts">
	import { onMount } from 'svelte';

	let needRefresh = $state(false);
	let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

	onMount(async () => {
		// vite-plugin-pwa exposes a virtual module that returns a register fn.
		try {
			const mod = await import('virtual:pwa-register');
			updateSW = mod.registerSW({
				onNeedRefresh() {
					needRefresh = true;
				},
				onOfflineReady() {
					/* nothing — we already toast about online status */
				}
			});
		} catch {
			/* PWA disabled in dev or import failed; silently no-op */
		}
	});

	async function refresh() {
		if (updateSW) await updateSW(true);
	}
</script>

{#if needRefresh}
	<div class="banner">
		<span>A new version of Fitness is available.</span>
		<button class="primary" onclick={refresh}>Refresh</button>
		<button class="ghost" onclick={() => (needRefresh = false)}>Later</button>
	</div>
{/if}

<style>
	.banner {
		position: fixed;
		top: env(safe-area-inset-top);
		left: 8px;
		right: 8px;
		z-index: 60;
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--bg-elev-2);
		border: 1px solid var(--accent);
		border-radius: var(--radius);
		padding: 10px 12px;
		font-size: 0.9rem;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
	}
	.banner span {
		flex: 1;
	}
	button {
		min-height: 36px;
		padding: 6px 12px;
		font-size: 0.85rem;
	}
</style>
