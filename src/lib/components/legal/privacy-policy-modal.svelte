<script lang="ts">
	import Database from '@lucide/svelte/icons/database';
	import Scissors from '@lucide/svelte/icons/scissors';
	import Activity from '@lucide/svelte/icons/activity';
	import Cookie from '@lucide/svelte/icons/cookie';
	import Link from '@lucide/svelte/icons/link';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import Building2 from '@lucide/svelte/icons/building-2';
	import Server from '@lucide/svelte/icons/server';
	import Lock from '@lucide/svelte/icons/lock';
	import Info from '@lucide/svelte/icons/info';
	import ModalWrapper from '$lib/components/shared/modal-wrapper.svelte';
	import {
		isAnalyticsEnabled,
		isAffiliateEnabled,
		getContactEmail,
		getDataController
	} from '$lib/config/deployment';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open = $bindable(), onClose }: Props = $props();

	// Render only claims that are true for THIS deployment.
	const analyticsEnabled = isAnalyticsEnabled();
	const affiliateEnabled = isAffiliateEnabled();
	const contactEmail = getContactEmail();
	const dataController = getDataController();
</script>

{#snippet section(title: string, icon: typeof Database)}
	{@const Icon = icon}
	<h3 class="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-200">
		<Icon class="h-3.5 w-3.5 text-slate-400" />
		{title}
	</h3>
{/snippet}

{#snippet bullet(text: string)}
	<li class="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
		<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600"></span>
		<span>{text}</span>
	</li>
{/snippet}

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
			<!-- Intro -->
			<p class="text-xs leading-relaxed text-slate-400">
				Gridfinity Label Generator is designed to keep your data on your device. This policy
				explains the few cases where data leaves your browser and how this instance handles it.
			</p>

			<!-- What we process -->
			<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
				{@render section('1. What we process', Database)}
				<p class="text-xs leading-relaxed text-slate-400">
					Your label content — text, custom images, layout and settings — is processed entirely in
					your browser. It is not uploaded to or stored on any server. The only exception is the
					optional QR-code shortening described below.
				</p>
			</div>

			<!-- URL shortening (always present — the feature ships with the app) -->
			<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
				{@render section('2. QR code URL shortening', Scissors)}
				<p class="text-xs leading-relaxed text-slate-400">
					When you add a QR code with a URL longer than 50 characters, that URL is sent to this
					instance's server and then to a third-party shortening service to create a shorter link:
				</p>
				<ul class="mt-2 space-y-2">
					{@render bullet(
						'The URL is forwarded to is.gd (primary) or tinyurl.com (fallback). These providers are outside the EU and have their own privacy policies.'
					)}
					{@render bullet(
						'Your IP address is used transiently (kept only in memory, for a short window) to rate-limit requests and prevent abuse. It is not stored long-term.'
					)}
					{@render bullet(
						'Short QR URLs (50 characters or fewer) are encoded directly in your browser and are never sent anywhere.'
					)}
				</ul>
			</div>

			<!-- Analytics (only if configured) -->
			{#if analyticsEnabled}
				<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
					{@render section('3. Analytics', Activity)}
					<p class="text-xs leading-relaxed text-slate-400">
						This instance uses Matomo analytics to understand feature usage:
					</p>
					<ul class="mt-2 space-y-2">
						{@render bullet('Cookieless — no tracking cookies are set.')}
						{@render bullet('The "Do Not Track" browser setting is respected.')}
						{@render bullet(
							'IP addresses are anonymized where the analytics server is configured to do so.'
						)}
					</ul>
				</div>
			{:else}
				<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
					{@render section('3. Analytics', Activity)}
					<p class="text-xs leading-relaxed text-slate-400">
						This instance does not use analytics or any usage tracking.
					</p>
				</div>
			{/if}

			<!-- Cookies & local storage -->
			<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
				{@render section('4. Cookies and local storage', Cookie)}
				<p class="text-xs leading-relaxed text-slate-400">
					<strong class="font-medium text-slate-300">No cookies are used for tracking.</strong> Your
					batch labels and settings may be saved in your browser's local storage. This data stays on
					your device and can be cleared at any time through your browser settings.
				</p>
			</div>

			<!-- Affiliate (only if configured) -->
			{#if affiliateEnabled}
				<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
					{@render section('5. Affiliate links (Amazon Associates)', Link)}
					<p class="text-xs leading-relaxed text-slate-400">
						This instance participates in the Amazon Services LLC Associates Program. When you click
						an Amazon link you leave this site for Amazon, which may collect data and set cookies
						per their own privacy policy. We may earn a commission from qualifying purchases at no
						extra cost to you.
					</p>
				</div>
			{/if}

			<!-- Rights -->
			<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
				{@render section('6. Your rights (GDPR)', UserCheck)}
				<p class="text-xs leading-relaxed text-slate-400">You have the right to:</p>
				<ul class="mt-2 space-y-2">
					{@render bullet('Access information held about you')}
					{@render bullet('Request correction or deletion of your data')}
					{@render bullet('Object to processing based on legitimate interests')}
					{@render bullet('Lodge a complaint with a supervisory authority')}
				</ul>
				<p class="mt-2 text-xs leading-relaxed text-slate-400">
					Because analytics (if enabled) is cookieless and anonymized, we may not be able to
					identify your specific data.
				</p>
			</div>

			<!-- Retention -->
			<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
				{@render section('7. Data retention', Server)}
				<ul class="mt-1 space-y-2">
					{@render bullet('Label data: not retained on any server (processed in your browser).')}
					{@render bullet(
						'Rate-limiting IP data: held only in memory for a short window, then discarded.'
					)}
					{@render bullet(
						'Analytics data (if enabled): retained according to this instance operator’s Matomo configuration.'
					)}
				</ul>
			</div>

			<!-- Security -->
			<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
				{@render section('8. Data security', Lock)}
				<p class="text-xs leading-relaxed text-slate-400">
					Label data is processed locally and, apart from QR shortening, does not leave your device.
					Production deployments are served over HTTPS. Any analytics data is stored on the
					operator's own Matomo server.
				</p>
			</div>

			<!-- Controller & contact -->
			<div class="rounded-xl border border-slate-800/50 bg-slate-950/50 p-5">
				{@render section('9. Data controller and contact', Building2)}
				{#if dataController || contactEmail}
					<p class="text-xs leading-relaxed text-slate-400">
						{#if dataController}
							The data controller for this instance is
							<strong class="font-medium text-slate-300">{dataController}</strong>.
						{/if}
						{#if contactEmail}
							For privacy questions, contact
							<a href="mailto:{contactEmail}" class="text-cyan-400 hover:underline"
								>{contactEmail}</a
							>.
						{/if}
					</p>
				{:else}
					<p class="text-xs leading-relaxed text-slate-400">
						This is a self-hosted instance. The operator of this deployment is the data controller
						and is responsible for this policy and for providing a contact method.
					</p>
				{/if}
			</div>

			<!-- Self-hoster / changes note -->
			<p class="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-500">
				<Info class="mt-0.5 h-3 w-3 flex-shrink-0" />
				<span>
					This policy reflects the features enabled on this instance and may be updated over time.
					If you self-host this project, review and adapt this policy for your own deployment.
				</span>
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
