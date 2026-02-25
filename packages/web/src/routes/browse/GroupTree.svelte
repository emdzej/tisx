<script lang="ts">
	export type GroupNode = {
		id: number;
		code: string | null;
		name: string | null;
		parentId: number | null;
	};

	export let nodes: GroupNode[] = [];
	export let depth = 0;
	export let expandedNodes: Set<number> = new Set();
	export let loadingMap: Record<number, boolean> = {};
	export let childrenMap: Record<number, GroupNode[]> = {};
	export let selectedNodeId: number | null = null;
	export let onToggle: (node: GroupNode) => void;
	export let onSelect: (node: GroupNode) => void;

	const hasChildren = (node: GroupNode) => Array.isArray(childrenMap[node.id]);
	const isExpanded = (node: GroupNode) => expandedNodes.has(node.id);
</script>

<ul class="space-y-1">
	{#each nodes as node (node.id)}
		<li class="space-y-1">
			<div class="flex items-center gap-2" style={`padding-left: ${depth * 0.75}rem`}>
				<button
					type="button"
					class="flex h-7 w-7 items-center justify-center rounded-md border border-slate-800 bg-slate-950/60 text-xs text-slate-300 transition hover:border-sky-500/60"
					on:click={() => onToggle(node)}
					aria-label={isExpanded(node) ? 'Collapse group' : 'Expand group'}
				>
					{#if loadingMap[node.id]}
						<span class="animate-pulse">…</span>
					{:else}
						<span class={`transition ${isExpanded(node) ? 'rotate-90' : ''}`}>▸</span>
					{/if}
				</button>
				<button
					type="button"
					class={`flex-1 rounded-md px-2 py-1 text-left text-sm transition ${
						selectedNodeId === node.id
							? 'bg-sky-500/20 text-sky-100'
							: 'text-slate-200 hover:bg-slate-800/80'
					}`}
					on:click={() => onSelect(node)}
				>
					<div class="font-medium">{node.name ?? 'Untitled group'}</div>
					{#if node.code}
						<div class="text-xs text-slate-400">{node.code}</div>
					{/if}
				</button>
			</div>

			{#if isExpanded(node)}
				{#if loadingMap[node.id]}
					<p class="ml-8 text-xs text-slate-500">Loading subgroups…</p>
				{:else if hasChildren(node) && childrenMap[node.id]?.length}
					<svelte:self
						nodes={childrenMap[node.id]}
						depth={depth + 1}
						expandedNodes={expandedNodes}
						loadingMap={loadingMap}
						childrenMap={childrenMap}
						selectedNodeId={selectedNodeId}
						onToggle={onToggle}
						onSelect={onSelect}
					/>
				{:else}
					<p class="ml-8 text-xs text-slate-500">No subgroups</p>
				{/if}
			{/if}
		</li>
	{/each}
</ul>
