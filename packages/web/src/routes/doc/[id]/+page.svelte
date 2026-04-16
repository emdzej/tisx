<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import type { PageProps } from './$types';
	import { vehicle, buildVehicleQuery } from '$lib/stores/vehicle';
	import { addFavouriteDocument, removeFavouriteDocument, favouriteDocuments } from '$lib/stores/favourites';
	import ImageViewer from '$lib/components/ImageViewer.svelte';
	import { imageMagnify } from '$lib/actions/imageMagnify';

	type DocumentDetail = {
		id: number;
		code: string | null;
		docTypeId: number;
		title: string;
		publicationDate: number | null;
		security: number | null;
	};

	type DocumentFile = {
		filename: string;
		deviceType: string | null;
		deviceCode: string | null;
		textPath?: string;
		textUrl?: string;
	};

	type DocumentResponse = {
		document: DocumentDetail;
		files: DocumentFile[];
	};

	type RelatedDocument = {
		id: number;
		code: string | null;
		docTypeId: number;
		title: string;
		publicationDate: number | null;
		docTypeCode: string;
		docTypeName: string;
	};

	type HotspotTarget = {
		id: number;
		code: string | null;
		docTypeId: number;
		title: string;
	};

	/** Map from hotspot number → array of target documents */
	type HotspotsMap = Record<number, HotspotTarget[]>;

	const { params } = $props<PageProps>();
	const id = $derived(params.id);

	let loading = $state(true);
	let error = $state('');
	let document = $state<DocumentDetail | null>(null);
	let file = $state<DocumentFile | null>(null);
	let textUrl = $state<string | null>(null);
	let textError = $state(false);
	let textLoading = $state(false);
	let textContent = $state('');
	let renderedHtml = $state('');
	let initialized = $state(false);

	let relatedDocs = $state<RelatedDocument[]>([]);
	let relatedLoading = $state(false);

	/** Hotspot cross-reference targets keyed by hotspot number */
	let hotspots = $state<HotspotsMap>({});

	/** When a hotspot has multiple targets, show a disambiguation popup */
	let disambiguationTargets = $state<HotspotTarget[]>([]);
	let disambiguationVisible = $state(false);

	/** Image lightbox — set to image src to open, null to close */
	let lightboxSrc = $state<string | null>(null);

	const formatPublicationDate = (value: number | null) => {
		if (!value) return 'Unknown date';
		const raw = String(value);
		if (raw.length === 8) {
			return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
		}
		if (raw.length === 6) {
			return `${raw.slice(0, 4)}-${raw.slice(4, 6)}`;
		}
		return raw;
	};

	/**
	 * Build the URL for fetching document HTML, appending vehicle context params
	 * so the server can substitute placeholders like --TYP--, --FGSTNR--, etc.
	 */
	const buildContentUrl = (baseUrl: string): string => {
		const url = new URL(baseUrl, window.location.origin);
		url.searchParams.set('format', 'html');

		const v = $vehicle;
		if (v.seriesId) url.searchParams.set('series', v.seriesId);
		if (v.modelId) url.searchParams.set('model', v.modelId);
		if (v.engineId) url.searchParams.set('engine', v.engineId);

		return url.pathname + url.search;
	};

	/**
	 * Build URL with vehicle params for the related-docs endpoint.
	 */
	const buildRelatedUrl = (docId: string): string => {
		const vq = buildVehicleQuery($vehicle);
		return `/api/document/${docId}/related${vq}`;
	};

	async function loadTextContent(url: string) {
		textError = false;
		textLoading = true;
		textContent = '';
		renderedHtml = '';
		try {
			const contentUrl = buildContentUrl(url);
			const response = await fetch(contentUrl);
			if (!response.ok) throw new Error('Text not found');
			const payload = (await response.json()) as { content?: string };
			textContent = payload.content ?? '';
			renderedHtml = textContent;
		} catch {
			textError = true;
		} finally {
			textLoading = false;
		}
	}

	async function loadRelatedDocs() {
		relatedLoading = true;
		try {
			const response = await fetch(buildRelatedUrl(id));
			if (!response.ok) {
				relatedDocs = [];
				return;
			}
			relatedDocs = (await response.json()) as RelatedDocument[];
		} catch {
			relatedDocs = [];
		} finally {
			relatedLoading = false;
		}
	}

	async function loadHotspots() {
		try {
			const vq = buildVehicleQuery($vehicle);
			const response = await fetch(`/api/document/${id}/hotspots${vq}`);
			if (!response.ok) {
				hotspots = {};
				return;
			}
			hotspots = (await response.json()) as HotspotsMap;
		} catch {
			hotspots = {};
		}
	}

	async function loadDocument() {
		loading = true;
		error = '';
		textError = false;
		textLoading = false;
		hotspots = {};
		disambiguationVisible = false;
		try {
			const response = await fetch(`/api/document/${id}`);
			if (!response.ok) {
				const message = await response.text();
				throw new Error(message || 'Failed to load document');
			}
			const payload = (await response.json()) as DocumentResponse;
			document = payload.document;
			file = payload.files?.[0] ?? null;

			textUrl = file?.textUrl ?? null;

			if (textUrl) {
				await loadTextContent(textUrl);
			}

			// Load related docs and hotspots in parallel
			loadRelatedDocs();
			loadHotspots();
		} catch (err) {
			error = (err as Error).message;
			document = null;
			file = null;
			textUrl = null;
		} finally {
			loading = false;
		}
	}

	function handleBack() {
		if (typeof history !== 'undefined' && history.length > 1) {
			history.back();
			return;
		}
		goto(resolve('/browse'));
	}

	function handlePrint() {
		window.print();
	}

	function openRelated(doc: RelatedDocument | HotspotTarget) {
		goto(resolve(`/doc/${doc.id}` as `/${string}`));
	}

	/**
	 * Navigate to a document via its hotspot number.
	 * If the hotspot has a single target, navigate directly.
	 * If multiple targets, show a disambiguation popup.
	 * If no targets found in the hotspots map, silently ignore.
	 */
	function navigateByHotspot(hotspotNr: number) {
		const targets = hotspots[hotspotNr];
		if (!targets || targets.length === 0) return;

		if (targets.length === 1) {
			goto(resolve(`/doc/${targets[0].id}` as `/${string}`));
		} else {
			// Multiple targets — show disambiguation
			disambiguationTargets = targets;
			disambiguationVisible = true;
		}
	}

	function closeDisambiguation() {
		disambiguationVisible = false;
		disambiguationTargets = [];
	}

	/**
	 * Intercept clicks on cross-reference links inside the rendered HTML.
	 * Links with class "tis-cross-ref" and a data-hotspot attribute are resolved
	 * via the hotspots map and navigated client-side.
	 */
	function handleArticleClick(event: MouseEvent) {
		const target = (event.target as HTMLElement).closest('a.tis-cross-ref');
		if (!target) return;
		event.preventDefault();
		const hotspotNr = target.getAttribute('data-hotspot');
		if (hotspotNr) {
			navigateByHotspot(Number(hotspotNr));
		}
	}

	// ── Document favourite ─────────────────────────────────────────────────

	/** Reactive: is the current doc favourited? */
	let currentFavId = $derived.by(() => {
		const docId = Number(id);
		const fav = $favouriteDocuments.find((f) => f.docId === docId);
		return fav?.id ?? null;
	});

	let isFavourited = $derived(currentFavId !== null);

	function toggleFavourite() {
		if (isFavourited && currentFavId) {
			removeFavouriteDocument(currentFavId);
		} else if (document) {
			addFavouriteDocument(
				{ docId: document.id, title: document.title, code: document.code, docTypeId: document.docTypeId },
				$vehicle,
			);
		}
	}

	// ── Font size ──────────────────────────────────────────────────────────

	const FONT_SIZES = [
		{ label: 'S', class: 'prose-sm', value: 0 },
		{ label: 'M', class: 'prose-base', value: 1 },
		{ label: 'L', class: 'prose-lg', value: 2 },
		{ label: 'XL', class: 'prose-xl', value: 3 },
		{ label: '2XL', class: 'prose-2xl', value: 4 },
	] as const;

	let fontSizeIdx = $state(
		browser ? Math.min(Math.max(Number(localStorage.getItem('tisx-doc-fontsize') ?? '1'), 0), FONT_SIZES.length - 1) : 1,
	);

	function decreaseFont() {
		if (fontSizeIdx > 0) {
			fontSizeIdx--;
			if (browser) localStorage.setItem('tisx-doc-fontsize', String(fontSizeIdx));
		}
	}
	function increaseFont() {
		if (fontSizeIdx < FONT_SIZES.length - 1) {
			fontSizeIdx++;
			if (browser) localStorage.setItem('tisx-doc-fontsize', String(fontSizeIdx));
		}
	}

	let proseSize = $derived(FONT_SIZES[fontSizeIdx].class);

	// -- Magnifier lens size presets ------------------------------------------
	const LENS_SIZES = [
		{ label: 'S', px: 120 },
		{ label: 'M', px: 180 },
		{ label: 'L', px: 260 },
		{ label: 'XL', px: 360 },
	] as const;

	let lensSizeIdx = $state(
		browser ? Math.min(Math.max(Number(localStorage.getItem('tisx-lens-size') ?? '1'), 0), LENS_SIZES.length - 1) : 1,
	);

	function decreaseLens() {
		if (lensSizeIdx > 0) {
			lensSizeIdx--;
			if (browser) localStorage.setItem('tisx-lens-size', String(lensSizeIdx));
		}
	}
	function increaseLens() {
		if (lensSizeIdx < LENS_SIZES.length - 1) {
			lensSizeIdx++;
			if (browser) localStorage.setItem('tisx-lens-size', String(lensSizeIdx));
		}
	}

	let currentLensSize = $derived(LENS_SIZES[lensSizeIdx].px);

	$effect(() => {
		// Track `id` so the effect re-runs when the route param changes
		const _docId = id;
		if (browser) {
			initialized = true;
			loadDocument();
		}
	});
