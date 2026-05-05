<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/stores/toast';

	let { data } = $props();

	let fileInput: HTMLInputElement;
	let angle = $state<'front' | 'side' | 'back' | ''>('');
	let note = $state('');
	let uploading = $state(false);

	let mode = $state<'gallery' | 'compare'>('gallery');
	let leftId = $state<number | null>(null);
	let rightId = $state<number | null>(null);

	const grouped = $derived.by(() => {
		const map = new Map<string, typeof data.photos>();
		for (const p of data.photos) {
			const month = p.takenAt.slice(0, 7); // YYYY-MM
			const arr = map.get(month) ?? [];
			arr.push(p);
			map.set(month, arr);
		}
		return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
	});

	function trigger() {
		fileInput?.click();
	}

	function newClientId(): string {
		if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
		return 'pid-' + Date.now() + '-' + Math.random().toString(36).slice(2);
	}

	async function onFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploading = true;
		try {
			const fd = new FormData();
			fd.append('photo', file);
			fd.append('takenAt', new Date().toISOString());
			fd.append('clientId', newClientId());
			if (angle) fd.append('angle', angle);
			if (note) fd.append('note', note);
			const res = await fetch('/api/photos', { method: 'POST', body: fd });
			if (res.ok) {
				showToast('Photo added', 'success');
				note = '';
				input.value = '';
				await invalidateAll();
			} else {
				showToast('Upload failed', 'error');
			}
		} catch {
			showToast('Network error', 'error');
		} finally {
			uploading = false;
		}
	}

	async function deletePhoto(id: number) {
		if (!confirm('Delete this photo?')) return;
		const res = await fetch(`/api/photos?id=${id}`, { method: 'DELETE' });
		if (res.ok) {
			showToast('Deleted', 'success');
			await invalidateAll();
		}
	}

	function monthLabel(ym: string): string {
		const [y, m] = ym.split('-').map(Number);
		return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
			month: 'long',
			year: 'numeric'
		});
	}

	function setLeft(id: number) {
		leftId = id;
		if (mode === 'gallery') mode = 'compare';
	}
	function setRight(id: number) {
		rightId = id;
		if (mode === 'gallery') mode = 'compare';
	}

	const leftPhoto = $derived(data.photos.find((p) => p.id === leftId) ?? null);
	const rightPhoto = $derived(data.photos.find((p) => p.id === rightId) ?? null);
</script>

<a href="/" class="back">← Back</a>
<h1>Progress Photos</h1>

<div class="card">
	<div class="row" style="flex-wrap: wrap; gap: var(--gap-sm);">
		<select bind:value={angle} style="flex: 1; min-width: 120px;">
			<option value="">Angle (optional)</option>
			<option value="front">Front</option>
			<option value="side">Side</option>
			<option value="back">Back</option>
		</select>
		<input
			type="text"
			bind:value={note}
			placeholder="Note (optional)"
			style="flex: 2; min-width: 140px;"
		/>
	</div>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		capture="environment"
		onchange={onFileChange}
		style="display: none;"
	/>
	<button
		class="primary"
		style="width: 100%; margin-top: var(--gap);"
		onclick={trigger}
		disabled={uploading}
	>
		{uploading ? 'Uploading…' : '+ Add photo'}
	</button>
</div>

<div class="row" style="margin-top: var(--gap);">
	<button class="ghost" class:active={mode === 'gallery'} onclick={() => (mode = 'gallery')}>
		Gallery
	</button>
	<button
		class="ghost"
		class:active={mode === 'compare'}
		onclick={() => (mode = 'compare')}
		disabled={data.photos.length < 2}
	>
		Compare
	</button>
</div>

{#if data.photos.length === 0}
	<div class="card" style="margin-top: var(--gap);">
		<p class="dim">No photos yet — tap "Add photo" above.</p>
	</div>
{:else if mode === 'gallery'}
	<div class="col" style="margin-top: var(--gap);">
		{#each grouped as [month, photos]}
			<div>
				<h3 class="dim" style="margin-bottom: var(--gap-sm);">{monthLabel(month)}</h3>
				<div class="grid">
					{#each photos as p}
						<div class="thumb">
							<img src={`/api/photos/file/${p.filePath}`} alt={p.angle ?? ''} loading="lazy" />
							<div class="overlay">
								{#if p.angle}<span class="tag">{p.angle}</span>{/if}
								<button class="ghost mini" onclick={() => setLeft(p.id)}>← Compare</button>
								<button class="danger mini" onclick={() => deletePhoto(p.id)}>×</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{:else}
	<div class="card" style="margin-top: var(--gap);">
		<p class="dim">Pick two photos from the gallery to compare.</p>
		<div class="compare">
			<div>
				<select bind:value={leftId}>
					<option value={null}>— pick —</option>
					{#each data.photos as p}
						<option value={p.id}>
							{p.takenAt.slice(0, 10)} {p.angle ? `(${p.angle})` : ''}
						</option>
					{/each}
				</select>
				{#if leftPhoto}
					<img src={`/api/photos/file/${leftPhoto.filePath}`} alt="left" />
					<div class="dim small">{leftPhoto.takenAt.slice(0, 10)}</div>
				{/if}
			</div>
			<div>
				<select bind:value={rightId}>
					<option value={null}>— pick —</option>
					{#each data.photos as p}
						<option value={p.id}>
							{p.takenAt.slice(0, 10)} {p.angle ? `(${p.angle})` : ''}
						</option>
					{/each}
				</select>
				{#if rightPhoto}
					<img src={`/api/photos/file/${rightPhoto.filePath}`} alt="right" />
					<div class="dim small">{rightPhoto.takenAt.slice(0, 10)}</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.back {
		display: inline-block;
		padding: 8px 0;
		color: var(--text-dim);
		font-size: 0.9rem;
	}
	button.active {
		border-color: var(--accent);
		color: var(--accent);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: var(--gap-sm);
	}
	.thumb {
		position: relative;
		aspect-ratio: 3/4;
		background: var(--bg-elev);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.overlay {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
		padding: 6px;
		display: flex;
		gap: 4px;
		align-items: center;
	}
	button.mini {
		min-height: 28px;
		padding: 4px 6px;
		font-size: 0.7rem;
	}
	.compare {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--gap-sm);
		margin-top: var(--gap);
	}
	.compare img {
		width: 100%;
		border-radius: var(--radius-sm);
		margin-top: var(--gap-sm);
	}
	.small {
		font-size: 0.8rem;
		text-align: center;
	}
</style>
