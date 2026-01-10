<script lang="ts">
	/**
	 * Standard image component with SVG priority.
	 * Only tries SVG if it's in the AVAILABLE_SVGS list to avoid 404 attempts.
	 */

	import { AVAILABLE_SVGS } from '$lib/utils/label-renderer';

	interface Props {
		/** Original image path (typically .png) */
		src: string;
		/** Alt text for the image */
		alt: string;
		/** CSS class for styling */
		class?: string;
	}

	let { src, alt, class: className = '' }: Props = $props();

	// Check if SVG version is available (only try if in AVAILABLE_SVGS list)
	const svgSrc = $derived.by(() => {
		if (!src.startsWith('/images/standards/') || !src.endsWith('.png')) {
			return null;
		}
		const svgFilename = src.replace('/images/standards/', '').replace(/\.png$/, '.svg');
		if (!AVAILABLE_SVGS.has(svgFilename)) {
			return null;
		}
		return src.replace(/\.png$/, '.svg');
	});

	// Track which source to use and which src triggered the SVG attempt
	let useSvg = $state(true);
	let svgAttemptedFor = $state<string | null>(null);

	function handleSvgError() {
		// Only fall back if this error is for the current src (prevents race condition)
		if (svgAttemptedFor === src) {
			useSvg = false;
		}
	}

	// Reset to try SVG when src changes
	$effect.pre(() => {
		svgAttemptedFor = src;
		useSvg = true;
	});
</script>

{#if svgSrc && useSvg}
	<img src={svgSrc} {alt} class={className} onerror={handleSvgError} />
{:else}
	<img {src} {alt} class={className} />
{/if}
