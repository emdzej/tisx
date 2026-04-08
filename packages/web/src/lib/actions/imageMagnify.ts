/**
 * Svelte action: attaches a magnifying-glass lens to all .tis-inline-image
 * elements inside a container. The lens follows the cursor and shows a 5x
 * zoomed region of the hovered image.
 *
 * Also intercepts clicks on images and calls `onclick` with the image src.
 *
 * Usage:
 *   <article use:imageMagnify={{ onclick: (src) => lightboxSrc = src }}>
 */

export interface MagnifyOptions {
	/** Called when an image is clicked — receives the image src */
	onclick: (src: string) => void;
	/** Zoom factor (default 5) */
	zoom?: number;
	/** Lens diameter in pixels (default 180) */
	lensSize?: number;
}

export function imageMagnify(
	node: HTMLElement,
	options: MagnifyOptions,
): { update: (opts: MagnifyOptions) => void; destroy: () => void } {
	let opts = options;
	const zoom = () => opts.zoom ?? 5;
	const lensSize = () => opts.lensSize ?? 180;

	// Create the lens element
	const lens = document.createElement('div');
	lens.className = 'tis-magnifier-lens';
	Object.assign(lens.style, {
		position: 'fixed',
		pointerEvents: 'none',
		borderRadius: '50%',
		border: '3px solid rgba(255,255,255,0.8)',
		boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.1)',
		backgroundRepeat: 'no-repeat',
		display: 'none',
		zIndex: '55',
		transition: 'opacity 0.15s ease',
		opacity: '0',
	});
	document.body.appendChild(lens);

	let activeImg: HTMLImageElement | null = null;

	function showLens(img: HTMLImageElement, clientX: number, clientY: number) {
		const size = lensSize();
		const z = zoom();
		const rect = img.getBoundingClientRect();

		// Position relative to image
		const relX = clientX - rect.left;
		const relY = clientY - rect.top;

		// Background size = image dimensions * zoom
		const bgW = rect.width * z;
		const bgH = rect.height * z;

		// Background position centers the zoomed region under the lens
		const bgX = -(relX * z - size / 2);
		const bgY = -(relY * z - size / 2);

		Object.assign(lens.style, {
			width: `${size}px`,
			height: `${size}px`,
			left: `${clientX - size / 2}px`,
			top: `${clientY - size / 2}px`,
			backgroundImage: `url('${img.src}')`,
			backgroundSize: `${bgW}px ${bgH}px`,
			backgroundPosition: `${bgX}px ${bgY}px`,
			display: 'block',
			opacity: '1',
		});
	}

	function hideLens() {
		lens.style.opacity = '0';
		// After fade, hide fully
		setTimeout(() => {
			if (lens.style.opacity === '0') {
				lens.style.display = 'none';
			}
		}, 150);
		activeImg = null;
	}

	function handleMouseMove(e: MouseEvent) {
		// Only show magnifier when Alt/Option is held
		if (!e.altKey) {
			if (activeImg) hideLens();
			return;
		}

		const target = e.target as HTMLElement;
		const img = target.closest('.tis-inline-image') as HTMLImageElement | null;

		if (img) {
			activeImg = img;
			showLens(img, e.clientX, e.clientY);
		} else if (activeImg) {
			hideLens();
		}
	}

	function handleKeyUp(e: KeyboardEvent) {
		// Hide lens when Alt/Option is released
		if (e.key === 'Alt' && activeImg) {
			hideLens();
		}
	}

	function handleMouseLeave() {
		if (activeImg) hideLens();
	}

	function handleClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		const img = target.closest('.tis-inline-image') as HTMLImageElement | null;
		if (img) {
			e.preventDefault();
			e.stopPropagation();
			hideLens();
			opts.onclick(img.src);
		}
	}

	node.addEventListener('mousemove', handleMouseMove);
	node.addEventListener('mouseleave', handleMouseLeave);
	node.addEventListener('click', handleClick, true); // capture phase
	window.addEventListener('keyup', handleKeyUp);

	// Add cursor style to images
	const style = document.createElement('style');
	style.textContent = `.tis-inline-image { cursor: zoom-in !important; }`;
	node.appendChild(style);

	return {
		update(newOpts: MagnifyOptions) {
			opts = newOpts;
		},
		destroy() {
			node.removeEventListener('mousemove', handleMouseMove);
			node.removeEventListener('mouseleave', handleMouseLeave);
			node.removeEventListener('click', handleClick, true);
			window.removeEventListener('keyup', handleKeyUp);
			lens.remove();
			style.remove();
		},
	};
}
