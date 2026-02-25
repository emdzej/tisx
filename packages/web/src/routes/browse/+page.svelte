<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import GroupTree from './GroupTree.svelte';
	import { browser } from '$app/environment';

	type DocType = {
		id: number;
		code: string;
		name: string;
		mainGroupLabel: string | null;
		subGroupLabel: string | null;
	};

	type GroupNode = {
		id: number;
		code: string | null;
		name: string | null;
		parentId: number | null;
	};

	type DocumentListItem = {
		id: number;
		code: string | null;
		dokartId: number;
		title: string;
		publicationDate: number | null;
	};

	let seriesName = $state('');
	let modelName = $state('');
	let engineName = $state('');

	const seriesId = $derived($page?.url?.searchParams?.get('series') ?? '');
	const modelId = $derived($page?.url?.searchParams?.get('model') ?? '');
	const engineId = $derived($page?.url?.searchParams?.get('engine') ?? '');

		let docTypes = $state<DocType[]>([]);
	let activeDocType = $state<DocType | null>(null);
	let loadingDocTypes = $state(false);
	let docTypeError = $state('');

	let rootGroups = $state<GroupNode[]>([]);
	let groupChildren = $state<Record<number, GroupNode[]>>({});
	let expandedNodes = $state(new Set<number>());
	let groupLoading = $state<Record<number, boolean>>({});
	let groupsError = $state('');
	let loadingGroups = $state(false);

	let selectedNodeId = $state<number | null>(null);
	let documents = $state<DocumentListItem[]>([]);
	let loadingDocuments = $state(false);
	let documentsError = $state('');

	const formatDate = (value: number | null) => {
		if (!value) return '—';
		const raw = String(value);
		if (raw.length === 8) {
			return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}`;
		}
		return raw;
	};

	async function fetchJson<T>(path: string): Promise<T> {
		const res = await fetch(path);
		if (!res.ok) {
			const payload = await res.json().catch(() => ({}));
			throw new Error(payload?.error ?? `Request failed (${res.status})`);
		}
		return res.json() as Promise<T>;
	}

	const loadDocTypes = async () => {
		console.log('loadDocTypes called');
		loadingDocTypes = true;
		docTypeError = '';
		try {
			console.log('Fetching /api/doctypes...');
			docTypes = await fetchJson<DocType[]>('/api/doctypes');
			console.log('Got docTypes:', docTypes);
			activeDocType = docTypes[0] ?? null;
			if (activeDocType) {
				await loadRootGroups(activeDocType.id);
			}
		} catch (error) {
			console.error('loadDocTypes error:', error);
			docTypeError = (error as Error).message;
		} finally {
			loadingDocTypes = false;
		}
	};

	const resetGroupsState = () => {
		rootGroups = [];
		groupChildren = {};
		expandedNodes = new Set();
		groupLoading = {};
		groupsError = '';
		selectedNodeId = null;
		documents = [];
		documentsError = '';
	};

	const loadRootGroups = async (dokartId: number) => {
		loadingGroups = true;
		groupsError = '';
		try {
			rootGroups = await fetchJson<GroupNode[]>(`/api/groups/${dokartId}`);
		} catch (error) {
			groupsError = (error as Error).message;
			rootGroups = [];
		} finally {
			loadingGroups = false;
		}
	};

	const loadChildren = async (dokartId: number, nodeId: number) => {
		groupLoading = { ...groupLoading, [nodeId]: true };
		try {
			const nodes = await fetchJson<GroupNode[]>(`/api/groups/${dokartId}/${nodeId}`);
			groupChildren = { ...groupChildren, [nodeId]: nodes };
		} catch (error) {
			groupChildren = { ...groupChildren, [nodeId]: [] };
		} finally {
			groupLoading = { ...groupLoading, [nodeId]: false };
		}
	};

	const toggleNode = async (node: GroupNode) => {
		if (!activeDocType) return;
		const next = new Set(expandedNodes);
		if (expandedNodes.has(node.id)) {
			next.delete(node.id);
			expandedNodes = next;
			return;
		}
		next.add(node.id);
		expandedNodes = next;
		if (!groupChildren[node.id]) {
			await loadChildren(activeDocType.id, node.id);
		}
	};

	const selectNode = async (node: GroupNode) => {
		selectedNodeId = node.id;
		await loadDocuments(node.id);
	};

	const loadDocuments = async (nodeId: number) => {
		loadingDocuments = true;
		documentsError = '';
		try {
			documents = await fetchJson<DocumentListItem[]>(`/api/documents/${nodeId}`);
		} catch (error) {
			documentsError = (error as Error).message;
			documents = [];
		} finally {
			loadingDocuments = false;
		}
	};

	const selectDocType = async (docType: DocType) => {
		if (activeDocType?.id === docType.id) return;
		activeDocType = docType;
		resetGroupsState();
		await loadRootGroups(docType.id);
	};

	const openDocument = (doc: DocumentListItem) => {
		goto(`/doc/${doc.id}`);
	};

	const loadVehicleNames = async () => {
		try {
			if (seriesId) {
				const series = await fetchJson<Array<{ id: number; name: string }>>('/api/series');
				seriesName = series.find((s) => String(s.id) === seriesId)?.name ?? seriesId;
			}
			if (seriesId && modelId) {
				const models = await fetchJson<Array<{ id: number; name: string }>>(
					`/api/series/${seriesId}/models`
				);
				modelName = models.find((m) => String(m.id) === modelId)?.name ?? modelId;
			}
			if (modelId && engineId) {
				const engines = await fetchJson<Array<{ id: number; name: string }>>(
					`/api/models/${modelId}/engines`
				);
				engineName = engines.find((e) => String(e.id) === engineId)?.name ?? engineId;
			}
		} catch {
			// ignore, fallback to IDs
		}
	};

	let initialized = $state(false);

	$effect(() => {
		if (browser && !initialized) {
			initialized = true;
			console.log('Browse page effect running, loading data...');
			loadDocTypes();
			loadVehicleNames();
		}
	});
</script>

<section class="space-y-6">
	<header class="space-y-4">
		<div>
			<p class="text-xs uppercase tracking-[0.4em] text-slate-400">Browse documents</p>
			<h1 class="text-3xl font-semibold">Document browser</h1>
			<p class="text-sm text-slate-300">
				{#if seriesId || modelId || engineId}
					Viewing documents for {seriesName || seriesId || '—'} / {modelName || modelId || '—'} / {engineName || engineId || '—'}
				{:else}
					Select a vehicle on the home page to refine results.
				{/if}
			</p>
		</div>

		<div class="flex flex-wrap gap-2">
			{#if loadingDocTypes}
				<span class="rounded-full border border-slate-800 bg-slate-950/60 px-4 py-2 text-xs text-slate-400">
					Loading document types…
				</span>
			{:else if docTypeError}
				<span class="rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs text-rose-300">
					{docTypeError}
				</span>
			{:else}
				{#each docTypes as docType (docType.id)}
					<button
						type="button"
						class={`rounded-full border px-4 py-2 text-sm font-medium transition ${
							activeDocType?.id === docType.id
								? 'border-sky-400 bg-sky-500/20 text-sky-100'
								: 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-600'
						}`}
						on:click={() => selectDocType(docType)}
					>
						<span class="mr-2 text-xs uppercase tracking-[0.3em] text-slate-400">{docType.code}</span>
						{docType.name}
					</button>
				{/each}
			{/if}
		</div>
	</header>

	<div class="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
		<aside class="rounded-3xl border border-slate-800 bg-slate-950/60 p-4 shadow-xl">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-semibold text-slate-200">Groups</h2>
				{#if activeDocType}
					<span class="text-xs text-slate-500">{activeDocType.mainGroupLabel ?? 'Main groups'}</span>
				{/if}
			</div>

			{#if loadingGroups}
				<p class="mt-4 text-sm text-slate-400">Loading groups…</p>
			{:else if groupsError}
				<p class="mt-4 text-sm text-rose-300">{groupsError}</p>
			{:else if rootGroups.length === 0}
				<p class="mt-4 text-sm text-slate-500">No groups available.</p>
			{:else}
				<div class="mt-4 max-h-[60vh] overflow-auto pr-2">
					<GroupTree
						nodes={rootGroups}
						expandedNodes={expandedNodes}
						loadingMap={groupLoading}
						childrenMap={groupChildren}
						selectedNodeId={selectedNodeId}
						onToggle={toggleNode}
						onSelect={selectNode}
					/>
				</div>
			{/if}
		</aside>

		<main class="space-y-4">
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-semibold">Documents</h2>
				{#if selectedNodeId}
					<span class="text-xs text-slate-500">Selected group ID: {selectedNodeId}</span>
				{/if}
			</div>

			{#if loadingDocuments}
				<p class="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
					Loading documents…
				</p>
			{:else if documentsError}
				<p class="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-300">
					{documentsError}
				</p>
			{:else if documents.length === 0}
				<p class="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
					Select a group to see documents.
				</p>
			{:else}
				<ul class="grid gap-3">
					{#each documents as doc (doc.id)}
						<li>
							<button
								type="button"
								class="w-full rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-left transition hover:border-sky-500/60 hover:bg-slate-900"
								on:click={() => openDocument(doc)}
							>
								<div class="flex flex-wrap items-center justify-between gap-2">
									<div>
										<p class="text-sm font-semibold text-slate-100">{doc.title}</p>
										<p class="text-xs text-slate-400">Doc ID: {doc.id} · Type {doc.dokartId}</p>
									</div>
									<span class="text-xs text-slate-400">{formatDate(doc.publicationDate)}</span>
								</div>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</main>
	</div>
</section>
