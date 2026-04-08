<script lang="ts">
	/**
	 * ImageViewer — lightbox popup + magnifying glass for TIS document images.
	 *
	 * Usage: Bind `src` to open the lightbox. Set to `null` to close.
	 * The magnifying glass is handled separately via the `magnify` action
	 * exported from this module.
	 */

	type Props = {
		/** Image src for the lightbox. Null = closed. */
		src: string | null;
		/** Called when the lightbox requests close */
		onclose: () => void;
	};

	const { src, onclose }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<!-- Lightbox overlay -->
{#if src}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
		onclick={onclose}
		onkeydown={handleKeydown}
	>
		<button
			type="button"
			class="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
			onclick={onclose}
			aria-label="Close image viewer"
		>
			<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<img
			{src}
			alt="Zoomed technical illustration"
			class="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		/>
	</div>
{/if}
