<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { vehicle, hasVehicle, vehicleSummary, buildVehicleQuery } from '$lib/stores/vehicle';

	type DocType = {
		id: number;
		code: string;
		name: string;
		mainGroupLabel: string | null;
		subGroupLabel: string | null;
		methode: number;
		zugriff: number;
		fzgRequ: number;
	};

	type GroupNode = {
		id: number;
		code: string | null;
		name: string | null;
		parentId: number | null;
		variantArt: number;
		variantWert: number;
		variantName: string | null;
	};

	type DocumentListItem = {
		id: number;
		code: string | null;
		docTypeId: number;
		title: string;
		publicationDate: number | null;
	};

	// --- URL param helpers ---
	/** Encode a group node key for URL: "id.variantArt.variantWert" */
	const encodeNodeKey = (node: GroupNode): string =>
		`${node.id}.${node.variantArt}.${node.variantWert}`;

	/** Decode a node key from URL. Returns {id, variantArt, variantWert} or null. */
	const decodeNodeKey = (
		raw: string | null,
	): { id: number; variantArt: number; variantWert: number } | null => {
		if (!raw) return null;
		const parts = raw.split('.');
		if (parts.length !== 3) return null;
		const [id, variantArt, variantWert] = parts.map(Number);
		if ([id, variantArt, variantWert].some(Number.isNaN)) return null;
		return { id, variantArt, variantWert };
	};

	/** Build a /browse URL with the given params, preserving existing params for unset keys. */
	const buildBrowseUrl = (params: {
		type?: number | null;
		group?: string | null;
		sub?: string | null;
	}): string => {
		const sp = new URLSearchParams();
		if (params.type != null) sp.set('type', String(params.type));
		if (params.group != null) sp.set('group', params.group);
		if (params.sub != null) sp.set('sub', params.sub);
		const qs = sp.toString();
		return resolve(`/browse${qs ? `?${qs}` : ''}` as `/${string}`);
	};

	// --- State ---
	let docTypes = $state<DocType[]>([]);
	let loadingDocTypes = $state(false);
	let docTypeError = $state('');

	let mainGroups = $state<GroupNode[]>([]);
	let loadingMainGroups = $state(false);
	let mainGroupsError = $state('');

	let subGroups = $state<GroupNode[]>([]);
	let loadingSubGroups = $state(false);
	let subGroupsError = $state('');

	let documents = $state<DocumentListItem[]>([]);
	let loadingDocuments = $state(false);
	let documentsError = $state('');

	// The actually-selected objects, resolved from URL params + loaded data
	let activeDocType = $state<DocType | null>(null);
	let selectedMainGroup = $state<GroupNode | null>(null);
	let selectedSubGroup = $state<GroupNode | null>(null);

	// --- Search state ---
	let mainGroupSearch = $state('');
	let subGroupSearch = $state('');
	let documentSearch = $state('');

	// --- Derived filtered lists ---
	let filteredMainGroups = $derived.by(() => {
		if (!mainGroupSearch.trim()) return mainGroups;
		const term = mainGroupSearch.trim().toLowerCase();
		return mainGroups.filter((node) => formatGroupNode(node).toLowerCase().includes(term));
	});

	let filteredSubGroups = $derived.by(() => {
		if (!subGroupSearch.trim()) return subGroups;
		const term = subGroupSearch.trim().toLowerCase();
		return subGroups.filter((node) => formatGroupNode(node).toLowerCase().includes(term));
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

	// --- Dynamic layout ---
	let showSubGroups = $derived(subGroups.length > 0 || loadingSubGroups);

	let gridClass = $derived(
		showSubGroups
			? 'grid gap-4 lg:grid-cols-[260px_260px_minmax(0,1fr)]'
			: 'grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]',
	);

	// --- Helpers ---
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

	/** Format a group node for display: "11 Engine (M54)" or "11 Engine" */
	const formatGroupNode = (node: GroupNode): string => {
		const label = [node.code, node.name].filter(Boolean).join(' ');
		if (node.variantName && node.variantName.trim()) {
			return `${label} (${node.variantName.trim()})`;
		}
		return label;
	};

	const nodeKey = (n: GroupNode) => `${n.id}:${n.variantArt}:${n.variantWert}`;

	const nodeMatchesKey = (
		node: GroupNode,
		key: { id: number; variantArt: number; variantWert: number },
	) => node.id === key.id && node.variantArt === key.variantArt && node.variantWert === key.variantWert;

	const isSelectedMain = (n: GroupNode) =>
		selectedMainGroup !== null && nodeMatchesKey(n, selectedMainGroup);
	const isSelectedSub = (n: GroupNode) =>
		selectedSubGroup !== null && nodeMatchesKey(n, selectedSubGroup);

	// --- Navigation: push URL state ---
	const navigateDocType = (docType: DocType) => {
		goto(buildBrowseUrl({ type: docType.id }));
	};

	const navigateMainGroup = (node: GroupNode) => {
		if (!activeDocType) return;
		goto(buildBrowseUrl({ type: activeDocType.id, group: encodeNodeKey(node) }));
	};

	const navigateSubGroup = (node: GroupNode) => {
		if (!activeDocType || !selectedMainGroup) return;
		goto(
			buildBrowseUrl({
				type: activeDocType.id,
				group: encodeNodeKey(selectedMainGroup),
				sub: encodeNodeKey(node),
			}),
		);
	};

	const openDocument = (doc: DocumentListItem) => {
		goto(resolve(`/doc/${doc.id}` as `/${string}`));
	};

	// --- Data loading functions (no URL side effects, pure data fetch) ---
	const fetchDocTypes = async (): Promise<DocType[]> => {
		loadingDocTypes = true;
		docTypeError = '';
		try {
			const result = await fetchJson<DocType[]>('/api/doctypes');
			docTypes = result;
			return result;
		} catch {
			docTypeError = 'Failed to load document types';
			docTypes = [];
			return [];
		} finally {
			loadingDocTypes = false;
		}
	};

	const fetchMainGroups = async (docTypeId: number): Promise<GroupNode[]> => {
		loadingMainGroups = true;
		mainGroupsError = '';
		mainGroupSearch = '';
		try {
			const result = await fetchJson<GroupNode[]>(`/api/groups/${docTypeId}${vehicleQuery()}`);
			mainGroups = result;
			return result;
		} catch {
			mainGroupsError = 'Failed to load groups';
			mainGroups = [];
			return [];
		} finally {
			loadingMainGroups = false;
		}
	};

	const fetchSubGroupsAndDocs = async (
		docTypeId: number,
		nodeId: number,
	): Promise<{ subs: GroupNode[]; docs: DocumentListItem[] }> => {
		loadingSubGroups = true;
		subGroupsError = '';
		subGroupSearch = '';
		loadingDocuments = true;
		documentsError = '';
		documentSearch = '';

		const [subResult, docResult] = await Promise.allSettled([
			fetchJson<GroupNode[]>(`/api/groups/${docTypeId}/${nodeId}${vehicleQuery()}`),
			fetchJson<DocumentListItem[]>(`/api/documents/${docTypeId}/${nodeId}${vehicleQuery()}`),
		]);

		let subs: GroupNode[] = [];
		if (subResult.status === 'fulfilled') {
			subGroups = subResult.value;
			subs = subResult.value;
		} else {
			subGroupsError = 'Failed to load sub-groups';
			subGroups = [];
		}
		loadingSubGroups = false;

		let docs: DocumentListItem[] = [];
		if (docResult.status === 'fulfilled') {
			documents = docResult.value;
			docs = docResult.value;
		} else {
			documentsError = 'Failed to load documents';
			documents = [];
		}
		loadingDocuments = false;

		return { subs, docs };
	};

	const fetchDocumentsForNode = async (docTypeId: number, nodeId: number) => {
		loadingDocuments = true;
		documentsError = '';
		documentSearch = '';
		try {
			documents = await fetchJson<DocumentListItem[]>(
				`/api/documents/${docTypeId}/${nodeId}${vehicleQuery()}`,
			);
		} catch {
			documentsError = 'Failed to load documents';
			documents = [];
		} finally {
			loadingDocuments = false;
		}
	};

	const fetchFlatDocuments = async (docTypeId: number) => {
		loadingDocuments = true;
		documentsError = '';
		documentSearch = '';
		try {
			documents = await fetchJson<DocumentListItem[]>(
				`/api/documents/${docTypeId}${vehicleQuery()}`,
			);
		} catch {
			documentsError = 'Failed to load documents';
			documents = [];
		} finally {
			loadingDocuments = false;
		}
	};

	// --- Reconcile UI state from URL params ---
	// This is the core logic: read URL, compare with current state, fetch what's needed.
	// Runs on every URL change (including popstate / back-forward).
	let lastReconcileKey = '';
	let lastVehicleKey = '';

	async function reconcile(urlTypeId: number | null, urlGroupKey: string | null, urlSubKey: string | null, vehicleKey: string) {
		const vehicleChanged = vehicleKey !== lastVehicleKey;
		lastVehicleKey = vehicleKey;

		const reconcileKey = `${urlTypeId}|${urlGroupKey}|${urlSubKey}|${vehicleKey}`;
		if (reconcileKey === lastReconcileKey) return;
		lastReconcileKey = reconcileKey;

		// 1. Ensure doc types are loaded
		let types = docTypes;
		if (types.length === 0) {
			types = await fetchDocTypes();
			if (types.length === 0) return;
		}

		// 2. Resolve doc type from URL (or default to first)
		const targetTypeId = urlTypeId ?? types[0]?.id ?? null;
		if (targetTypeId === null) return;

		const targetDocType = types.find((dt) => dt.id === targetTypeId) ?? null;
		if (!targetDocType) return;

		const docTypeChanged = activeDocType?.id !== targetDocType.id;
		activeDocType = targetDocType;

		// 3. ISB (methode 5): flat doc list, no groups
		if (targetDocType.methode === 5) {
			if (docTypeChanged || vehicleChanged) {
				mainGroups = [];
				selectedMainGroup = null;
				subGroups = [];
				selectedSubGroup = null;
				await fetchFlatDocuments(targetDocType.id);
			}
			return;
		}

		// 4. Load main groups if doc type changed or vehicle changed or not loaded
		if (docTypeChanged || vehicleChanged || mainGroups.length === 0) {
			subGroups = [];
			selectedSubGroup = null;
			documents = [];
			selectedMainGroup = null;
			const groups = await fetchMainGroups(targetDocType.id);

			// If no group in URL, stop here — just showing main groups
			if (!urlGroupKey) {
				selectedMainGroup = null;
				subGroups = [];
				selectedSubGroup = null;
				documents = [];
				return;
			}

			// 5. Resolve the main group from the URL key
			const groupParsed = decodeNodeKey(urlGroupKey);
			if (!groupParsed) return;

			const matchedGroup = groups.find((n) => nodeMatchesKey(n, groupParsed)) ?? null;
			if (!matchedGroup) {
				// Group from URL not found in loaded data — maybe vehicle changed and it's gone
				selectedMainGroup = null;
				subGroups = [];
				selectedSubGroup = null;
				documents = [];
				return;
			}

			selectedMainGroup = matchedGroup;

			// 6. Load sub-groups + docs for this main group
			const { subs } = await fetchSubGroupsAndDocs(targetDocType.id, matchedGroup.id);

			// 7. If sub group in URL, resolve and load its docs
			if (urlSubKey) {
				const subParsed = decodeNodeKey(urlSubKey);
				if (subParsed) {
					const matchedSub = subs.find((n) => nodeMatchesKey(n, subParsed)) ?? null;
					if (matchedSub) {
						selectedSubGroup = matchedSub;
						await fetchDocumentsForNode(targetDocType.id, matchedSub.id);
					} else {
						selectedSubGroup = null;
					}
				}
			} else {
				selectedSubGroup = null;
			}
			return;
		}

		// Doc type and vehicle didn't change — check if group selection changed
		const groupParsed = decodeNodeKey(urlGroupKey);
		const currentGroupKey = selectedMainGroup ? encodeNodeKey(selectedMainGroup) : null;

		if (urlGroupKey !== currentGroupKey) {
			// Main group changed
			subGroups = [];
			selectedSubGroup = null;
			documents = [];
			subGroupSearch = '';
			documentSearch = '';

			if (!groupParsed) {
				selectedMainGroup = null;
				return;
			}

			const matchedGroup = mainGroups.find((n) => nodeMatchesKey(n, groupParsed)) ?? null;
			if (!matchedGroup) {
				selectedMainGroup = null;
				return;
			}

			selectedMainGroup = matchedGroup;
			const { subs } = await fetchSubGroupsAndDocs(targetDocType.id, matchedGroup.id);

			if (urlSubKey) {
				const subParsed = decodeNodeKey(urlSubKey);
				if (subParsed) {
					const matchedSub = subs.find((n) => nodeMatchesKey(n, subParsed)) ?? null;
					if (matchedSub) {
						selectedSubGroup = matchedSub;
						await fetchDocumentsForNode(targetDocType.id, matchedSub.id);
					}
				}
			}
			return;
		}

		// Main group didn't change — check sub group
		const subParsed = decodeNodeKey(urlSubKey);
		const currentSubKey = selectedSubGroup ? encodeNodeKey(selectedSubGroup) : null;

		if (urlSubKey !== currentSubKey) {
			documentSearch = '';
			if (!subParsed) {
				selectedSubGroup = null;
				// Reload docs for main group
				if (selectedMainGroup) {
					await fetchDocumentsForNode(targetDocType.id, selectedMainGroup.id);
				}
				return;
			}

			const matchedSub = subGroups.find((n) => nodeMatchesKey(n, subParsed)) ?? null;
			if (matchedSub) {
				selectedSubGroup = matchedSub;
				await fetchDocumentsForNode(targetDocType.id, matchedSub.id);
			} else {
				selectedSubGroup = null;
			}
		}
	}

	// --- Effect: react to URL + vehicle changes ---
	$effect(() => {
		if (!browser) return;

		const sp = $page.url.searchParams;
		const urlTypeRaw = sp.get('type');
		const urlTypeId = urlTypeRaw ? Number(urlTypeRaw) : null;
		const urlGroupKey = sp.get('group');
		const urlSubKey = sp.get('sub');

		const vk = `${$vehicle.seriesId}:${$vehicle.modelId}:${$vehicle.engineId}:${$vehicle.bodyIds}:${$vehicle.gearboxIds}`;

		reconcile(
			urlTypeId != null && !Number.isNaN(urlTypeId) ? urlTypeId : null,
			urlGroupKey,
			urlSubKey,
			vk,
		);
	});
</script>

<section class="space-y-6">
	<header class="space-y-4">
		<div>
			<p class="text-xs tracking-[0.4em] text-slate-500 uppercase dark:text-slate-400">
				Browse documents
			</p>
			<h1 class="text-3xl font-semibold">Document browser</h1>
			{#if $hasVehicle}
				<p class="text-sm text-slate-600 dark:text-slate-300">
					Viewing documents for {$vehicleSummary}
				</p>
			{:else}
				<p class="text-sm text-slate-500 dark:text-slate-400">
					No vehicle selected. Use the vehicle selector in the header to refine results.
				</p>
			{/if}
		</div>

		<!-- Doc type tabs -->
		<div class="flex flex-wrap gap-2">
			{#if loadingDocTypes}
				<span
					class="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400"
				>
					Loading document types...
				</span>
			{:else if docTypeError}
				<span
					class="rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-xs text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
				>
					{docTypeError}
				</span>
			{:else}
				{#each docTypes as docType (docType.id)}
					<button
						type="button"
						class={`rounded-full border px-4 py-2 text-sm font-medium transition ${
							activeDocType?.id === docType.id
								? 'border-sky-400 bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-100'
								: 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:border-slate-600'
						}`}
						onclick={() => navigateDocType(docType)}
					>
						<span class="mr-2 text-xs tracking-[0.3em] text-slate-500 uppercase dark:text-slate-400"
							>{docType.code}</span
						>
						{docType.name}
					</button>
				{/each}
			{/if}
		</div>
	</header>

	<!-- Vehicle required notice for ISB -->
	{#if activeDocType?.fzgRequ === 1 && !$hasVehicle}
		<p
			class="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
		>
			This document type requires a vehicle selection. Use the vehicle selector in the header to choose a vehicle.
		</p>
	{:else if activeDocType?.methode === 5}
		<!-- ISB: flat document list only -->
		<div>
			{@render documentPanel()}
		</div>
	{:else}
		<!-- Cascading list layout: Main Group | (Sub Group) | Documents -->
		<div class={gridClass}>
			<!-- Main Groups column -->
			<div
				class="flex max-h-[70vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950/60"
			>
				<div class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
					<h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
						{activeDocType?.mainGroupLabel ?? 'Main groups'}
					</h2>
					{#if mainGroups.length > 0}
						<span class="text-xs text-slate-400">{mainGroups.length}</span>
					{/if}
				</div>
				{@render searchBox(mainGroupSearch, (v) => (mainGroupSearch = v), 'Filter groups...')}
				<div class="flex-1 overflow-auto">
					{#if loadingMainGroups}
						<p class="p-4 text-sm text-slate-500 dark:text-slate-400">Loading...</p>
					{:else if mainGroupsError}
						<p class="p-4 text-sm text-rose-600 dark:text-rose-300">{mainGroupsError}</p>
					{:else if mainGroups.length === 0}
						<p class="p-4 text-sm text-slate-500">No groups available.</p>
					{:else if filteredMainGroups.length === 0}
						<p class="p-4 text-sm text-slate-400">No matching groups.</p>
					{:else}
						<ul class="divide-y divide-slate-100 dark:divide-slate-800/50">
							{#each filteredMainGroups as node (nodeKey(node))}
								<li>
									<button
										type="button"
										class={`w-full px-4 py-2.5 text-left text-sm transition ${
											isSelectedMain(node)
												? 'bg-sky-50 font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-200'
												: 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
										}`}
										onclick={() => navigateMainGroup(node)}
									>
										{formatGroupNode(node)}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>

			<!-- Sub Groups column (conditionally rendered) -->
			{#if showSubGroups}
				<div
					class="flex max-h-[70vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950/60"
				>
					<div class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
						<h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
							{activeDocType?.subGroupLabel?.trim() || 'Sub groups'}
						</h2>
						{#if subGroups.length > 0}
							<span class="text-xs text-slate-400">{subGroups.length}</span>
						{/if}
					</div>
					{@render searchBox(subGroupSearch, (v) => (subGroupSearch = v), 'Filter sub-groups...')}
					<div class="flex-1 overflow-auto">
						{#if loadingSubGroups}
							<p class="p-4 text-sm text-slate-500 dark:text-slate-400">Loading...</p>
						{:else if subGroupsError}
							<p class="p-4 text-sm text-rose-600 dark:text-rose-300">{subGroupsError}</p>
						{:else if filteredSubGroups.length === 0}
							<p class="p-4 text-sm text-slate-400">No matching sub-groups.</p>
						{:else}
							<ul class="divide-y divide-slate-100 dark:divide-slate-800/50">
								{#each filteredSubGroups as node (nodeKey(node))}
									<li>
										<button
											type="button"
											class={`w-full px-4 py-2.5 text-left text-sm transition ${
												isSelectedSub(node)
													? 'bg-sky-50 font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-200'
													: 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
											}`}
											onclick={() => navigateSubGroup(node)}
										>
											{formatGroupNode(node)}
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Documents column -->
			<div class="min-w-0">
				{@render documentPanel()}
			</div>
		</div>
	{/if}
</section>

{#snippet searchBox(value: string, onchange: (v: string) => void, placeholder: string)}
	<div class="relative border-b border-slate-200 dark:border-slate-800">
		<input
			type="text"
			{placeholder}
			value={value}
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
					{#if activeDocType?.methode === 5}
						{#if $hasVehicle}
							No documents found for the selected vehicle.
						{:else}
							Select a vehicle to view inspection sheets.
						{/if}
					{:else if !selectedMainGroup}
						Select a group to see documents.
					{:else}
						No documents in this group.
					{/if}
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
								</p>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/snippet}
