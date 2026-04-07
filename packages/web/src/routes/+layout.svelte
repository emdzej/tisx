<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { theme, toggleTheme } from '$lib/stores/theme';
	import { browser } from '$app/environment';
	import VehicleSelector from '$lib/components/VehicleSelector.svelte';
	import FavouritesDropdown from '$lib/components/FavouritesDropdown.svelte';
	import SettingsOverlay from '$lib/components/SettingsOverlay.svelte';

	let { children } = $props();

	let settingsOpen = $state(false);

	/** Which nav link is active based on current route */
	let activeNav = $derived.by(() => {
		const path = $page.url.pathname;
		if (path.startsWith('/symptoms')) return 'symptoms';
		// /browse and /doc/* both fall under "documents"
		return 'documents';
	});

	const navLinkClass = (active: boolean) =>
		active
			? 'font-medium text-sky-700 dark:text-sky-300'
			: 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white';

	$effect(() => {
		if (browser) {
			document.documentElement.classList.toggle('dark', $theme === 'dark');
		}
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
	<header
		class="sticky top-0 z-50 shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80"
	>
		<nav class="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-3">
			<div class="flex items-center gap-6">
				<a href={resolve('/')} class="text-lg font-semibold tracking-wide">TISX</a>
				<div class="flex items-center gap-4 text-sm">
					<a
						class={navLinkClass(activeNav === 'documents')}
						aria-current={activeNav === 'documents' ? 'page' : undefined}
						href={resolve('/browse')}>Documents</a
					>
					<a
						class={navLinkClass(activeNav === 'symptoms')}
						aria-current={activeNav === 'symptoms' ? 'page' : undefined}
						href={resolve('/symptoms')}>Symptoms</a
					>
				</div>
			</div>

			<div class="flex items-center gap-1.5">
				<VehicleSelector />
				<FavouritesDropdown />
				<!-- Settings (gear icon) -->
				<button
					onclick={() => (settingsOpen = true)}
					class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
					title="Settings"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
				</button>
				<!-- Theme toggle -->
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

	<main class="mx-auto w-full max-w-7xl flex-1 overflow-y-auto px-6 py-10">{@render children()}</main>
</div>

<SettingsOverlay bind:open={settingsOpen} />
