<script lang="ts">
	import * as Command from '$lib/components/ui/command';
	import type { ISODINStandard } from '$lib/data/standards';
	import { formatDesignations } from '$lib/data/standards';
	import { UI_TEXT } from '$lib/constants/ui-text';
	import StandardImage from './standard-image.svelte';
	import { fuzzyMatchDescription } from '$lib/utils/search-aliases';

	interface Props {
		/** Array of standards to search through */
		standards: ISODINStandard[];
		/** Callback when a standard is selected */
		onSelect: (standardId: string) => void;
		/** Optional search placeholder text */
		placeholder?: string;
	}

	let { standards, onSelect, placeholder = UI_TEXT.placeholders.searchStandards }: Props = $props();

	/**
	 * Custom filter function for standards search that prioritizes exact and substring matches
	 * and supports fuzzy matching with aliases (hex→hexagon, torx→hexalobular, etc.)
	 */
	function exactAndSubstringFilter(value: string, search: string, keywords?: string[]): number {
		if (!search) return 1;

		const searchLower = search.toLowerCase().trim();
		const valueLower = value.toLowerCase();

		// Combine value and keywords for searching
		const allSearchableText = [valueLower, ...(keywords || [])].map((text) => text.toLowerCase());

		// Find the best match score across all searchable fields
		let bestScore = 0;

		for (const text of allSearchableText) {
			let score = 0;

			// Exact match = highest priority (perfect match)
			if (text === searchLower) {
				score = 1.0;
			}
			// Starts with = high priority
			else if (text.startsWith(searchLower)) {
				score = 0.9;
			}
			// Check for exact word match in the text
			else {
				const words = text.split(/\s+/);
				if (words.includes(searchLower)) {
					score = 0.85;
				}
				// Contains as substring = medium priority
				else if (text.includes(searchLower)) {
					score = 0.7;
				}
				// Fuzzy match with aliases (hex→hexagon, torx→hexalobular, etc.)
				else if (fuzzyMatchDescription(searchLower, text)) {
					score = 0.6;
				}
			}

			// Keep track of the best score
			if (score > bestScore) {
				bestScore = score;
			}

			// Early exit if we found a perfect match
			if (bestScore === 1.0) {
				break;
			}
		}

		return bestScore;
	}
</script>

<Command.Root filter={exactAndSubstringFilter}>
	<Command.Input {placeholder} />
	<Command.Empty>{UI_TEXT.errors.noStandard}</Command.Empty>
	<Command.Group class="max-h-[300px] overflow-y-auto">
		{#each standards as standard (standard.id)}
			<Command.Item
				value={standard.id}
				keywords={[
					...standard.designations.map((d) => d.code),
					...standard.designations.map((d) => `${d.system} ${d.code}`),
					standard.description
				]}
				onSelect={() => onSelect(standard.id)}
				class="flex items-center justify-between"
			>
				<div class="flex flex-1 flex-col">
					<span>{formatDesignations(standard)}</span>
					<span class="text-xs text-muted-foreground">{standard.description}</span>
				</div>
				{#if standard.image}
					<StandardImage
						src={standard.image}
						alt={formatDesignations(standard)}
						class="ml-3 h-10 w-10 flex-shrink-0 object-contain"
					/>
				{/if}
			</Command.Item>
		{/each}
	</Command.Group>
</Command.Root>
