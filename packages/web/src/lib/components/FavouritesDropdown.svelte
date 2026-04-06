<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import { vehicle, setVehicle } from '$lib/stores/vehicle';
	import {
		favouriteVehicles,
		favouriteDocuments,
		favouriteCount,
		removeFavouriteVehicle,
		removeFavouriteDocument,
		renameFavouriteVehicle,
		renameFavouriteDocument,
	} from '$lib/stores/favourites';
	import type { FavouriteVehicle, FavouriteDocument } from '$lib/stores/favourites';
	import type { VehicleContext } from '$lib/stores/vehicle';

	let open = $state(false);
	let activeTab = $state<'vehicles' | 'documents'>('vehicles');

	/** ID of item currently being renamed (null = none) */
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');

	let popupRef: HTMLDivElement | undefined = $state();

	function toggleOpen() {
		open = !open;
	}

	// ── Vehicle actions ────────────────────────────────────────────────────

	function applyVehicle(v: VehicleContext) {
		setVehicle(v);
		open = false;
	}

	function deleteVehicle(id: string, event: MouseEvent) {
		event.stopPropagation();
		removeFavouriteVehicle(id);
	}

	// ── Document actions ───────────────────────────────────────────────────

	function openDocument(fav: FavouriteDocument) {
		// If the favourite has vehicle context and it differs from current, apply it
		if (fav.vehicle && fav.vehicle.seriesId) {
			const v = $vehicle;
			if (
				v.seriesId !== fav.vehicle.seriesId ||
				v.modelId !== fav.vehicle.modelId ||
				v.engineId !== fav.vehicle.engineId
			) {
				setVehicle(fav.vehicle);
			}
		}
		open = false;
		goto(resolve(`/doc/${fav.docId}` as `/${string}`));
	}

	function deleteDocument(id: string, event: MouseEvent) {
		event.stopPropagation();
		removeFavouriteDocument(id);
	}

	// ── Rename ─────────────────────────────────────────────────────────────

	function startRename(id: string, currentLabel: string, event: MouseEvent) {
		event.stopPropagation();
		renamingId = id;
		renameValue = currentLabel;
	}

	function commitRename() {
		if (!renamingId) return;
		const trimmed = renameValue.trim();
		if (activeTab === 'vehicles') {
			renameFavouriteVehicle(renamingId, trimmed);
		} else {
			renameFavouriteDocument(renamingId, trimmed);
		}
		renamingId = null;
		renameValue = '';
	}

	function cancelRename() {
		renamingId = null;
		renameValue = '';
	}

	function handleRenameKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') commitRename();
		if (event.key === 'Escape') cancelRename();
	}

	// ── Helpers ────────────────────────────────────────────────────────────

	function vehicleLabel(fav: FavouriteVehicle): string {
		const parts = [
			fav.vehicle.seriesName || fav.vehicle.seriesId,
			fav.vehicle.modelName || fav.vehicle.modelId,
			fav.vehicle.engineName || fav.vehicle.engineId,
		].filter(Boolean);
		return parts.join(' / ');
	}

	/** Build a detail line with body, gearbox, drive, year info */
	function vehicleDetails(fav: FavouriteVehicle): string {
		const parts: string[] = [];
		const v = fav.vehicle;
		if (v.bodyNames?.length) parts.push(v.bodyNames.join(', '));
		if (v.gearboxNames?.length) parts.push(v.gearboxNames.join(', '));
		if (v.driveNames?.length) parts.push(v.driveNames.join(', '));
		if (v.modelYear) parts.push(v.modelYear);
		if (v.productionDate) {
			const y = v.productionDate.slice(0, 4);
			const m = v.productionDate.slice(4);
			parts.push(`prod. ${m}/${y}`);
		}
		return parts.join(' · ');
	}

	// ── Click outside ──────────────────────────────────────────────────────

	function handleWindowClick(event: MouseEvent) {
		if (open && popupRef && !popupRef.contains(event.target as Node)) {
			open = false;
			renamingId = null;
		}
	}

	$effect(() => {
		if (browser) {
			if (open) {
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
	<!-- Trigger button: star icon with badge -->
	<button
		type="button"
		class="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
		title="Favourites"
		onclick={toggleOpen}
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
			/>
		</svg>
		{#if $favouriteCount > 0}
			<span
				class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white"
			>
				{$favouriteCount}
			</span>
		{/if}
	</button>

	{#if open}
		<div
			class="absolute right-0 top-full z-50 mt-2 w-[380px] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
		>
			<!-- Tabs -->
			<div class="flex border-b border-slate-200 dark:border-slate-700">
				<button
					type="button"
					class="flex-1 px-4 py-2.5 text-sm font-medium transition
						{activeTab === 'vehicles'
						? 'border-b-2 border-sky-500 text-sky-600 dark:text-sky-400'
						: 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}"
					onclick={() => (activeTab = 'vehicles')}
				>
					Vehicles
					{#if $favouriteVehicles.length > 0}
						<span class="ml-1 text-xs opacity-60">({$favouriteVehicles.length})</span>
					{/if}
				</button>
				<button
					type="button"
					class="flex-1 px-4 py-2.5 text-sm font-medium transition
						{activeTab === 'documents'
						? 'border-b-2 border-sky-500 text-sky-600 dark:text-sky-400'
						: 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}"
					onclick={() => (activeTab = 'documents')}
				>
					Documents
					{#if $favouriteDocuments.length > 0}
						<span class="ml-1 text-xs opacity-60">({$favouriteDocuments.length})</span>
					{/if}
				</button>
			</div>

			<!-- Content -->
			<div class="max-h-80 overflow-y-auto p-3">
				{#if activeTab === 'vehicles'}
					{#if $favouriteVehicles.length === 0}
						<p class="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
							No favourite vehicles yet.
						</p>
					{:else}
						<ul class="grid gap-1.5">
							{#each $favouriteVehicles as fav (fav.id)}
								<li>
									{#if renamingId === fav.id}
										<!-- Rename input -->
										<div class="flex items-center gap-2 rounded-lg border border-sky-400 bg-sky-50 p-2 dark:border-sky-500/40 dark:bg-sky-500/10">
											<input
												type="text"
												class="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
												bind:value={renameValue}
												onkeydown={handleRenameKeydown}
												placeholder={vehicleLabel(fav)}
											/>
											<button
												type="button"
												class="rounded bg-sky-500 px-2 py-1 text-xs font-medium text-white hover:bg-sky-400"
												onclick={commitRename}
											>
												Save
											</button>
											<button
												type="button"
												class="rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
												onclick={cancelRename}
											>
												Cancel
											</button>
										</div>
									{:else}
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div
											class="group flex w-full cursor-pointer items-start gap-2 rounded-lg p-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
											onclick={() => applyVehicle(fav.vehicle)}
										>
											<!-- Car icon -->
											<svg
												class="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												stroke-width="2"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
												/>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m10 0H3m10 0h2m4 0a1 1 0 001-1v-4a1 1 0 00-.76-.97l-2-0.5A1 1 0 0016.5 9H14"
												/>
											</svg>
											<div class="min-w-0 flex-1">
												{#if fav.label}
													<p class="text-sm font-medium text-slate-800 dark:text-slate-100">
														{fav.label}
													</p>
												{/if}
												<p class="text-xs text-slate-500 dark:text-slate-400">
													{vehicleLabel(fav)}
												</p>
												{#if vehicleDetails(fav)}
													<p class="text-xs text-slate-400 dark:text-slate-500">
														{vehicleDetails(fav)}
													</p>
												{/if}
											</div>
											<!-- Action buttons (visible on hover) -->
											<div class="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
												<button
													type="button"
													class="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
													title="Rename"
													onclick={(e) => startRename(fav.id, fav.label, e)}
												>
													<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
														<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
													</svg>
												</button>
												<button
													type="button"
													class="rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-400"
													title="Remove"
													onclick={(e) => deleteVehicle(fav.id, e)}
												>
													<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
														<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
													</svg>
												</button>
											</div>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				{:else}
					{#if $favouriteDocuments.length === 0}
						<p class="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
							No favourite documents yet.
						</p>
					{:else}
						<ul class="grid gap-1.5">
							{#each $favouriteDocuments as fav (fav.id)}
								<li>
									{#if renamingId === fav.id}
										<div class="flex items-center gap-2 rounded-lg border border-sky-400 bg-sky-50 p-2 dark:border-sky-500/40 dark:bg-sky-500/10">
											<input
												type="text"
												class="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
												bind:value={renameValue}
												onkeydown={handleRenameKeydown}
												placeholder={fav.title}
											/>
											<button
												type="button"
												class="rounded bg-sky-500 px-2 py-1 text-xs font-medium text-white hover:bg-sky-400"
												onclick={commitRename}
											>
												Save
											</button>
											<button
												type="button"
												class="rounded px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
												onclick={cancelRename}
											>
												Cancel
											</button>
										</div>
									{:else}
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div
											class="group flex w-full cursor-pointer items-start gap-2 rounded-lg p-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
											onclick={() => openDocument(fav)}
										>
											<!-- Document icon -->
											<svg
												class="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												stroke-width="2"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
												/>
											</svg>
											<div class="min-w-0 flex-1">
												<p class="text-sm font-medium text-slate-800 dark:text-slate-100">
													{fav.label || fav.title}
												</p>
												{#if fav.label}
													<p class="text-xs text-slate-400 dark:text-slate-500">
														{fav.title}
													</p>
												{/if}
												{#if fav.vehicle}
													<p class="text-xs text-sky-500/70 dark:text-sky-400/50">
														{[fav.vehicle.seriesName, fav.vehicle.modelName, fav.vehicle.engineName]
															.filter(Boolean)
															.join(' / ')}
													</p>
												{/if}
											</div>
											<div class="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
												<button
													type="button"
													class="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
													title="Rename"
													onclick={(e) => startRename(fav.id, fav.label, e)}
												>
													<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
														<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
													</svg>
												</button>
												<button
													type="button"
													class="rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-400"
													title="Remove"
													onclick={(e) => deleteDocument(fav.id, e)}
												>
													<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
														<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
													</svg>
												</button>
											</div>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
</div>
