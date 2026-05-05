<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Chart,
		LineController,
		LineElement,
		PointElement,
		LinearScale,
		CategoryScale,
		Tooltip,
		Filler
	} from 'chart.js';

	Chart.register(
		LineController,
		LineElement,
		PointElement,
		LinearScale,
		CategoryScale,
		Tooltip,
		Filler
	);

	let {
		labels,
		values,
		label = 'Value',
		color = '#22c55e'
	}: {
		labels: string[];
		values: Array<number | null>;
		label?: string;
		color?: string;
	} = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	function rgba(hex: string, a: number) {
		const m = hex.match(/^#([0-9a-f]{6})$/i);
		if (!m) return hex;
		const n = parseInt(m[1], 16);
		return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
	}

	function build() {
		if (!canvas) return;
		chart?.destroy();
		chart = new Chart(canvas, {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label,
						data: values,
						borderColor: color,
						backgroundColor: rgba(color, 0.15),
						fill: true,
						tension: 0.25,
						pointRadius: 3,
						spanGaps: true
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: { tooltip: { mode: 'index', intersect: false } },
				scales: {
					x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
					y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } }
				}
			}
		});
	}

	onMount(build);
	$effect(() => {
		labels;
		values;
		build();
	});
	onDestroy(() => chart?.destroy());
</script>

<div class="wrap">
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.wrap {
		position: relative;
		height: 200px;
	}
</style>
