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

	// Active tab: 'condition' (Diagnosis) or 'component' (Vehicle component system)
	let activeTab = $state<'condition' | 'component'>('condition');

	// Root categories (diagnosis -2, component system -1)
	let roots = $state<RootCategory[]>([]);
	let loadingRoots = $state(false);

	// Condition tree state (diagnosis, parentId=-2)
	let conditionNodes = $state<SymptomNode[]>([]);
	let conditionChildren = $state<Record<number, SymptomNode[]>>({});
	let conditionExpanded = $state(new SvelteSet<number>());
	let conditionSelectedId = $state<number | null>(null);
	let loadingConditions = $state(false);

	// Component tree state (vehicle component system, parentId=-1)
	let componentNodes = $state<SymptomNode[]>([]);
	let componentChildren = $state<Record<number, SymptomNode[]>>({});
	let componentExpanded = $state(new SvelteSet<number>());
	let componentSelectedId = $state<number | null>(null);
	let loadingComponents = $state(false);

	// Documents
	let documents = $state<DocumentListItem[]>([]);
	let loadingDocuments = $state(false);
	let documentsError = $state('');
	let activeNodeId = $state<number | null>(null);

	// Document search filter
	let documentSearch = $state('');

	// Tree search filters
	let conditionSearch = $state('');
	let componentSearch = $state('');

	/**
	 * Build a childrenMap from a flat list of nodes: group each node by its parentId.
	 * Also returns the root-level nodes (those whose parentId equals the rootId).
	 */
	const buildTree = (
		allNodes: SymptomNode[],
		rootId: number,
	): { roots: SymptomNode[]; childrenMap: Record<number, SymptomNode[]> } => {
		const childrenMap: Record<number, SymptomNode[]> = {};
		const rootNodes: SymptomNode[] = [];
		for (const node of allNodes) {
			if (node.parentId === rootId) {
				rootNodes.push(node);
			} else {
				if (!childrenMap[node.parentId]) {
					childrenMap[node.parentId] = [];
				}
				childrenMap[node.parentId].push(node);
			}
		}
		return { roots: rootNodes, childrenMap };
	};

	/**
	 * Recursively filter a tree: a node is kept if it matches the term
	 * OR any of its loaded descendants match. Returns filtered root nodes,
	 * a filtered childrenMap containing only the kept branches, and a set
	 * of node IDs that should be auto-expanded (ancestors of matching leaves).
	 */
	const filterTree = (
		nodes: SymptomNode[],
		childrenMap: Record<number, SymptomNode[]>,
		term: string,
	): { nodes: SymptomNode[]; childrenMap: Record<number, SymptomNode[]>; expandIds: Set<number> } => {
		const filteredChildrenMap: Record<number, SymptomNode[]> = {};
		const expandIds = new Set<number>();

		const nodeMatches = (node: SymptomNode): boolean => {
			const selfMatch = !!node.name?.toLowerCase().includes(term);
			const kids = childrenMap[node.id];
			if (kids && kids.length > 0) {
				const matchingKids = kids.filter((kid) => nodeMatches(kid));
				if (matchingKids.length > 0) {
					filteredChildrenMap[node.id] = matchingKids;
					// Auto-expand this node so matching descendants are visible
					expandIds.add(node.id);
					return true;
				}
			}
			return selfMatch;
		};

		const filteredNodes = nodes.filter((n) => nodeMatches(n));
		return { nodes: filteredNodes, childrenMap: filteredChildrenMap, expandIds };
	};

	const emptyExpandIds = new Set<number>();

	let filteredConditionTree = $derived.by(() => {
		if (!conditionSearch.trim()) return { nodes: conditionNodes, childrenMap: conditionChildren, expandIds: emptyExpandIds };
		return filterTree(conditionNodes, conditionChildren, conditionSearch.trim().toLowerCase());
	});

	let filteredComponentTree = $derived.by(() => {
		if (!componentSearch.trim()) return { nodes: componentNodes, childrenMap: componentChildren, expandIds: emptyExpandIds };
		return filterTree(componentNodes, componentChildren, componentSearch.trim().toLowerCase());
	});

	// When searching, merge the auto-expand IDs with the user's manually expanded set
	// so that all ancestor nodes of matches are open. When not searching, use just the manual set.
	let effectiveConditionExpanded = $derived.by(() => {
		const ids = filteredConditionTree.expandIds;
		if (ids.size === 0) return conditionExpanded;
		const merged = new Set(conditionExpanded);
		for (const id of ids) merged.add(id);
		return merged;
	});

	let effectiveComponentExpanded = $derived.by(() => {
		const ids = filteredComponentTree.expandIds;
		if (ids.size === 0) return componentExpanded;
		const merged = new Set(componentExpanded);
		for (const id of ids) merged.add(id);
		return merged;
	});

	let filteredDocuments = $derived.by(() => {
		if (!documentSearch.trim()) return documents;
		const term = documentSearch.trim().toLowerCase();
		return documents.filter(
			(doc) =>
				doc.title.toLowerCase().includes(term) ||
				(doc.code && doc.code.toLowerCase().includes(term)),
		);
	});

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

	// Load root categories + full trees for both condition and component
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
			fetchJson<SymptomNode[]>(`/api/symptoms/tree/-2${vq}`),
			fetchJson<SymptomNode[]>(`/api/symptoms/tree/-1${vq}`),
		]);

		if (condResult.status === 'fulfilled') {
			const tree = buildTree(condResult.value, -2);
			conditionNodes = tree.roots;
			conditionChildren = tree.childrenMap;
		} else {
			conditionNodes = [];
			conditionChildren = {};
		}

		if (compResult.status === 'fulfilled') {
			const tree = buildTree(compResult.value, -1);
			componentNodes = tree.roots;
			componentChildren = tree.childrenMap;
		} else {
			componentNodes = [];
			componentChildren = {};
		}

		loadingConditions = false;
		loadingComponents = false;
	};

	const toggleConditionNode = (node: SymptomNode) => {
		const next = new SvelteSet(conditionExpanded);
		if (conditionExpanded.has(node.id)) {
			next.delete(node.id);
		} else {
			next.add(node.id);
		}
		conditionExpanded = next;
	};

	const toggleComponentNode = (node: SymptomNode) => {
		const next = new SvelteSet(componentExpanded);
		if (componentExpanded.has(node.id)) {
			next.delete(node.id);
		} else {
			next.add(node.id);
		}
		componentExpanded = next;
	};

	const loadDocuments = async (nodeId: number) => {
		loadingDocuments = true;
		documentsError = '';
		documentSearch = '';
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
		await loadDocuments(node.id);
	};

	const selectComponentNode = async (node: SymptomNode) => {
		componentSelectedId = node.id;
		conditionSelectedId = null;
		await loadDocuments(node.id);
	};

	const switchTab = (tab: 'condition' | 'component') => {
		activeTab = tab;
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

<section class="space-y-4">
	<header class="space-y-4">
		{#if $hasVehicle}
			<p class="text-sm text-slate-600 dark:text-slate-300">
				Viewing symptoms for {$vehicleSummary}
			</p>
		{:else}
			<p class="text-sm text-slate-500 dark:text-slate-400">
				No vehicle selected. Use the vehicle selector in the header to refine results.
			</p>
		{/if}

		<!-- Tab pills -->
		<div class="flex flex-wrap gap-1.5">
			<button
				type="button"
				class={`rounded-full border px-3 py-1 text-xs font-medium transition ${
					activeTab === 'condition'
						? 'border-sky-400 bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-100'
						: 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:border-slate-600'
				}`}
				onclick={() => switchTab('condition')}
			>
				Diagnosis
			</button>
			<button
				type="button"
				class={`rounded-full border px-3 py-1 text-xs font-medium transition ${
					activeTab === 'component'
						? 'border-sky-400 bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-100'
						: 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:border-slate-600'
				}`}
				onclick={() => switchTab('component')}
			>
				Vehicle component system
			</button>
		</div>
	</header>

	<!-- Tree + Documents side by side -->
	<div class="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
		<!-- Symptom tree column -->
		<div
			class="flex max-h-[70vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950/60"
		>
			<div class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
				<h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
					{activeTab === 'condition' ? 'Conditions' : 'Components'}
				</h2>
				{#if activeTab === 'condition' && conditionNodes.length > 0}
					<span class="text-xs text-slate-400">{conditionNodes.length}</span>
				{:else if activeTab === 'component' && componentNodes.length > 0}
					<span class="text-xs text-slate-400">{componentNodes.length}</span>
				{/if}
			</div>
			{#if activeTab === 'condition'}
				{@render searchBox(conditionSearch, (v) => (conditionSearch = v), 'Filter conditions...')}
			{:else}
				{@render searchBox(componentSearch, (v) => (componentSearch = v), 'Filter components...')}
			{/if}
			<div class="flex-1 overflow-auto p-2">
				{#if activeTab === 'condition'}
					{#if loadingConditions}
						<p class="p-2 text-sm text-slate-500 dark:text-slate-400">Loading conditions...</p>
					{:else if conditionNodes.length === 0}
						<p class="p-2 text-sm text-slate-500">No conditions available.</p>
					{:else if filteredConditionTree.nodes.length === 0}
						<p class="p-2 text-sm text-slate-400">No matching conditions.</p>
					{:else}
					<SymptomTree
						nodes={filteredConditionTree.nodes}
						expandedNodes={effectiveConditionExpanded}
						loadingMap={{}}
						childrenMap={conditionSearch.trim() ? filteredConditionTree.childrenMap : conditionChildren}
						selectedNodeId={conditionSelectedId}
						onToggle={toggleConditionNode}
						onSelect={selectConditionNode}
					/>
					{/if}
				{:else}
					{#if loadingComponents}
						<p class="p-2 text-sm text-slate-500 dark:text-slate-400">Loading components...</p>
					{:else if componentNodes.length === 0}
						<p class="p-2 text-sm text-slate-500">No components available.</p>
					{:else if filteredComponentTree.nodes.length === 0}
						<p class="p-2 text-sm text-slate-400">No matching components.</p>
					{:else}
					<SymptomTree
						nodes={filteredComponentTree.nodes}
						expandedNodes={effectiveComponentExpanded}
						loadingMap={{}}
						childrenMap={componentSearch.trim() ? filteredComponentTree.childrenMap : componentChildren}
						selectedNodeId={componentSelectedId}
						onToggle={toggleComponentNode}
						onSelect={selectComponentNode}
					/>
					{/if}
				{/if}
			</div>
		</div>

		<!-- Documents column -->
		<div class="min-w-0">
			{@render documentPanel()}
		</div>
	</div>
</section>

{#snippet searchBox(value: string, onchange: (v: string) => void, placeholder: string)}
	<div class="relative border-b border-slate-200 dark:border-slate-800">
		<input
			type="text"
			{placeholder}
			{value}
			oninput={(e) => onchange(e.currentTarget.value)}
			class="w-full bg-transparent px-4 py-2 text-xs text-slate-700 placeholder-slate-400 outline-none dark:text-slate-300 dark:placeholder-slate-500"
		/>
		{#if value}
			<button
				type="button"
				class="absolute top-1/2 right-2 -translate-y-1/2 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
				onclick={() => onchange('')}
			>
				&times;
			</button>
		{/if}
	</div>
{/snippet}

{#snippet documentPanel()}
	<div
		class="flex max-h-[70vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950/60"
	>
		<div class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
			<h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">Documents</h2>
			{#if documents.length > 0}
				<span class="text-xs text-slate-400">{documents.length}</span>
			{/if}
		</div>
		{@render searchBox(documentSearch, (v) => (documentSearch = v), 'Filter documents...')}
		<div class="flex-1 overflow-auto">
			{#if loadingDocuments}
				<p class="p-4 text-sm text-slate-500 dark:text-slate-400">Loading documents...</p>
			{:else if documentsError}
				<p class="p-4 text-sm text-rose-600 dark:text-rose-300">{documentsError}</p>
			{:else if documents.length === 0}
				<p class="p-4 text-sm text-slate-400 dark:text-slate-500">
					{activeNodeId !== null ? 'No documents for this node.' : 'Select a condition or component to see documents.'}
				</p>
			{:else if filteredDocuments.length === 0}
				<p class="p-4 text-sm text-slate-400">No matching documents.</p>
			{:else}
				<ul class="divide-y divide-slate-100 dark:divide-slate-800/50">
					{#each filteredDocuments as doc (doc.id)}
						<li>
							<button
								type="button"
								class="w-full px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
								onclick={() => openDocument(doc)}
							>
								<p class="text-sm font-medium text-slate-900 dark:text-slate-100">
									{doc.title}
								</p>
								<p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
									{doc.code ?? doc.id} · {formatDate(doc.publicationDate)}
									<span
										class="ml-1 inline-block rounded-full border border-slate-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
									>
										{docTypeLabel(doc.docTypeId)}
									</span>
								</p>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/snippet}
