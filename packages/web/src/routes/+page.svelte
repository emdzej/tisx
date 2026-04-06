<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';

	$effect(() => {
		if (browser) {
			goto(resolve('/browse'), { replaceState: true });
		}
	});
</script>

<section class="flex items-center justify-center py-20">
	<p class="text-sm text-slate-500 dark:text-slate-400">Redirecting to document browser...</p>
</section>
