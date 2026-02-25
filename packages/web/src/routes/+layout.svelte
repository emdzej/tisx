<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-100">
	<header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
		<nav class="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-6 py-4">
			<a href="/" class="text-lg font-semibold tracking-wide">TISX</a>
			<div class="flex items-center gap-4 text-sm">
				<a class="text-slate-300 hover:text-white" href="/browse">Browse</a>
				<a class="text-slate-300 hover:text-white" href="/doc/example">Docs</a>
			</div>
		</nav>
	</header>

	<main class="mx-auto w-full max-w-5xl px-6 py-10">{@render children()}</main>
</div>
