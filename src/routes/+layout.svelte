<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { initMatomo, trackPageView } from '$lib/matomo';

	let { children } = $props();

	// Initialize Matomo on first mount
	onMount(() => {
		initMatomo();
	});

	// Track page views on SPA navigation
	afterNavigate(() => {
		trackPageView();
	});
</script>

{@render children()}
