/**
 * Repoints `image` fields in src/lib/data/standards-generated.ts at the
 * generated catalog SVGs, for every shipped standard whose id is a key in
 * catalog/out/manifest.json.
 *
 * This is the "surgical" update prescribed by catalog/README.md — running
 * `pnpm standards:build` is NOT an alternative because it requires the
 * git-ignored data/dinmedia-*.json cache and produces a lossy dataset.
 *
 * Usage: node scripts/catalog-repoint-standards.mjs
 * Rerun after each catalog basket is integrated (catalog/integrate.py).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const manifestPath = resolve(root, 'catalog/out/manifest.json');
const generatedPath = resolve(root, 'src/lib/data/standards-generated.ts');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')).standards;
let source = readFileSync(generatedPath, 'utf8');

// The edits below rely on the generator's exact formatting (tab indentation,
// single quotes, entries closed by "\n\t}"). Bail out loudly if it changed.
if (
	!source.includes('GENERATED FILE - DO NOT EDIT') ||
	!/\n\t\{\n\t\tid: '/.test(source) ||
	!/ as HardwareType[,\n]/.test(source)
) {
	throw new Error('standards-generated.ts format changed — update this script before rerunning');
}

let repointed = 0;
let inserted = 0;

for (const [id, meta] of Object.entries(manifest)) {
	const idMarker = `\n\t\tid: '${id}',`;
	const start = source.indexOf(idMarker);
	if (start === -1) continue; // not a shipped standard

	// Entry blocks close at "\n\t}"; nested objects are indented deeper.
	const end = source.indexOf('\n\t}', start);
	if (end === -1) {
		throw new Error(`unterminated entry block for ${id}`);
	}

	const block = source.slice(start, end);
	const image = `/images/standards/${meta.svg}`;
	let next;
	if (/image: '[^']*'/.test(block)) {
		if (block.includes(`image: '${image}'`)) continue; // already current
		next = block.replace(/image: '[^']*'/, `image: '${image}'`);
		repointed++;
	} else {
		next = `${block},\n\t\timage: '${image}'`;
		inserted++;
	}
	source = source.slice(0, start) + next + source.slice(end);
}

// Pass 2: entries whose id has no manifest key but whose legacy png already
// shows another standard's drawing (image inherited via designation
// cross-reference, e.g. iso8678 -> din_603.png). Swapping that png for the
// SAME standard's svg is a like-for-like upgrade, not a new equivalence claim.
let bridged = 0;
source = source.replace(/image: '\/images\/standards\/([a-z0-9_.]+)\.png'/g, (full, base) => {
	const meta = manifest[base.replaceAll('_', '')];
	if (!meta) return full;
	bridged++;
	return `image: '/images/standards/${meta.svg}'`;
});

const withImages = (source.match(/image: '/g) ?? []).length;
source = source.replace(
	/^ \* Standards with images: \d+$/m,
	` * Standards with images: ${withImages}`
);

writeFileSync(generatedPath, source);
console.log(
	`repointed ${repointed}, inserted ${inserted}, bridged ${bridged}, total with images ${withImages}`
);
