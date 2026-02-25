<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	type Option = { id: string | number; name: string };

	let seriesOptions: Option[] = [];
	let modelOptions: Option[] = [];
	let engineOptions: Option[] = [];

	let selectedSeries = '';
	let selectedModel = '';
	let selectedEngine = '';

	let loadingSeries = false;
	let loadingModels = false;
	let loadingEngines = false;
	let errorMessage = '';

	const asOptions = (data: unknown): Option[] => {
		if (Array.isArray(data)) return data as Option[];
		return [];
	};

	const loadSeries = async () => {
		loadingSeries = true;
		errorMessage = '';
		try {
			const res = await fetch('/api/series');
			if (!res.ok) throw new Error('Failed to load series');
			seriesOptions = asOptions(await res.json());
		} catch (error) {
			errorMessage = (error as Error).message;
		} finally {
			loadingSeries = false;
		}
	};

	const loadModels = async (seriesId: string) => {
		loadingModels = true;
		errorMessage = '';
		try {
			const res = await fetch(`/api/series/${seriesId}/models`);
			if (!res.ok) throw new Error('Failed to load models');
			modelOptions = asOptions(await res.json());
		} catch (error) {
			errorMessage = (error as Error).message;
		} finally {
			loadingModels = false;
		}
	};

	const loadEngines = async (modelId: string) => {
		loadingEngines = true;
		errorMessage = '';
		try {
			const res = await fetch(`/api/models/${modelId}/engines`);
			if (!res.ok) throw new Error('Failed to load engines');
			engineOptions = asOptions(await res.json());
		} catch (error) {
			errorMessage = (error as Error).message;
		} finally {
			loadingEngines = false;
		}
	};

	const handleSeriesChange = async (event: Event) => {
		selectedSeries = (event.target as HTMLSelectElement).value;
		selectedModel = '';
		selectedEngine = '';
		modelOptions = [];
		engineOptions = [];
		if (selectedSeries) {
			await loadModels(selectedSeries);
		}
	};

	const handleModelChange = async (event: Event) => {
		selectedModel = (event.target as HTMLSelectElement).value;
		selectedEngine = '';
		engineOptions = [];
		if (selectedModel) {
			await loadEngines(selectedModel);
		}
	};

	const handleEngineChange = (event: Event) => {
		selectedEngine = (event.target as HTMLSelectElement).value;
	};

	const handleBrowse = () => {
		if (!selectedSeries || !selectedModel || !selectedEngine) return;
		const params = new URLSearchParams({
			series: selectedSeries,
			model: selectedModel,
			engine: selectedEngine
		});
		goto(`/browse?${params.toString()}`);
	};

	onMount(loadSeries);
</script>

<section class="space-y-10">
	<div class="space-y-3">
		<p class="text-sm uppercase tracking-[0.3em] text-slate-400">Find your fitment</p>
		<h1 class="text-4xl font-semibold">Select a vehicle</h1>
		<p class="max-w-2xl text-slate-300">
			Pick a series, model, and engine to browse the correct TIS resources.
		</p>
	</div>

	<div
		class="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-slate-950/60 p-6 shadow-xl"
	>
		<div class="grid gap-6 md:grid-cols-3">
			<div class="space-y-2">
				<label class="text-sm font-medium text-slate-200" for="series">Series</label>
				<div class="relative">
					<select
						id="series"
						class="w-full appearance-none rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
						on:change={handleSeriesChange}
						disabled={loadingSeries}
					>
						<option value="">{loadingSeries ? 'Loading series…' : 'Choose series'}</option>
						{#each seriesOptions as option}
							<option value={option.id}>{option.name}</option>
						{/each}
					</select>
					<span class="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">▾</span>
				</div>
			</div>

			<div class="space-y-2">
				<label class="text-sm font-medium text-slate-200" for="model">Model</label>
				<div class="relative">
					<select
						id="model"
						class="w-full appearance-none rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
						on:change={handleModelChange}
						disabled={!selectedSeries || loadingModels}
					>
						<option value="">
							{selectedSeries
								? loadingModels
									? 'Loading models…'
									: 'Choose model'
								: 'Select series first'}
						</option>
						{#each modelOptions as option}
							<option value={option.id}>{option.name}</option>
						{/each}
					</select>
					<span class="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">▾</span>
				</div>
			</div>

			<div class="space-y-2">
				<label class="text-sm font-medium text-slate-200" for="engine">Engine</label>
				<div class="relative">
					<select
						id="engine"
						class="w-full appearance-none rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
						on:change={handleEngineChange}
						disabled={!selectedModel || loadingEngines}
					>
						<option value="">
							{selectedModel
								? loadingEngines
									? 'Loading engines…'
									: 'Choose engine'
								: 'Select model first'}
						</option>
						{#each engineOptions as option}
							<option value={option.id}>{option.name}</option>
						{/each}
					</select>
					<span class="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">▾</span>
				</div>
			</div>
		</div>

		<div class="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="text-sm text-slate-400">
				{#if errorMessage}
					<span class="text-rose-400">{errorMessage}</span>
				{:else}
					<span>Complete all fields to unlock browsing.</span>
				{/if}
			</div>
			<button
				class="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
				disabled={!selectedSeries || !selectedModel || !selectedEngine}
				on:click={handleBrowse}
			>
				Browse
			</button>
		</div>
	</div>
</section>
