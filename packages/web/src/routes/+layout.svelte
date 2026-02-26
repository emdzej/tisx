<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { theme, toggleTheme } from '$lib/stores/theme';
	import { browser } from '$app/environment';

	let { children } = $props();

	// Apply theme class on mount
	$effect(() => {
		if (browser) {
			document.documentElement.classList.toggle('dark', $theme === 'dark');
		}
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
	<header
		class="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80"
	>
		<nav class="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-6 py-4">
			<a href={resolve('/')} class="text-lg font-semibold tracking-wide">TISX</a>
			<div class="flex items-center gap-4 text-sm">
				<a
					class="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
					href={resolve('/browse')}>Browse</a
				>
				<a
					class="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
					href={resolve('/doc/example')}>Docs</a
				>
				<button
					onclick={toggleTheme}
					class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
					title={$theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
				>
					{#if $theme === 'dark'}
						<svg
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
							/>
						</svg>
					{:else}
						<svg
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
							/>
						</svg>
					{/if}
				</button>
			</div>
		</nav>
	</header>

	<main class="mx-auto w-full max-w-5xl px-6 py-10">{@render children()}</main>
</div>
