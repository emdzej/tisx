<script lang="ts">
	const items = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
</script>

<section class="space-y-6">
	<div class="space-y-2">
		<h1 class="text-3xl font-semibold">Browse</h1>
		<p class="text-slate-300">Start with a small, static list while wiring data sources.</p>
	</div>

	<ul class="grid gap-3 sm:grid-cols-2">
		{#each items as item}
			<li class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
				<p class="font-medium">{item}</p>
				<p class="text-sm text-slate-400">Preview entry for {item.toLowerCase()}.</p>
			</li>
		{/each}
	</ul>
</section>
