<script lang="ts">
	import Database from '@lucide/svelte/icons/database';
	import Shield from '@lucide/svelte/icons/shield';
	import Cookie from '@lucide/svelte/icons/cookie';
	import Link from '@lucide/svelte/icons/link';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import Lock from '@lucide/svelte/icons/lock';
	import Mail from '@lucide/svelte/icons/mail';
	import Info from '@lucide/svelte/icons/info';
	import ModalWrapper from '$lib/components/shared/modal-wrapper.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open = $bindable(), onClose }: Props = $props();
</script>

<ModalWrapper
	bind:open
	{onClose}
	title="Privacy Policy"
	titleId="privacy-modal-title"
	maxWidth="2xl"
>
	{#snippet headerSubtitle()}
		<p class="text-xs font-medium text-slate-400">Last updated: January 2026</p>
	{/snippet}

	{#snippet content()}
		<div class="space-y-4">
			<!-- Introduction -->
			<p class="text-xs leading-relaxed text-slate-400">
				Welcome to Gridfinity Label Generator. We respect your privacy and are committed to
				protecting your personal data. This privacy policy explains how we handle your information
				when you use our label generation service.
			</p>

			<!-- Section 1 -->
			<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
				<h3 class="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-200">
					<Database class="h-3.5 w-3.5 text-slate-400" />
					1. Information We Collect
				</h3>
				<p class="text-xs leading-relaxed text-slate-400">
					Our service processes label data locally in your browser. We collect minimal information:
				</p>
				<ul class="mt-2 space-y-2">
					<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600"></span>
						<span>
							<strong class="font-medium text-slate-300">Analytics (Matomo, self-hosted):</strong>
							Page views, feature usage, anonymized IP (2-3 bytes masked)
						</span>
					</li>
					<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600"></span>
						<span>
							<strong class="font-medium text-slate-300">Technical data:</strong>
							Browser type, device information (no cookies used)
						</span>
					</li>
					<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600"></span>
						<span>
							<strong class="font-medium text-slate-300">Do Not Track:</strong>
							We respect the DNT browser setting
						</span>
					</li>
				</ul>
			</div>

			<!-- Section 2 -->
			<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
				<h3 class="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-200">
					<Shield class="h-3.5 w-3.5 text-slate-400" />
					2. How We Use Your Information
				</h3>
				<p class="text-xs leading-relaxed text-slate-400">
					Your label data is processed entirely in your browser and never sent to our servers. We
					use collected information to:
				</p>
				<ul class="mt-2 space-y-2">
					<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600"></span>
						<span>Understand how features are used and improve the service</span>
					</li>
					<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600"></span>
						<span>Fix technical issues and bugs</span>
					</li>
					<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600"></span>
						<span>Measure affiliate link performance (aggregated only)</span>
					</li>
				</ul>
			</div>

			<!-- Section 3 -->
			<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
				<h3 class="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-200">
					<Cookie class="h-3.5 w-3.5 text-slate-400" />
					3. Cookies and Local Storage
				</h3>
				<p class="text-xs leading-relaxed text-slate-400">
					<strong class="font-medium text-slate-300"
						>We do not use cookies for analytics or tracking.</strong
					> Your label preferences may be saved in browser local storage, which remains on your device
					and can be cleared at any time through your browser settings.
				</p>
			</div>

			<!-- Section 4 -->
			<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
				<h3 class="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-200">
					<Link class="h-3.5 w-3.5 text-slate-400" />
					4. Affiliate Links (Amazon Associates)
				</h3>
				<p class="text-xs leading-relaxed text-slate-400">
					We participate in the Amazon Services LLC Associates Program. When you click Amazon links
					on our site:
				</p>
				<ul class="mt-2 space-y-2">
					<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600"></span>
						<span>You leave our website and visit Amazon</span>
					</li>
					<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600"></span>
						<span>Amazon may collect data and set cookies according to their privacy policy</span>
					</li>
					<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600"></span>
						<span>We may earn a commission from qualifying purchases at no extra cost to you</span>
					</li>
				</ul>
				<div
					class="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3"
				>
					<Info class="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-400" />
					<p class="text-xs leading-relaxed text-amber-300">
						As an Amazon Associate, we earn from qualifying purchases at no extra cost to you.
					</p>
				</div>
			</div>

			<!-- Section 5 -->
			<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
				<h3 class="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-200">
					<UserCheck class="h-3.5 w-3.5 text-slate-400" />
					5. Your Rights (GDPR)
				</h3>
				<p class="text-xs leading-relaxed text-slate-400">You have the right to:</p>
				<ul class="mt-2 space-y-2">
					<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600"></span>
						<span>Access information we hold about you</span>
					</li>
					<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600"></span>
						<span>Request correction or deletion of your data</span>
					</li>
					<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600"></span>
						<span>Object to processing based on legitimate interests</span>
					</li>
					<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600"></span>
						<span>Lodge a complaint with a supervisory authority</span>
					</li>
				</ul>
				<p class="mt-2 text-xs leading-relaxed text-slate-400">
					Note: Because we use anonymized, cookieless analytics, we may not be able to identify your
					specific data in our systems.
				</p>
			</div>

			<!-- Section 6 -->
			<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
				<h3 class="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-200">
					<Lock class="h-3.5 w-3.5 text-slate-400" />
					6. Data Security
				</h3>
				<p class="text-xs leading-relaxed text-slate-400">
					Your label data is processed locally and never leaves your device. Analytics data is
					stored on self-hosted servers in the EU with restricted access. All connections use HTTPS
					encryption.
				</p>
			</div>

			<!-- Section 7 -->
			<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
				<h3 class="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-200">
					<Mail class="h-3.5 w-3.5 text-slate-400" />
					7. Contact Us
				</h3>
				<p class="text-xs leading-relaxed text-slate-400">
					If you have questions about this privacy policy or our data practices, please contact us
					via email:
				</p>
				<div class="mt-3 rounded-lg border border-slate-800/50 bg-slate-900/50 p-3">
					<p class="text-xs text-slate-400">
						<strong class="font-medium text-slate-300">Email:</strong>
						<a href="mailto:hello@gridfinitylabels.com" class="text-cyan-400 hover:underline">
							hello@gridfinitylabels.com
						</a>
					</p>
				</div>
			</div>

			<p class="flex items-center gap-1.5 text-[10px] text-slate-500">
				<Info class="h-3 w-3 flex-shrink-0" />
				We may update this policy from time to time.
			</p>
		</div>
	{/snippet}

	{#snippet footer()}
		<div class="flex items-center justify-end">
			<button
				onclick={onClose}
				class="rounded-full border border-slate-700 bg-slate-800 px-6 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
			>
				Got it
			</button>
		</div>
	{/snippet}
</ModalWrapper>
