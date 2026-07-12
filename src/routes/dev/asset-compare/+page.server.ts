// Dev-only asset comparison lab.
//
// Loads every generated catalog drawing (catalog/out/manifest.json + the inlined
// SVG source) and pairs it with the legacy raster image the app ships today
// (data/image-mappings.json). The page renders the two side by side so a
// maintainer can eyeball how faithful each generated vector is to the raster it
// is meant to replace.
//
// The route is already gated to dev by the parent src/routes/dev/+layout.server.ts,
// but we re-assert it here so the filesystem reads below never run in production.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const ROOT = process.cwd();
const MANIFEST = join(ROOT, 'catalog', 'out', 'manifest.json');
const CATALOG_OUT = join(ROOT, 'catalog', 'out');
const IMAGE_MAPPINGS = join(ROOT, 'data', 'image-mappings.json');

interface ManifestEntry {
	family: string;
	source: string;
	svg: string;
	sha256: string;
	alias_of?: string;
}

interface LegacyEntry {
	image: string;
	hardwareType: string;
}

export interface ComparisonItem {
	id: string;
	family: string;
	source: string;
	aliasOf: string | null;
	/** Inlined generated SVG markup (XML prolog stripped). */
	svg: string;
	/** Public URL of the legacy raster, served from static/. */
	legacyImage: string | null;
	hardwareType: string | null;
}

function stripXmlProlog(svg: string): string {
	return svg.replace(/^\s*<\?xml[^>]*\?>\s*/i, '').trim();
}

export const load: PageServerLoad = async () => {
	if (!dev) {
		error(404, 'Not Found');
	}

	const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8')).standards as Record<
		string,
		ManifestEntry
	>;
	const legacy = JSON.parse(readFileSync(IMAGE_MAPPINGS, 'utf-8')) as Record<string, LegacyEntry>;

	// One SVG file can back several manifest keys (aliases reuse the base drawing),
	// so cache reads by filename to avoid re-reading the same file 26 times.
	const svgCache = new Map<string, string>();
	const readSvg = (file: string): string => {
		const cached = svgCache.get(file);
		if (cached !== undefined) return cached;
		const markup = stripXmlProlog(readFileSync(join(CATALOG_OUT, file), 'utf-8'));
		svgCache.set(file, markup);
		return markup;
	};

	const items: ComparisonItem[] = Object.entries(manifest)
		.map(([id, entry]) => ({
			id,
			family: entry.family,
			source: entry.source,
			aliasOf: entry.alias_of ?? null,
			svg: readSvg(entry.svg),
			legacyImage: legacy[id]?.image ?? null,
			hardwareType: legacy[id]?.hardwareType ?? null
		}))
		.sort((a, b) => a.id.localeCompare(b.id));

	const families = [...new Set(items.map((i) => i.family))].sort();
	const distinctCount = items.filter((i) => i.aliasOf === null).length;
	const aliasCount = items.length - distinctCount;

	return {
		items,
		families,
		stats: {
			total: items.length,
			distinct: distinctCount,
			aliases: aliasCount,
			families: families.length,
			missingLegacy: items.filter((i) => i.legacyImage === null).length
		}
	};
};