</script>

<section class="space-y-6">
	<!-- Toolbar: Back (left) | Actions (right) -->
	<div class="flex items-center justify-between print:hidden">
		<button
			type="button"
			class="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
			onclick={handleBack}
		>
			<span aria-hidden="true">&larr;</span>
			Back
		</button>

		<div class="flex items-center gap-2">
			<!-- Font size controls -->
			<div class="inline-flex items-center overflow-hidden rounded-full border border-slate-300 dark:border-slate-800" title="Text size">
				<button
					type="button"
					class="px-2.5 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800"
					onclick={decreaseFont}
					disabled={fontSizeIdx === 0}
					title="Decrease font size"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
					</svg>
				</button>
				<span class="min-w-[2rem] border-x border-slate-300 px-1 py-2 text-center text-xs font-medium text-slate-600 dark:border-slate-800 dark:text-slate-300"
					>{FONT_SIZES[fontSizeIdx].label}</span
				>
				<button
					type="button"
					class="px-2.5 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800"
					onclick={increaseFont}
					disabled={fontSizeIdx === FONT_SIZES.length - 1}
					title="Increase font size"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
					</svg>
				</button>
			</div>

			<!-- Magnifier lens size control -->
			<div class="inline-flex items-center overflow-hidden rounded-full border border-slate-300 dark:border-slate-800" title="Magnifier size — hold Alt/Option over an image to zoom">
				<button
					type="button"
					class="px-2.5 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800"
					onclick={decreaseLens}
					disabled={lensSizeIdx === 0}
					title="Decrease magnifier size"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
					</svg>
				</button>
				<span class="inline-flex min-w-[2.5rem] items-center justify-center gap-1 border-x border-slate-300 px-1 py-2 text-center text-xs font-medium text-slate-600 dark:border-slate-800 dark:text-slate-300">
					<svg class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					{LENS_SIZES[lensSizeIdx].label}
				</span>
				<button
					type="button"
					class="px-2.5 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800"
					onclick={increaseLens}
					disabled={lensSizeIdx === LENS_SIZES.length - 1}
					title="Increase magnifier size"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
					</svg>
				</button>
			</div>

			<button
				type="button"
				class="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition
					{isFavourited
					? 'border-amber-400 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20'
					: 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white'}"
				onclick={toggleFavourite}
				title={isFavourited ? 'Remove from favourites' : 'Add to favourites'}
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
					fill={isFavourited ? 'currentColor' : 'none'}
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
				</svg>
				{isFavourited ? 'Saved' : 'Save'}
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
				onclick={handlePrint}
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
				</svg>
				Print
			</button>
		</div>
	</div>

	<header class="space-y-2 print:block">
		<h1 class="text-3xl font-semibold">{document?.title ?? `Doc: ${id}`}</h1>
	</header>

	{#if loading}
		<div
			class="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300"
		>
			Loading document details&hellip;
		</div>
	{:else if error}
		<div
			class="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
		>
			{error}
		</div>
	{:else}
		<!-- Document content — single-column, full-width article with inline images -->
		<div class="space-y-6">
			{#if textUrl && !textError && !textLoading}
				<article
					class="prose max-w-none rounded-2xl border border-slate-200 bg-white p-6 prose-slate dark:border-slate-800 dark:bg-slate-950/70 dark:prose-invert [&_.tis-inline-image]:mx-auto [&_.tis-inline-image]:block [&_.tis-inline-image]:max-w-full [&_.tis-cross-ref]:cursor-pointer [&_.tis-cross-ref]:text-sky-600 [&_.tis-cross-ref]:no-underline hover:[&_.tis-cross-ref]:underline dark:[&_.tis-cross-ref]:text-sky-400 [&_a.tis-cross-ref]:font-medium [&_span.tis-cross-ref]:font-medium [&_.tis-layout-table]:max-w-full [&_.tis-layout-table]:border-collapse [&_.tis-img-cell]:w-[45%] [&_.tis-img-cell]:align-top [&_.tis-img-cell]:pr-4 [&_.tis-text-cell]:align-top [&_.tis-img-cell_.tis-inline-image]:mx-0 {proseSize}"
					onclick={handleArticleClick}
					use:imageMagnify={{ onclick: (src) => (lightboxSrc = src), lensSize: currentLensSize }}
				>
					{#if renderedHtml}
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- server-rendered HTML from Pandoc with RTF->HTML conversion -->
						{@html renderedHtml}
					{:else}
						<p class="text-slate-500 dark:text-slate-400">Text file was empty.</p>
					{/if}
				</article>
			{:else if textUrl && !textError}
				<div
					class="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300"
				>
					Loading text content&hellip;
				</div>
			{:else}
				<div
					class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-400"
				>
					No text content available.
				</div>
			{/if}

			<!-- Related documents (Verbund) -->
			{#if relatedLoading}
				<div
					class="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400"
				>
					Loading related documents&hellip;
				</div>
			{:else if relatedDocs.length > 0}
				<div
					class="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/60"
				>
					<h2 class="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
						Related documents
					</h2>
					<ul class="grid gap-2">
						{#each relatedDocs as doc (doc.id)}
							<li>
								<button
									type="button"
									class="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-sky-400 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-500/60 dark:hover:bg-slate-800"
									onclick={() => openRelated(doc)}
								>
									<div class="flex flex-wrap items-center justify-between gap-2">
										<div>
											<p class="text-sm font-medium text-slate-900 dark:text-slate-100">
												{doc.title}
											</p>
											<p class="text-xs text-slate-500 dark:text-slate-400">
												<span
													class="mr-2 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-slate-600 uppercase dark:bg-slate-700 dark:text-slate-300"
													>{doc.docTypeCode}</span
												>
												{doc.docTypeName}
											</p>
										</div>
										<span class="text-xs text-slate-500 dark:text-slate-400"
											>{formatPublicationDate(doc.publicationDate)}</span
										>
									</div>
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</section>

<!-- Image lightbox viewer -->
<ImageViewer src={lightboxSrc} onclose={() => (lightboxSrc = null)} />

<!-- Disambiguation popup for hotspots with multiple targets -->
{#if disambiguationVisible}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
		onclick={closeDisambiguation}
		onkeydown={(e) => e.key === 'Escape' && closeDisambiguation()}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="mx-4 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
			onclick={(e) => e.stopPropagation()}
		>
			<h3 class="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">
				Multiple documents found
			</h3>
			<p class="mb-4 text-sm text-slate-500 dark:text-slate-400">
				This reference links to multiple documents. Select one:
			</p>
			<ul class="grid gap-2">
				{#each disambiguationTargets as target (target.id)}
					<li>
						<button
							type="button"
							class="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-sky-400 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-500/60 dark:hover:bg-slate-700"
							onclick={() => {
								closeDisambiguation();
								openRelated(target);
							}}
						>
							<p class="text-sm font-medium text-slate-900 dark:text-slate-100">
								{target.title}
							</p>
							{#if target.code}
								<p class="text-xs text-slate-500 dark:text-slate-400">
									Code: {target.code}
								</p>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
			<div class="mt-4 flex justify-end">
				<button
					type="button"
					class="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500"
					onclick={closeDisambiguation}
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}
