<script lang="ts">
	import Self from './SymptomTree.svelte';

	type SymptomNode = {
		id: number;
		code: string | null;
		name: string | null;
		parentId: number;
		hasChildren: boolean;
	};

	let {
		nodes = [],
		depth = 0,
		expandedNodes = new Set<number>(),
		loadingMap = {},
		childrenMap = {},
		selectedNodeId = null,
		onToggle,
		onSelect,
	}: {
		nodes: SymptomNode[];
		depth?: number;
		expandedNodes: Set<number>;
		loadingMap: Record<number, boolean>;
		childrenMap: Record<number, SymptomNode[]>;
		selectedNodeId: number | null;
		onToggle: (node: SymptomNode) => void;
		onSelect: (node: SymptomNode) => void;
	} = $props();

	const isExpanded = (node: SymptomNode) => expandedNodes.has(node.id);
</script>

<ul class="space-y-1">
	{#each nodes as node (node.id)}
		<li class="space-y-1">
			<div class="flex items-center gap-2" style={`padding-left: ${depth * 0.75}rem`}>
				{#if node.hasChildren}
					<button
						type="button"
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-xs text-slate-600 transition hover:border-sky-400 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:border-sky-500/60"
						onclick={() => onToggle(node)}
						aria-label={isExpanded(node) ? 'Collapse' : 'Expand'}
					>
						{#if loadingMap[node.id]}
							<span class="animate-pulse">...</span>
						{:else}
							<span class={`transition ${isExpanded(node) ? 'rotate-90' : ''}`}>&#9656;</span>
						{/if}
					</button>
				{:else}
					<span class="h-7 w-7 shrink-0"></span>
				{/if}
				<button
					type="button"
					class={`flex-1 rounded-md px-2 py-1 text-left text-sm transition ${
						selectedNodeId === node.id
							? 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-100'
							: 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/80'
					}`}
					onclick={() => onSelect(node)}
				>
					<div class="font-medium">{node.name ?? 'Untitled'}</div>
				</button>
			</div>

			{#if node.hasChildren && isExpanded(node)}
				{#if loadingMap[node.id]}
					<p class="ml-8 text-xs text-slate-500">Loading...</p>
				{:else if childrenMap[node.id]?.length}
					<Self
						nodes={childrenMap[node.id]}
						depth={depth + 1}
						{expandedNodes}
						{loadingMap}
						{childrenMap}
						{selectedNodeId}
						{onToggle}
						{onSelect}
					/>
				{:else}
					<p class="ml-8 text-xs text-slate-500">No sub-items</p>
				{/if}
			{/if}
		</li>
	{/each}
</ul>
