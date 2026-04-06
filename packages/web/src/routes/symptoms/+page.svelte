<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import SymptomTree from './SymptomTree.svelte';
	import { browser } from '$app/environment';
	import { vehicle, hasVehicle, vehicleSummary, buildVehicleQuery } from '$lib/stores/vehicle';

	type SymptomNode = {
		id: number;
		code: string | null;
		name: string | null;
		parentId: number;
		hasChildren: boolean;
	};

	type DocumentListItem = {
		id: number;
		code: string | null;
		docTypeId: number;
		title: string;
		publicationDate: number | null;
	};

	type RootCategory = {
		id: number;
		name: string;
	};

	// Root categories (diagnosis -2, component system -1)
	let roots = $state<RootCategory[]>([]);
	let loadingRoots = $state(false);

	// Condition tree state (diagnosis, parentId=-2)
	let conditionNodes = $state<SymptomNode[]>([]);
	let conditionChildren = $state<Record<number, SymptomNode[]>>({});
	let conditionExpanded = $state(new SvelteSet<number>());
	let conditionLoading = $state<Record<number, boolean>>({});
	let conditionSelectedId = $state<number | null>(null);
	let loadingConditions = $state(false);

	// Component tree state (vehicle component system, parentId=-1)
	let componentNodes = $state<SymptomNode[]>([]);
	let componentChildren = $state<Record<number, SymptomNode[]>>({});
	let componentExpanded = $state(new SvelteSet<number>());
	let componentLoading = $state<Record<number, boolean>>({});
	let componentSelectedId = $state<number | null>(null);
	let loadingComponents = $state(false);

	// Documents
	let documents = $state<DocumentListItem[]>([]);
	let loadingDocuments = $state(false);
	let documentsError = $state('');
	let activeNodeId = $state<number | null>(null);
	let activeTreeLabel = $state('');

	const formatDate = (value: number | null) => {
		if (!value) return '\u2014';
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

	const vehicleQuery = () => buildVehicleQuery($vehicle);

	// Load the two root categories + initial nodes for both trees
	const loadInitialData = async () => {
		loadingRoots = true;
		loadingConditions = true;
		loadingComponents = true;
		try {
			roots = await fetchJson<RootCategory[]>('/api/symptoms/roots');
		} catch {
			roots = [];
		} finally {
			loadingRoots = false;
		}

		const vq = vehicleQuery();
		const [condResult, compResult] = await Promise.allSettled([
			fetchJson<SymptomNode[]>(`/api/symptoms/nodes/-2${vq}`),
			fetchJson<SymptomNode[]>(`/api/symptoms/nodes/-1${vq}`),
		]);
		conditionNodes = condResult.status === 'fulfilled' ? condResult.value : [];
		componentNodes = compResult.status === 'fulfilled' ? compResult.value : [];
		loadingConditions = false;
		loadingComponents = false;
	};

	const loadChildren = async (
		parentId: number,
		tree: 'condition' | 'component',
	) => {
		const setLoading = tree === 'condition' ? (v: Record<number, boolean>) => (conditionLoading = v) : (v: Record<number, boolean>) => (componentLoading = v);
		const getLoading = tree === 'condition' ? () => conditionLoading : () => componentLoading;
		const setChildren = tree === 'condition' ? (v: Record<number, SymptomNode[]>) => (conditionChildren = v) : (v: Record<number, SymptomNode[]>) => (componentChildren = v);
		const getChildren = tree === 'condition' ? () => conditionChildren : () => componentChildren;

		setLoading({ ...getLoading(), [parentId]: true });
		try {
			const nodes = await fetchJson<SymptomNode[]>(
				`/api/symptoms/nodes/${parentId}${vehicleQuery()}`,
			);
			setChildren({ ...getChildren(), [parentId]: nodes });
		} catch {
			setChildren({ ...getChildren(), [parentId]: [] });
		} finally {
			setLoading({ ...getLoading(), [parentId]: false });
		}
	};

	const toggleConditionNode = async (node: SymptomNode) => {
		const next = new SvelteSet(conditionExpanded);
		if (conditionExpanded.has(node.id)) {
			next.delete(node.id);
			conditionExpanded = next;
			return;
		}
		next.add(node.id);
		conditionExpanded = next;
		if (!conditionChildren[node.id]) {
			await loadChildren(node.id, 'condition');
		}
	};

	const toggleComponentNode = async (node: SymptomNode) => {
		const next = new SvelteSet(componentExpanded);
		if (componentExpanded.has(node.id)) {
			next.delete(node.id);
			componentExpanded = next;
			return;
		}
		next.add(node.id);
		componentExpanded = next;
		if (!componentChildren[node.id]) {
			await loadChildren(node.id, 'component');
		}
	};

	const loadDocuments = async (nodeId: number) => {
		loadingDocuments = true;
		documentsError = '';
		activeNodeId = nodeId;
		try {
			documents = await fetchJson<DocumentListItem[]>(
				`/api/symptoms/documents/${nodeId}${vehicleQuery()}`,
			);
		} catch {
			documentsError = 'Failed to load documents';
			documents = [];
		} finally {
			loadingDocuments = false;
		}
	};

	const selectConditionNode = async (node: SymptomNode) => {
		conditionSelectedId = node.id;
		componentSelectedId = null;
		activeTreeLabel = 'Condition';
		await loadDocuments(node.id);
	};

	const selectComponentNode = async (node: SymptomNode) => {
		componentSelectedId = node.id;
		conditionSelectedId = null;
		activeTreeLabel = 'Component';
		await loadDocuments(node.id);
	};

	const openDocument = (doc: DocumentListItem) => {
		goto(resolve(`/doc/${doc.id}` as `/${string}`));
	};

	// Doc type code lookup for display
	const docTypeLabel = (docTypeId: number): string => {
		const map: Record<number, string> = { 100: 'SI', 200: 'RA', 300: 'TD', 400: 'AZD', 1100: 'SBT', 1200: 'IDC', 1300: 'SWS' };
		return map[docTypeId] ?? String(docTypeId);
	};

	// Re-load trees when vehicle context changes
	let lastVehicleKey = $state('');

	$effect(() => {
		if (!browser) return;
		const key = `${$vehicle.seriesId}:${$vehicle.modelId}:${$vehicle.engineId}`;
		if (key !== lastVehicleKey && lastVehicleKey !== '') {
			// Vehicle changed — reload both trees
			loadInitialData();
		}
		lastVehicleKey = key;
	});

	let initialized = $state(false);

	$effect(() => {
		if (browser && !initialized) {
			initialized = true;
			loadInitialData();
		}
	});
</script>

<section class="space-y-6">
	<header class="space-y-2">
		<p class="text-xs tracking-[0.4em] text-slate-500 uppercase dark:text-slate-400">
			Symptom-based navigation
		</p>
		<h1 class="text-3xl font-semibold">Symptom browser</h1>
		{#if $hasVehicle}
			<p class="text-sm text-slate-600 dark:text-slate-300">
				Viewing symptoms for {$vehicleSummary}
			</p>
		{:else}
			<p class="text-sm text-slate-500 dark:text-slate-400">
				No vehicle selected. Use the vehicle selector in the header to refine results.
			</p>
		{/if}
	</header>

	<!-- Two trees side by side -->
	<div class="grid gap-6 md:grid-cols-2">
		<!-- Conditions tree (diagnosis) -->
		<div
			class="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-950/60"
		>
			<h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">Diagnosis</h2>
			<p class="mb-3 text-xs text-slate-500 dark:text-slate-400">
				Browse by condition or symptom
			</p>

			{#if loadingConditions}
				<p class="text-sm text-slate-500 dark:text-slate-400">Loading conditions...</p>
			{:else if conditionNodes.length === 0}
				<p class="text-sm text-slate-500">No conditions available.</p>
			{:else}
				<div class="max-h-[50vh] overflow-auto pr-2">
					<SymptomTree
						nodes={conditionNodes}
						expandedNodes={conditionExpanded}
						loadingMap={conditionLoading}
						childrenMap={conditionChildren}
						selectedNodeId={conditionSelectedId}
						onToggle={toggleConditionNode}
						onSelect={selectConditionNode}
					/>
				</div>
			{/if}
		</div>

		<!-- Components tree (vehicle component system) -->
		<div
			class="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-950/60"
		>
			<h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
				Vehicle component system
			</h2>
			<p class="mb-3 text-xs text-slate-500 dark:text-slate-400">
				Browse by vehicle system and component
			</p>

			{#if loadingComponents}
				<p class="text-sm text-slate-500 dark:text-slate-400">Loading components...</p>
			{:else if componentNodes.length === 0}
				<p class="text-sm text-slate-500">No components available.</p>
			{:else}
				<div class="max-h-[50vh] overflow-auto pr-2">
					<SymptomTree
						nodes={componentNodes}
						expandedNodes={componentExpanded}
						loadingMap={componentLoading}
						childrenMap={componentChildren}
						selectedNodeId={componentSelectedId}
						onToggle={toggleComponentNode}
						onSelect={selectComponentNode}
					/>
				</div>
			{/if}
		</div>
	</div>

	<!-- Documents -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold">Documents</h2>
			{#if activeNodeId !== null}
				<span class="text-xs text-slate-500">{activeTreeLabel} node ID: {activeNodeId}</span>
			{/if}
		</div>

		{#if loadingDocuments}
			<p
				class="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400"
			>
				Loading documents...
			</p>
		{:else if documentsError}
			<p
				class="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
			>
				{documentsError}
			</p>
		{:else if documents.length === 0}
			<p
				class="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400"
			>
				{activeNodeId !== null ? 'No documents for this node.' : 'Select a condition or component to see documents.'}
			</p>
		{:else}
			<p class="text-xs text-slate-500">{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
			<ul class="grid gap-3">
				{#each documents as doc (doc.id)}
					<li>
						<button
							type="button"
							class="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-400 hover:bg-sky-50 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-sky-500/60 dark:hover:bg-slate-900"
							onclick={() => openDocument(doc)}
						>
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div>
									<p class="text-sm font-semibold text-slate-900 dark:text-slate-100">
										{doc.title}
									</p>
									<p class="text-xs text-slate-500 dark:text-slate-400">
										Doc ID: {doc.id}
										<span
											class="ml-2 inline-block rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
										>
											{docTypeLabel(doc.docTypeId)}
										</span>
									</p>
								</div>
								<span class="text-xs text-slate-500 dark:text-slate-400"
									>{formatDate(doc.publicationDate)}</span
								>
							</div>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>
