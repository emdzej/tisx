<script lang="ts">
	import type { PageProps } from './$types';

	const { params } = $props<PageProps>();
	const { id } = params;
</script>

<section class="space-y-4">
	<div class="space-y-2">
		<p class="text-sm uppercase tracking-[0.3em] text-slate-400">Document</p>
		<h1 class="text-3xl font-semibold">Doc: {id}</h1>
	</div>
	<div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
		<p class="text-slate-300">
			This is a placeholder for document <span class="font-semibold text-white">{id}</span>. Add data
			loading in a +page.ts when ready.
		</p>
	</div>
</section>
