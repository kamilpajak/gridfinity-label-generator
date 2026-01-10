<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { initMatomo, trackPageView } from '$lib/matomo';
	import PrivacyPolicyModal from '$lib/components/legal/privacy-policy-modal.svelte';

	let { children } = $props();

	let privacyModalOpen = $state(false);

	// Initialize Matomo on first mount
	onMount(() => {
		initMatomo();
	});

	// Track page views on SPA navigation
	afterNavigate(() => {
		trackPageView();
	});
</script>

<div class="flex min-h-screen flex-col">
	<div class="flex-1">
		{@render children()}
	</div>

	<!-- Footer -->
	<footer class="border-t border-slate-200 bg-white py-6">
		<div
			class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row"
		>
			<p class="text-sm text-slate-400">
				Made with <span class="text-red-400">&hearts;</span> for the Gridfinity community
			</p>
			<button
				onclick={() => (privacyModalOpen = true)}
				class="text-sm text-slate-400 transition-colors hover:text-slate-600"
			>
				Privacy Policy
			</button>
		</div>
	</footer>
</div>

<PrivacyPolicyModal bind:open={privacyModalOpen} onClose={() => (privacyModalOpen = false)} />
