import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

const getInitialTheme = (): Theme => {
	if (!browser) return 'dark';
	const stored = localStorage.getItem('tisx-theme');
	if (stored === 'light' || stored === 'dark') return stored;
	return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

export const theme = writable<Theme>(getInitialTheme());

theme.subscribe((value) => {
	if (!browser) return;
	localStorage.setItem('tisx-theme', value);
	document.documentElement.classList.toggle('dark', value === 'dark');
});

export const toggleTheme = () => {
	theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
};
