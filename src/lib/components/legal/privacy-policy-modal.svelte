<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import Database from '@lucide/svelte/icons/database';
	import Shield from '@lucide/svelte/icons/shield';
	import Cookie from '@lucide/svelte/icons/cookie';
	import Link from '@lucide/svelte/icons/link';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import Lock from '@lucide/svelte/icons/lock';
	import Mail from '@lucide/svelte/icons/mail';
	import Info from '@lucide/svelte/icons/info';
	import { AFFILIATE_DISCLOSURE } from '$lib/data/affiliate-products';
	import { createEscapeHandler, createBackdropClickHandler } from '$lib/utils/modal-utils';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open = $bindable(), onClose }: Props = $props();

	const handleKeydown = createEscapeHandler(onClose);
	const handleBackdropClick = createBackdropClickHandler(onClose);
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
		onclick={handleBackdropClick}
	>
		<!-- Modal -->
		<div
			class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="privacy-modal-title"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-8 py-6"
			>
				<div>
					<h2 id="privacy-modal-title" class="text-2xl font-bold text-slate-800">Privacy Policy</h2>
					<p class="mt-1 text-sm text-slate-500">Last updated: January 2026</p>
				</div>
				<button
					onclick={onClose}
					class="text-slate-400 transition-colors hover:text-slate-600"
					aria-label="Close privacy policy"
				>
					<X class="h-6 w-6" />
				</button>
			</div>

			<!-- Content -->
			<div class="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-8 py-6">
				<!-- Introduction -->
				<div class="space-y-3">
					<p class="leading-relaxed text-slate-600">
						Welcome to Gridfinity Label Generator. We respect your privacy and are committed to
						protecting your personal data. This privacy policy explains how we handle your
						information when you use our label generation service.
					</p>
				</div>

				<!-- Section 1 -->
				<div class="space-y-3">
					<h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
						<Database class="h-4 w-4 text-blue-500" />
						1. Information We Collect
					</h3>
					<p class="text-sm leading-relaxed text-slate-600">
						Our service processes label data locally in your browser. We collect minimal
						information:
					</p>
					<ul class="ml-4 list-inside list-disc space-y-2 text-sm text-slate-600">
						<li>
							<strong>Analytics (Matomo, self-hosted):</strong> Page views, feature usage, anonymized
							IP (2-3 bytes masked)
						</li>
						<li>
							<strong>Technical data:</strong> Browser type, device information (no cookies used)
						</li>
						<li>
							<strong>Do Not Track:</strong> We respect the DNT browser setting
						</li>
					</ul>
				</div>

				<!-- Section 2 -->
				<div class="space-y-3">
					<h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
						<Shield class="h-4 w-4 text-emerald-500" />
						2. How We Use Your Information
					</h3>
					<p class="text-sm leading-relaxed text-slate-600">
						Your label data is processed entirely in your browser and never sent to our servers. We
						use collected information to:
					</p>
					<ul class="ml-4 list-inside list-disc space-y-2 text-sm text-slate-600">
						<li>Understand how features are used and improve the service</li>
						<li>Fix technical issues and bugs</li>
						<li>Measure affiliate link performance (aggregated only)</li>
					</ul>
				</div>

				<!-- Section 3 -->
				<div class="space-y-3">
					<h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
						<Cookie class="h-4 w-4 text-amber-500" />
						3. Cookies and Local Storage
					</h3>
					<p class="text-sm leading-relaxed text-slate-600">
						<strong>We do not use cookies for analytics or tracking.</strong> Your label preferences
						may be saved in browser local storage, which remains on your device and can be cleared at
						any time through your browser settings.
					</p>
				</div>

				<!-- Section 4 -->
				<div class="space-y-3">
					<h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
						<Link class="h-4 w-4 text-purple-500" />
						4. Affiliate Links (Amazon Associates)
					</h3>
					<p class="text-sm leading-relaxed text-slate-600">
						We participate in the Amazon Services LLC Associates Program. When you click Amazon
						links on our site:
					</p>
					<ul class="ml-4 list-inside list-disc space-y-2 text-sm text-slate-600">
						<li>You leave our website and visit Amazon</li>
						<li>Amazon may collect data and set cookies according to their privacy policy</li>
						<li>We may earn a commission from qualifying purchases at no extra cost to you</li>
					</ul>
					<div class="rounded-lg border border-amber-200 bg-amber-50 p-4">
						<p class="text-sm text-amber-800">
							<Info class="mr-1 inline h-4 w-4" />
							{AFFILIATE_DISCLOSURE}
						</p>
					</div>
				</div>

				<!-- Section 5 -->
				<div class="space-y-3">
					<h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
						<UserCheck class="h-4 w-4 text-indigo-500" />
						5. Your Rights (GDPR)
					</h3>
					<p class="text-sm leading-relaxed text-slate-600">You have the right to:</p>
					<ul class="ml-4 list-inside list-disc space-y-2 text-sm text-slate-600">
						<li>Access information we hold about you</li>
						<li>Request correction or deletion of your data</li>
						<li>Object to processing based on legitimate interests</li>
						<li>Lodge a complaint with a supervisory authority</li>
					</ul>
					<p class="text-sm leading-relaxed text-slate-600">
						Note: Because we use anonymized, cookieless analytics, we may not be able to identify
						your specific data in our systems.
					</p>
				</div>

				<!-- Section 6 -->
				<div class="space-y-3">
					<h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
						<Lock class="h-4 w-4 text-red-500" />
						6. Data Security
					</h3>
					<p class="text-sm leading-relaxed text-slate-600">
						Your label data is processed locally and never leaves your device. Analytics data is
						stored on self-hosted servers in the EU with restricted access. All connections use
						HTTPS encryption.
					</p>
				</div>

				<!-- Section 7 -->
				<div class="space-y-3">
					<h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
						<Mail class="h-4 w-4 text-blue-500" />
						7. Contact Us
					</h3>
					<p class="text-sm leading-relaxed text-slate-600">
						If you have questions about this privacy policy or our data practices, please contact us
						via email:
					</p>
					<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
						<p class="text-sm text-slate-700">
							<strong>Email:</strong>
							<a href="mailto:hello@gridfinitylabels.com" class="text-blue-600 hover:underline">
								hello@gridfinitylabels.com
							</a>
						</p>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-8 py-4"
			>
				<p class="text-xs text-slate-500">
					<Info class="mr-1 inline h-3 w-3" />
					We may update this policy from time to time
				</p>
				<button
					onclick={onClose}
					class="rounded-lg bg-blue-500 px-6 py-2 text-sm font-medium text-white transition-all hover:bg-blue-600"
				>
					Got it
				</button>
			</div>
		</div>
	</div>
{/if}
