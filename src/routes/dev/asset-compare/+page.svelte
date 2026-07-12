<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import Layers from '@lucide/svelte/icons/layers';
	import Blend from '@lucide/svelte/icons/blend';
	import DraftingCompass from '@lucide/svelte/icons/drafting-compass';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Link2 from '@lucide/svelte/icons/link-2';
	import X from '@lucide/svelte/icons/x';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let query = $state('');
	let activeFamily = $state('all');
	let showAliases = $state(false);
	let overlay = $state(false);
	let overlayMix = $state(55);

	const prettyFamily = (f: string) => f.replace(/_/g, ' ');

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return data.items.filter((item) => {
			if (!showAliases && item.aliasOf !== null) return false;
			if (activeFamily !== 'all' && item.family !== activeFamily) return false;
			if (!q) return true;
			return (
				item.id.toLowerCase().includes(q) ||
				item.family.toLowerCase().includes(q) ||
				item.source.toLowerCase().includes(q)
			);
		});
	});
</script>

<svelte:head>
	<title>Asset Comparison Lab · dev</title>
	<meta name="robots" content="noindex, nofollow" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,900&family=IBM+Plex+Mono:wght@300;400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="lab">
	<header class="titleblock">
		<div class="brand">
			<DraftingCompass size={30} strokeWidth={1.4} />
			<div>
				<h1>Asset Comparison Lab</h1>
				<p class="sub">
					legacy raster <span class="arrow">→</span> generated vector · washer catalog
				</p>
			</div>
		</div>

		<dl class="readout">
			<div>
				<dt>drawings</dt>
				<dd>{data.stats.distinct}</dd>
			</div>
			<div>
				<dt>aliases</dt>
				<dd>{data.stats.aliases}</dd>
			</div>
			<div>
				<dt>families</dt>
				<dd>{data.stats.families}</dd>
			</div>
			<div class:warn={data.stats.missingLegacy > 0}>
				<dt>no&nbsp;legacy</dt>
				<dd>{data.stats.missingLegacy}</dd>
			</div>
		</dl>
	</header>

	<div class="controls">
		<label class="field search">
			<Search size={16} strokeWidth={1.6} />
			<input type="text" placeholder="filter id · family · source" bind:value={query} />
			{#if query}
				<button class="clear" aria-label="clear search" onclick={() => (query = '')}>
					<X size={14} />
				</button>
			{/if}
		</label>

		<div class="families">
			<button class="chip" class:on={activeFamily === 'all'} onclick={() => (activeFamily = 'all')}>
				all
			</button>
			{#each data.families as fam (fam)}
				<button class="chip" class:on={activeFamily === fam} onclick={() => (activeFamily = fam)}>
					{prettyFamily(fam)}
				</button>
			{/each}
		</div>

		<div class="switches">
			<button class="toggle" class:on={showAliases} onclick={() => (showAliases = !showAliases)}>
				<Layers size={15} strokeWidth={1.7} /> aliases
			</button>
			<button class="toggle" class:on={overlay} onclick={() => (overlay = !overlay)}>
				<Blend size={15} strokeWidth={1.7} /> overlay
			</button>
			{#if overlay}
				<label class="mix" title="generated opacity over legacy">
					<input type="range" min="0" max="100" bind:value={overlayMix} />
					<span>{overlayMix}%</span>
				</label>
			{/if}
		</div>
	</div>

	<p class="count">
		showing <strong>{filtered.length}</strong> of {data.stats.total}
	</p>

	{#if filtered.length === 0}
		<div class="empty">
			<TriangleAlert size={22} strokeWidth={1.5} />
			<span>no assets match the current filter.</span>
		</div>
	{:else}
		<section class="grid">
			{#each filtered as item (item.id)}
				<article class="card">
					<div class="cardhead">
						<span class="id">{item.id}</span>
						{#if item.aliasOf}
							<span class="badge alias" title="reuses {item.aliasOf}'s drawing">
								<Link2 size={11} strokeWidth={2} />
								{item.aliasOf}
							</span>
						{/if}
						<span class="badge fam">{prettyFamily(item.family)}</span>
					</div>

					{#if overlay}
						<div class="panes single">
							<figure class="pane">
								<span class="tag">overlay</span>
								{#if item.legacyImage}
									<img class="base" src={item.legacyImage} alt="legacy {item.id}" loading="lazy" />
								{/if}
								<div class="over" style="opacity:{overlayMix / 100}">
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html item.svg}
								</div>
							</figure>
						</div>
					{:else}
						<div class="panes">
							<figure class="pane">
								<span class="tag">legacy · raster</span>
								{#if item.legacyImage}
									<img src={item.legacyImage} alt="legacy {item.id}" loading="lazy" />
								{:else}
									<div class="missing"><TriangleAlert size={18} strokeWidth={1.5} /> none</div>
								{/if}
							</figure>
							<figure class="pane">
								<span class="tag gen">generated · vector</span>
								<!-- eslint-disable-next-line svelte/no-at-html-tags -->
								{@html item.svg}
							</figure>
						</div>
					{/if}

					<p class="source" title={item.source}>{item.source}</p>
				</article>
			{/each}
		</section>
	{/if}
</div>

<style>
	.lab {
		--ink: #0b1a2b;
		--ink-2: #0f2136;
		--line: rgba(120, 190, 240, 0.14);
		--line-strong: rgba(120, 190, 240, 0.32);
		--paper: #f6f2e8;
		--paper-edge: #e4dcc8;
		--cyan: #4cc4f0;
		--amber: #f2b23a;
		--text: #d6e4f0;
		--muted: #7f97ad;

		min-height: 100vh;
		padding: 2rem clamp(1rem, 4vw, 3.5rem) 5rem;
		background-color: var(--ink);
		background-image:
			linear-gradient(var(--line) 1px, transparent 1px),
			linear-gradient(90deg, var(--line) 1px, transparent 1px),
			radial-gradient(circle at 78% -8%, rgba(76, 196, 240, 0.12), transparent 46%);
		background-size:
			26px 26px,
			26px 26px,
			100% 100%;
		color: var(--text);
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
	}

	/* ---- title block ---- */
	.titleblock {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1.5rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid var(--line-strong);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 1rem;
		color: var(--cyan);
	}
	.brand h1 {
		margin: 0;
		font-family: 'Fraunces', Georgia, serif;
		font-optical-sizing: auto;
		font-weight: 900;
		font-size: clamp(1.7rem, 3.4vw, 2.7rem);
		line-height: 0.95;
		letter-spacing: -0.01em;
		color: var(--paper);
	}
	.sub {
		margin: 0.35rem 0 0;
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.sub .arrow {
		color: var(--amber);
		padding: 0 0.15em;
	}

	.readout {
		display: flex;
		gap: 0;
		margin: 0;
		border: 1px solid var(--line-strong);
	}
	.readout > div {
		padding: 0.5rem 1.05rem;
		border-left: 1px solid var(--line-strong);
	}
	.readout > div:first-child {
		border-left: none;
	}
	.readout dt {
		font-size: 0.6rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.readout dd {
		margin: 0.15rem 0 0;
		font-size: 1.4rem;
		font-weight: 600;
		color: var(--cyan);
	}
	.readout .warn dd {
		color: var(--amber);
	}

	/* ---- controls ---- */
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1.5rem;
		margin-top: 1.5rem;
	}
	.field {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		min-width: 260px;
		background: var(--ink-2);
		border: 1px solid var(--line-strong);
		color: var(--muted);
	}
	.field input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text);
		font-family: inherit;
		font-size: 0.85rem;
		letter-spacing: 0.03em;
	}
	.field input::placeholder {
		color: var(--muted);
	}
	.clear {
		display: flex;
		background: none;
		border: none;
		color: var(--muted);
		cursor: pointer;
		padding: 0;
	}
	.clear:hover {
		color: var(--amber);
	}

	.families {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.chip {
		padding: 0.32rem 0.65rem;
		background: transparent;
		border: 1px solid var(--line-strong);
		color: var(--muted);
		font-family: inherit;
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
	}
	.chip:hover {
		color: var(--text);
		border-color: var(--cyan);
	}
	.chip.on {
		color: var(--ink);
		background: var(--cyan);
		border-color: var(--cyan);
		font-weight: 600;
	}

	.switches {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.42rem 0.75rem;
		background: var(--ink-2);
		border: 1px solid var(--line-strong);
		color: var(--muted);
		font-family: inherit;
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s;
	}
	.toggle:hover {
		color: var(--text);
	}
	.toggle.on {
		color: var(--amber);
		border-color: var(--amber);
	}
	.mix {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.72rem;
		color: var(--amber);
	}
	.mix input {
		accent-color: var(--amber);
		width: 90px;
	}
	.mix span {
		min-width: 2.6ch;
	}

	.count {
		margin: 1.4rem 0 0.9rem;
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.count strong {
		color: var(--cyan);
	}

	.empty {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 3rem;
		justify-content: center;
		color: var(--muted);
		border: 1px dashed var(--line-strong);
	}

	/* ---- grid + cards ---- */
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.1rem;
	}
	.card {
		display: flex;
		flex-direction: column;
		background: var(--ink-2);
		border: 1px solid var(--line-strong);
		transition:
			transform 0.14s ease,
			border-color 0.14s ease,
			box-shadow 0.14s ease;
	}
	.card:hover {
		transform: translateY(-3px);
		border-color: var(--cyan);
		box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.7);
	}
	.cardhead {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid var(--line);
	}
	.id {
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--paper);
	}
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.12rem 0.42rem;
		font-size: 0.6rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		border: 1px solid var(--line-strong);
		color: var(--muted);
	}
	.badge.fam {
		margin-left: auto;
		color: var(--cyan);
		border-color: rgba(76, 196, 240, 0.35);
	}
	.badge.alias {
		color: var(--amber);
		border-color: rgba(242, 178, 58, 0.4);
	}

	.panes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		background: var(--line);
	}
	.panes.single {
		grid-template-columns: 1fr;
	}
	.pane {
		position: relative;
		margin: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.4rem 1.1rem 1.1rem;
		aspect-ratio: 4 / 3;
		background:
			linear-gradient(var(--paper), var(--paper)) padding-box,
			repeating-linear-gradient(45deg, var(--paper-edge) 0 2px, transparent 2px 9px) border-box;
		overflow: hidden;
	}
	.tag {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		font-size: 0.55rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #9c8f6f;
	}
	.tag.gen {
		color: #2f7fa0;
	}
	.pane :global(svg),
	.pane img {
		display: block;
		width: 100%;
		height: 100%;
		max-height: 100%;
		object-fit: contain;
	}
	.pane .base {
		position: absolute;
		inset: 1.4rem 1.1rem 1.1rem;
		width: auto;
		height: auto;
		max-width: calc(100% - 2.2rem);
		max-height: calc(100% - 2.5rem);
		margin: auto;
	}
	.over {
		position: absolute;
		inset: 1.4rem 1.1rem 1.1rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.over :global(svg) {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.missing {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #b8a06a;
	}

	.source {
		margin: 0;
		padding: 0.55rem 0.75rem;
		font-size: 0.66rem;
		line-height: 1.4;
		color: var(--muted);
		border-top: 1px solid var(--line);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
