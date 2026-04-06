<script lang="ts">
	import { browser } from '$app/environment';
	import { exportFavourites, importFavourites } from '$lib/stores/favourites';

	let { open = $bindable(false) } = $props();
	let importText = $state('');
	let importError = $state('');
	let importSuccess = $state(false);
	let exportText = $state('');

	// Reset state when opening
	$effect(() => {
		if (open) {
			importText = '';
			importError = '';
			importSuccess = false;
			exportText = '';
		}
	});

	function handleExport() {
		exportText = exportFavourites();
	}

	function handleCopyExport() {
		if (!browser) return;
		navigator.clipboard.writeText(exportText);
	}

	function handleDownload() {
		if (!browser || !exportText) return;
		const blob = new Blob([exportText], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'tisx-favourites.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleImport() {
		importError = '';
		importSuccess = false;
		const result = importFavourites(importText);
		if (result.success) {
			importSuccess = true;
			importText = '';
		} else {
			importError = result.error ?? 'Import failed';
		}
	}

	function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			importText = reader.result as string;
		};
		reader.readAsText(file);
		input.value = '';
	}

	function close() {
		open = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') close();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
		onclick={close}
		onkeydown={handleKeydown}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="mx-4 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
				<h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">Settings</h2>
				<button
					type="button"
					class="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
					onclick={close}
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="space-y-6 p-5">
				<!-- Export section -->
				<div>
					<h3 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
						Export favourites
					</h3>
					<p class="mb-3 text-xs text-slate-500 dark:text-slate-400">
						Export your saved vehicles and documents as a JSON file.
					</p>
					{#if exportText}
						<textarea
							class="mb-2 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
							rows="6"
							readonly
							value={exportText}
						></textarea>
						<div class="flex gap-2">
							<button
								type="button"
								class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
								onclick={handleCopyExport}
							>
								Copy to clipboard
							</button>
							<button
								type="button"
								class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
								onclick={handleDownload}
							>
								Download .json
							</button>
						</div>
					{:else}
						<button
							type="button"
							class="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
							onclick={handleExport}
						>
							Generate export
						</button>
					{/if}
				</div>

				<!-- Divider -->
				<div class="h-px bg-slate-200 dark:bg-slate-700"></div>

				<!-- Import section -->
				<div>
					<h3 class="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
						Import favourites
					</h3>
					<p class="mb-3 text-xs text-slate-500 dark:text-slate-400">
						Paste JSON or upload a file to replace your current favourites.
					</p>

					<div class="mb-2 flex gap-2">
						<label
							class="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
						>
							Choose file...
							<input type="file" accept=".json" class="hidden" onchange={handleFileUpload} />
						</label>
					</div>

					<textarea
						class="mb-2 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs text-slate-700 placeholder:font-sans placeholder:text-slate-400 focus:border-sky-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:placeholder:text-slate-500"
						rows="6"
						placeholder="Paste JSON here..."
						bind:value={importText}
					></textarea>

					{#if importError}
						<p class="mb-2 text-xs text-rose-500 dark:text-rose-400">{importError}</p>
					{/if}
					{#if importSuccess}
						<p class="mb-2 text-xs text-emerald-600 dark:text-emerald-400">
							Favourites imported successfully.
						</p>
					{/if}

					<button
						type="button"
						class="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
						disabled={!importText.trim()}
						onclick={handleImport}
					>
						Import
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
