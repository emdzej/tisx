<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import type { PageProps } from './$types';

	type DocumentDetail = {
		id: number;
		code: string | null;
		dokartId: number;
		title: string;
		publicationDate: number | null;
		security: number | null;
	};

	type DocumentFile = {
		filename: string;
		deviceType: string | null;
		deviceCode: string | null;
		graphicsPath?: string;
		grafikPath?: string;
		textPath?: string;
		textUrl?: string;
	};

	type DocumentResponse = {
		document: DocumentDetail;
		files: DocumentFile[];
	};

	const { params } = $props<PageProps>();
	const { id } = params;

	let loading = $state(true);
	let error = $state('');
	let document = $state<DocumentDetail | null>(null);
	let file = $state<DocumentFile | null>(null);
	let imageUrl = $state<string | null>(null);
	let textUrl = $state<string | null>(null);
	const placeholderImageUrl = '/assets/placeholder.svg';
	let textError = $state(false);
	let textLoading = $state(false);
	let textContent = $state('');
	let renderedHtml = $state('');
	let initialized = $state(false);

	const normalizeAssetPath = (path: string, base: string) => {
		const cleaned = path
			.replace(/^\/+/, '')
			.replace(/^GRAFIK\//i, '')
			.replace(/^TEXT\//i, '');
		return `${base}/${cleaned}`;
	};

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

	async function loadTextContent(url: string) {
		textError = false;
		textLoading = true;
		textContent = '';
		renderedHtml = '';
		try {
			// Request HTML from server (Pandoc conversion)
			const response = await fetch(`${url}?format=html`);
			if (!response.ok) throw new Error('Text not found');
			const payload = (await response.json()) as { content?: string };
			textContent = payload.content ?? '';
			// Content is already HTML from Pandoc
			renderedHtml = textContent;
		} catch {
			textError = true;
		} finally {
			textLoading = false;
		}
	}

	async function loadDocument() {
		loading = true;
		error = '';
		textError = false;
		textLoading = false;
		try {
			const response = await fetch(`/api/document/${id}`);
			if (!response.ok) {
				const message = await response.text();
				throw new Error(message || 'Failed to load document');
			}
			const payload = (await response.json()) as DocumentResponse;
			document = payload.document;
			file = payload.files?.[0] ?? null;

			const graphicPath = file?.graphicsPath ?? file?.grafikPath ?? '';
			const textPath = file?.textPath ?? '';
			imageUrl = graphicPath
				? normalizeAssetPath(graphicPath, '/assets/images')
				: placeholderImageUrl;
			textUrl = file?.textUrl ?? (textPath ? normalizeAssetPath(textPath, '/api/docs') : null);

			if (textUrl) {
				await loadTextContent(textUrl);
			}
		} catch (err) {
			error = (err as Error).message;
			document = null;
			file = null;
			imageUrl = null;
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
		goto('/browse');
	}

	function handleImageError() {
		imageUrl = placeholderImageUrl;
	}

	$effect(() => {
		if (browser && !initialized) {
			initialized = true;
			loadDocument();
		}
	});
</script>

<section class="space-y-6">
	<header class="flex flex-wrap items-start justify-between gap-4">
		<div class="space-y-2">
			<p class="text-xs uppercase tracking-[0.4em] text-slate-400">Document detail</p>
			<h1 class="text-3xl font-semibold text-white">{document?.title ?? `Doc: ${id}`}</h1>
			<div class="flex flex-wrap gap-4 text-sm text-slate-300">
				<span class="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1">
					Date: {formatPublicationDate(document?.publicationDate ?? null)}
				</span>
				<span class="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1">
					Doc type: {document?.dokartId ?? '—'}
				</span>
			</div>
		</div>

		<button
			type="button"
			class="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-600 hover:text-white"
			onclick={handleBack}
		>
			<span aria-hidden="true">←</span>
			Back
		</button>
	</header>

	{#if loading}
		<div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300">
			Loading document details…
		</div>
	{:else if error}
		<div class="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-rose-200">
			{error}
		</div>
	{:else}
		<div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
			<div class="space-y-3">
				<h2 class="text-lg font-semibold text-white">Graphics</h2>
				{#if imageUrl}
					<div class="group relative overflow-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
						<img
							src={imageUrl}
							alt={document?.title ?? 'Document graphic'}
							class="mx-auto max-h-[70vh] w-auto origin-center transition-transform duration-300 group-hover:scale-105"
							onerror={handleImageError}
						/>
						<p class="mt-2 text-xs text-slate-500">Scroll to pan, hover to zoom.</p>
					</div>
				{:else}
					<div class="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 text-sm text-slate-400">
						No graphic available yet.
					</div>
				{/if}
			</div>

			<div class="space-y-3">
				<h2 class="text-lg font-semibold text-white">Text content</h2>
				{#if textUrl && !textError && !textLoading}
					<article class="prose prose-invert prose-sm max-w-none rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
						{#if renderedHtml}
							{@html renderedHtml}
						{:else}
							<p class="text-slate-400">Text file was empty.</p>
						{/if}
					</article>
				{:else if textUrl && !textError}
					<div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-300">
						Loading text content…
					</div>
				{:else}
					<div class="rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-5 text-sm text-slate-400">
						No text content available yet.
					</div>
				{/if}
			</div>
		</div>
	{/if}
</section>
