// Dev-only asset comparison lab.
//
// Loads every generated catalog drawing (catalog/out/manifest.json + the inlined
// SVG source) and pairs it with the raster the app shipped before vectorization
// (data/legacy-image-mappings.json). The page renders the two side by side so a
// maintainer can eyeball how faithful each generated vector is to the raster it
// replaced.
//
// The legacy column deliberately reads the frozen snapshot, not the live
// data/image-mappings.json: catalog/integrate.py repoints the live file at the
// generated SVGs, so using it here would compare each drawing with itself.
//
// The route is already gated to dev by the parent src/routes/dev/+layout.server.ts,
// but we re-assert it here so the filesystem reads below never run in production.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// process.cwd() is the project root under the Node adapter, which is all this
// dev-only route runs on (it 404s in production and never sees edge/serverless).
const ROOT = process.cwd();
const MANIFEST = join(ROOT, 'catalog', 'out', 'manifest.json');
const CATALOG_OUT = join(ROOT, 'catalog', 'out');
const IMAGE_MAPPINGS = join(ROOT, 'data', 'image-mappings.json');
const LEGACY_IMAGE_MAPPINGS = join(ROOT, 'data', 'legacy-image-mappings.json');
const SHIPPED_STANDARDS = join(ROOT, 'src', 'lib', 'data', 'standards-generated.ts');

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
	/** Whether the shipped dataset actually serves this drawing to users. */
	served: boolean;
	hardwareType: string | null;
}

function stripXmlProlog(svg: string): string {
	return svg.replace(/^\s*<\?xml[^>]*\?>\s*/i, '').trim();
}

function readComparison() {
	const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8')).standards as Record<
		string,
		ManifestEntry
	>;
	const current = JSON.parse(readFileSync(IMAGE_MAPPINGS, 'utf-8')) as Record<string, LegacyEntry>;
	// Which drawings reach a user. Not the same question as "is this key mapped":
	// image-mappings.json is repointed for every manifest key the moment the SVG is
	// copied, so reading it here badged all 247, and more than half of those keys
	// are not ids the app knows at all — the DIN and ISO forms of one fastener are
	// a single shipped standard, so din931 rides along inside iso4014. The shipped
	// dataset is the only place that says what is really drawn.
	const servedFiles = new Set(
		[
			...readFileSync(SHIPPED_STANDARDS, 'utf-8').matchAll(/image: '\/images\/standards\/([^']+)'/g)
		].map((match) => match[1])
	);
	const legacy = JSON.parse(readFileSync(LEGACY_IMAGE_MAPPINGS, 'utf-8')) as Record<
		string,
		LegacyEntry
	>;

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
			served: servedFiles.has(entry.svg),
			hardwareType: current[id]?.hardwareType ?? legacy[id]?.hardwareType ?? null
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
}

export const load: PageServerLoad = async () => {
	if (!dev) {
		error(404, 'Not Found');
	}
	try {
		return readComparison();
	} catch (e) {
		// The catalog output is likely missing (deleted or never generated). Give a
		// maintainer a clear next step instead of a raw filesystem stack trace.
		error(
			500,
			`Could not load catalog assets: ${(e as Error).message}. ` +
				'Run `./catalog/run python -m catalog.build_catalog` to (re)generate them.'
		);
	}
};
