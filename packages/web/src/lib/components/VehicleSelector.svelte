<script lang="ts">
	import { browser } from '$app/environment';
	import {
		vehicle,
		hasVehicle,
		vehicleSummary,
		setVehicle,
		clearVehicle,
	} from '$lib/stores/vehicle';
	import { addFavouriteVehicle } from '$lib/stores/favourites';

	type Option = { id: string | number; name: string };
	type VinResult = {
		seriesId: number;
		seriesName: string | null;
		modelId: number;
		modelName: string | null;
		engineId: number;
		engineName: string | null;
		bodyId: number;
		bodyName: string | null;
		gearboxId: number;
		gearboxName: string | null;
		driveId: number;
		driveName: string | null;
		productionDate: number | null;
	};

	let open = $state(false);

	// --- Manual selection state ---
	let seriesOptions = $state<Option[]>([]);
	let modelOptions = $state<Option[]>([]);
	let engineOptions = $state<Option[]>([]);

	let selectedSeries = $state('');
	let selectedModel = $state('');
	let selectedEngine = $state('');

	let loadingSeries = $state(false);
	let loadingModels = $state(false);
	let loadingEngines = $state(false);
	let manualError = $state('');

	// --- VIN state ---
	let vinInput = $state('');
	let vinLoading = $state(false);
	let vinError = $state('');
	let vinResult = $state<VinResult | null>(null);

	// --- Helpers ---
	const asOptions = (data: unknown): Option[] => {
		if (Array.isArray(data)) return data as Option[];
		return [];
	};

	async function fetchJson<T>(path: string): Promise<T> {
		const res = await fetch(path);
		if (!res.ok) {
			const payload = await res.json().catch(() => ({}));
			throw new Error((payload as { error?: string })?.error ?? `Request failed (${res.status})`);
		}
		return res.json() as Promise<T>;
	}

	type VariantsResult = {
		bodyIds: string;
		gearboxIds: string;
		driveIds: string;
		bodyNames: string[];
		gearboxNames: string[];
		driveNames: string[];
		modelYear: string;
	};

	/** Fetch body/gearbox/drive variant IDs and names for the selected vehicle */
	const fetchVariants = async (seriesId: string, modelId: string, engineId: string): Promise<VariantsResult> => {
		try {
			const params = new URLSearchParams({ series: seriesId, model: modelId, engine: engineId });
			const data = await fetchJson<{
				bodyIds: number[]; gearboxIds: number[]; driveIds: number[];
				bodyNames: string[]; gearboxNames: string[]; driveNames: string[];
				modelYear: string | null;
			}>(`/api/vehicle-variants?${params}`);
			return {
				bodyIds: data.bodyIds.join(','),
				gearboxIds: data.gearboxIds.join(','),
				driveIds: (data.driveIds ?? []).join(','),
				bodyNames: data.bodyNames ?? [],
				gearboxNames: data.gearboxNames ?? [],
				driveNames: data.driveNames ?? [],
				modelYear: data.modelYear ?? '',
			};
		} catch {
			return { bodyIds: '', gearboxIds: '', driveIds: '', bodyNames: [], gearboxNames: [], driveNames: [], modelYear: '' };
		}
	};

	// --- Series / Model / Engine cascade ---
	const loadSeries = async () => {
		loadingSeries = true;
		manualError = '';
		try {
			seriesOptions = asOptions(await fetchJson('/api/series'));
		} catch (e) {
			manualError = (e as Error).message;
		} finally {
			loadingSeries = false;
		}
	};

	const loadModels = async (seriesId: string) => {
		loadingModels = true;
		manualError = '';
		try {
			modelOptions = asOptions(await fetchJson(`/api/series/${seriesId}/models`));
		} catch (e) {
			manualError = (e as Error).message;
		} finally {
			loadingModels = false;
		}
	};

	const loadEngines = async (modelId: string) => {
		loadingEngines = true;
		manualError = '';
		try {
			engineOptions = asOptions(await fetchJson(`/api/models/${modelId}/engines`));
		} catch (e) {
			manualError = (e as Error).message;
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

	const applyManualSelection = async () => {
		if (!selectedSeries || !selectedModel || !selectedEngine) return;
		const sName = seriesOptions.find((o) => String(o.id) === selectedSeries)?.name ?? '';
		const mName = modelOptions.find((o) => String(o.id) === selectedModel)?.name ?? '';
		const eName = engineOptions.find((o) => String(o.id) === selectedEngine)?.name ?? '';
		const variants = await fetchVariants(selectedSeries, selectedModel, selectedEngine);
		setVehicle({
			seriesId: selectedSeries,
			seriesName: sName,
			modelId: selectedModel,
			modelName: mName,
			engineId: selectedEngine,
			engineName: eName,
			...variants,
			productionDate: '',
		});
		open = false;
	};

	// --- VIN lookup ---
	const handleVinLookup = async () => {
		const vin = vinInput.trim().replace(/[\s-]/g, '');
		if (vin.length !== 17) {
			vinError = 'VIN must be exactly 17 characters';
			return;
		}
		vinLoading = true;
		vinError = '';
		vinResult = null;
		try {
			vinResult = await fetchJson<VinResult>(`/api/vin/${encodeURIComponent(vin)}`);
		} catch (e) {
			vinError = (e as Error).message;
		} finally {
			vinLoading = false;
		}
	};

	const applyVinResult = async () => {
		if (!vinResult) return;
		const variants = await fetchVariants(
			String(vinResult.seriesId),
			String(vinResult.modelId),
			String(vinResult.engineId),
		);
		// VIN resolves to a single exact body/gearbox/drive, but we keep
		// the full set of IDs from fetchVariants for document filtering.
		// Use VIN-specific names for display when available.
		const prodDate = vinResult.productionDate ? String(vinResult.productionDate) : '';
		setVehicle({
			seriesId: String(vinResult.seriesId),
			seriesName: vinResult.seriesName ?? '',
			modelId: String(vinResult.modelId),
			modelName: vinResult.modelName ?? '',
			engineId: String(vinResult.engineId),
			engineName: vinResult.engineName ?? '',
			bodyIds: variants.bodyIds,
			gearboxIds: variants.gearboxIds,
			driveIds: variants.driveIds,
			bodyNames: vinResult.bodyName ? [vinResult.bodyName] : variants.bodyNames,
			gearboxNames: vinResult.gearboxName ? [vinResult.gearboxName] : variants.gearboxNames,
			driveNames: vinResult.driveName ? [vinResult.driveName] : variants.driveNames,
			modelYear: variants.modelYear,
			productionDate: prodDate,
		});
		open = false;
	};

	const handleVinKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Enter') handleVinLookup();
	};

	const handleClear = () => {
		clearVehicle();
		vinResult = null;
		vinInput = '';
		vinError = '';
		selectedSeries = '';
		selectedModel = '';
		selectedEngine = '';
		modelOptions = [];
		engineOptions = [];
	};

	// --- Save to favourites ---
	let saveFavLabel = $state('');
	let showSaveFav = $state(false);

	const handleSaveFavourite = () => {
		addFavouriteVehicle($vehicle, saveFavLabel.trim());
		saveFavLabel = '';
		showSaveFav = false;
	};

	const toggleOpen = () => {
		open = !open;
		// Load series list on first open
		if (open && seriesOptions.length === 0) {
			loadSeries();
		}
	};

	// Close popup when clicking outside
	let popupRef: HTMLDivElement | undefined = $state();

	function handleWindowClick(event: MouseEvent) {
		if (open && popupRef && !popupRef.contains(event.target as Node)) {
			open = false;
		}
	}

	$effect(() => {
		if (browser) {
			if (open) {
				// Delay to avoid catching the click that opened it
				const timer = setTimeout(() => {
					window.addEventListener('click', handleWindowClick, true);
				}, 0);
				return () => {
					clearTimeout(timer);
					window.removeEventListener('click', handleWindowClick, true);
				};
			}
		}
	});
</script>

<div class="relative" bind:this={popupRef}>
	<!-- Collapsed: trigger button -->
	<button
		type="button"
		class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition
			{$hasVehicle
			? 'border border-sky-400/50 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20'
			: 'border border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200'}"
		onclick={toggleOpen}
	>
		{#if $hasVehicle}
			<!-- Car icon -->
			<svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
				<path stroke-linecap="round" stroke-linejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m10 0H3m10 0h2m4 0a1 1 0 001-1v-4a1 1 0 00-.76-.97l-2-0.5A1 1 0 0016.5 9H14" />
			</svg>
			<span class="max-w-[200px] truncate font-medium">{$vehicleSummary}</span>
		{:else}
			<svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			<span>Select vehicle</span>
		{/if}
		<svg class="h-3 w-3 shrink-0 transition {open ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
			<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	<!-- Expanded: dropdown popup -->
	{#if open}
		<div
			class="absolute right-0 top-full z-50 mt-2 w-[420px] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
		>
			<!-- VIN lookup -->
			<div class="mb-5">
				<h3 class="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
					VIN lookup
				</h3>
				<div class="flex gap-2">
					<input
						type="text"
						maxlength="17"
						placeholder="e.g. WBAPH5C55BA12345"
						class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm tracking-wider text-slate-900 uppercase placeholder:normal-case placeholder:tracking-normal focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
						bind:value={vinInput}
						onkeydown={handleVinKeydown}
						disabled={vinLoading}
					/>
					<button
						type="button"
						class="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
						disabled={vinInput.replace(/[\s-]/g, '').length !== 17 || vinLoading}
						onclick={handleVinLookup}
					>
						{vinLoading ? '...' : 'Look up'}
					</button>
				</div>
				{#if vinError}
					<p class="mt-1.5 text-xs text-rose-500 dark:text-rose-400">{vinError}</p>
				{/if}
				{#if vinResult}
					<div class="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
						<div class="mb-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-700 dark:text-slate-200">
							<span><span class="text-slate-500 dark:text-slate-400">Series:</span> {vinResult.seriesName ?? vinResult.seriesId}</span>
							<span><span class="text-slate-500 dark:text-slate-400">Model:</span> {vinResult.modelName ?? vinResult.modelId}</span>
							<span><span class="text-slate-500 dark:text-slate-400">Engine:</span> {vinResult.engineName ?? vinResult.engineId}</span>
							<span><span class="text-slate-500 dark:text-slate-400">Body:</span> {vinResult.bodyName ?? vinResult.bodyId}</span>
							<span><span class="text-slate-500 dark:text-slate-400">Gearbox:</span> {vinResult.gearboxName ?? vinResult.gearboxId}</span>
							<span><span class="text-slate-500 dark:text-slate-400">Drive:</span> {vinResult.driveName ?? vinResult.driveId}</span>
							{#if vinResult.productionDate}
								<span><span class="text-slate-500 dark:text-slate-400">Produced:</span> {String(vinResult.productionDate).slice(0, 4)}/{String(vinResult.productionDate).slice(4)}</span>
							{/if}
						</div>
						<button
							type="button"
							class="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
							onclick={applyVinResult}
						>
							Use this vehicle
						</button>
					</div>
				{/if}
			</div>

			<!-- Divider -->
			<div class="mb-5 flex items-center gap-3">
				<div class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
				<span class="text-[10px] font-medium tracking-widest text-slate-400 uppercase dark:text-slate-500">or select manually</span>
				<div class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
			</div>

			<!-- Manual selection -->
			<div class="space-y-3">
				<div class="space-y-1">
					<label class="text-xs font-medium text-slate-600 dark:text-slate-300" for="vs-series">Series</label>
					<select
						id="vs-series"
						class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
						onchange={handleSeriesChange}
						disabled={loadingSeries}
						value={selectedSeries}
					>
						<option value="">{loadingSeries ? 'Loading...' : 'Choose series'}</option>
						{#each seriesOptions as opt, i (String(opt.id) + '-' + i)}
							<option value={String(opt.id)}>{opt.name}</option>
						{/each}
					</select>
				</div>

				<div class="space-y-1">
					<label class="text-xs font-medium text-slate-600 dark:text-slate-300" for="vs-model">Model</label>
					<select
						id="vs-model"
						class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
						onchange={handleModelChange}
						disabled={!selectedSeries || loadingModels}
						value={selectedModel}
					>
						<option value="">
							{selectedSeries ? (loadingModels ? 'Loading...' : 'Choose model') : 'Select series first'}
						</option>
						{#each modelOptions as opt, i (String(opt.id) + '-' + i)}
							<option value={String(opt.id)}>{opt.name}</option>
						{/each}
					</select>
				</div>

				<div class="space-y-1">
					<label class="text-xs font-medium text-slate-600 dark:text-slate-300" for="vs-engine">Engine</label>
					<select
						id="vs-engine"
						class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
						onchange={handleEngineChange}
						disabled={!selectedModel || loadingEngines}
						value={selectedEngine}
					>
						<option value="">
							{selectedModel ? (loadingEngines ? 'Loading...' : 'Choose engine') : 'Select model first'}
						</option>
						{#each engineOptions as opt, i (String(opt.id) + '-' + i)}
							<option value={String(opt.id)}>{opt.name}</option>
						{/each}
					</select>
				</div>

				{#if manualError}
					<p class="text-xs text-rose-500 dark:text-rose-400">{manualError}</p>
				{/if}

				<button
					type="button"
					class="w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
					disabled={!selectedSeries || !selectedModel || !selectedEngine}
					onclick={applyManualSelection}
				>
					Apply
				</button>
			</div>

			<!-- Clear vehicle button (shown when a vehicle is selected) -->
			{#if $hasVehicle}
				<div class="mt-4 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
					{#if showSaveFav}
						<div class="flex items-center gap-2">
							<input
								type="text"
								class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
								placeholder="Label (optional)"
								bind:value={saveFavLabel}
								onkeydown={(e) => e.key === 'Enter' && handleSaveFavourite()}
							/>
							<button
								type="button"
								class="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-400"
								onclick={handleSaveFavourite}
							>
								Save
							</button>
							<button
								type="button"
								class="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
								onclick={() => { showSaveFav = false; saveFavLabel = ''; }}
							>
								Cancel
							</button>
						</div>
					{:else}
						<button
							type="button"
							class="flex w-full items-center justify-center gap-2 rounded-lg border border-sky-400/50 px-4 py-2 text-sm text-sky-600 transition hover:bg-sky-50 dark:border-sky-500/30 dark:text-sky-400 dark:hover:bg-sky-500/10"
							onclick={() => (showSaveFav = true)}
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
							</svg>
							Save to favourites
						</button>
					{/if}
					<button
						type="button"
						class="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
						onclick={handleClear}
					>
						Clear vehicle selection
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
