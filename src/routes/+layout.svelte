<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { initSyncQueue, queueSize } from '$lib/stores/syncQueue';
	import { toasts } from '$lib/stores/toast';

	onMount(() => {
		initSyncQueue();
	});

	let { children } = $props();
</script>

<div class="app">
	{@render children()}
</div>

<div class="toast-container">
	{#each $toasts as t (t.id)}
		<div class="toast {t.variant}">{t.message}</div>
	{/each}
	{#if $queueSize > 0}
		<div class="toast">Syncing {$queueSize} queued…</div>
	{/if}
</div>

<nav class="bottom-nav">
	<a href="/" class:active={$page.url.pathname === '/'}>Home</a>
	<a href="/bodyweight" class:active={$page.url.pathname.startsWith('/bodyweight')}>Weight</a>
	<a href="/photos" class:active={$page.url.pathname.startsWith('/photos')}>Photos</a>
</nav>
